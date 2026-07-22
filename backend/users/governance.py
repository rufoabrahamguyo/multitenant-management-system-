"""Delegated management trust model: permission matrix and owner alerts."""

from .models import OwnerAlert
from .utils import get_org_role, get_organization, is_org_owner

# Role capability matrix (documented + enforced via permission classes + frontend nav)
_OWNER_PERMS = {
    'dashboard': {'read': True},
    'properties': {'read': True, 'write': True},
    'units': {'read': True, 'write': True},
    'tenants': {'read': True, 'write': True},
    'leases': {'read': True, 'write': True},
    'payments': {'read': True, 'write': True},
    'cash_collections': {'read': True, 'write': True, 'approve': True},
    'invoices': {'read': True, 'write': True},
    'reminders': {'read': True, 'write': True},
    'transfers': {'read': True, 'write': True},
    'integrity_alerts': {'read': True},
    'dispute_packs': {'read': True, 'export': True},
    'evidence_bundles': {'read': True, 'export': True},
    'reconciliation': {'read': True, 'write': True},
    'mpesa_config': {'read': True, 'write': True},
    'utilities': {'read': True, 'write': True},
    'tax_export': {'read': True, 'export': True},
    'team': {'read': True, 'write': True},
    'activity_log': {'read': True},
    'owner_alerts': {'read': True},
    'weekly_digest': {'read': True, 'generate': True},
    'maintenance': {'read': True, 'write': True},
    'reports': {'read': True},
    'arrears': {'read': True},
    'governance': {'read': True, 'write': True},
    'account_suspend': {'read': True, 'write': True},
}

PERMISSION_MATRIX = {
    'OWNER': _OWNER_PERMS,
    'FRONT_DESK': {
        'dashboard': {'read': True},
        'properties': {'read': False, 'write': False},
        'units': {'read': True, 'write': False},
        'tenants': {'read': True, 'write': True},
        'leases': {'read': False, 'write': False},
        'payments': {'read': True, 'write': False},
        'cash_collections': {'read': True, 'write': True, 'approve': False},
        'invoices': {'read': False, 'write': False},
        'reminders': {'read': True, 'write': True},
        'transfers': {'read': True, 'write': True},
        'integrity_alerts': {'read': False},
        'dispute_packs': {'read': False, 'export': False},
        'evidence_bundles': {'read': False, 'export': False},
        'reconciliation': {'read': False, 'write': False},
        'mpesa_config': {'read': False, 'write': False},
        'utilities': {'read': False, 'write': False},
        'tax_export': {'read': False, 'export': False},
        'team': {'read': False, 'write': False},
        'activity_log': {'read': False},
        'owner_alerts': {'read': False},
        'weekly_digest': {'read': False, 'generate': False},
        'maintenance': {'read': False, 'write': False},
        'reports': {'read': False},
        'arrears': {'read': True},
        'governance': {'read': False, 'write': False},
        'account_suspend': {'read': True, 'write': True},
    },
    'MAINTENANCE': {
        'dashboard': {'read': True},
        'properties': {'read': False, 'write': False},
        'units': {'read': False, 'write': False},
        'tenants': {'read': False, 'write': False},
        'leases': {'read': False, 'write': False},
        'payments': {'read': False, 'write': False},
        'cash_collections': {'read': False, 'write': False, 'approve': False},
        'invoices': {'read': False, 'write': False},
        'reminders': {'read': False, 'write': False},
        'transfers': {'read': False, 'write': False},
        'integrity_alerts': {'read': False},
        'dispute_packs': {'read': False, 'export': False},
        'evidence_bundles': {'read': False, 'export': False},
        'reconciliation': {'read': False, 'write': False},
        'mpesa_config': {'read': False, 'write': False},
        'utilities': {'read': False, 'write': False},
        'tax_export': {'read': False, 'export': False},
        'team': {'read': False, 'write': False},
        'activity_log': {'read': False},
        'owner_alerts': {'read': False},
        'weekly_digest': {'read': False, 'generate': False},
        'maintenance': {'read': True, 'write': True},
        'reports': {'read': False},
        'arrears': {'read': False},
        'governance': {'read': False, 'write': False},
        'account_suspend': {'read': False, 'write': False},
    },
    'STAFF': {
        'dashboard': {'read': True},
        'properties': {'read': False, 'write': False},
        'units': {'read': True, 'write': False},
        'tenants': {'read': True, 'write': True},
        'leases': {'read': False, 'write': False},
        'payments': {'read': True, 'write': False},
        'cash_collections': {'read': True, 'write': True, 'approve': False},
        'invoices': {'read': False, 'write': False},
        'reminders': {'read': True, 'write': True},
        'transfers': {'read': True, 'write': True},
        'integrity_alerts': {'read': False},
        'dispute_packs': {'read': False, 'export': False},
        'evidence_bundles': {'read': False, 'export': False},
        'reconciliation': {'read': False, 'write': False},
        'mpesa_config': {'read': False, 'write': False},
        'utilities': {'read': False, 'write': False},
        'tax_export': {'read': False, 'export': False},
        'team': {'read': False, 'write': False},
        'activity_log': {'read': False},
        'owner_alerts': {'read': False},
        'weekly_digest': {'read': False, 'generate': False},
        'maintenance': {'read': True, 'write': True},
        'reports': {'read': False},
        'arrears': {'read': True},
        'governance': {'read': False, 'write': False},
        'account_suspend': {'read': True, 'write': True},
    },
}

STAFF_ASSIGNABLE_ROLES = frozenset({'FRONT_DESK', 'MAINTENANCE', 'STAFF'})

SENSITIVE_RESOURCES = frozenset({
    'integrity_alerts', 'dispute_packs', 'evidence_bundles',
    'mpesa_config', 'tax_export', 'activity_log', 'owner_alerts',
    'weekly_digest', 'payments_write', 'invoices_write', 'account_suspend',
})

# Frontend nav: path → required resource + action
NAV_PERMISSIONS = {
    '/dashboard': ('dashboard', 'read'),
    '/properties': ('properties', 'read'),
    '/units': ('units', 'read'),
    '/transfers': ('transfers', 'read'),
    '/tenants': ('tenants', 'read'),
    '/leases': ('leases', 'read'),
    '/payments': ('payments', 'read'),
    '/reports': ('reports', 'read'),
    '/arrears': ('arrears', 'read'),
    '/governance': ('governance', 'read'),
    '/maintenance': ('maintenance', 'read'),
    '/team': ('team', 'read'),
    '/activity': ('activity_log', 'read'),
}


def get_user_permissions(user):
    role = get_org_role(user) or 'STAFF'
    return PERMISSION_MATRIX.get(role, PERMISSION_MATRIX['STAFF'])


def staff_can(user, resource, action='read'):
    perms = get_user_permissions(user)
    resource_perms = perms.get(resource, {})
    return resource_perms.get(action, False)


def log_owner_alert(user, alert_type, message, resource='', severity=OwnerAlert.Severity.MEDIUM):
    org = get_organization(user)
    if not org:
        return
    OwnerAlert.objects.create(
        organization=org,
        triggered_by=user if not is_org_owner(user) else None,
        alert_type=alert_type,
        message=message[:500],
        resource=resource[:255],
        severity=severity,
    )


def log_blocked_action(user, resource, action_attempted):
    from .activity import log_activity

    log_activity(
        user, 'blocked_action',
        f'Staff blocked: {action_attempted} on {resource}',
        resource,
    )
    log_owner_alert(
        user,
        OwnerAlert.AlertType.BLOCKED_ACTION,
        f'{user.username} attempted {action_attempted} on {resource} (blocked by RBAC)',
        resource,
        severity=OwnerAlert.Severity.HIGH,
    )


def log_sensitive_access(user, resource, detail=''):
    from .activity import log_activity

    if is_org_owner(user):
        return
    log_activity(user, 'sensitive_access', detail or resource, resource)
    log_owner_alert(
        user,
        OwnerAlert.AlertType.SENSITIVE_ACCESS,
        f'{user.username} accessed sensitive resource: {resource}',
        resource,
        severity=OwnerAlert.Severity.MEDIUM,
    )
