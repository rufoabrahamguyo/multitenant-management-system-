"""Shared helpers for organization-scoped data access."""

from users.utils import get_pm_id


def organization_filter(user, lookup='manager__property_manager_id'):
    """
    Return a Django ORM filter dict scoping querysets to the user's organization.

    Example:
        Property.objects.filter(**organization_filter(user))
        Lease.objects.filter(**organization_filter(user, 'unit__property__manager__property_manager_id'))
    """
    pm_id = get_pm_id(user)
    if pm_id is None:
        # Guarantee an empty queryset rather than filtering on NULL, which would
        # return unowned rows if the FK were nullable.
        return {'pk__in': []}
    return {lookup: pm_id}


def belongs_to_organization(user, obj_pm_id):
    """Return True when an object's property_manager_id matches the user's org."""
    pm_id = get_pm_id(user)
    return pm_id is not None and pm_id == obj_pm_id
