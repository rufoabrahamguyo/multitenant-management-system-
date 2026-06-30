from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from properties.models import Lease, TenantProfile
from users.activity import log_activity
from users.governance import log_owner_alert, log_sensitive_access
from users.models import OwnerAlert
from users.permissions import IsManager, IsOrgOwnerForWrite, IsOrgOwnerOnly

from propizy.storage_utils import media_url
from users.tenancy import belongs_to_organization, organization_filter
from users.utils import get_organization, get_pm_id, is_org_owner

from .advanced_serializers import (
    CashCollectionCreateSerializer,
    CashCollectionSerializer,
    EvidenceSnapshotSerializer,
    UtilityChargeSerializer,
)
from .documents import generate_dispute_pack_pdf
from .evidence import create_evidence_snapshot
from .models import CashCollection, Payment, UtilityCharge
from .receipt import generate_receipt_pdf
from .reconciliation import get_reconciliation_summary, import_statement_csv
from .services import month_start, resolve_month_paid
from .wallet import process_completed_payment
from .tax_export import generate_etims_rent_csv


class CashCollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CashCollectionSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            return [IsOrgOwnerOnly()]
        if self.action == 'create':
            return [IsManager()]
        return [IsManager()]

    def get_queryset(self):
        return CashCollection.objects.filter(
            **organization_filter(self.request.user, 'lease__unit__property__manager__property_manager_id'),
        ).select_related(
            'lease__tenant__user', 'lease__unit__property', 'recorded_by',
        )

    def create(self, request, *args, **kwargs):
        serializer = CashCollectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lease_id = serializer.validated_data['lease_id']
        try:
            lease = Lease.objects.get(
                id=lease_id,
                **organization_filter(request.user, 'unit__property__manager__property_manager_id'),
                is_active=True,
            )
        except Lease.DoesNotExist:
            return Response({'detail': 'Lease not found.'}, status=status.HTTP_404_NOT_FOUND)

        preferred = serializer.validated_data.get('month_paid') or month_start(date.today())
        today = date.today()
        current_month = month_start(today)
        oldest_unpaid = resolve_month_paid(lease, preferred=preferred)
        if oldest_unpaid is None or oldest_unpaid > current_month:
            month_paid = current_month
        else:
            month_paid = oldest_unpaid

        cash = CashCollection.objects.create(
            lease=lease,
            recorded_by=request.user,
            amount=serializer.validated_data['amount'],
            month_paid=month_paid,
            notes=serializer.validated_data.get('notes', ''),
            receipt_photo=request.FILES.get('receipt_photo'),
        )
        log_activity(request.user, 'cash_collection_recorded', f'KES {cash.amount}', f'cash:{cash.id}')
        org = get_organization(request.user)
        if org:
            log_owner_alert(
                request.user,
                OwnerAlert.AlertType.CASH_PENDING,
                f'Cash collection KES {cash.amount} pending owner approval',
                f'cash:{cash.id}',
            )
        return Response(
            CashCollectionSerializer(cash, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        cash = self.get_object()
        if cash.status != CashCollection.Status.PENDING:
            return Response({'detail': 'Already reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.create(
            tenant=cash.lease.tenant,
            lease=cash.lease,
            amount=cash.amount,
            month_paid=cash.month_paid,
            status=Payment.Status.COMPLETED,
            payment_method=Payment.Method.CASH,
            mpesa_receipt_number=f'CASH{cash.id:06d}',
            transaction_id=f'cash-{cash.id}',
            payment_date=timezone.now(),
        )
        receipt_path = generate_receipt_pdf(payment)
        payment.receipt_pdf = receipt_path
        payment.save()
        process_completed_payment(payment)

        cash.status = CashCollection.Status.APPROVED
        cash.reviewed_by = request.user
        cash.reviewed_at = timezone.now()
        cash.linked_payment = payment
        cash.save()

        log_activity(request.user, 'cash_collection_approved', f'KES {cash.amount}', f'cash:{cash.id}')
        return Response(CashCollectionSerializer(cash, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        cash = self.get_object()
        if cash.status != CashCollection.Status.PENDING:
            return Response({'detail': 'Already reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        cash.status = CashCollection.Status.REJECTED
        cash.reviewed_by = request.user
        cash.reviewed_at = timezone.now()
        cash.rejection_reason = request.data.get('reason', 'Rejected by owner')
        cash.save()
        log_activity(request.user, 'cash_collection_rejected', cash.rejection_reason, f'cash:{cash.id}')
        return Response(CashCollectionSerializer(cash, context={'request': request}).data)


class UtilityChargeViewSet(viewsets.ModelViewSet):
    serializer_class = UtilityChargeSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsManager(), IsOrgOwnerForWrite()]
        return [IsManager()]

    def get_queryset(self):
        return UtilityCharge.objects.filter(
            **organization_filter(self.request.user, 'lease__unit__property__manager__property_manager_id'),
        ).select_related('lease__tenant__user', 'lease__unit')

    def perform_create(self, serializer):
        lease = serializer.validated_data['lease']
        if not belongs_to_organization(self.request.user, lease.unit.property.manager.property_manager_id):
            raise PermissionDenied('You do not have access to this lease.')
        serializer.save()
        log_activity(
            self.request.user, 'utility_charge_created',
            f'{serializer.instance.utility_type} KES {serializer.instance.amount}',
            f'utility:{serializer.instance.id}',
        )


class ReconciliationView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        if not is_org_owner(request.user):
            log_sensitive_access(request.user, 'reconciliation', 'Staff viewed reconciliation summary')
        pm_id = get_pm_id(request.user)
        return Response(get_reconciliation_summary(pm_id))

    def post(self, request):
        if not is_org_owner(request.user):
            from users.governance import log_blocked_action
            log_blocked_action(request.user, 'reconciliation', 'csv_import')
            return Response({'detail': 'Only owner can import statements.'}, status=status.HTTP_403_FORBIDDEN)

        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'CSV file required.'}, status=status.HTTP_400_BAD_REQUEST)

        content = uploaded.read().decode('utf-8', errors='replace')
        imp = import_statement_csv(org, request.user, uploaded.name, content, get_pm_id(request.user))
        log_activity(request.user, 'mpesa_statement_imported', uploaded.name, f'import:{imp.id}')
        log_owner_alert(
            request.user,
            OwnerAlert.AlertType.RECONCILIATION,
            f'Statement imported: {imp.matched_count} matched, {imp.orphan_count} orphan transactions',
            f'import:{imp.id}',
        )
        return Response({
            'import_id': imp.id,
            'matched_count': imp.matched_count,
            'orphan_count': imp.orphan_count,
            'filename': imp.filename,
        }, status=status.HTTP_201_CREATED)


class TaxExportView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request):
        pm_id = get_pm_id(request.user)
        month_param = request.query_params.get('month')
        month_start = None
        if month_param:
            try:
                year, mon = month_param.split('-')
                month_start = date(int(year), int(mon), 1)
            except ValueError:
                return Response({'detail': 'Use YYYY-MM format.'}, status=status.HTTP_400_BAD_REQUEST)

        csv_content = generate_etims_rent_csv(pm_id, month_start)
        log_activity(request.user, 'tax_export_generated', month_param or 'current', 'etims_csv')
        return Response(
            csv_content,
            content_type='text/csv',
            headers={'Content-Disposition': 'attachment; filename="propizy_etims_export.csv"'},
        )


class EvidenceBundleView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request, tenant_id):
        pm_id = get_pm_id(request.user)
        try:
            tenant = TenantProfile.objects.get(
                id=tenant_id,
                user__manager__property_manager_id=pm_id,
            )
        except TenantProfile.DoesNotExist:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_404_NOT_FOUND)

        pdf_path = generate_dispute_pack_pdf(tenant)
        snapshot = create_evidence_snapshot(tenant, request.user, pdf_path or '')
        if pdf_path:
            snapshot.pdf_path = pdf_path
            snapshot.save(update_fields=['pdf_path'])

        pdf_url = media_url(request, pdf_path)
        log_activity(request.user, 'evidence_bundle_exported', tenant.user.username, snapshot.sha256_hash[:16])

        return Response({
            'snapshot_id': snapshot.id,
            'sha256_hash': snapshot.sha256_hash,
            'pdf_url': pdf_url,
            'timeline_event_count': len(snapshot.json_bundle.get('timeline', [])),
            'json_bundle': snapshot.json_bundle,
            'message': 'Evidence bundle with integrity hash generated.',
        })

    def post(self, request, tenant_id):
        return self.get(request, tenant_id)
