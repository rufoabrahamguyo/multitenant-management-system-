import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        MANAGER = 'MANAGER', 'Manager'
        TENANT = 'TENANT', 'Tenant'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.TENANT)
    property_manager_id = models.UUIDField(null=True, blank=True, db_index=True)
    phone_number = models.CharField(max_length=15, blank=True)
    phone_verified = models.BooleanField(default=False)
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenants',
        limit_choices_to={'role': Role.MANAGER},
    )

    def save(self, *args, **kwargs):
        if self.role == self.Role.MANAGER and not self.property_manager_id:
            self.property_manager_id = uuid.uuid4()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.username} ({self.role})'


class PhoneVerificationCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='phone_verification')
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f'Phone verification for {self.user.username}'


class Organization(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    property_manager_id = models.UUIDField(unique=True, db_index=True, default=uuid.uuid4)
    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='owned_organization',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class OrganizationMember(models.Model):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        STAFF = 'STAFF', 'Staff'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='org_membership')
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['organization', 'user']

    def __str__(self):
        return f'{self.user.username} ({self.role}) @ {self.organization.name}'


class TenantInvite(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField()
    phone_number = models.CharField(max_length=15)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tenant_invites')
    unit = models.ForeignKey(
        'properties.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invites',
    )
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Invite {self.email} ({self.token})'

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()


class StaffInvite(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField()
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='staff_invites')
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()


class ActivityLog(models.Model):
    class Severity(models.TextChoices):
        INFO = 'info', 'Info'
        WARNING = 'warning', 'Warning'
        HIGH = 'high', 'High'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='activity_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='activity_logs')
    action = models.CharField(max_length=100)
    detail = models.TextField(blank=True)
    target = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.INFO)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} by {self.user_id} @ {self.created_at}'


class OrganizationMpesaConfig(models.Model):
    """Per-organization M-PESA Paybill/Till and Daraja STK credentials."""

    class Channel(models.TextChoices):
        PAYBILL = 'paybill', 'Paybill'
        TILL = 'till', 'Till Number'
        STK = 'stk', 'STK Push (your Paybill/Till)'

    class MpesaEnv(models.TextChoices):
        SANDBOX = 'sandbox', 'Sandbox'
        PRODUCTION = 'production', 'Production'

    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name='mpesa_config',
    )
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.STK)
    shortcode = models.CharField(max_length=20, blank=True, help_text='Paybill or Till number')
    account_number = models.CharField(max_length=50, blank=True, help_text='Paybill account reference prefix')
    mpesa_env = models.CharField(
        max_length=10, choices=MpesaEnv.choices, default=MpesaEnv.SANDBOX,
    )
    consumer_key_encrypted = models.TextField(blank=True)
    consumer_secret_encrypted = models.TextField(blank=True)
    passkey_encrypted = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'M-PESA config for {self.organization.name}'

    def _secret_is_set(self, encrypted_field):
        return bool(getattr(self, encrypted_field))

    @property
    def consumer_key_set(self):
        return self._secret_is_set('consumer_key_encrypted')

    @property
    def consumer_secret_set(self):
        return self._secret_is_set('consumer_secret_encrypted')

    @property
    def passkey_set(self):
        return self._secret_is_set('passkey_encrypted')

    @property
    def stk_configured(self):
        return (
            self.channel == self.Channel.STK
            and self.shortcode
            and self.consumer_key_set
            and self.consumer_secret_set
            and self.passkey_set
        )

    def set_consumer_key(self, value):
        from users.mpesa_crypto import encrypt_secret

        if value is None:
            return
        self.consumer_key_encrypted = encrypt_secret(value.strip()) if value.strip() else ''

    def set_consumer_secret(self, value):
        from users.mpesa_crypto import encrypt_secret

        if value is None:
            return
        self.consumer_secret_encrypted = encrypt_secret(value.strip()) if value.strip() else ''

    def set_passkey(self, value):
        from users.mpesa_crypto import encrypt_secret

        if value is None:
            return
        self.passkey_encrypted = encrypt_secret(value.strip()) if value.strip() else ''

    def get_stk_credentials(self):
        from users.mpesa_crypto import decrypt_secret

        if not self.stk_configured:
            return None
        return {
            'consumer_key': decrypt_secret(self.consumer_key_encrypted),
            'consumer_secret': decrypt_secret(self.consumer_secret_encrypted),
            'passkey': decrypt_secret(self.passkey_encrypted),
            'shortcode': self.shortcode.strip(),
            'mpesa_env': self.mpesa_env,
            'transaction_type': (
                'CustomerBuyGoodsOnline'
                if self.channel == self.Channel.TILL
                else 'CustomerPayBillOnline'
            ),
        }


class MpesaIntegrationRequest(models.Model):
    """Owner-submitted M-PESA setup request; platform team completes Daraja integration."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending review'
        IN_PROGRESS = 'in_progress', 'In progress'
        COMPLETED = 'completed', 'Completed'
        REJECTED = 'rejected', 'Rejected'

    class Channel(models.TextChoices):
        TILL = 'till', 'Till Number'
        PAYBILL = 'paybill', 'Paybill'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='mpesa_integration_requests',
    )
    requested_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='mpesa_integration_requests',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    channel = models.CharField(max_length=10, choices=Channel.choices)
    shortcode = models.CharField(max_length=20, help_text='Till or Paybill number')
    business_name = models.CharField(max_length=200)
    mpesa_username = models.CharField(max_length=100, help_text='M-PESA portal username from Safaricom email')
    contact_phone = models.CharField(max_length=20)
    contact_email = models.EmailField(blank=True)
    account_number = models.CharField(max_length=50, blank=True, help_text='Paybill account number if applicable')
    notes = models.TextField(blank=True, help_text='Extra details from Safaricom email')
    admin_notes = models.TextField(blank=True, help_text='Internal notes for the Propizy team')
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_mpesa_requests',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'M-PESA request for {self.organization.name} ({self.get_status_display()})'

    @property
    def is_open(self):
        return self.status in (self.Status.PENDING, self.Status.IN_PROGRESS)


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f'PasswordReset for {self.user.username}'


class LoginAttempt(models.Model):
    username = models.CharField(max_length=150, unique=True, db_index=True)
    failure_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_attempt = models.DateTimeField(auto_now=True)

    def is_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

    def minutes_remaining(self):
        if not self.is_locked():
            return 0
        delta = self.locked_until - timezone.now()
        return max(int(delta.total_seconds() // 60) + 1, 1)

    def __str__(self):
        return f'LoginAttempt {self.username} ({self.failure_count} failures)'


class OwnerAlert(models.Model):
    """Alerts for owners when staff access sensitive data or attempt blocked actions."""

    class AlertType(models.TextChoices):
        BLOCKED_ACTION = 'blocked_action', 'Blocked Action'
        SENSITIVE_ACCESS = 'sensitive_access', 'Sensitive Access'
        CASH_PENDING = 'cash_pending', 'Cash Pending Approval'
        RECONCILIATION = 'reconciliation', 'Reconciliation Issue'
        INTEGRITY = 'integrity', 'Payment Integrity'

    class Severity(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='owner_alerts')
    triggered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='triggered_alerts',
    )
    alert_type = models.CharField(max_length=20, choices=AlertType.choices)
    message = models.TextField()
    resource = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.alert_type}: {self.message[:50]}'
