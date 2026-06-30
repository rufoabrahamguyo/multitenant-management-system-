from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import ActivityLog, Organization, OrganizationMember, OrganizationMpesaConfig, OwnerAlert, StaffInvite, TenantInvite, User
from .mpesa_integration_admin import MpesaIntegrationRequestAdmin  # noqa: F401


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'property_manager_id', 'manager']
    list_filter = ['role']
    fieldsets = UserAdmin.fieldsets + (
        ('Propizy', {'fields': ('role', 'property_manager_id', 'manager')}),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'owner', 'property_manager_id']


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role']


@admin.register(TenantInvite)
class TenantInviteAdmin(admin.ModelAdmin):
    list_display = ['email', 'organization', 'unit', 'expires_at', 'used_at']


@admin.register(StaffInvite)
class StaffInviteAdmin(admin.ModelAdmin):
    list_display = ['email', 'organization', 'expires_at', 'used_at']


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'organization', 'detail', 'severity', 'created_at']
    list_filter = ['action', 'organization', 'severity']


@admin.register(OwnerAlert)
class OwnerAlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'message', 'severity', 'is_read', 'organization', 'created_at']
    list_filter = ['alert_type', 'severity', 'is_read']


@admin.register(OrganizationMpesaConfig)
class OrganizationMpesaConfigAdmin(admin.ModelAdmin):
    list_display = ['organization', 'channel', 'shortcode', 'mpesa_env', 'stk_configured', 'updated_at']
    readonly_fields = ['consumer_key_set', 'consumer_secret_set', 'passkey_set', 'stk_configured', 'updated_at']
