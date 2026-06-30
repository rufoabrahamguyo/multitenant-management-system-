from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from propizy.storage_utils import save_media_bytes


def generate_lease_agreement_pdf(lease, organization_name):
    """Generate a Kenya-compliant written tenancy agreement on lease creation."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'], fontSize=20,
        textColor=colors.HexColor('#1e40af'), spaceAfter=16,
    )

    tenant = lease.tenant.user
    prop = lease.unit.property
    elements = [
        Paragraph('WRITTEN TENANCY AGREEMENT', title_style),
        Paragraph(
            '<i>Issued under the Kenya Landlord and Tenant framework · '
            'digitally verified via Propizy invite-only onboarding.</i>',
            styles['Normal'],
        ),
        Spacer(1, 20),
        Paragraph('<b>1. PARTIES</b>', styles['Heading3']),
        Paragraph(f'<b>Landlord/Manager:</b> {organization_name}'),
        Paragraph(f'<b>Tenant:</b> {tenant.get_full_name() or tenant.username} ({tenant.email})'),
        Paragraph(f'<b>M-PESA Phone:</b> {lease.tenant.phone_number}'),
        Spacer(1, 12),
        Paragraph('<b>2. PREMISES</b>', styles['Heading3']),
        Paragraph(f'Property: {prop.name}'),
        Paragraph(f'Address: {prop.address}'),
        Paragraph(f'Unit: {lease.unit.unit_number}'),
        Spacer(1, 12),
        Paragraph('<b>3. TERM</b>', styles['Heading3']),
        Paragraph(f'Commencement: {lease.start_date.strftime("%d %B %Y")}'),
        Paragraph(f'Expiry: {lease.end_date.strftime("%d %B %Y")}'),
        Spacer(1, 12),
        Paragraph('<b>4. RENT</b>', styles['Heading3']),
        Paragraph(f'Monthly rent: KES {lease.rent_amount:,.2f}'),
        Paragraph('Payment method: M-PESA via Propizy mobile app (STK Push).'),
        Paragraph('Due date: Last day of each calendar month unless otherwise agreed.'),
        Spacer(1, 12),
        Paragraph('<b>5. TENANT OBLIGATIONS</b>', styles['Heading3']),
        Paragraph('• Pay rent on time through the Propizy app'),
        Paragraph('• Maintain the premises in good condition'),
        Paragraph('• Report maintenance issues via the Propizy app'),
        Paragraph('• Not sublet without written consent'),
        Spacer(1, 12),
        Paragraph('<b>6. LANDLORD OBLIGATIONS</b>', styles['Heading3']),
        Paragraph('• Provide habitable premises and essential services'),
        Paragraph('• Issue digital receipts upon confirmed payment'),
        Paragraph('• Follow due process for any tenancy termination'),
        Spacer(1, 12),
        Paragraph('<b>7. DIGITAL RECORD</b>', styles['Heading3']),
        Paragraph(
            'This agreement was generated automatically when the tenant accepted '
            'a verified Propizy invite. All payments, invoices, and receipts are '
            'stored as auditable digital records.',
            styles['Normal'],
        ),
        Spacer(1, 30),
        Paragraph(f'Agreement Reference: LEASE-{lease.id}', styles['Normal']),
    ]

    doc.build(elements)
    buffer.seek(0)

    filename = f'lease_agreement_{lease.id}.pdf'
    return save_media_bytes('leases', filename, buffer.getvalue())
