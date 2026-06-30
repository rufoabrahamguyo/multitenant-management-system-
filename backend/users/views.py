from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from maintenance.models import MaintenanceRequest
from payments.documents import generate_owner_statement_pdf
from payments.models import Payment
from propizy.storage_utils import media_url
from properties.models import Lease, Property, Unit
from .activity import log_activity
from .emails import tenant_invite_app_url
from .models import ActivityLog, OrganizationMember, PasswordResetToken, StaffInvite, TenantInvite
from .permissions import IsManager, IsOrgOwner, IsOrgOwnerOnly
from .serializers import (
    ManagerRegisterSerializer,
    OrganizationMemberSerializer,
    StaffInviteCreateSerializer,
    StaffInviteSerializer,
    StaffRegisterSerializer,
    TenantInviteCreateSerializer,
    TenantInviteSerializer,
    TenantRegisterSerializer,
    UserSerializer,
)
from .analytics import collection_stats, monthly_collection_trend
from .tenancy import organization_filter
from .utils import get_organization, get_pm_id
from .phone_verification import send_verification_code, verify_code
from .throttling import AuthRateThrottle, PhoneVerifyRateThrottle

User = get_user_model()


def _auth_response(user):
    refresh = RefreshToken.for_user(user)
    return {
        'user': UserSerializer(user).data,
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': user.role,
        'id': user.id,
    }


class ManagerRegisterView(generics.CreateAPIView):
    serializer_class = ManagerRegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        try:
            send_verification_code(user)
        except ValueError:
            pass
        return Response(_auth_response(user), status=status.HTTP_201_CREATED)


class SendPhoneCodeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PhoneVerifyRateThrottle]

    def post(self, request):
        user = request.user
        if user.phone_verified:
            return Response({'detail': 'Phone number already verified.'})
        if not user.phone_number:
            return Response({'detail': 'No phone number on file.'}, status=status.HTTP_400_BAD_REQUEST)
        payload = send_verification_code(user)
        return Response({
            'message': 'Verification code sent.' if not payload.get('sms_simulated') else (
                'SMS could not be delivered. Use the dev code below or fix Africa\'s Talking credentials.'
            ),
            'masked_phone': payload['masked_phone'],
            'sms_simulated': payload.get('sms_simulated', True),
            **({'dev_code': payload['dev_code']} if 'dev_code' in payload else {}),
        })


class VerifyPhoneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.phone_verified:
            return Response({'user': UserSerializer(user).data, 'message': 'Already verified.'})
        code = request.data.get('code', '').strip()
        if not code:
            return Response({'detail': 'Verification code is required.'}, status=status.HTTP_400_BAD_REQUEST)
        ok, error = verify_code(user, code)
        if not ok:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        return Response({
            'message': 'Phone number verified.',
            'user': UserSerializer(user).data,
        })


class TenantRegisterView(generics.CreateAPIView):
    serializer_class = TenantRegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(_auth_response(user), status=status.HTTP_201_CREATED)


class StaffRegisterView(generics.CreateAPIView):
    serializer_class = StaffRegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(_auth_response(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'detail': 'Username and password required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(_auth_response(user))


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if user:
            PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(
                used_at=timezone.now(),
            )
            reset_token = PasswordResetToken.objects.create(
                user=user,
                expires_at=timezone.now() + timedelta(hours=1),
            )
            from .tasks import send_password_reset_email_task
            send_password_reset_email_task.delay(reset_token.id)

        return Response({
            'message': 'If this email is registered, a password reset link has been sent.',
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        token_value = (request.data.get('token') or '').strip()
        password = request.data.get('password') or ''

        if not token_value or not password:
            return Response(
                {'detail': 'Token and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            reset_token = PasswordResetToken.objects.select_related('user').get(token=token_value)
        except (PasswordResetToken.DoesNotExist, ValueError):
            return Response(
                {'detail': 'Invalid or expired reset link. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reset_token.is_valid:
            return Response(
                {'detail': 'Invalid or expired reset link. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset_token.user
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            return Response({'detail': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        reset_token.used_at = timezone.now()
        reset_token.save(update_fields=['used_at'])

        return Response({'message': 'Password reset successfully. Please sign in.'})


class CurrentUserView(APIView):
    """Return the authenticated user profile (validates JWT on dashboard load)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class InvitePreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = TenantInvite.objects.select_related('unit__property', 'organization').get(token=token)
        except TenantInvite.DoesNotExist:
            return Response({'detail': 'Invalid invite.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'email': invite.email,
            'phone_number': invite.phone_number,
            'organization': invite.organization.name,
            'unit': f'{invite.unit.property.name} - Unit {invite.unit.unit_number}' if invite.unit else None,
            'is_valid': invite.is_valid,
            'expires_at': invite.expires_at.isoformat(),
            'app_invite_url': tenant_invite_app_url(invite.token),
        })


class StaffInvitePreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = StaffInvite.objects.select_related('organization').get(token=token)
        except StaffInvite.DoesNotExist:
            return Response({'detail': 'Invalid invite.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'email': invite.email,
            'organization': invite.organization.name,
            'is_valid': invite.is_valid,
        })


class TenantInviteViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        return [IsManager()]

    def get_serializer_class(self):
        if self.action == 'create':
            return TenantInviteCreateSerializer
        return TenantInviteSerializer

    def get_queryset(self):
        org = get_organization(self.request.user)
        if not org:
            return TenantInvite.objects.none()
        return TenantInvite.objects.filter(organization=org).select_related('unit__property')

    def create(self, request, *args, **kwargs):
        serializer = TenantInviteCreateSerializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        org = get_organization(request.user)
        unit = serializer.context['unit']
        invite = TenantInvite.objects.create(
            email=serializer.validated_data['email'],
            phone_number=serializer.validated_data['phone_number'],
            organization=org,
            unit=unit,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        log_activity(request.user, 'tenant_invited', invite.email, f'invite:{invite.id}')
        from .tasks import send_tenant_invite_email_task
        send_tenant_invite_email_task.delay(invite.id)
        data = TenantInviteSerializer(invite).data
        data['email_sent'] = True
        return Response(data, status=status.HTTP_201_CREATED)


class StaffInviteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsOrgOwner]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return StaffInviteCreateSerializer
        return StaffInviteSerializer

    def get_queryset(self):
        org = get_organization(self.request.user)
        if not org:
            return StaffInvite.objects.none()
        return StaffInvite.objects.filter(organization=org)

    def create(self, request, *args, **kwargs):
        serializer = StaffInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org = get_organization(request.user)
        invite = StaffInvite.objects.create(
            email=serializer.validated_data['email'],
            organization=org,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        log_activity(request.user, 'staff_invited', invite.email, f'invite:{invite.id}')
        from .tasks import send_staff_invite_email_task
        send_staff_invite_email_task.delay(invite.id)
        data = StaffInviteSerializer(invite).data
        data['email_sent'] = True
        return Response(data, status=status.HTTP_201_CREATED)


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationMemberSerializer
    permission_classes = [IsManager]
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsOrgOwner()]
        return [IsManager()]

    def get_queryset(self):
        org = get_organization(self.request.user)
        if not org:
            return OrganizationMember.objects.none()
        return OrganizationMember.objects.filter(organization=org).select_related('user')

    def destroy(self, request, *args, **kwargs):
        member = self.get_object()
        if member.role == OrganizationMember.Role.OWNER:
            return Response(
                {'detail': 'Cannot remove the organization owner.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        staff_user = member.user
        log_activity(
            request.user,
            'staff_removed',
            staff_user.username,
            f'member:{member.id}',
        )
        member.delete()
        staff_user.is_active = False
        staff_user.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        properties = Property.objects.filter(**organization_filter(request.user))
        units = Unit.objects.filter(**organization_filter(request.user, 'property__manager__property_manager_id'))
        occupied = units.filter(status=Unit.Status.OCCUPIED).count()
        total_units = units.count()

        today = date.today()
        month_start = date(today.year, today.month, 1)
        lease_org = organization_filter(request.user, 'unit__property__manager__property_manager_id')
        payment_org = organization_filter(request.user, 'lease__unit__property__manager__property_manager_id')

        active_leases_qs = Lease.objects.filter(**lease_org, is_active=True)
        active_leases = active_leases_qs.count()
        collection_rate, collected_total, _expected = collection_stats(
            payment_org, month_start, active_leases_qs,
        )

        pending_maint = MaintenanceRequest.objects.filter(
            **organization_filter(request.user, 'unit__property__manager__property_manager_id'),
            status=MaintenanceRequest.Status.PENDING,
        ).count()

        paid_leases = Payment.objects.filter(
            **payment_org,
            status=Payment.Status.COMPLETED,
            month_paid=month_start,
        ).values('lease_id').distinct().count()
        overdue = max(active_leases - paid_leases, 0)

        return Response({
            'properties': properties.count(),
            'units': total_units,
            'occupied': occupied,
            'vacant': total_units - occupied,
            'occupancy_rate': round(occupied / total_units * 100, 1) if total_units else 0,
            'collected_this_month': collected_total,
            'pending_maintenance': pending_maint,
            'overdue_payments': overdue,
            'active_leases': active_leases,
            'collection_rate': collection_rate,
            'monthly_trend': monthly_collection_trend(payment_org, month_start),
        })


class ReportsView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        pm_id = get_pm_id(request.user)
        today = date.today()
        month_start = date(today.year, today.month, 1)
        lease_org = organization_filter(request.user, 'unit__property__manager__property_manager_id')
        payment_org = organization_filter(request.user, 'lease__unit__property__manager__property_manager_id')

        properties = Property.objects.filter(**organization_filter(request.user))
        units = Unit.objects.filter(**organization_filter(request.user, 'property__manager__property_manager_id'))
        active_leases = Lease.objects.filter(**lease_org, is_active=True)

        expected_rent = active_leases.aggregate(total=Sum('rent_amount'))['total'] or 0
        collected = Payment.objects.filter(
            **payment_org,
            status=Payment.Status.COMPLETED,
            month_paid=month_start,
        ).aggregate(total=Sum('amount'))['total'] or 0

        collection_rate = round(float(collected) / float(expected_rent) * 100, 1) if expected_rent else 0

        monthly_trend = monthly_collection_trend(payment_org, month_start)

        property_breakdown = []
        for prop in properties:
            prop_units = units.filter(property=prop)
            prop_expected = active_leases.filter(unit__property=prop).aggregate(
                total=Sum('rent_amount'),
            )['total'] or 0
            prop_collected = Payment.objects.filter(
                lease__unit__property=prop,
                status=Payment.Status.COMPLETED,
                month_paid=month_start,
            ).aggregate(total=Sum('amount'))['total'] or 0
            property_breakdown.append({
                'name': prop.name,
                'units': prop_units.count(),
                'occupied': prop_units.filter(status=Unit.Status.OCCUPIED).count(),
                'expected_rent': float(prop_expected),
                'collected': float(prop_collected),
            })

        from payments.services import get_org_arrears
        arrears = get_org_arrears(pm_id)
        total_arrears = sum(a['total_owed'] for a in arrears)

        return Response({
            'month': month_start.strftime('%B %Y'),
            'expected_rent': float(expected_rent),
            'collected_this_month': float(collected),
            'collection_rate': collection_rate,
            'total_arrears': float(total_arrears),
            'tenants_in_arrears': len(arrears),
            'monthly_trend': monthly_trend,
            'property_breakdown': property_breakdown,
        })


class OwnerStatementView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request):
        org = get_organization(request.user)
        if not org:
            return Response({'detail': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

        month_param = request.query_params.get('month')
        today = date.today()
        if month_param:
            try:
                year, mon = month_param.split('-')
                month_start = date(int(year), int(mon), 1)
            except ValueError:
                return Response({'detail': 'Invalid month format. Use YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            month_start = date(today.year, today.month, 1)

        pdf_path = generate_owner_statement_pdf(org, month_start)
        log_activity(request.user, 'owner_statement_generated', month_start.strftime('%B %Y'), pdf_path)
        url = media_url(request, pdf_path)
        return Response({
            'statement_url': url,
            'month': month_start.strftime('%B %Y'),
            'message': 'Owner statement generated for diaspora/absentee oversight.',
        })


class ActivityLogView(APIView):
    permission_classes = [IsOrgOwnerOnly]

    def get(self, request):
        org = get_organization(request.user)
        if not org:
            return Response([])
        logs = ActivityLog.objects.filter(organization=org).select_related('user')[:100]
        data = [{
            'id': log.id,
            'action': log.action,
            'detail': log.detail,
            'target': log.target,
            'user': log.user.username if log.user else 'System',
            'created_at': log.created_at.isoformat(),
        } for log in logs]
        return Response(data)
