from rest_framework.permissions import BasePermission, SAFE_METHODS

from .utils import get_pm_id, is_org_owner


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'MANAGER'
        )


class IsTenant(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'TENANT'
        )


class IsOrgOwner(BasePermission):
    def has_permission(self, request, view):
        return is_org_owner(request.user)


class IsOwnerOrManager(BasePermission):
    """Object-level check using property_manager_id isolation."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        pm_id = get_pm_id(user)
        if user.role == 'MANAGER' and pm_id:
            if hasattr(obj, 'manager') and hasattr(obj.manager, 'property_manager_id'):
                return obj.manager.property_manager_id == pm_id
            if hasattr(obj, 'property') and hasattr(obj.property, 'manager'):
                return obj.property.manager.property_manager_id == pm_id
            if hasattr(obj, 'unit') and hasattr(obj.unit, 'property'):
                return obj.unit.property.manager.property_manager_id == pm_id
            if hasattr(obj, 'tenant') and obj.tenant.user.manager:
                return obj.tenant.user.manager.property_manager_id == pm_id
            if hasattr(obj, 'user') and obj.user.manager:
                return obj.user.manager.property_manager_id == pm_id
        if user.role == 'TENANT':
            if hasattr(obj, 'tenant'):
                return obj.tenant.user_id == user.id
            if hasattr(obj, 'user'):
                return obj.user_id == user.id
        return False


class IsManagerOrReadOnlyTenant(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'MANAGER':
            return True
        if request.user.role == 'TENANT':
            return request.method in SAFE_METHODS
        return False


class IsOrgOwnerForWrite(BasePermission):
    """Managers can read; only org owners can create/update/delete financial or admin data."""

    message = 'Only the organization owner can perform this action. Staff have read-only access.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role != 'MANAGER':
            return False
        if request.method in SAFE_METHODS:
            return True
        if is_org_owner(request.user):
            return True
        from .governance import log_blocked_action
        resource = getattr(view, 'basename', None) or view.__class__.__name__
        log_blocked_action(request.user, resource, request.method.lower())
        return False


class IsOrgOwnerOnly(BasePermission):
    message = 'Only the organization owner can access this.'

    def has_permission(self, request, view):
        return is_org_owner(request.user)
