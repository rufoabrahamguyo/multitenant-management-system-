from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from users.activity import log_activity
from users.models import OwnerAlert
from users.permissions import IsManager, IsOrgOwnerForWrite, IsTenant
from users.tenancy import belongs_to_organization, organization_filter
from users.utils import get_organization, get_pm_id

from .models import Lease, Unit, UnitCategory, UnitTransferRequest
from .serializers import UnitCategorySerializer, UnitTransferCreateSerializer, UnitTransferRequestSerializer
from .transfer_service import (
    approve_transfer,
    determine_initial_status,
    get_category_availability,
    get_waitlist_position,
    move_to_waitlist,
    reject_transfer,
)


class UnitCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = UnitCategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsManager(), IsOrgOwnerForWrite()]
        return [IsManager()]

    def get_queryset(self):
        qs = UnitCategory.objects.filter(
            **organization_filter(self.request.user, 'property_ref__manager__property_manager_id'),
        ).select_related('property_ref')
        property_id = self.request.query_params.get('property')
        if property_id:
            qs = qs.filter(property_ref_id=property_id)
        return qs

    def perform_create(self, serializer):
        prop = serializer.validated_data['property_ref']
        if not belongs_to_organization(self.request.user, prop.manager.property_manager_id):
            raise PermissionDenied('Property does not belong to your organization.')
        cat = serializer.save()
        log_activity(self.request.user, 'category_created', cat.name, f'category:{cat.id}')


class UnitAvailabilityView(APIView):
    """Tenants and managers browse vacant units by category."""

    def get_permissions(self):
        user = self.request.user
        if user.role == 'TENANT':
            return [IsTenant()]
        return [IsManager()]

    def get(self, request):
        property_id = request.query_params.get('property')
        if request.user.role == 'TENANT':
            profile = request.user.tenant_profile
            lease = Lease.objects.filter(tenant=profile, is_active=True).select_related(
                'unit__property',
            ).first()
            if not lease:
                return Response([])
            property_id = lease.unit.property_id

        pm_id = get_pm_id(request.user) if request.user.role == 'MANAGER' else None
        if request.user.role == 'TENANT':
            pm_id = request.user.manager.property_manager_id if request.user.manager else None

        data = get_category_availability(
            property_id=int(property_id) if property_id else None,
            pm_id=pm_id,
        )
        return Response(data)


class UnitTransferRequestViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return UnitTransferCreateSerializer
        return UnitTransferRequestSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsTenant()]
        if self.action in ['approve', 'reject', 'waitlist']:
            return [IsManager()]
        if self.request.user.role == 'TENANT':
            return [IsTenant()]
        return [IsManager()]

    def get_queryset(self):
        user = self.request.user
        qs = UnitTransferRequest.objects.select_related(
            'tenant__user', 'current_lease__unit__category', 'desired_category__property_ref',
            'preferred_unit', 'assigned_unit', 'reviewed_by',
        )
        if user.role == 'TENANT' and hasattr(user, 'tenant_profile'):
            return qs.filter(tenant=user.tenant_profile)
        return qs.filter(
            **organization_filter(user, 'desired_category__property_ref__manager__property_manager_id'),
        )

    def create(self, request, *args, **kwargs):
        serializer = UnitTransferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = request.user.tenant_profile

        active = UnitTransferRequest.objects.filter(
            tenant=profile,
            status__in=[
                UnitTransferRequest.Status.PENDING,
                UnitTransferRequest.Status.WAITLISTED,
                UnitTransferRequest.Status.APPROVED,
            ],
        ).exists()
        if active:
            return Response(
                {'detail': 'You already have an active transfer request.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lease = Lease.objects.filter(tenant=profile, is_active=True).select_related(
            'unit__property',
        ).first()
        if not lease:
            return Response({'detail': 'No active lease.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category = UnitCategory.objects.get(id=serializer.validated_data['desired_category_id'])
        except UnitCategory.DoesNotExist:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if category.property_ref_id != lease.unit.property_id:
            return Response(
                {'detail': 'Category must be in your current property.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if lease.unit.category_id == category.id:
            return Response(
                {'detail': 'You are already in this room category.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        preferred_unit = None
        pref_id = serializer.validated_data.get('preferred_unit_id')
        if pref_id:
            try:
                preferred_unit = Unit.objects.get(id=pref_id, category=category)
            except Unit.DoesNotExist:
                return Response({'detail': 'Preferred unit not found.'}, status=status.HTTP_404_NOT_FOUND)

        initial_status = determine_initial_status(category, preferred_unit)

        transfer = UnitTransferRequest.objects.create(
            tenant=profile,
            current_lease=lease,
            desired_category=category,
            preferred_unit=preferred_unit,
            status=initial_status,
            tenant_note=serializer.validated_data.get('tenant_note', ''),
        )

        log_activity(
            request.user, 'transfer_requested',
            f'{category.name} ({initial_status})',
            f'transfer:{transfer.id}',
        )

        if initial_status == UnitTransferRequest.Status.WAITLISTED and request.user.manager:
            org = get_organization(request.user.manager)
            if org:
                position = get_waitlist_position(transfer)
                OwnerAlert.objects.create(
                    organization=org,
                    triggered_by=None,
                    alert_type=OwnerAlert.AlertType.RECONCILIATION,
                    message=(
                        f'Tenant {request.user.username} waitlisted for {category.name} '
                        f'(position {position})'
                    )[:500],
                    resource=f'transfer:{transfer.id}',
                    severity=OwnerAlert.Severity.MEDIUM,
                )

        return Response(
            UnitTransferRequestSerializer(transfer).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        transfer = self.get_object()
        unit_id = request.data.get('unit_id') or (
            transfer.preferred_unit_id if transfer.preferred_unit else None
        )
        if not unit_id:
            return Response({'detail': 'unit_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            unit = Unit.objects.get(
                id=unit_id,
                category=transfer.desired_category,
                status=Unit.Status.VACANT,
            )
        except Unit.DoesNotExist:
            return Response({'detail': 'Vacant unit not found in category.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            approve_transfer(transfer, unit, request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        transfer.refresh_from_db()
        return Response(UnitTransferRequestSerializer(transfer).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        transfer = self.get_object()
        reject_transfer(transfer, request.user, request.data.get('reason', ''))
        transfer.refresh_from_db()
        return Response(UnitTransferRequestSerializer(transfer).data)

    @action(detail=True, methods=['post'])
    def waitlist(self, request, pk=None):
        transfer = self.get_object()
        move_to_waitlist(transfer, request.user)
        transfer.refresh_from_db()
        data = UnitTransferRequestSerializer(transfer).data
        data['waitlist_position'] = get_waitlist_position(transfer)
        return Response(data)

    @action(detail=True, methods=['post'], permission_classes=[IsTenant])
    def cancel(self, request, pk=None):
        transfer = self.get_object()
        if transfer.tenant.user_id != request.user.id:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if transfer.status not in (
            UnitTransferRequest.Status.PENDING,
            UnitTransferRequest.Status.WAITLISTED,
        ):
            return Response({'detail': 'Cannot cancel this request.'}, status=status.HTTP_400_BAD_REQUEST)
        transfer.status = UnitTransferRequest.Status.CANCELLED
        transfer.save(update_fields=['status', 'updated_at'])
        return Response(UnitTransferRequestSerializer(transfer).data)
