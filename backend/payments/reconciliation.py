import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.utils import timezone

from properties.models import Lease

from .models import MpesaStatementImport, MpesaStatementLine, Payment
from .services import get_org_arrears


def parse_mpesa_csv(file_content):
    """Parse M-PESA statement CSV. Expected columns: date, receipt, phone, amount, reference."""
    reader = csv.DictReader(io.StringIO(file_content))
    rows = []
    for row in reader:
        normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        rows.append(normalized)
    return rows


def _parse_amount(val):
    try:
        cleaned = val.replace(',', '').replace('KES', '').strip()
        return Decimal(cleaned)
    except (InvalidOperation, AttributeError):
        return None


def _parse_date(val):
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y %H:%M', '%d/%m/%Y'):
        try:
            return timezone.make_aware(datetime.strptime(val, fmt))
        except (ValueError, TypeError):
            continue
    return None


def import_statement_csv(organization, user, filename, file_content, pm_id):
    """Import CSV and attempt to match lines to existing payments."""
    rows = parse_mpesa_csv(file_content)
    imp = MpesaStatementImport.objects.create(
        organization=organization,
        uploaded_by=user,
        filename=filename,
    )

    matched = 0
    orphans = 0

    for row in rows:
        receipt = row.get('receipt') or row.get('receipt number') or row.get('transaction id') or ''
        phone = row.get('phone') or row.get('phone number') or row.get('msisdn') or ''
        amount = _parse_amount(row.get('amount') or row.get('paid in') or row.get('credit') or '0')
        ref = row.get('reference') or row.get('account') or row.get('bill ref number') or ''
        tx_date = _parse_date(row.get('date') or row.get('completion time') or row.get('transaction date') or '')

        if amount is None:
            continue

        line = MpesaStatementLine.objects.create(
            statement_import=imp,
            transaction_date=tx_date,
            receipt_number=receipt[:50],
            phone_number=phone[:15],
            amount=amount,
            account_reference=ref[:100],
            raw_row=str(row)[:500],
        )

        payment = None
        if receipt:
            payment = Payment.objects.filter(
                mpesa_receipt_number=receipt,
                lease__unit__property__manager__property_manager_id=pm_id,
            ).first()
        if not payment and amount:
            # Fallback: require amount + phone + lease ID extracted from account reference.
            # Amount + phone alone is too weak (same tenant/amount across months would
            # produce false matches). Account reference encodes the lease ID, making
            # this combination essentially unique.
            qs = Payment.objects.filter(
                amount=amount,
                lease__unit__property__manager__property_manager_id=pm_id,
                status=Payment.Status.COMPLETED,
            )
            if len(phone) >= 9:
                qs = qs.filter(pay_phone_number__endswith=phone[-9:])
            m = re.search(r'RENT-(\d+)', ref, re.IGNORECASE) if ref else None
            if m:
                qs = qs.filter(lease_id=int(m.group(1)))
            else:
                qs = qs.none()
            payment = qs.first()

        if payment:
            line.match_status = MpesaStatementLine.MatchStatus.MATCHED
            line.matched_payment = payment
            line.save(update_fields=['match_status', 'matched_payment'])
            matched += 1
        else:
            orphans += 1

    imp.matched_count = matched
    imp.orphan_count = orphans
    imp.save(update_fields=['matched_count', 'orphan_count'])
    return imp


def get_reconciliation_summary(pm_id):
    """Orphan transactions + silent tenants (expected rent, no payment)."""
    from users.models import Organization

    org = Organization.objects.filter(property_manager_id=pm_id).first()
    if not org:
        return {'orphan_transactions': [], 'silent_tenants': [], 'imports': []}

    orphan_lines = MpesaStatementLine.objects.filter(
        statement_import__organization=org,
        match_status=MpesaStatementLine.MatchStatus.ORPHAN,
    ).select_related('statement_import').order_by('-id')[:50]

    orphans = [{
        'id': line.id,
        'receipt_number': line.receipt_number,
        'phone_number': line.phone_number,
        'amount': float(line.amount),
        'account_reference': line.account_reference,
        'transaction_date': line.transaction_date.isoformat() if line.transaction_date else None,
        'import_filename': line.statement_import.filename,
    } for line in orphan_lines]

    today = date.today()
    month_start = date(today.year, today.month, 1)
    silent = []
    leases = Lease.objects.filter(
        is_active=True,
        unit__property__manager__property_manager_id=pm_id,
    ).select_related('tenant__user', 'unit__property')

    for lease in leases:
        paid = Payment.objects.filter(
            lease=lease,
            month_paid=month_start,
            status=Payment.Status.COMPLETED,
        ).exists()
        if not paid:
            silent.append({
                'lease_id': lease.id,
                'tenant_name': lease.tenant.user.get_full_name() or lease.tenant.user.username,
                'phone_number': lease.tenant.phone_number,
                'property_name': lease.unit.property.name,
                'unit_number': lease.unit.unit_number,
                'expected_amount': float(lease.rent_amount),
                'month': month_start.isoformat(),
            })

    imports = MpesaStatementImport.objects.filter(organization=org).order_by('-imported_at')[:10]
    import_list = [{
        'id': i.id,
        'filename': i.filename,
        'imported_at': i.imported_at.isoformat(),
        'matched_count': i.matched_count,
        'orphan_count': i.orphan_count,
    } for i in imports]

    arrears = get_org_arrears(pm_id)

    return {
        'orphan_transactions': orphans,
        'silent_tenants': silent,
        'imports': import_list,
        'tenants_in_arrears': len(arrears),
    }
