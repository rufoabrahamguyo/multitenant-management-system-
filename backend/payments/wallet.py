from decimal import Decimal

from datetime import date

from django.db import transaction
from django.db.models import Sum

from .models import Payment, TenantWallet, WalletTransaction
from .services import add_months, iter_rent_months, month_start


def get_or_create_wallet(tenant):
    wallet, _ = TenantWallet.objects.get_or_create(tenant=tenant)
    return wallet


def get_month_rent_covered(lease, rent_month):
    payment_cover = Payment.objects.filter(
        lease=lease,
        month_paid=rent_month,
        status=Payment.Status.COMPLETED,
    ).aggregate(total=Sum('rent_applied'))['total'] or Decimal('0')

    wallet_cover = WalletTransaction.objects.filter(
        lease=lease,
        rent_month=rent_month,
        transaction_type=WalletTransaction.Type.DEBIT,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    return payment_cover + wallet_cover


def is_month_fully_paid(lease, rent_month):
    return get_month_rent_covered(lease, rent_month) >= lease.rent_amount


def credit_wallet(wallet, amount, payment=None, description=''):
    amount = Decimal(str(amount))
    if amount <= 0:
        return None
    wallet.balance += amount
    wallet.save(update_fields=['balance', 'updated_at'])
    return WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=WalletTransaction.Type.CREDIT,
        amount=amount,
        balance_after=wallet.balance,
        source=WalletTransaction.Source.PAYMENT if payment else WalletTransaction.Source.ADJUSTMENT,
        payment=payment,
        description=description or 'Wallet credit',
    )


def debit_wallet(wallet, amount, lease, rent_month, description=''):
    amount = Decimal(str(amount))
    if amount <= 0:
        return None
    if wallet.balance < amount:
        raise ValueError('Insufficient wallet balance.')
    wallet.balance -= amount
    wallet.save(update_fields=['balance', 'updated_at'])
    return WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=WalletTransaction.Type.DEBIT,
        amount=amount,
        balance_after=wallet.balance,
        source=WalletTransaction.Source.RENT_APPLICATION,
        lease=lease,
        rent_month=rent_month,
        description=description or f'Rent for {rent_month.strftime("%B %Y")}',
    )


@transaction.atomic
def auto_apply_wallet(lease, as_of=None):
    wallet = get_or_create_wallet(lease.tenant)
    wallet = TenantWallet.objects.select_for_update().get(pk=wallet.pk)
    if wallet.balance <= 0:
        return

    lease_end = month_start(lease.end_date)
    if lease.start_date > lease_end:
        return

    apply_through = month_start(as_of) if as_of is not None else lease_end
    end = min(lease_end, apply_through)

    for rent_month in iter_rent_months(lease.start_date, end):
        if wallet.balance <= 0:
            break
        if is_month_fully_paid(lease, rent_month):
            continue
        covered = get_month_rent_covered(lease, rent_month)
        needed = lease.rent_amount - covered
        apply_amount = min(wallet.balance, needed)
        if apply_amount > 0:
            debit_wallet(
                wallet,
                apply_amount,
                lease,
                rent_month,
                description=f'Rent for {rent_month.strftime("%B %Y")}',
            )
            wallet.refresh_from_db()


def preview_payment_allocation(lease, rent_month, amount):
    amount = Decimal(str(amount))
    already = get_month_rent_covered(lease, rent_month)
    needed = max(lease.rent_amount - already, Decimal('0'))
    rent_applied = min(amount, needed)
    wallet_credit = amount - rent_applied
    return {
        'rent_applied': rent_applied,
        'wallet_credit': wallet_credit,
        'month_remaining_after': max(needed - rent_applied, Decimal('0')),
    }


@transaction.atomic
def process_completed_payment(payment):
    lease = payment.lease
    wallet = get_or_create_wallet(payment.tenant)

    auto_apply_wallet(lease, as_of=date.today())

    month = payment.month_paid
    preview = preview_payment_allocation(lease, month, payment.amount)

    payment.rent_applied = preview['rent_applied']
    payment.wallet_applied = preview['wallet_credit']
    payment.save(update_fields=['rent_applied', 'wallet_applied'])

    if preview['wallet_credit'] > 0:
        credit_wallet(
            wallet,
            preview['wallet_credit'],
            payment=payment,
            description=f'Credit from payment #{payment.id}',
        )

    # Full wallet-only payments prepay future months; partial overpayments stay in wallet.
    if preview['rent_applied'] == 0 and preview['wallet_credit'] > 0:
        auto_apply_wallet(lease)
    else:
        auto_apply_wallet(lease, as_of=date.today())


def get_wallet_summary(tenant):
    wallet = get_or_create_wallet(tenant)
    lease = tenant.leases.filter(is_active=True).first()
    if lease:
        auto_apply_wallet(lease, as_of=date.today())
        wallet.refresh_from_db()

    transactions = WalletTransaction.objects.filter(wallet=wallet).select_related(
        'payment', 'lease__unit__property',
    )[:30]

    return wallet, transactions
