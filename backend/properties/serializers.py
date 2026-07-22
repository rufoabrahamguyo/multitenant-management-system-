from rest_framework import serializers

from propizy.storage_utils import media_url
from .models import Lease, Property, TenantProfile, Unit
from .transfer_serializers import (
    UnitCategorySerializer,
    UnitTransferCreateSerializer,
    UnitTransferRequestSerializer,
)

PROFILE_EDIT_FIELDS = [
    'phone_number', 'date_of_birth', 'nationality', 'interests',
    'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_email',
    'refund_account_type', 'refund_account_name', 'refund_bank_name',
    'refund_swift_code', 'refund_account_number',
]

USER_EDIT_FIELDS = ['first_name', 'last_name', 'email']


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
    email = serializers.EmailField(source='user.email', required=False, allow_blank=True)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    unit_number = serializers.CharField(source='current_unit.unit_number', read_only=True, default=None)
    property_name = serializers.CharField(source='current_unit.property.name', read_only=True, default=None)
    balance = serializers.SerializerMethodField()
    months_overdue = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()
    id_card_front_url = serializers.SerializerMethodField()
    id_card_back_url = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    must_change_password = serializers.BooleanField(source='user.must_change_password', read_only=True)
    tenant_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = TenantProfile
        fields = [
            'id', 'tenant_id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'date_of_birth', 'nationality', 'interests',
            'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_email',
            'refund_account_type', 'refund_account_name', 'refund_bank_name',
            'refund_swift_code', 'refund_account_number',
            'current_unit', 'unit_number', 'property_name',
            'balance', 'months_overdue', 'payment_history',
            'id_card_front_url', 'id_card_back_url', 'is_active', 'must_change_password',
        ]
        read_only_fields = ['current_unit']

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

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user
        for field in USER_EDIT_FIELDS:
            if field in user_data:
                setattr(user, field, user_data[field])
        if user_data:
            user.save(update_fields=[f for f in USER_EDIT_FIELDS if f in user_data])

        for field in PROFILE_EDIT_FIELDS:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class TenantProvisionSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=15)
    unit_id = serializers.IntegerField()
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    nationality = serializers.CharField(required=False, allow_blank=True, max_length=100)
    interests = serializers.CharField(required=False, allow_blank=True)
    next_of_kin_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    next_of_kin_phone = serializers.CharField(required=False, allow_blank=True, max_length=15)
    next_of_kin_email = serializers.EmailField(required=False, allow_blank=True)
    refund_account_type = serializers.CharField(required=False, allow_blank=True, max_length=50)
    refund_account_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    refund_bank_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    refund_swift_code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    refund_account_number = serializers.CharField(required=False, allow_blank=True, max_length=100)


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
