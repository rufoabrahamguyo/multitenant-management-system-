from datetime import date, timedelta
from decimal import Decimal

from users.utils import get_organization

from .lease_doc import generate_lease_agreement_pdf
from .models import Lease, Unit


def sync_property_units(property_obj, desired_count=None):
    """Create placeholder units up to total_units (or desired_count)."""
    target = desired_count if desired_count is not None else property_obj.total_units
    if not target or target < 1:
        return []

    existing_numbers = set(property_obj.units.values_list('unit_number', flat=True))
    to_create = []
    for n in range(1, target + 1):
        unit_number = str(n)
        if unit_number in existing_numbers:
            continue
        to_create.append(Unit(
            property=property_obj,
            unit_number=unit_number,
            rent_amount=Decimal('0'),
            status=Unit.Status.VACANT,
        ))

    created = Unit.objects.bulk_create(to_create) if to_create else []
    actual_count = property_obj.units.count()
    if property_obj.total_units != actual_count:
        property_obj.total_units = actual_count
        property_obj.save(update_fields=['total_units'])
    return created


def update_property_unit_count(property_obj):
    property_obj.total_units = property_obj.units.count()
    property_obj.save(update_fields=['total_units'])


def create_lease_for_tenant(tenant_profile, unit, months=12, preserve_rent_amount=False):
    """Create an active lease when a tenant is assigned to a unit."""
    today = date.today()
    lease, created = Lease.objects.get_or_create(
        tenant=tenant_profile,
        unit=unit,
        is_active=True,
        defaults={
            'start_date': today,
            'end_date': today + timedelta(days=months * 30),
            'rent_amount': unit.rent_amount,
        },
    )
    if not created:
        updates = ['is_active']
        lease.is_active = True
        if not preserve_rent_amount:
            lease.rent_amount = unit.rent_amount
            updates.append('rent_amount')
        lease.save(update_fields=updates)

    tenant_profile.current_unit = unit
    tenant_profile.save(update_fields=['current_unit'])
    unit.status = Unit.Status.OCCUPIED
    unit.save(update_fields=['status'])

    if not lease.pdf_upload:
        org = get_organization(unit.property.manager)
        org_name = org.name if org else unit.property.manager.get_full_name() or unit.property.manager.username
        pdf_path = generate_lease_agreement_pdf(lease, org_name)
        lease.pdf_upload = pdf_path
        lease.save(update_fields=['pdf_upload'])

    return lease
