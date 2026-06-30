from django.contrib.auth import get_user_model

User = get_user_model()


def get_pm_id(user):
    """Return the property_manager_id for managers/staff."""
    if not user or not user.is_authenticated or user.role != User.Role.MANAGER:
        return None
    try:
        return user.owned_organization.property_manager_id
    except Exception:
        pass
    try:
        return user.org_membership.organization.property_manager_id
    except Exception:
        pass
    return None


def get_organization(user):
    if not user or not user.is_authenticated or user.role != User.Role.MANAGER:
        return None
    try:
        return user.owned_organization
    except Exception:
        pass
    try:
        return user.org_membership.organization
    except Exception:
        pass
    return None


def get_org_owner(user):
    org = get_organization(user)
    return org.owner if org else None


def is_org_owner(user):
    if not user or user.role != User.Role.MANAGER:
        return False
    try:
        return bool(user.owned_organization)
    except Exception:
        return False


def is_org_staff(user):
    if not user or user.role != User.Role.MANAGER:
        return False
    try:
        user.owned_organization
        return False
    except Exception:
        pass
    try:
        return bool(user.org_membership)
    except Exception:
        return False


def get_org_role(user):
    if is_org_owner(user):
        return 'OWNER'
    if is_org_staff(user):
        return 'STAFF'
    return None
