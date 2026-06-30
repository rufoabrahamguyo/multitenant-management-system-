from decimal import Decimal

from django.db import migrations


def backfill_property_units(apps, schema_editor):
    Property = apps.get_model('properties', 'Property')
    Unit = apps.get_model('properties', 'Unit')

    for prop in Property.objects.all():
        if prop.total_units < 1:
            continue
        existing = set(prop.units.values_list('unit_number', flat=True))
        to_create = []
        for n in range(1, prop.total_units + 1):
            unit_number = str(n)
            if unit_number in existing:
                continue
            to_create.append(Unit(
                property_id=prop.id,
                unit_number=unit_number,
                rent_amount=Decimal('0'),
                status='vacant',
            ))
        if to_create:
            Unit.objects.bulk_create(to_create)
        actual = prop.units.count()
        if prop.total_units != actual:
            prop.total_units = actual
            prop.save(update_fields=['total_units'])


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0004_tenantprofile_id_cards'),
    ]

    operations = [
        migrations.RunPython(backfill_property_units, migrations.RunPython.noop),
    ]
