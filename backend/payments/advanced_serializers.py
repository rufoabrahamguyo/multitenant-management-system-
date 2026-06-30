from rest_framework import serializers

from propizy.storage_utils import media_url
from .models import CashCollection, EvidenceSnapshot, UtilityCharge


class CashCollectionSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.user.username', read_only=True)
    unit_number = serializers.CharField(source='lease.unit.unit_number', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    receipt_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = CashCollection
        fields = [
            'id', 'lease', 'tenant_name', 'unit_number', 'property_name',
            'recorded_by', 'recorded_by_name', 'amount', 'month_paid', 'notes',
            'receipt_photo', 'receipt_photo_url', 'status', 'reviewed_by',
            'reviewed_at', 'rejection_reason', 'linked_payment', 'created_at',
        ]
        read_only_fields = [
            'recorded_by', 'status', 'reviewed_by', 'reviewed_at',
            'rejection_reason', 'linked_payment', 'created_at',
        ]

    def get_receipt_photo_url(self, obj):
        return media_url(self.context.get('request'), obj.receipt_photo)


class CashCollectionCreateSerializer(serializers.Serializer):
    lease_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    month_paid = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class UtilityChargeSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.user.username', read_only=True)
    unit_number = serializers.CharField(source='lease.unit.unit_number', read_only=True)

    class Meta:
        model = UtilityCharge
        fields = [
            'id', 'lease', 'tenant_name', 'unit_number', 'utility_type',
            'month', 'amount', 'description', 'is_paid', 'created_at',
        ]
        read_only_fields = ['created_at']


class EvidenceSnapshotSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.user.username', read_only=True)

    class Meta:
        model = EvidenceSnapshot
        fields = [
            'id', 'tenant', 'tenant_name', 'json_bundle', 'pdf_path',
            'sha256_hash', 'created_at',
        ]
        read_only_fields = ['json_bundle', 'pdf_path', 'sha256_hash', 'created_at']
