from datetime import date
from decimal import Decimal

from properties.models import Lease

from .models import Payment, PaymentReminder


def month_start(d):
    return date(d.year, d.month, 1)


def add_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def iter_rent_months(start, end):
    current = month_start(start)
    last = month_start(end)
    while current <= last:
        yield current
        current = add_months(current, 1)


def resolve_month_paid(lease, preferred=None):
    """
    Return the oldest lease month that is not yet fully covered by rent payments
    and wallet debits. Returns None when every month through lease end is paid.
    """
    from .wallet import is_month_fully_paid

    lease_end = month_start(lease.end_date)
    candidate = month_start(lease.start_date)

    while candidate <= lease_end:
        if not is_month_fully_paid(lease, candidate):
            return candidate
        candidate = add_months(candidate, 1)

    return None


def get_lease_arrears(lease, as_of=None):
    from .wallet import auto_apply_wallet, get_month_rent_covered, is_month_fully_paid

    as_of = as_of or date.today()
    if not lease.is_active or lease.start_date > as_of:
        return []

    auto_apply_wallet(lease, as_of=as_of)

    end = min(as_of, lease.end_date)
    owed = []
    for rent_month in iter_rent_months(lease.start_date, end):
        if is_month_fully_paid(lease, rent_month):
            continue
        covered = get_month_rent_covered(lease, rent_month)
        outstanding = lease.rent_amount - covered
        days_late = (as_of - rent_month).days
        owed.append({
            'month': rent_month,
            'amount': outstanding,
            'days_late': days_late,
        })
    return owed


def get_org_arrears(pm_id):
    leases = Lease.objects.filter(
        is_active=True,
        unit__property__manager__property_manager_id=pm_id,
    ).select_related('tenant__user', 'unit__property')

    results = []
    for lease in leases:
        arrears = get_lease_arrears(lease)
        if not arrears:
            continue
        total_owed = sum(a['amount'] for a in arrears)
        last_reminder = PaymentReminder.objects.filter(lease=lease).order_by('-sent_at').first()
        results.append({
            'lease_id': lease.id,
            'tenant_id': lease.tenant_id,
            'tenant_name': lease.tenant.user.get_full_name() or lease.tenant.user.username,
            'phone_number': lease.tenant.phone_number,
            'property_name': lease.unit.property.name,
            'unit_number': lease.unit.unit_number,
            'rent_amount': lease.rent_amount,
            'months_overdue': len(arrears),
            'total_owed': total_owed,
            'oldest_month': arrears[0]['month'].isoformat(),
            'arrears_months': [a['month'].strftime('%B %Y') for a in arrears],
            'last_reminder_at': last_reminder.sent_at.isoformat() if last_reminder else None,
        })
    results.sort(key=lambda x: x['months_overdue'], reverse=True)
    return results


def send_payment_reminder(lease):
    from .notifications import send_sms
    from .whatsapp import arrears_whatsapp_message, build_whatsapp_link

    arrears = get_lease_arrears(lease)
    if not arrears:
        return None
    total = sum(a['amount'] for a in arrears)
    tenant_name = lease.tenant.user.get_full_name() or lease.tenant.user.username
    message = (
        f'Propizy Reminder: KES {total:,.0f} outstanding for {len(arrears)} month(s). '
        f'Pay via the Propizy app.'
    )
    whatsapp_link = ''
    phone = lease.tenant.phone_number
    if phone:
        wa_message = arrears_whatsapp_message(
            tenant_name, float(total), len(arrears), lease.unit.property.name,
        )
        whatsapp_link = build_whatsapp_link(phone, wa_message)

    reminder = PaymentReminder.objects.create(
        lease=lease, message=message, whatsapp_link=whatsapp_link,
    )

    if phone:
        result = send_sms(phone, message)
        if result.get('success'):
            reminder.sms_sent = True
            reminder.save(update_fields=['sms_sent'])

    return reminder


def get_tenant_balance(tenant_profile):
    from .wallet import get_or_create_wallet

    lease = Lease.objects.filter(tenant=tenant_profile, is_active=True).first()
    wallet = get_or_create_wallet(tenant_profile)
    if not lease:
        return {
            'balance': Decimal('0'),
            'wallet_balance': wallet.balance,
            'months_overdue': 0,
            'arrears_months': [],
        }
    arrears = get_lease_arrears(lease)
    total = sum(a['amount'] for a in arrears)
    wallet.refresh_from_db()
    return {
        'balance': total,
        'wallet_balance': wallet.balance,
        'months_overdue': len(arrears),
        'arrears_months': [a['month'].strftime('%B %Y') for a in arrears],
    }
