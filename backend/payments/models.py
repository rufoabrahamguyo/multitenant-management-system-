from django.conf import settings
from django.db import models

from properties.models import Lease, TenantProfile


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    class Method(models.TextChoices):
        MPESA = 'mpesa', 'M-PESA'
        CASH = 'cash', 'Cash'
        BANK = 'bank', 'Bank'

    tenant = models.ForeignKey(TenantProfile, on_delete=models.CASCADE, related_name='payments')
    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    month_paid = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    transaction_id = models.CharField(max_length=100, blank=True, unique=True, null=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    pay_phone_number = models.CharField(max_length=15, blank=True)
    payment_date = models.DateTimeField(null=True, blank=True)
    receipt_pdf = models.FileField(upload_to='receipts/', blank=True, null=True)
    payment_method = models.CharField(max_length=10, choices=Method.choices, default=Method.MPESA)
    rent_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    wallet_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Payment {self.id} - {self.tenant.user.username} - {self.status}'


class TenantWallet(models.Model):
    tenant = models.OneToOneField(
        TenantProfile, on_delete=models.CASCADE, related_name='wallet',
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Wallet {self.tenant.user.username} - KES {self.balance}'


class WalletTransaction(models.Model):
    class Type(models.TextChoices):
        CREDIT = 'credit', 'Credit'
        DEBIT = 'debit', 'Debit'

    class Source(models.TextChoices):
        PAYMENT = 'payment', 'Payment'
        RENT_APPLICATION = 'rent_application', 'Rent Application'
        ADJUSTMENT = 'adjustment', 'Adjustment'

    wallet = models.ForeignKey(TenantWallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=Type.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    source = models.CharField(max_length=20, choices=Source.choices)
    payment = models.ForeignKey(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='wallet_transactions',
    )
    lease = models.ForeignKey(
        Lease, on_delete=models.SET_NULL, null=True, blank=True, related_name='wallet_transactions',
    )
    rent_month = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.transaction_type} KES {self.amount} ({self.wallet_id})'


class PaymentReminder(models.Model):
    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='reminders')
    message = models.TextField()
    sms_sent = models.BooleanField(default=False)
    whatsapp_link = models.URLField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sent_at']


class Invoice(models.Model):
    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='invoices')
    month = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    invoice_pdf = models.FileField(upload_to='invoices/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-month']
        unique_together = ['lease', 'month']

    def __str__(self):
        return f'Invoice {self.lease_id} - {self.month.strftime("%B %Y")}'


class CashCollection(models.Model):
    """Caretaker-recorded cash rent; owner must approve before it counts as collected."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Owner Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='cash_collections')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='cash_collections_recorded',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    month_paid = models.DateField()
    notes = models.TextField(blank=True)
    receipt_photo = models.FileField(upload_to='cash_receipts/', blank=True, null=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cash_collections_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    linked_payment = models.OneToOneField(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_collection',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Cash {self.amount} - {self.status}'


class UtilityCharge(models.Model):
    """Service charge / utility billing split from base rent."""

    class UtilityType(models.TextChoices):
        WATER = 'water', 'Water'
        ELECTRICITY = 'electricity', 'Electricity'
        SERVICE = 'service', 'Service Charge'
        GARBAGE = 'garbage', 'Garbage'
        OTHER = 'other', 'Other'

    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='utility_charges')
    utility_type = models.CharField(max_length=15, choices=UtilityType.choices, default=UtilityType.SERVICE)
    month = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-month']
        unique_together = ['lease', 'utility_type', 'month']

    def __str__(self):
        return f'{self.utility_type} {self.month.strftime("%b %Y")} - KES {self.amount}'


class MpesaStatementImport(models.Model):
    """CSV import of Paybill/Till statement for reconciliation."""

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, related_name='mpesa_imports',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
    )
    filename = models.CharField(max_length=255)
    imported_at = models.DateTimeField(auto_now_add=True)
    matched_count = models.PositiveIntegerField(default=0)
    orphan_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-imported_at']


class MpesaStatementLine(models.Model):
    class MatchStatus(models.TextChoices):
        MATCHED = 'matched', 'Matched'
        ORPHAN = 'orphan', 'Orphan (unmatched)'
        DUPLICATE = 'duplicate', 'Duplicate'

    statement_import = models.ForeignKey(
        MpesaStatementImport, on_delete=models.CASCADE, related_name='lines',
    )
    transaction_date = models.DateTimeField(null=True, blank=True)
    receipt_number = models.CharField(max_length=50, db_index=True)
    phone_number = models.CharField(max_length=15, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    account_reference = models.CharField(max_length=100, blank=True)
    match_status = models.CharField(max_length=12, choices=MatchStatus.choices, default=MatchStatus.ORPHAN)
    matched_payment = models.ForeignKey(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='statement_lines',
    )
    raw_row = models.TextField(blank=True)

    class Meta:
        ordering = ['-transaction_date']


class EvidenceSnapshot(models.Model):
    """Immutable evidence bundle with SHA-256 integrity hash."""

    tenant = models.ForeignKey(TenantProfile, on_delete=models.CASCADE, related_name='evidence_snapshots')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    json_bundle = models.JSONField()
    pdf_path = models.CharField(max_length=500, blank=True)
    sha256_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Evidence {self.sha256_hash[:12]}... for tenant {self.tenant_id}'
