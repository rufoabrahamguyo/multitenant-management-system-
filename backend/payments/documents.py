from datetime import date
from io import BytesIO

from django.db.models import Sum
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .evidence import build_tenant_timeline
from .models import Invoice, Payment, PaymentReminder
from .services import get_lease_arrears, get_org_arrears
from properties.models import Lease, Property
from propizy.storage_utils import save_media_bytes


def _save_pdf(buffer, folder, filename):
    return save_media_bytes(folder, filename, buffer.getvalue())


def generate_owner_statement_pdf(org, month_start):
    pm_id = org.property_manager_id
    properties = Property.objects.filter(manager__property_manager_id=pm_id)
    arrears = get_org_arrears(pm_id)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'], fontSize=22,
        textColor=colors.HexColor('#1e40af'), spaceAfter=16,
    )

    elements = [
        Paragraph('Propizy Owner Statement', title_style),
        Paragraph(f'<b>Organization:</b> {org.name}'),
        Paragraph(f'<b>Period:</b> {month_start.strftime("%B %Y")}'),
        Paragraph(f'<b>Generated:</b> {date.today().strftime("%d %B %Y")}'),
        Spacer(1, 16),
        Paragraph(
            '<i>Monthly statement for diaspora and absentee landlords · '
            'independent of caretaker reports.</i>',
            styles['Normal'],
        ),
        Spacer(1, 20),
    ]

    total_expected = 0
    total_collected = 0
    rows = [['Property', 'Units', 'Expected', 'Collected', 'Arrears']]

    for prop in properties:
        active_leases = Lease.objects.filter(unit__property=prop, is_active=True)
        expected = sum(l.rent_amount for l in active_leases)
        collected = Payment.objects.filter(
            lease__unit__property=prop,
            status=Payment.Status.COMPLETED,
            month_paid=month_start,
        ).aggregate(total=Sum('amount'))['total'] or 0
        prop_arrears = sum(
            a['total_owed'] for a in arrears if a['property_name'] == prop.name
        )
        total_expected += expected
        total_collected += collected
        rows.append([
            prop.name,
            str(active_leases.count()),
            f'KES {expected:,.0f}',
            f'KES {collected:,.0f}',
            f'KES {prop_arrears:,.0f}',
        ])

    rows.append(['TOTAL', '', f'KES {total_expected:,.0f}', f'KES {total_collected:,.0f}',
                 f'KES {sum(a["total_owed"] for a in arrears):,.0f}'])

    table = Table(rows, colWidths=[2 * inch, 0.7 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 20))

    rate = round(float(total_collected) / float(total_expected) * 100, 1) if total_expected else 0
    elements.append(Paragraph(f'<b>Collection Rate:</b> {rate}%', styles['Normal']))
    elements.append(Paragraph(f'<b>Tenants in Arrears:</b> {len(arrears)}', styles['Normal']))

    doc.build(elements)
    buffer.seek(0)
    filename = f'owner_statement_{org.id}_{month_start.strftime("%Y_%m")}.pdf'
    return _save_pdf(buffer, 'statements', filename)


def generate_dispute_pack_pdf(tenant_profile):
    lease = Lease.objects.filter(tenant=tenant_profile, is_active=True).select_related(
        'unit__property',
    ).first()
    if not lease:
        return None

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'], fontSize=20,
        textColor=colors.HexColor('#1e40af'), spaceAfter=14,
    )

    user = tenant_profile.user
    elements = [
        Paragraph('Propizy Dispute Evidence Pack', title_style),
        Paragraph(
            '<i>Compiled record for dispute resolution · lease, payments, invoices, reminders.</i>',
            styles['Normal'],
        ),
        Spacer(1, 16),
        Paragraph('<b>TENANT DETAILS</b>', styles['Heading2']),
        Paragraph(f'Name: {user.get_full_name() or user.username}'),
        Paragraph(f'Email: {user.email}'),
        Paragraph(f'M-PESA Phone: {tenant_profile.phone_number}'),
        Paragraph(f'Property: {lease.unit.property.name} · Unit {lease.unit.unit_number}'),
        Spacer(1, 12),
        Paragraph('<b>LEASE AGREEMENT</b>', styles['Heading2']),
        Paragraph(f'Start: {lease.start_date.strftime("%d %B %Y")}'),
        Paragraph(f'End: {lease.end_date.strftime("%d %B %Y")}'),
        Paragraph(f'Monthly Rent: KES {lease.rent_amount:,.2f}'),
        Spacer(1, 12),
    ]

    arrears = get_lease_arrears(lease)
    elements.append(Paragraph('<b>CURRENT BALANCE</b>', styles['Heading2']))
    if arrears:
        total = sum(a['amount'] for a in arrears)
        elements.append(Paragraph(f'Outstanding: KES {total:,.2f} ({len(arrears)} month(s))'))
        for a in arrears:
            elements.append(Paragraph(f'  • {a["month"].strftime("%B %Y")} · KES {a["amount"]:,.2f}', styles['Normal']))
    else:
        elements.append(Paragraph('No outstanding arrears.', styles['Normal']))
    elements.append(Spacer(1, 12))

    payments = Payment.objects.filter(tenant=tenant_profile).order_by('-month_paid')[:12]
    pay_rows = [['Month', 'Amount', 'Status', 'Receipt', 'Date']]
    for p in payments:
        pay_rows.append([
            p.month_paid.strftime('%b %Y'),
            f'KES {p.amount:,.0f}',
            p.status,
            p.mpesa_receipt_number or '-',
            p.payment_date.strftime('%d %b %Y') if p.payment_date else '-',
        ])
    elements.append(Paragraph('<b>PAYMENT HISTORY</b>', styles['Heading2']))
    pay_table = Table(pay_rows, colWidths=[1.2 * inch, 1 * inch, 0.8 * inch, 1.2 * inch, 1 * inch])
    pay_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(pay_table)
    elements.append(Spacer(1, 12))

    invoices = Invoice.objects.filter(lease=lease).order_by('-month')[:6]
    if invoices:
        elements.append(Paragraph('<b>INVOICES ISSUED</b>', styles['Heading2']))
        for inv in invoices:
            elements.append(Paragraph(
                f'{inv.month.strftime("%B %Y")} · KES {inv.amount:,.2f}',
                styles['Normal'],
            ))

    reminders = PaymentReminder.objects.filter(lease=lease).order_by('-sent_at')[:6]
    if reminders:
        elements.append(Spacer(1, 12))
        elements.append(Paragraph('<b>REMINDER HISTORY</b>', styles['Heading2']))
        for r in reminders:
            elements.append(Paragraph(
                f'{r.sent_at.strftime("%d %b %Y %H:%M")} · {r.message}',
                styles['Normal'],
            ))

    timeline = build_tenant_timeline(tenant_profile)
    if timeline:
        elements.append(Spacer(1, 12))
        elements.append(Paragraph('<b>EVENT TIMELINE (EVIDENCE CHAIN)</b>', styles['Heading2']))
        for event in timeline[-15:]:
            elements.append(Paragraph(
                f'{event["timestamp"][:16]} · [{event["event"]}] {event["detail"]}',
                styles['Normal'],
            ))

    doc.build(elements)
    buffer.seek(0)
    filename = f'dispute_pack_{tenant_profile.id}.pdf'
    return _save_pdf(buffer, 'disputes', filename)
