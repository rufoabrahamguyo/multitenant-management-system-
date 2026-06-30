from rest_framework import serializers

from .models import Lease, Property, TenantProfile, Unit, UnitCategory, UnitTransferRequest
from .transfer_service import get_waitlist_position


class UnitCategorySerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property_ref.name', read_only=True)
    vacant_count = serializers.SerializerMethodField()
    unit_count = serializers.SerializerMethodField()

    class Meta:
        model = UnitCategory
        fields = [
            'id', 'property_ref', 'property_name', 'name', 'description',
            'sort_order', 'vacant_count', 'unit_count', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_vacant_count(self, obj):
        return obj.vacant_count()

    def get_unit_count(self, obj):
        return obj.units.count()


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


class UnitTransferRequestSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.user.username', read_only=True)
    current_unit_number = serializers.CharField(source='current_lease.unit.unit_number', read_only=True)
    current_category_name = serializers.CharField(
        source='current_lease.unit.category.name', read_only=True, default=None,
    )
    desired_category_name = serializers.CharField(source='desired_category.name', read_only=True)
    property_name = serializers.CharField(source='desired_category.property_ref.name', read_only=True)
    preferred_unit_number = serializers.CharField(source='preferred_unit.unit_number', read_only=True, default=None)
    assigned_unit_number = serializers.CharField(source='assigned_unit.unit_number', read_only=True, default=None)
    waitlist_position = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    class Meta:
        model = UnitTransferRequest
        fields = [
            'id', 'tenant', 'tenant_name', 'current_lease', 'current_unit_number',
            'current_category_name', 'desired_category', 'desired_category_name',
            'property_name', 'preferred_unit', 'preferred_unit_number',
            'assigned_unit', 'assigned_unit_number', 'status', 'tenant_note',
            'manager_note', 'waitlist_position', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'tenant', 'current_lease', 'status', 'assigned_unit', 'reviewed_by',
            'reviewed_at', 'created_at', 'updated_at',
        ]

    def get_waitlist_position(self, obj):
        return get_waitlist_position(obj)


class UnitTransferCreateSerializer(serializers.Serializer):
    desired_category_id = serializers.IntegerField()
    preferred_unit_id = serializers.IntegerField(required=False, allow_null=True)
    tenant_note = serializers.CharField(required=False, allow_blank=True)


class UnitAvailabilitySerializer(serializers.Serializer):
    category_id = serializers.IntegerField()
    category_name = serializers.CharField()
    description = serializers.CharField()
    property_id = serializers.IntegerField()
    property_name = serializers.CharField()
    vacant_count = serializers.IntegerField()
    waitlist_count = serializers.IntegerField()
    vacant_units = serializers.ListField()
