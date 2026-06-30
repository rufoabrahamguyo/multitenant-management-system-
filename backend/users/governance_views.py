from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.activity import log_activity
from users.governance import PERMISSION_MATRIX, log_sensitive_access
from users.permissions import IsManager, IsOrgOwner, IsOrgOwnerOnly
from users.utils import get_organization, get_pm_id, is_org_owner

from propizy.storage_utils import media_url
from users.models import OrganizationMpesaConfig, OwnerAlert, MpesaIntegrationRequest

from .governance_serializers import (
    MpesaConfigSerializer,
    MpesaIntegrationRequestCreateSerializer,
    MpesaIntegrationRequestSerializer,
    OwnerAlertSerializer,
)


class PermissionMatrixView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        role = 'OWNER' if is_org_owner(request.user) else 'STAFF'
        return Response({
            'role': role,
            'matrix': PERMISSION_MATRIX,
            'your_permissions': PERMISSION_MATRIX.get(role, PERMISSION_MATRIX['STAFF']),
        })


class OwnerAlertsView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request):
        org = get_organization(request.user)
        if not org:
            return Response([])
        unread_only = request.query_params.get('unread') == 'true'
        qs = OwnerAlert.objects.filter(organization=org).select_related('triggered_by')
        if unread_only:
            qs = qs.filter(is_read=False)
        data = OwnerAlertSerializer(qs[:100], many=True).data
        return Response(data)

    def patch(self, request):
        org = get_organization(request.user)
        alert_ids = request.data.get('alert_ids', [])
        if alert_ids:
            OwnerAlert.objects.filter(organization=org, id__in=alert_ids).update(is_read=True)
        else:
            OwnerAlert.objects.filter(organization=org, is_read=False).update(is_read=True)
        return Response({'message': 'Alerts marked as read.'})


class MpesaConfigView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not is_org_owner(request.user):
            log_sensitive_access(request.user, 'mpesa_config', 'Staff viewed M-PESA config')
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=org)
        return Response(MpesaConfigSerializer(config).data)

    def put(self, request):
        if not is_org_owner(request.user):
            from users.governance import log_blocked_action
            log_blocked_action(request.user, 'mpesa_config', 'update')
            return Response(
                {'detail': 'Only the organization owner can update M-PESA config.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        org = get_organization(request.user)
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=org)
        serializer = MpesaConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(request.user, 'mpesa_config_updated', config.shortcode or config.channel, f'org:{org.id}')
        return Response(serializer.data)


class MpesaIntegrationRequestView(APIView):
    """Owners submit M-PESA setup requests; managers can view status."""

    permission_classes = [IsManager]

    def get(self, request):
        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=org)
        latest = MpesaIntegrationRequest.objects.filter(organization=org).first()

        return Response({
            'mpesa_config': {
                'stk_configured': config.stk_configured,
                'shortcode': config.shortcode,
                'channel': config.channel,
            },
            'integration_request': (
                MpesaIntegrationRequestSerializer(latest).data if latest else None
            ),
        })

    def post(self, request):
        if not is_org_owner(request.user):
            from users.governance import log_blocked_action
            log_blocked_action(request.user, 'mpesa_integration_request', 'create')
            return Response(
                {'detail': 'Only the organization owner can request M-PESA integration.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=org)
        if config.stk_configured:
            return Response(
                {'detail': 'M-PESA is already configured for this organization.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        open_request = MpesaIntegrationRequest.objects.filter(
            organization=org,
            status__in=[
                MpesaIntegrationRequest.Status.PENDING,
                MpesaIntegrationRequest.Status.IN_PROGRESS,
            ],
        ).exists()
        if open_request:
            return Response(
                {'detail': 'You already have an open M-PESA integration request. Our team is working on it.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MpesaIntegrationRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        integration_request = serializer.save(
            organization=org,
            requested_by=request.user,
            status=MpesaIntegrationRequest.Status.PENDING,
        )

        from users.mpesa_integration import notify_ops_team
        notify_ops_team(integration_request)
        log_activity(
            request.user,
            'mpesa_integration_requested',
            integration_request.shortcode,
            f'org:{org.id}',
        )

        return Response(
            {
                'message': (
                    'Request received. Our team will work on your M-PESA integration '
                    'and get back to you shortly.'
                ),
                'integration_request': MpesaIntegrationRequestSerializer(integration_request).data,
            },
            status=status.HTTP_201_CREATED,
        )


class WeeklyDigestView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request):
        from payments.digest import generate_weekly_digest_pdf

        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

        pdf_path = generate_weekly_digest_pdf(org)
        log_activity(request.user, 'weekly_digest_generated', org.name, pdf_path)
        url = media_url(request, pdf_path)
        return Response({
            'digest_url': url,
            'message': 'Weekly owner digest generated for absentee oversight.',
        })
