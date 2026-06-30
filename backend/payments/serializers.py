from decimal import Decimal

from rest_framework import serializers

from propizy.storage_utils import media_url
from .integrity import get_payment_integrity_flags
from .models import Invoice, Payment, TenantWallet, WalletTransaction


class PaymentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.user.username', read_only=True)
    unit_number = serializers.CharField(source='lease.unit.unit_number', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    receipt_url = serializers.SerializerMethodField()
    integrity_flags = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'tenant', 'tenant_name', 'lease', 'amount', 'month_paid',
            'rent_applied', 'wallet_applied',
            'status', 'mpesa_receipt_number', 'transaction_id', 'checkout_request_id',
            'pay_phone_number', 'payment_date', 'payment_method', 'receipt_pdf', 'receipt_url',
            'integrity_flags', 'created_at', 'unit_number', 'property_name',
        ]
        read_only_fields = [
            'status', 'mpesa_receipt_number', 'transaction_id', 'checkout_request_id',
            'pay_phone_number', 'payment_date', 'receipt_pdf', 'rent_applied', 'wallet_applied',
            'created_at',
        ]

    def get_receipt_url(self, obj):
        return media_url(self.context.get('request'), obj.receipt_pdf)

    def get_integrity_flags(self, obj):
        return get_payment_integrity_flags(obj)


class InitiatePaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    phone_number = serializers.CharField(max_length=15)
    lease_id = serializers.IntegerField()


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantWallet
        fields = ['balance', 'updated_at']


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'transaction_type', 'amount', 'balance_after', 'source',
            'rent_month', 'description', 'created_at',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.user.username', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    unit_number = serializers.CharField(source='lease.unit.unit_number', read_only=True)
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'lease', 'tenant_name', 'property_name', 'unit_number',
            'month', 'amount', 'invoice_pdf', 'invoice_url', 'created_at',
        ]

    def get_invoice_url(self, obj):
        return media_url(self.context.get('request'), obj.invoice_pdf)
