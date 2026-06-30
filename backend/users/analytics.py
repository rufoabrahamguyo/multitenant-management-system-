from datetime import date

from django.db.models import Sum

from payments.models import Payment


def month_start_offset(base: date, months_back: int) -> date:
    d = base
    for _ in range(months_back):
        d = date(d.year - 1, 12, 1) if d.month == 1 else date(d.year, d.month - 1, 1)
    return d


def monthly_collection_trend(payment_org: dict, month_start: date, months: int = 6) -> list[dict]:
    trend = []
    for i in range(months - 1, -1, -1):
        d = month_start_offset(month_start, i)
        total = Payment.objects.filter(
            **payment_org,
            status=Payment.Status.COMPLETED,
            month_paid__year=d.year,
            month_paid__month=d.month,
        ).aggregate(total=Sum('amount'))['total'] or 0
        trend.append({'month': d.strftime('%b %Y'), 'collected': float(total)})
    return trend


def collection_stats(payment_org: dict, month_start: date, active_leases_qs):
    expected = active_leases_qs.aggregate(total=Sum('rent_amount'))['total'] or 0
    collected = Payment.objects.filter(
        **payment_org,
        status=Payment.Status.COMPLETED,
        month_paid=month_start,
    ).aggregate(total=Sum('amount'))['total'] or 0
    rate = round(float(collected) / float(expected) * 100, 1) if expected else 0
    return rate, float(collected), float(expected)
