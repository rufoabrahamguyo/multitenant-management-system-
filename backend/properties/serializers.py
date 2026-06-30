from rest_framework import serializers

from propizy.storage_utils import media_url
from .models import Lease, Property, TenantProfile, Unit
from .transfer_serializers import (
    UnitCategorySerializer,
    UnitTransferCreateSerializer,
    UnitTransferRequestSerializer,
)


class PropertySerializer(serializers.ModelSerializer):
    units_count = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = ['id', 'name', 'address', 'total_units', 'units_count', 'created_at']
        read_only_fields = ['created_at']

    def get_units_count(self, obj):
        return obj.units.count()

    def validate_total_units(self, value):
        if self.instance and value < self.instance.units.count():
            raise serializers.ValidationError(
                'Cannot reduce below the current number of units. Delete vacant units first.',
            )
        return value


class UnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    tenant_name = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'property', 'property_name', 'category', 'category_name',
            'unit_number', 'rent_amount', 'status', 'tenant_name',
        ]

    def get_tenant_name(self, obj):
        tenant = obj.current_tenants.first()
        return tenant.user.get_full_name() or tenant.user.username if tenant else None


class TenantProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    unit_number = serializers.CharField(source='current_unit.unit_number', read_only=True, default=None)
    property_name = serializers.CharField(source='current_unit.property.name', read_only=True, default=None)
    balance = serializers.SerializerMethodField()
    months_overdue = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()
    id_card_front_url = serializers.SerializerMethodField()
    id_card_back_url = serializers.SerializerMethodField()

    class Meta:
        model = TenantProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'current_unit', 'unit_number', 'property_name',
            'balance', 'months_overdue', 'payment_history',
            'id_card_front_url', 'id_card_back_url',
        ]

    def _media_url(self, file_field):
        return media_url(self.context.get('request'), file_field)

    def get_id_card_front_url(self, obj):
        return self._media_url(obj.id_card_front)

    def get_id_card_back_url(self, obj):
        return self._media_url(obj.id_card_back)

    def get_balance(self, obj):
        from payments.services import get_tenant_balance
        return float(get_tenant_balance(obj)['balance'])

    def get_months_overdue(self, obj):
        from payments.services import get_tenant_balance
        return get_tenant_balance(obj)['months_overdue']

    def get_payment_history(self, obj):
        from payments.models import Payment
        payments = Payment.objects.filter(tenant=obj, status='completed').order_by('-month_paid')[:6]
        return [{
            'month': p.month_paid.strftime('%B %Y'),
            'amount': float(p.amount),
            'receipt': p.mpesa_receipt_number,
        } for p in payments]


class LeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.user.username', read_only=True)
    tenant_phone = serializers.CharField(source='tenant.phone_number', read_only=True, default=None)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True)
    category_name = serializers.CharField(source='unit.category.name', read_only=True, default=None)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)
    lease_agreement_url = serializers.SerializerMethodField()

    class Meta:
        model = Lease
        fields = [
            'id', 'tenant', 'tenant_name', 'tenant_phone', 'unit', 'unit_number', 'category_name',
            'property_name', 'start_date', 'end_date', 'rent_amount', 'pdf_upload',
            'lease_agreement_url', 'is_active', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_lease_agreement_url(self, obj):
        return media_url(self.context.get('request'), obj.pdf_upload)
