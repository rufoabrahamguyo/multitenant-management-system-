from datetime import date

from django.utils import timezone

from users.activity import log_activity

from .models import Lease, Unit, UnitTransferRequest
from .ordering import order_units_by_number
from .services import create_lease_for_tenant


def get_waitlist_position(transfer_request):
    """1-based position among waitlisted requests for same category."""
    if transfer_request.status != UnitTransferRequest.Status.WAITLISTED:
        return None
    earlier = UnitTransferRequest.objects.filter(
        desired_category=transfer_request.desired_category,
        status=UnitTransferRequest.Status.WAITLISTED,
        created_at__lt=transfer_request.created_at,
    ).count()
    return earlier + 1


def get_category_availability(property_id=None, pm_id=None):
    """Vacant units grouped by category for tenant/manager views."""
    from .models import UnitCategory

    qs = UnitCategory.objects.select_related('property_ref').prefetch_related('units')
    if property_id:
        qs = qs.filter(property_ref_id=property_id)
    if pm_id:
        qs = qs.filter(property_ref__manager__property_manager_id=pm_id)

    results = []
    for cat in qs:
        vacant_units = order_units_by_number(
            cat.units.filter(status=Unit.Status.VACANT),
        )
        waitlist_count = UnitTransferRequest.objects.filter(
            desired_category=cat,
            status=UnitTransferRequest.Status.WAITLISTED,
        ).count()
        results.append({
            'category_id': cat.id,
            'category_name': cat.name,
            'description': cat.description,
            'property_id': cat.property_ref_id,
            'property_name': cat.property_ref.name,
            'vacant_count': vacant_units.count(),
            'waitlist_count': waitlist_count,
            'vacant_units': [{
                'id': u.id,
                'unit_number': u.unit_number,
                'rent_amount': float(u.rent_amount),
            } for u in vacant_units],
        })
    return results


def determine_initial_status(desired_category, preferred_unit=None):
    """Auto waitlist if no vacant units in category or preferred unit unavailable."""
    if preferred_unit:
        if preferred_unit.category_id != desired_category.id:
            return UnitTransferRequest.Status.PENDING
        if preferred_unit.status == Unit.Status.VACANT:
            return UnitTransferRequest.Status.PENDING
        return UnitTransferRequest.Status.WAITLISTED

    if desired_category.units.filter(status=Unit.Status.VACANT).exists():
        return UnitTransferRequest.Status.PENDING
    return UnitTransferRequest.Status.WAITLISTED


def approve_transfer(transfer_request, target_unit, reviewer):
    """Complete room change: end old lease, assign new unit, create new lease."""
    if transfer_request.status not in (
        UnitTransferRequest.Status.PENDING,
        UnitTransferRequest.Status.WAITLISTED,
        UnitTransferRequest.Status.APPROVED,
    ):
        raise ValueError('Request cannot be approved in current status.')

    if target_unit.status != Unit.Status.VACANT:
        raise ValueError('Target unit is not vacant.')

    if target_unit.category_id != transfer_request.desired_category_id:
        raise ValueError('Target unit must match requested category.')

    old_lease = transfer_request.current_lease
    old_unit = old_lease.unit
    tenant = transfer_request.tenant

    old_lease.is_active = False
    old_lease.end_date = date.today()
    old_lease.save(update_fields=['is_active', 'end_date'])

    old_unit.status = Unit.Status.VACANT
    old_unit.save(update_fields=['status'])

    new_lease = create_lease_for_tenant(tenant, target_unit)

    transfer_request.status = UnitTransferRequest.Status.COMPLETED
    transfer_request.assigned_unit = target_unit
    transfer_request.reviewed_by = reviewer
    transfer_request.reviewed_at = timezone.now()
    transfer_request.save()

    log_activity(
        reviewer, 'unit_transfer_completed',
        f'{tenant.user.username}: {old_unit.unit_number} → {target_unit.unit_number}',
        f'transfer:{transfer_request.id}',
    )
    return transfer_request


def reject_transfer(transfer_request, reviewer, reason=''):
    transfer_request.status = UnitTransferRequest.Status.REJECTED
    transfer_request.reviewed_by = reviewer
    transfer_request.reviewed_at = timezone.now()
    transfer_request.manager_note = reason or transfer_request.manager_note
    transfer_request.save()
    log_activity(
        reviewer, 'unit_transfer_rejected',
        transfer_request.tenant.user.username,
        f'transfer:{transfer_request.id}',
    )
    return transfer_request


def move_to_waitlist(transfer_request, reviewer=None):
    transfer_request.status = UnitTransferRequest.Status.WAITLISTED
    if reviewer:
        transfer_request.reviewed_by = reviewer
        transfer_request.reviewed_at = timezone.now()
    transfer_request.save()
    if reviewer:
        log_activity(
            reviewer, 'unit_transfer_waitlisted',
            transfer_request.tenant.user.username,
            f'transfer:{transfer_request.id}',
        )
    return transfer_request
