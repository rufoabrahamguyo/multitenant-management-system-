from rest_framework import serializers

from .models import OrganizationMpesaConfig, OwnerAlert, MpesaIntegrationRequest


class OwnerAlertSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.CharField(source='triggered_by.username', read_only=True, default=None)

    class Meta:
        model = OwnerAlert
        fields = [
            'id', 'alert_type', 'message', 'resource', 'severity',
            'is_read', 'triggered_by', 'triggered_by_name', 'created_at',
        ]


class MpesaConfigSerializer(serializers.ModelSerializer):
    consumer_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    consumer_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    passkey = serializers.CharField(write_only=True, required=False, allow_blank=True)
    consumer_key_set = serializers.BooleanField(read_only=True)
    consumer_secret_set = serializers.BooleanField(read_only=True)
    passkey_set = serializers.BooleanField(read_only=True)
    stk_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrganizationMpesaConfig
        fields = [
            'channel', 'shortcode', 'account_number', 'mpesa_env', 'updated_at',
            'consumer_key', 'consumer_secret', 'passkey',
            'consumer_key_set', 'consumer_secret_set', 'passkey_set', 'stk_configured',
        ]
        read_only_fields = [
            'updated_at', 'consumer_key_set', 'consumer_secret_set',
            'passkey_set', 'stk_configured',
        ]

    def update(self, instance, validated_data):
        consumer_key = validated_data.pop('consumer_key', None)
        consumer_secret = validated_data.pop('consumer_secret', None)
        passkey = validated_data.pop('passkey', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if consumer_key is not None and consumer_key.strip():
            instance.set_consumer_key(consumer_key)
        if consumer_secret is not None and consumer_secret.strip():
            instance.set_consumer_secret(consumer_secret)
        if passkey is not None and passkey.strip():
            instance.set_passkey(passkey)

        instance.save()
        return instance


class MpesaIntegrationRequestSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    admin_notes = serializers.SerializerMethodField()

    class Meta:
        model = MpesaIntegrationRequest
        fields = [
            'id', 'status', 'status_display', 'channel', 'channel_display',
            'shortcode', 'business_name', 'mpesa_username', 'contact_phone',
            'contact_email', 'account_number', 'notes', 'admin_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_admin_notes(self, obj):
        if obj.status == MpesaIntegrationRequest.Status.REJECTED:
            return obj.admin_notes
        return ''


class MpesaIntegrationRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaIntegrationRequest
        fields = [
            'channel', 'shortcode', 'business_name', 'mpesa_username',
            'contact_phone', 'contact_email', 'account_number', 'notes',
        ]

    def validate_shortcode(self, value):
        cleaned = value.strip()
        if not cleaned.isdigit():
            raise serializers.ValidationError('Till/Paybill number must contain digits only.')
        return cleaned

