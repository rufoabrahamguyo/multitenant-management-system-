from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from properties.models import TenantProfile, Unit
from properties.services import create_lease_for_tenant

from .models import Organization, OrganizationMember, StaffInvite, TenantInvite
from .phone_verification import mask_phone, normalize_phone, send_verification_code, verify_code
from .utils import get_pm_id

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    org_role = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()
    phone_masked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'property_manager_id', 'org_role', 'organization_name',
            'phone_number', 'phone_verified', 'phone_masked',
        ]
        read_only_fields = ['property_manager_id', 'phone_verified', 'phone_masked']

    def get_phone_masked(self, obj):
        if not obj.phone_number:
            return None
        return mask_phone(obj.phone_number)

    def get_org_role(self, obj):
        if hasattr(obj, 'owned_organization'):
            return 'OWNER'
        if hasattr(obj, 'org_membership'):
            return obj.org_membership.role
        return None

    def get_organization_name(self, obj):
        if hasattr(obj, 'owned_organization'):
            return obj.owned_organization.name
        if hasattr(obj, 'org_membership'):
            return obj.org_membership.organization.name
        return None


class ManagerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    organization_name = serializers.CharField(write_only=True)
    phone_number = serializers.CharField(max_length=15)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name',
            'organization_name', 'phone_number',
        ]

    def validate_phone_number(self, value):
        digits = normalize_phone(value)
        if len(digits) < 9:
            raise serializers.ValidationError('Enter a valid phone number.')
        return digits

    def create(self, validated_data):
        org_name = validated_data.pop('organization_name')
        password = validated_data.pop('password')

        user = User(role=User.Role.MANAGER, phone_verified=False, **validated_data)
        user.set_password(password)
        user.save()

        base_slug = slugify(org_name) or 'org'
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        org = Organization.objects.create(
            name=org_name,
            slug=slug,
            property_manager_id=user.property_manager_id,
            owner=user,
        )
        OrganizationMember.objects.create(
            organization=org,
            user=user,
            role=OrganizationMember.Role.OWNER,
        )
        return user


class TenantRegisterSerializer(serializers.Serializer):
    invite_token = serializers.UUIDField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_invite_token(self, value):
        try:
            invite = TenantInvite.objects.select_related('organization', 'unit').get(token=value)
        except TenantInvite.DoesNotExist:
            raise serializers.ValidationError('Invalid invite token.')
        if not invite.is_valid:
            raise serializers.ValidationError('Invite has expired or already been used.')
        self.context['invite'] = invite
        return value

    def create(self, validated_data):
        invite = self.context['invite']
        validated_data.pop('invite_token')
        password = validated_data.pop('password')

        owner = invite.organization.owner
        user = User(
            username=validated_data['username'],
            email=invite.email,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=User.Role.TENANT,
            manager=owner,
        )
        user.set_password(password)
        user.save()

        profile = TenantProfile.objects.create(
            user=user,
            phone_number=invite.phone_number,
        )

        if invite.unit:
            create_lease_for_tenant(profile, invite.unit)

        invite.used_at = timezone.now()
        invite.save(update_fields=['used_at'])
        return user


class StaffRegisterSerializer(serializers.Serializer):
    invite_token = serializers.UUIDField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_invite_token(self, value):
        try:
            invite = StaffInvite.objects.select_related('organization').get(token=value)
        except StaffInvite.DoesNotExist:
            raise serializers.ValidationError('Invalid invite token.')
        if not invite.is_valid:
            raise serializers.ValidationError('Invite has expired or already been used.')
        self.context['invite'] = invite
        return value

    def create(self, validated_data):
        invite = self.context['invite']
        validated_data.pop('invite_token')
        password = validated_data.pop('password')

        user = User(
            username=validated_data['username'],
            email=invite.email,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=User.Role.MANAGER,
            property_manager_id=invite.organization.property_manager_id,
            phone_verified=True,
        )
        user.set_password(password)
        user.save()

        OrganizationMember.objects.create(
            organization=invite.organization,
            user=user,
            role=OrganizationMember.Role.STAFF,
        )

        invite.used_at = timezone.now()
        invite.save(update_fields=['used_at'])
        return user


class TenantInviteSerializer(serializers.ModelSerializer):
    unit_label = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()
    app_invite_url = serializers.SerializerMethodField()
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = TenantInvite
        fields = [
            'id', 'token', 'email', 'phone_number', 'unit', 'unit_label',
            'expires_at', 'used_at', 'is_valid', 'invite_url', 'app_invite_url', 'created_at',
        ]
        read_only_fields = ['token', 'used_at', 'created_at']

    def get_unit_label(self, obj):
        if obj.unit:
            return f'{obj.unit.property.name} - Unit {obj.unit.unit_number}'
        return None

    def get_invite_url(self, obj):
        from .emails import tenant_invite_web_url
        return tenant_invite_web_url(obj.token)

    def get_app_invite_url(self, obj):
        from .emails import tenant_invite_app_url
        return tenant_invite_app_url(obj.token)


class TenantInviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=15)
    unit_id = serializers.IntegerField()

    def validate_unit_id(self, value):
        user = self.context['user']
        pm_id = get_pm_id(user)
        try:
            unit = Unit.objects.get(
                id=value,
                property__manager__property_manager_id=pm_id,
            )
        except Unit.DoesNotExist:
            raise serializers.ValidationError('Unit not found.')
        if unit.status == Unit.Status.OCCUPIED:
            raise serializers.ValidationError('Unit is already occupied.')
        self.context['unit'] = unit
        return value


class StaffInviteSerializer(serializers.ModelSerializer):
    invite_url = serializers.SerializerMethodField()
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffInvite
        fields = ['id', 'token', 'email', 'expires_at', 'used_at', 'is_valid', 'invite_url', 'created_at']
        read_only_fields = ['token', 'used_at', 'created_at']

    def get_invite_url(self, obj):
        from .emails import staff_invite_web_url
        return staff_invite_web_url(obj.token)


class StaffInviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()


class OrganizationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)

    class Meta:
        model = OrganizationMember
        fields = ['id', 'username', 'email', 'first_name', 'role', 'joined_at']
