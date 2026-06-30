import csv
import io
from datetime import date

from django.db.models import Sum

from properties.models import Lease

from .models import Payment, UtilityCharge


def generate_etims_rent_csv(pm_id, month_start=None):
    """
    Basic rent income export formatted for accountant / eTIMS preparation.
    Columns align with common KRA rental income reporting fields.
    """
    today = date.today()
    month_start = month_start or date(today.year, today.month, 1)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Period', 'Property', 'Unit', 'Tenant Name', 'Tenant Phone',
        'Rent Amount (KES)', 'Utilities (KES)', 'Total Collected (KES)',
        'M-PESA Receipts', 'Payment Methods', 'Tax Category',
    ])

    leases = Lease.objects.filter(
        is_active=True,
        unit__property__manager__property_manager_id=pm_id,
    ).select_related('tenant__user', 'unit__property')

    for lease in leases:
        payments = Payment.objects.filter(
            lease=lease,
            month_paid=month_start,
            status=Payment.Status.COMPLETED,
        )
        collected = payments.aggregate(total=Sum('amount'))['total'] or 0
        utilities = UtilityCharge.objects.filter(
            lease=lease, month=month_start,
        ).aggregate(total=Sum('amount'))['total'] or 0
        receipts = ';'.join(p.mpesa_receipt_number for p in payments if p.mpesa_receipt_number)
        methods = ';'.join(set(p.payment_method for p in payments))

        writer.writerow([
            month_start.strftime('%Y-%m'),
            lease.unit.property.name,
            lease.unit.unit_number,
            lease.tenant.user.get_full_name() or lease.tenant.user.username,
            lease.tenant.phone_number,
            float(lease.rent_amount),
            float(utilities),
            float(collected),
            receipts or '-',
            methods or '-',
            'Residential Rental Income',
        ])

    return output.getvalue()
