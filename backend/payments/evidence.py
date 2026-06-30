import hashlib
import json
from datetime import date

from django.utils import timezone

from properties.models import Lease
from users.models import ActivityLog, TenantInvite

from .models import EvidenceSnapshot, Invoice, Payment, PaymentReminder


def build_tenant_timeline(tenant_profile):
    """Chronological event chain for dispute evidence."""
    events = []
    user = tenant_profile.user

    invites = TenantInvite.objects.filter(
        email=user.email,
        used_at__isnull=False,
    ).order_by('used_at')
    for inv in invites:
        events.append({
            'timestamp': inv.used_at.isoformat() if inv.used_at else inv.created_at.isoformat(),
            'event': 'tenant_invite_accepted',
            'detail': f'Invite accepted for unit {inv.unit_id}',
            'actor': inv.invited_by.username if inv.invited_by else 'system',
        })

    leases = Lease.objects.filter(tenant=tenant_profile).order_by('created_at')
    for lease in leases:
        events.append({
            'timestamp': lease.created_at.isoformat(),
            'event': 'lease_created',
            'detail': f'Unit {lease.unit.unit_number} · KES {lease.rent_amount}/month',
            'actor': 'system',
        })

    for inv in Invoice.objects.filter(lease__tenant=tenant_profile).order_by('created_at'):
        events.append({
            'timestamp': inv.created_at.isoformat(),
            'event': 'invoice_issued',
            'detail': f'{inv.month.strftime("%B %Y")} · KES {inv.amount}',
            'actor': 'system',
        })

    for pay in Payment.objects.filter(tenant=tenant_profile).order_by('created_at'):
        ts = pay.payment_date.isoformat() if pay.payment_date else pay.created_at.isoformat()
        events.append({
            'timestamp': ts,
            'event': f'payment_{pay.status}',
            'detail': f'{pay.month_paid.strftime("%B %Y")} · KES {pay.amount} ({pay.payment_method})',
            'actor': pay.tenant.user.username,
        })

    for rem in PaymentReminder.objects.filter(lease__tenant=tenant_profile).order_by('sent_at'):
        events.append({
            'timestamp': rem.sent_at.isoformat(),
            'event': 'reminder_sent',
            'detail': rem.message[:120],
            'actor': 'system',
        })

    org = getattr(user.manager, 'owned_organization', None) if user.manager else None
    if org:
        logs = ActivityLog.objects.filter(
            organization=org,
            target__contains=f'tenant:{tenant_profile.id}',
        ).order_by('created_at')[:20]
        for log in logs:
            events.append({
                'timestamp': log.created_at.isoformat(),
                'event': log.action,
                'detail': log.detail,
                'actor': log.user.username if log.user else 'system',
            })

    events.sort(key=lambda e: e['timestamp'])
    return events


def build_evidence_bundle(tenant_profile):
    lease = Lease.objects.filter(tenant=tenant_profile, is_active=True).select_related(
        'unit__property',
    ).first()

    bundle = {
        'generated_at': timezone.now().isoformat(),
        'tenant': {
            'id': tenant_profile.id,
            'username': tenant_profile.user.username,
            'email': tenant_profile.user.email,
            'phone': tenant_profile.phone_number,
        },
        'lease': None,
        'timeline': build_tenant_timeline(tenant_profile),
        'payments': [],
        'invoices': [],
        'reminders': [],
    }

    if lease:
        bundle['lease'] = {
            'id': lease.id,
            'property': lease.unit.property.name,
            'unit': lease.unit.unit_number,
            'rent_amount': float(lease.rent_amount),
            'start_date': lease.start_date.isoformat(),
            'end_date': lease.end_date.isoformat(),
        }

    for p in Payment.objects.filter(tenant=tenant_profile).order_by('-month_paid')[:24]:
        bundle['payments'].append({
            'month': p.month_paid.isoformat(),
            'amount': float(p.amount),
            'status': p.status,
            'method': p.payment_method,
            'receipt': p.mpesa_receipt_number,
            'phone': p.pay_phone_number,
        })

    if lease:
        for inv in Invoice.objects.filter(lease=lease).order_by('-month')[:12]:
            bundle['invoices'].append({
                'month': inv.month.isoformat(),
                'amount': float(inv.amount),
            })
        for rem in PaymentReminder.objects.filter(lease=lease).order_by('-sent_at')[:12]:
            bundle['reminders'].append({
                'sent_at': rem.sent_at.isoformat(),
                'message': rem.message,
                'sms_sent': rem.sms_sent,
            })

    return bundle


def compute_bundle_hash(bundle):
    canonical = json.dumps(bundle, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def create_evidence_snapshot(tenant_profile, user, pdf_path=''):
    bundle = build_evidence_bundle(tenant_profile)
    sha256 = compute_bundle_hash(bundle)
    snapshot = EvidenceSnapshot.objects.create(
        tenant=tenant_profile,
        created_by=user,
        json_bundle=bundle,
        pdf_path=pdf_path,
        sha256_hash=sha256,
    )
    return snapshot
