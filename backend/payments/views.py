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
from users.permissions import IsManager, IsOrgOwnerOnly, IsTenant
from users.tenancy import organization_filter
from users.throttling import PaymentInitiateThrottle
from users.utils import get_pm_id

from .initiation import PaymentInitiationError, initiate_stk_payment
from .integrity import get_org_integrity_alerts
from .models import Payment
from .mpesa import MpesaService
from .receipt import generate_invoice_pdf
from .serializers import InitiatePaymentSerializer, InvoiceSerializer, PaymentSerializer
from .services import get_org_arrears, send_payment_reminder
from .wallet import get_wallet_summary


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
        if not hasattr(user, 'tenant_profile'):
            return Response({'detail': 'Tenant profile not found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = initiate_stk_payment(
                tenant=user.tenant_profile,
                lease_id=serializer.validated_data['lease_id'],
                amount=serializer.validated_data['amount'],
                phone_number=serializer.validated_data['phone_number'],
            )
        except PaymentInitiationError as exc:
            return Response({'detail': exc.detail}, status=exc.status_code)

        return Response(payload, status=status.HTTP_201_CREATED)


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
