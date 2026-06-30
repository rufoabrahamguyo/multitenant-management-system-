from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.activity import log_activity
from users.permissions import IsManager, IsTenant
from users.tenancy import organization_filter

from .models import MaintenanceRequest
from .serializers import MaintenanceRequestSerializer


class MaintenanceViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return MaintenanceRequest.objects.none()
        qs = MaintenanceRequest.objects.select_related(
            'tenant__user', 'unit__property',
        )
        if user.role == 'MANAGER':
            return qs.filter(
                **organization_filter(user, 'unit__property__manager__property_manager_id'),
            )
        if user.role == 'TENANT' and hasattr(user, 'tenant_profile'):
            return qs.filter(tenant=user.tenant_profile)
        return qs.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsTenant()]
        if self.action in ['partial_update', 'update']:
            return [IsManager()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'tenant_profile'):
            return Response({'detail': 'Tenant profile required.'}, status=status.HTTP_400_BAD_REQUEST)

        tenant = user.tenant_profile
        if not tenant.current_unit:
            return Response({'detail': 'No unit assigned.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant, unit=tenant.current_unit)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status and new_status in dict(MaintenanceRequest.Status.choices):
            instance.status = new_status
            instance.save()
            log_activity(
                request.user, 'maintenance_updated',
                f'{instance.unit.unit_number}: {new_status}',
                f'maintenance:{instance.id}',
            )
        return Response(self.get_serializer(instance).data)
