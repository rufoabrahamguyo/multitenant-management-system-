from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from users.activity import log_activity
from users.permissions import IsManager, IsOrgOwnerForWrite, IsOrgOwnerOnly, IsOwnerOrManager
from users.tenancy import belongs_to_organization, organization_filter

from propizy.storage_utils import media_url
from .models import Lease, Property, TenantProfile, Unit
from .serializers import LeaseSerializer, PropertySerializer, TenantProfileSerializer, UnitSerializer
from .ordering import order_units_by_number
from .services import create_lease_for_tenant, sync_property_units, update_property_unit_count


class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsManager(), IsOrgOwnerForWrite()]
        return [IsManager(), IsOwnerOrManager()]

    def get_queryset(self):
        return Property.objects.filter(
            **organization_filter(self.request.user),
        ).select_related('manager')

    def perform_create(self, serializer):
        prop = serializer.save(manager=self.request.user)
        sync_property_units(prop)
        log_activity(self.request.user, 'property_created', prop.name, f'property:{prop.id}')

    def perform_update(self, serializer):
        instance = serializer.instance
        previous_count = instance.units.count()
        prop = serializer.save()
        if prop.total_units > previous_count:
            sync_property_units(prop, desired_count=prop.total_units)
        log_activity(self.request.user, 'property_updated', prop.name, f'property:{prop.id}')

    def perform_destroy(self, instance):
        name = instance.name
        prop_id = instance.id
        instance.delete()
        log_activity(self.request.user, 'property_deleted', name, f'property:{prop_id}')


class UnitViewSet(viewsets.ModelViewSet):
    serializer_class = UnitSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'assign_tenant']:
            return [IsManager(), IsOrgOwnerForWrite()]
        return [IsManager(), IsOwnerOrManager()]

    def get_queryset(self):
        qs = Unit.objects.filter(
            **organization_filter(self.request.user, 'property__manager__property_manager_id'),
        ).select_related('property', 'category')
        property_id = self.request.query_params.get('property')
        if property_id:
            qs = qs.filter(property_id=property_id)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return order_units_by_number(qs)

    def perform_create(self, serializer):
        property_obj = serializer.validated_data['property']
        if not belongs_to_organization(self.request.user, property_obj.manager.property_manager_id):
            raise PermissionDenied('Property does not belong to your organization.')
        serializer.save()
        update_property_unit_count(property_obj)
        log_activity(
            self.request.user, 'unit_created',
            f'{property_obj.name} - Unit {serializer.instance.unit_number}',
            f'unit:{serializer.instance.id}',
        )

    def perform_destroy(self, instance):
        property_obj = instance.property
        if instance.status != Unit.Status.VACANT:
            raise ValidationError({'detail': 'Only vacant units can be deleted.'})
        unit_label = f'{property_obj.name} - Unit {instance.unit_number}'
        instance.delete()
        update_property_unit_count(property_obj)
        log_activity(self.request.user, 'unit_deleted', unit_label, f'property:{property_obj.id}')

    def perform_update(self, serializer):
        property_obj = serializer.validated_data.get('property', serializer.instance.property)
        if not belongs_to_organization(self.request.user, property_obj.manager.property_manager_id):
            raise PermissionDenied('Property does not belong to your organization.')
        unit = serializer.save()
        log_activity(
            self.request.user, 'unit_updated',
            f'{property_obj.name} - Unit {unit.unit_number}',
            f'unit:{unit.id}',
        )

    @action(detail=True, methods=['post'])
    def assign_tenant(self, request, pk=None):
        unit = self.get_object()
        if unit.status == Unit.Status.OCCUPIED:
            return Response({'detail': 'Unit is already occupied.'}, status=status.HTTP_400_BAD_REQUEST)
        tenant_id = request.data.get('tenant_id')
        try:
            tenant = TenantProfile.objects.get(
                id=tenant_id,
                **organization_filter(request.user, 'user__manager__property_manager_id'),
            )
        except TenantProfile.DoesNotExist:
            return Response({'detail': 'Tenant not found.'}, status=status.HTTP_404_NOT_FOUND)

        create_lease_for_tenant(tenant, unit)
        log_activity(request.user, 'tenant_assigned', tenant.user.username, f'tenant:{tenant.id}')
        return Response(UnitSerializer(unit).data)


class TenantViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TenantProfileSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        return TenantProfile.objects.filter(
            **organization_filter(self.request.user, 'user__manager__property_manager_id'),
        ).select_related('user', 'current_unit__property')

    @action(detail=True, methods=['get'], permission_classes=[IsOrgOwnerOnly])
    def dispute_pack(self, request, pk=None):
        from payments.documents import generate_dispute_pack_pdf

        tenant = self.get_object()
        pdf_path = generate_dispute_pack_pdf(tenant)
        if not pdf_path:
            return Response({'detail': 'No active lease for this tenant.'}, status=status.HTTP_404_NOT_FOUND)
        log_activity(request.user, 'dispute_pack_exported', tenant.user.username, f'tenant:{tenant.id}')
        url = media_url(request, pdf_path)
        return Response({'dispute_pack_url': url, 'message': 'Dispute evidence pack generated.'})

    @action(
        detail=True,
        methods=['post'],
        url_path='upload-id-card',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_id_card(self, request, pk=None):
        tenant = self.get_object()
        front = request.FILES.get('id_card_front')
        back = request.FILES.get('id_card_back')

        if not front and not back:
            raise ValidationError({'detail': 'Upload at least one ID image (front or back).'})

        updated = []
        if front:
            tenant.id_card_front = front
            updated.append('front')
        if back:
            tenant.id_card_back = back
            updated.append('back')

        tenant.save(update_fields=['id_card_front', 'id_card_back'])
        log_activity(
            request.user,
            'tenant_id_card_uploaded',
            f'{tenant.user.username}: {", ".join(updated)}',
            f'tenant:{tenant.id}',
        )
        return Response(
            TenantProfileSerializer(tenant, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


class LeaseViewSet(viewsets.ModelViewSet):
    serializer_class = LeaseSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsManager(), IsOrgOwnerForWrite()]
        return [IsManager(), IsOwnerOrManager()]

    def get_queryset(self):
        return Lease.objects.filter(
            **organization_filter(self.request.user, 'unit__property__manager__property_manager_id'),
        ).select_related('tenant__user', 'unit__property')

    def perform_create(self, serializer):
        unit = serializer.validated_data['unit']
        if not belongs_to_organization(self.request.user, unit.property.manager.property_manager_id):
            raise PermissionDenied('Unit does not belong to your organization.')
        lease = serializer.save()
        # preserve_rent_amount=True prevents overwriting the manager's explicit rent_amount
        create_lease_for_tenant(lease.tenant, unit, preserve_rent_amount=True)


class TenantLeaseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LeaseSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role != 'TENANT':
            return Lease.objects.none()
        try:
            profile = user.tenant_profile
        except Exception:
            return Lease.objects.none()
        return Lease.objects.filter(
            tenant=profile,
            is_active=True,
        ).select_related('unit__property', 'unit__category')
