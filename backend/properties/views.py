import secrets
import string

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from users.activity import log_activity
from users.governance import log_blocked_action, staff_can
from users.permissions import IsManager, IsOrgOwnerForWrite, IsOrgOwnerOnly, IsOwnerOrManager
from users.tenancy import belongs_to_organization, organization_filter
from users.utils import get_org_owner, is_org_owner

from propizy.storage_utils import media_url
from .models import Lease, Property, TenantProfile, Unit
from .serializers import (
    LeaseSerializer,
    PropertySerializer,
    TenantProfileSerializer,
    TenantProvisionSerializer,
    UnitSerializer,
)
from .ordering import order_units_by_number
from .services import create_lease_for_tenant, sync_property_units, update_property_unit_count

User = get_user_model()


def _require_tenant_write(request):
    if is_org_owner(request.user) or staff_can(request.user, 'tenants', 'write'):
        return
    log_blocked_action(request.user, 'tenants', 'write')
    raise PermissionDenied('You do not have permission to manage tenants.')


def _require_account_suspend(request):
    if is_org_owner(request.user) or staff_can(request.user, 'account_suspend', 'write'):
        return
    # Front-desk / staff with tenants.write may suspend tenant accounts
    if staff_can(request.user, 'tenants', 'write'):
        return
    log_blocked_action(request.user, 'account_suspend', 'write')
    raise PermissionDenied('You do not have permission to suspend accounts.')


def _generate_temp_password(length=10):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _unique_username(base):
    candidate = (base or 'tenant')[:120].strip().lower().replace(' ', '')
    if not candidate:
        candidate = 'tenant'
    username = candidate
    n = 1
    while User.objects.filter(username=username).exists():
        username = f'{candidate}{n}'
        n += 1
    return username


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


class TenantViewSet(viewsets.ModelViewSet):
    serializer_class = TenantProfileSerializer
    permission_classes = [IsManager]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return TenantProfile.objects.filter(
            **organization_filter(self.request.user, 'user__manager__property_manager_id'),
        ).select_related('user', 'current_unit__property')

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Use POST /api/tenants/provision/ to set up a tenant account.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        _require_tenant_write(request)
        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        tenant = serializer.save()
        log_activity(
            self.request.user,
            'tenant_profile_updated',
            tenant.user.username,
            f'tenant:{tenant.id}',
        )

    @action(detail=False, methods=['post'], url_path='provision')
    @transaction.atomic
    def provision(self, request):
        _require_tenant_write(request)
        serializer = TenantProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            unit = Unit.objects.select_related('property__manager').get(
                id=data['unit_id'],
                **organization_filter(request.user, 'property__manager__property_manager_id'),
            )
        except Unit.DoesNotExist:
            raise ValidationError({'unit_id': 'Unit not found in your organization.'})

        if unit.status == Unit.Status.OCCUPIED:
            raise ValidationError({'unit_id': 'Unit is already occupied.'})

        email = data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError({'email': 'A user with this email already exists.'})

        owner = get_org_owner(request.user) or request.user
        username = data.get('username') or _unique_username(
            data.get('first_name') or email.split('@')[0],
        )
        if User.objects.filter(username=username).exists():
            raise ValidationError({'username': 'Username is already taken.'})

        temp_password = _generate_temp_password()
        user = User(
            username=username,
            email=email,
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role=User.Role.TENANT,
            manager=owner,
            phone_number=data['phone_number'],
            phone_verified=True,
            must_change_password=True,
        )
        user.set_password(temp_password)
        user.save()

        profile = TenantProfile.objects.create(
            user=user,
            phone_number=data['phone_number'],
            date_of_birth=data.get('date_of_birth'),
            nationality=data.get('nationality', ''),
            interests=data.get('interests', ''),
            next_of_kin_name=data.get('next_of_kin_name', ''),
            next_of_kin_phone=data.get('next_of_kin_phone', ''),
            next_of_kin_email=data.get('next_of_kin_email', ''),
            refund_account_type=data.get('refund_account_type', ''),
            refund_account_name=data.get('refund_account_name', ''),
            refund_bank_name=data.get('refund_bank_name', ''),
            refund_swift_code=data.get('refund_swift_code', ''),
            refund_account_number=data.get('refund_account_number', ''),
        )
        create_lease_for_tenant(profile, unit)
        log_activity(request.user, 'tenant_provisioned', username, f'tenant:{profile.id}')

        return Response(
            {
                'tenant': TenantProfileSerializer(profile, context={'request': request}).data,
                'credentials': {
                    'username': username,
                    'temporary_password': temp_password,
                },
                'message': 'Tenant account created. Share these credentials once; the tenant must change the password on first login.',
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='reset-credentials')
    def reset_credentials(self, request, pk=None):
        _require_tenant_write(request)
        tenant = self.get_object()
        user = tenant.user
        temp_password = _generate_temp_password()
        user.set_password(temp_password)
        user.must_change_password = True
        if not user.is_active:
            user.is_active = True
        user.save(update_fields=['password', 'must_change_password', 'is_active'])
        log_activity(request.user, 'tenant_credentials_reset', user.username, f'tenant:{tenant.id}')
        return Response({
            'credentials': {
                'username': user.username,
                'temporary_password': temp_password,
            },
            'tenant': TenantProfileSerializer(tenant, context={'request': request}).data,
            'message': 'Temporary password generated. Share it once with the tenant.',
        })

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
        from django.conf import settings as django_settings
        from propizy.storage_utils import assign_image_field, save_image_upload

        _require_tenant_write(request)
        tenant = self.get_object()
        front = request.FILES.get('id_card_front')
        back = request.FILES.get('id_card_back')

        if not front and not back:
            raise ValidationError({'detail': 'Upload at least one ID image (front or back).'})

        folder = f'tenant_ids/{tenant.id}'
        updated = []
        if front:
            name = save_image_upload(front, folder=folder, public_id='front')
            assign_image_field(tenant, 'id_card_front', name)
            updated.append('front')
        if back:
            name = save_image_upload(back, folder=folder, public_id='back')
            assign_image_field(tenant, 'id_card_back', name)
            updated.append('back')

        tenant.save(update_fields=['id_card_front', 'id_card_back'])
        log_activity(
            request.user,
            'tenant_id_card_uploaded',
            f'{tenant.user.username}: {", ".join(updated)}'
            + (' → Cloudinary' if django_settings.USE_CLOUDINARY else ' → local media'),
            f'tenant:{tenant.id}',
        )
        return Response(
            TenantProfileSerializer(tenant, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        _require_account_suspend(request)
        tenant = self.get_object()
        user = tenant.user
        if not user.is_active:
            return Response({'detail': 'Account is already suspended.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=['is_active'])
        log_activity(request.user, 'tenant_suspended', user.username, f'tenant:{tenant.id}')
        return Response(TenantProfileSerializer(tenant, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        _require_account_suspend(request)
        tenant = self.get_object()
        user = tenant.user
        if user.is_active:
            return Response({'detail': 'Account is already active.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = True
        user.save(update_fields=['is_active'])
        log_activity(request.user, 'tenant_reactivated', user.username, f'tenant:{tenant.id}')
        return Response(TenantProfileSerializer(tenant, context={'request': request}).data)


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
