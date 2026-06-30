from django.contrib import admin

from .models import (
    CashCollection,
    EvidenceSnapshot,
    Invoice,
    MpesaStatementImport,
    MpesaStatementLine,
    Payment,
    PaymentReminder,
    TenantWallet,
    UtilityCharge,
    WalletTransaction,
)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'tenant', 'amount', 'rent_applied', 'wallet_applied', 'month_paid', 'status', 'payment_date']
    list_filter = ['status', 'month_paid']


@admin.register(TenantWallet)
class TenantWalletAdmin(admin.ModelAdmin):
    list_display = ['id', 'tenant', 'balance', 'updated_at']


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'wallet', 'transaction_type', 'amount', 'balance_after', 'rent_month', 'created_at']
    list_filter = ['transaction_type', 'source']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['id', 'lease', 'month', 'amount', 'created_at']


@admin.register(PaymentReminder)
class PaymentReminderAdmin(admin.ModelAdmin):
    list_display = ['id', 'lease', 'sent_at', 'sms_sent']


@admin.register(CashCollection)
class CashCollectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'lease', 'amount', 'status', 'recorded_by', 'created_at']
    list_filter = ['status']


@admin.register(UtilityCharge)
class UtilityChargeAdmin(admin.ModelAdmin):
    list_display = ['id', 'lease', 'utility_type', 'month', 'amount', 'is_paid']


@admin.register(MpesaStatementImport)
class MpesaStatementImportAdmin(admin.ModelAdmin):
    list_display = ['id', 'filename', 'matched_count', 'orphan_count', 'imported_at']


@admin.register(EvidenceSnapshot)
class EvidenceSnapshotAdmin(admin.ModelAdmin):
    list_display = ['id', 'tenant', 'sha256_hash', 'created_at']
