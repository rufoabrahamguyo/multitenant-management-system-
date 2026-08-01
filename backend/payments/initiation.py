"""STK payment initiation orchestration (keeps InitiatePaymentView thin)."""

import logging
import uuid
from datetime import date
from decimal import Decimal

import requests as http_requests
from django.utils import timezone

from properties.models import Lease
from users.activity import log_activity
from users.mpesa_config import get_mpesa_config_for_lease
from users.models import OrganizationMpesaConfig

from .models import Payment
from .mpesa import MpesaService
from .services import month_start, resolve_month_paid
from .wallet import get_or_create_wallet, preview_payment_allocation, process_completed_payment

logger = logging.getLogger(__name__)


class PaymentInitiationError(Exception):
    """Domain error with HTTP status and response body for the view layer."""

    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def initiate_stk_payment(*, tenant, lease_id, amount, phone_number):
    """
    Create a pending Payment and trigger M-PESA STK (or simulate when unconfigured).

    Returns a dict suitable for the API response body.
    Raises PaymentInitiationError for client/gateway failures.
    """
    try:
        lease = Lease.objects.get(id=lease_id, tenant=tenant, is_active=True)
    except Lease.DoesNotExist as exc:
        raise PaymentInitiationError('Lease not found.', status_code=404) from exc

    amount = Decimal(str(amount))
    if amount <= 0:
        raise PaymentInitiationError('Amount must be greater than zero.')

    today = date.today()
    current_month = month_start(today)
    oldest_unpaid = resolve_month_paid(lease, preferred=current_month)
    if oldest_unpaid is None or oldest_unpaid > current_month:
        wallet_only = True
        month_paid = current_month
    else:
        wallet_only = False
        month_paid = oldest_unpaid

    allocation = preview_payment_allocation(lease, month_paid, amount)
    wallet = get_or_create_wallet(tenant)

    mpesa_config = get_mpesa_config_for_lease(lease)
    if mpesa_config and mpesa_config.channel != OrganizationMpesaConfig.Channel.STK:
        raise PaymentInitiationError(
            'This landlord accepts manual Paybill/Till payments. '
            'Use the payment details provided by your property manager.',
        )

    prefix = (mpesa_config.account_number.strip() if mpesa_config else '') or ''
    account_reference = f'{prefix}RENT-{lease.id}' if prefix else f'RENT-{lease.id}'

    payment = Payment.objects.create(
        tenant=tenant,
        lease=lease,
        amount=amount,
        month_paid=month_paid,
        status=Payment.Status.PENDING,
        transaction_id=str(uuid.uuid4()),
        pay_phone_number=phone_number,
    )

    mpesa = MpesaService.from_org_config(mpesa_config)
    try:
        result = mpesa.stk_push(
            phone_number=phone_number,
            amount=amount,
            account_reference=account_reference,
            transaction_desc=f'Rent payment for {lease.unit.unit_number}',
        )
    except http_requests.RequestException as exc:
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=['status'])
        logger.exception('STK push network error: %s', exc)
        raise PaymentInitiationError(
            'Payment gateway unavailable. Please try again.',
            status_code=502,
        ) from exc

    if not result.get('success') and not result.get('simulated'):
        payment.status = Payment.Status.FAILED
        payment.save()
        raise PaymentInitiationError(
            result.get('response_description', 'STK push failed.'),
            status_code=502,
        )

    payment.checkout_request_id = result.get('checkout_request_id', '')
    if result.get('transaction_id'):
        payment.transaction_id = result['transaction_id']
    payment.save()

    if result.get('simulated'):
        payment.status = Payment.Status.COMPLETED
        payment.mpesa_receipt_number = f'SIM{payment.id:06d}'
        payment.payment_date = timezone.now()
        payment.save()
        process_completed_payment(payment)
        from .tasks import generate_receipt_pdf_task
        generate_receipt_pdf_task.delay(payment.id)
        org_user = lease.unit.property.manager
        log_activity(
            org_user, 'payment_completed',
            f'KES {payment.amount} from {tenant.user.username}',
            f'payment:{payment.id}',
        )

    wallet.refresh_from_db()
    message = 'Check your phone for STK prompt.'
    if result.get('simulated'):
        message = 'Payment simulated successfully.'
    elif wallet_only:
        message = 'Check your phone for STK prompt. This payment will be added to your wallet.'
    elif allocation['wallet_credit'] > 0:
        message = (
            f'Check your phone for STK prompt. KES {allocation["rent_applied"]} will cover '
            f'{month_paid.strftime("%B %Y")} and KES {allocation["wallet_credit"]} will go to your wallet.'
        )

    return {
        'payment_id': payment.id,
        'checkout_request_id': payment.checkout_request_id,
        'month_paid': month_paid.isoformat(),
        'wallet_only': wallet_only,
        'rent_applied': str(allocation['rent_applied']),
        'wallet_credit': str(allocation['wallet_credit']),
        'wallet_balance': str(wallet.balance),
        'message': message,
        'simulated': result.get('simulated', False),
        'status': payment.status,
    }
