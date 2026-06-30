from datetime import date, timedelta
from io import BytesIO

from django.db.models import Sum
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from properties.models import Lease, Property
from users.models import ActivityLog, OwnerAlert

from .integrity import get_org_integrity_alerts
from .models import CashCollection, Payment
from .services import get_org_arrears
from propizy.storage_utils import save_media_bytes


def generate_weekly_digest_pdf(org, week_start=None):
    """Weekly owner digest for absentee landlords."""
    pm_id = org.property_manager_id
    today = date.today()
    week_start = week_start or (today - timedelta(days=today.weekday()))
    week_end = week_start + timedelta(days=6)

    month_start = date(today.year, today.month, 1)
    properties = Property.objects.filter(manager__property_manager_id=pm_id)
    active_leases = Lease.objects.filter(
        unit__property__manager__property_manager_id=pm_id,
        is_active=True,
    )
    expected = sum(l.rent_amount for l in active_leases)
    collected = Payment.objects.filter(
        lease__unit__property__manager__property_manager_id=pm_id,
        status=Payment.Status.COMPLETED,
        month_paid=month_start,
    ).aggregate(total=Sum('amount'))['total'] or 0

    arrears = get_org_arrears(pm_id)
    integrity = get_org_integrity_alerts(pm_id)
    staff_actions = ActivityLog.objects.filter(
        organization=org,
        created_at__date__gte=week_start,
        created_at__date__lte=week_end,
    ).count()
    alerts = OwnerAlert.objects.filter(
        organization=org,
        created_at__date__gte=week_start,
        is_read=False,
    ).count()
    pending_cash_count = CashCollection.objects.filter(
        lease__unit__property__manager__property_manager_id=pm_id,
        status=CashCollection.Status.PENDING,
    ).count()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'], fontSize=20,
        textColor=colors.HexColor('#1e40af'), spaceAfter=14,
    )

    rate = round(float(collected) / float(expected) * 100, 1) if expected else 0
    elements = [
        Paragraph('Propizy Weekly Owner Digest', title_style),
        Paragraph(f'<b>Organization:</b> {org.name}'),
        Paragraph(f'<b>Week:</b> {week_start.strftime("%d %b")} to {week_end.strftime("%d %b %Y")}'),
        Paragraph(f'<b>Generated:</b> {today.strftime("%d %B %Y")}'),
        Spacer(1, 16),
        Paragraph('<b>COLLECTIONS (THIS MONTH)</b>', styles['Heading2']),
        Paragraph(f'Expected: KES {expected:,.0f} | Collected: KES {collected:,.0f} | Rate: {rate}%'),
        Spacer(1, 10),
        Paragraph('<b>GOVERNANCE SUMMARY</b>', styles['Heading2']),
        Paragraph(f'Properties: {properties.count()} | Active leases: {active_leases.count()}'),
        Paragraph(f'Tenants in arrears: {len(arrears)}'),
        Paragraph(f'Payment integrity flags: {len(integrity)}'),
        Paragraph(f'Staff actions this week: {staff_actions}'),
        Paragraph(f'Unread owner alerts: {alerts}'),
        Paragraph(f'Cash collections pending approval: {pending_cash_count}'),
        Spacer(1, 10),
        Paragraph(
            '<i>Independent weekly report for diaspora/absentee oversight · '
            'does not rely on caretaker verbal reports.</i>',
            styles['Normal'],
        ),
    ]

    doc.build(elements)
    buffer.seek(0)
    filename = f'weekly_digest_{org.id}_{week_start.isoformat()}.pdf'
    return save_media_bytes('digests', filename, buffer.getvalue())
