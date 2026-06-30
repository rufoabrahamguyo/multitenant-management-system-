from decimal import Decimal

from django.db.models import Sum

from .models import Payment
from .wallet import get_month_rent_covered


def get_payment_integrity_flags(payment):
    flags = []
    lease = payment.lease
    tenant = payment.tenant

    if payment.status == Payment.Status.COMPLETED:
        if payment.rent_applied + payment.wallet_applied != payment.amount:
            flags.append({
                'code': 'allocation_mismatch',
                'severity': 'high',
                'message': 'Payment amount does not match rent and wallet allocation.',
            })

        month_covered = get_month_rent_covered(lease, payment.month_paid)
        if month_covered > lease.rent_amount:
            flags.append({
                'code': 'overpaid_month',
                'severity': 'medium',
                'message': f'{payment.month_paid.strftime("%B %Y")} has more than the monthly rent recorded.',
            })

    if payment.pay_phone_number and tenant.phone_number:
        normalized_pay = payment.pay_phone_number.replace(' ', '')[-9:]
        normalized_tenant = tenant.phone_number.replace(' ', '')[-9:]
        if normalized_pay != normalized_tenant:
            flags.append({
                'code': 'unregistered_phone',
                'severity': 'medium',
                'message': f'Payment phone {payment.pay_phone_number} differs from tenant M-PESA number.',
            })

    return flags


def get_org_integrity_alerts(pm_id):
    payments = Payment.objects.filter(
        lease__unit__property__manager__property_manager_id=pm_id,
    ).select_related('tenant', 'lease__unit__property').order_by('-created_at')[:100]

    alerts = []
    for payment in payments:
        flags = get_payment_integrity_flags(payment)
        if flags:
            alerts.append({
                'payment_id': payment.id,
                'tenant_name': payment.tenant.user.get_full_name() or payment.tenant.user.username,
                'property_name': payment.lease.unit.property.name,
                'unit_number': payment.lease.unit.unit_number,
                'amount': float(payment.amount),
                'month_paid': payment.month_paid.isoformat(),
                'status': payment.status,
                'flags': flags,
            })
    return alerts
