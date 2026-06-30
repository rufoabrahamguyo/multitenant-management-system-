from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from propizy.storage_utils import save_media_bytes


def generate_receipt_pdf(payment):
    """Generate a PDF receipt for a completed payment and save to media/receipts/."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=20,
    )

    tenant = payment.tenant
    lease = payment.lease
    elements = [
        Paragraph('Propizy Payment Receipt', title_style),
        Spacer(1, 12),
        Paragraph(f'<b>Tenant:</b> {tenant.user.get_full_name() or tenant.user.username}'),
        Paragraph(f'<b>Property:</b> {lease.unit.property.name}'),
        Paragraph(f'<b>Unit:</b> {lease.unit.unit_number}'),
        Spacer(1, 20),
    ]

    data = [
        ['Field', 'Value'],
        ['Receipt Number', payment.mpesa_receipt_number or 'N/A'],
        ['Transaction ID', payment.transaction_id or 'N/A'],
        ['Amount (KES)', f'{payment.amount:,.2f}'],
        ['Month Paid', payment.month_paid.strftime('%B %Y')],
        ['Payment Date', payment.payment_date.strftime('%d %b %Y %H:%M') if payment.payment_date else 'N/A'],
        ['Status', payment.status.upper()],
    ]
    table = Table(data, colWidths=[2.5 * inch, 3.5 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        '<i>Thank you for your payment. This is an official Propizy receipt.</i>',
        styles['Normal'],
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f'receipt_{payment.id}_{payment.mpesa_receipt_number or "pending"}.pdf'
    return save_media_bytes('receipts', filename, buffer.getvalue())


def generate_invoice_pdf(lease, invoice_month, amount):
    """Generate a monthly rent invoice PDF and save to media/invoices/."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=20,
    )

    tenant = lease.tenant
    due_date = date(invoice_month.year, invoice_month.month, 28)
    elements = [
        Paragraph('Propizy Rent Invoice', title_style),
        Spacer(1, 12),
        Paragraph(f'<b>Tenant:</b> {tenant.user.get_full_name() or tenant.user.username}'),
        Paragraph(f'<b>Property:</b> {lease.unit.property.name}'),
        Paragraph(f'<b>Unit:</b> {lease.unit.unit_number}'),
        Paragraph(f'<b>Invoice Period:</b> {invoice_month.strftime("%B %Y")}'),
        Spacer(1, 20),
    ]

    data = [
        ['Description', 'Amount (KES)'],
        [f'Monthly rent · {invoice_month.strftime("%B %Y")}', f'{amount:,.2f}'],
        ['Total Due', f'{amount:,.2f}'],
    ]
    table = Table(data, colWidths=[4 * inch, 2 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f'<b>Due Date:</b> {due_date.strftime("%d %B %Y")}', styles['Normal']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        '<i>Pay via M-PESA through the Propizy mobile app. Receipts are generated automatically upon payment.</i>',
        styles['Normal'],
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f'invoice_{lease.id}_{invoice_month.strftime("%Y_%m")}.pdf'
    return save_media_bytes('invoices', filename, buffer.getvalue())
