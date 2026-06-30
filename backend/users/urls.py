from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .governance_views import MpesaConfigView, MpesaIntegrationRequestView, OwnerAlertsView, PermissionMatrixView, WeeklyDigestView
from .views import (
    ActivityLogView,
    CurrentUserView,
    DashboardView,
    ForgotPasswordView,
    InvitePreviewView,
    LoginView,
    ManagerRegisterView,
    OwnerStatementView,
    ReportsView,
    ResetPasswordView,
    SendPhoneCodeView,
    StaffInvitePreviewView,
    StaffInviteViewSet,
    StaffRegisterView,
    TeamViewSet,
    TenantInviteViewSet,
    TenantRegisterView,
    VerifyPhoneView,
)

router = DefaultRouter()
router.register(r'tenant-invites', TenantInviteViewSet, basename='tenant-invite')
router.register(r'staff-invites', StaffInviteViewSet, basename='staff-invite')
router.register(r'team', TeamViewSet, basename='team')

urlpatterns = [
    path('register/', ManagerRegisterView.as_view(), name='register'),
    path('register-tenant/', TenantRegisterView.as_view(), name='register-tenant'),
    path('register-staff/', StaffRegisterView.as_view(), name='register-staff'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('phone/send-code/', SendPhoneCodeView.as_view(), name='phone-send-code'),
    path('phone/verify/', VerifyPhoneView.as_view(), name='phone-verify'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('invite/<uuid:token>/', InvitePreviewView.as_view(), name='invite-preview'),
    path('staff-invite/<uuid:token>/', StaffInvitePreviewView.as_view(), name='staff-invite-preview'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('reports/', ReportsView.as_view(), name='reports'),
    path('owner-statement/', OwnerStatementView.as_view(), name='owner-statement'),
    path('activity/', ActivityLogView.as_view(), name='activity'),
    path('permission-matrix/', PermissionMatrixView.as_view(), name='permission-matrix'),
    path('owner-alerts/', OwnerAlertsView.as_view(), name='owner-alerts'),
    path('mpesa-config/', MpesaConfigView.as_view(), name='mpesa-config'),
    path('mpesa-integration-request/', MpesaIntegrationRequestView.as_view(), name='mpesa-integration-request'),
    path('weekly-digest/', WeeklyDigestView.as_view(), name='weekly-digest'),
] + router.urls
