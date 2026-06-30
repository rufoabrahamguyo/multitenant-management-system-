from django.db.models import Case, IntegerField, Value, When
from django.db.models.functions import Cast


def order_units_by_number(queryset):
    """Sort units numerically when unit_number is digits, else alphabetically after."""
    return queryset.annotate(
        unit_num_int=Case(
            When(unit_number__regex=r'^\d+$', then=Cast('unit_number', IntegerField())),
            default=Value(2_147_483_647),
            output_field=IntegerField(),
        ),
    ).order_by('unit_num_int', 'unit_number')
