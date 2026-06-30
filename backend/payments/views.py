import logging
import uuid
from datetime import date
from decimal import Decimal

import requests as http_requests

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from properties.models import Lease
from users.activity import log_activity
from users.mpesa_config import get_mpesa_config_for_lease
from users.models import OrganizationMpesaConfig
from users.permissions import IsManager, IsOrgOwnerOnly, IsTenant
from users.tenancy import organization_filter
from users.throttling import PaymentInitiateThrottle
from users.utils import get_pm_id

from .integrity import get_org_integrity_alerts
from .models import Payment
from .mpesa import MpesaService
from .receipt import generate_invoice_pdf
from .serializers import InitiatePaymentSerializer, InvoiceSerializer, PaymentSerializer
from .services import get_org_arrears, month_start, resolve_month_paid, send_payment_reminder
from .wallet import (
    get_or_create_wallet,
    get_wallet_summary,
    preview_payment_allocation,
    process_completed_payment,
)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer

    def get_permissions(self):
        if self.action == 'generate_invoices':
            return [IsOrgOwnerOnly()]
        if self.action == 'remind':
            return [IsManager()]
        if self.action == 'integrity_alerts':
            return [IsOrgOwnerOnly()]
        return [IsManager()]

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.select_related(
            'tenant__user', 'lease__unit__property',
        )
        if user.role == 'MANAGER':
            qs = qs.filter(
                **organization_filter(user, 'lease__unit__property__manager__property_manager_id'),
            )
        elif user.role == 'TENANT':
            try:
                qs = qs.filter(tenant=user.tenant_profile)
            except Exception:
                qs = qs.none()
        else:
            qs = qs.none()

        month = self.request.query_params.get('month')
        if month:
            try:
                year, mon = month.split('-')
                qs = qs.filter(month_paid__year=int(year), month_paid__month=int(mon))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=['get'], permission_classes=[IsManager])
    def summary(self, request):
        qs = self.get_queryset().filter(status=Payment.Status.COMPLETED)
        month = request.query_params.get('month')
        if month:
            try:
                year, mon = month.split('-')
                qs = qs.filter(month_paid__year=int(year), month_paid__month=int(mon))
            except ValueError:
                pass

        monthly_data = {}
        for payment in qs:
            key = payment.month_paid.strftime('%Y-%m')
            monthly_data[key] = monthly_data.get(key, 0) + float(payment.amount)

        chart_data = [{'month': k, 'total': v} for k, v in sorted(monthly_data.items())]
        return Response({
            'total_collected': sum(monthly_data.values()),
            'payment_count': qs.count(),
            'chart_data': chart_data,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsManager], url_path='arrears')
    def arrears(self, request):
        pm_id = get_pm_id(request.user)
        return Response(get_org_arrears(pm_id))

    @action(detail=False, methods=['post'], permission_classes=[IsManager], url_path='remind')
    def remind(self, request):
        lease_id = request.data.get('lease_id')
        try:
            lease = Lease.objects.get(
                id=lease_id,
                **organization_filter(request.user, 'unit__property__manager__property_manager_id'),
                is_active=True,
            )
        except Lease.DoesNotExist:
            return Response({'detail': 'Lease not found.'}, status=status.HTTP_404_NOT_FOUND)

        reminder = send_payment_reminder(lease)
        if not reminder:
            return Response({'detail': 'No arrears for this lease.'}, status=status.HTTP_400_BAD_REQUEST)
        log_activity(request.user, 'reminder_sent', lease.tenant.user.username, f'lease:{lease.id}')
        return Response({
            'message': reminder.message,
            'sent_at': reminder.sent_at.isoformat(),
            'sms_sent': reminder.sms_sent,
            'whatsapp_link': reminder.whatsapp_link,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsOrgOwnerOnly], url_path='integrity-alerts')
    def integrity_alerts(self, request):
        pm_id = get_pm_id(request.user)
        return Response(get_org_integrity_alerts(pm_id))

    @action(detail=False, methods=['get'], permission_classes=[IsManager])
    def invoices(self, request):
        from .models import Invoice
        qs = Invoice.objects.filter(
            **organization_filter(request.user, 'lease__unit__property__manager__property_manager_id'),
        ).select_related('lease__tenant__user', 'lease__unit__property')
        return Response(InvoiceSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'], permission_classes=[IsManager], url_path='generate-invoices')
    def generate_invoices(self, request):
        from .models import Invoice
        today = date.today()
        invoice_month = date(today.year, today.month, 1)
        created = []

        leases = Lease.objects.filter(
            is_active=True,
            **organization_filter(request.user, 'unit__property__manager__property_manager_id'),
        ).select_related('tenant__user', 'unit__property')

        for lease in leases:
            from .wallet import is_month_fully_paid
            if is_month_fully_paid(lease, invoice_month):
                continue
            invoice, is_new = Invoice.objects.get_or_create(
                lease=lease,
                month=invoice_month,
                defaults={'amount': lease.rent_amount},
            )
            if is_new or not invoice.invoice_pdf:
                pdf_path = generate_invoice_pdf(lease, invoice_month, lease.rent_amount)
                invoice.invoice_pdf = pdf_path
                invoice.save()
            created.append(invoice)

        log_activity(request.user, 'invoices_generated', f'{len(created)} invoices', invoice_month.isoformat())
        return Response(
            InvoiceSerializer(created, many=True, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class InitiatePaymentView(APIView):
    permission_classes = [IsTenant]
    throttle_classes = [PaymentInitiateThrottle]

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        try:
            tenant = user.tenant_profile
        except Exception:
            return Response({'detail': 'Tenant profile not found.'}, status=status.HTTP_400_BAD_REQUEST)
        lease_id = serializer.validated_data['lease_id']
        amount = serializer.validated_data['amount']
        phone_number = serializer.validated_data['phone_number']

        try:
            lease = Lease.objects.get(id=lease_id, tenant=tenant, is_active=True)
        except Lease.DoesNotExist:
            return Response({'detail': 'Lease not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(amount))
        if amount <= 0:
            return Response({'detail': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response(
                {
                    'detail': (
                        'This landlord accepts manual Paybill/Till payments. '
                        'Use the payment details provided by your property manager.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
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
            logging.getLogger(__name__).exception('STK push network error: %s', exc)
            return Response(
                {'detail': 'Payment gateway unavailable. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not result.get('success') and not result.get('simulated'):
            payment.status = Payment.Status.FAILED
            payment.save()
            return Response(
                {'detail': result.get('response_description', 'STK push failed.')},
                status=status.HTTP_502_BAD_GATEWAY,
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

        return Response({
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
        }, status=status.HTTP_201_CREATED)


class PaymentStatusView(APIView):
    permission_classes = [IsTenant]

    def get(self, request, pk):
        user = request.user
        try:
            payment = Payment.objects.get(id=pk, tenant__user=user)
        except Payment.DoesNotExist:
            return Response({'detail': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PaymentSerializer(payment, context={'request': request}).data)


class WalletView(APIView):
    permission_classes = [IsTenant]

    def get(self, request):
        user = request.user
        try:
            tenant_profile = user.tenant_profile
        except Exception:
            return Response({'detail': 'Tenant profile not found.'}, status=status.HTTP_400_BAD_REQUEST)

        wallet, transactions = get_wallet_summary(tenant_profile)
        from .serializers import WalletSerializer, WalletTransactionSerializer
        return Response({
            'wallet': WalletSerializer(wallet).data,
            'transactions': WalletTransactionSerializer(transactions, many=True).data,
        })


class MpesaCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        callback_secret = getattr(settings, 'MPESA_CALLBACK_SECRET', '')
        if callback_secret:
            provided = request.headers.get('X-MPESA-Callback-Secret', '')
            if provided != callback_secret:
                return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        elif not settings.DEBUG:
            # In production the secret is mandatory; reject unauthenticated callbacks.
            import logging
            logging.getLogger(__name__).error(
                'MPESA_CALLBACK_SECRET is not set. All M-PESA callbacks are being rejected. '
                'Set this value in your production environment.'
            )
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        mpesa = MpesaService()
        parsed = mpesa.parse_callback(request.data)

        checkout_id = parsed.get('checkout_request_id')
        if not checkout_id:
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        with transaction.atomic():
            try:
                payment = Payment.objects.select_for_update().get(checkout_request_id=checkout_id)
            except Payment.DoesNotExist:
                return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

            if payment.status == Payment.Status.COMPLETED:
                return Response({'ResultCode': 0, 'ResultDesc': 'Already processed'})

            if parsed['success']:
                callback_amount = parsed.get('amount')
                if callback_amount is not None and Decimal(str(callback_amount)) != payment.amount:
                    payment.status = Payment.Status.FAILED
                    payment.save(update_fields=['status'])
                    return Response({'ResultCode': 0, 'ResultDesc': 'Amount mismatch'})

                payment.status = Payment.Status.COMPLETED
                payment.mpesa_receipt_number = parsed.get('mpesa_receipt_number', '')
                payment.payment_date = timezone.now()
                payment.save()
                process_completed_payment(payment)
                from .tasks import generate_receipt_pdf_task
                generate_receipt_pdf_task.delay(payment.id)
                org_user = payment.lease.unit.property.manager
                log_activity(
                    org_user, 'payment_completed',
                    f'KES {payment.amount} from {payment.tenant.user.username}',
                    f'payment:{payment.id}',
                )
            else:
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=['status'])

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})
