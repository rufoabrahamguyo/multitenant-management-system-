from django.conf import settings
from django.db import models


class Property(models.Model):
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='properties',
        limit_choices_to={'role': 'MANAGER'},
    )
    name = models.CharField(max_length=255)
    address = models.TextField()
    total_units = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'properties'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class UnitCategory(models.Model):
    """Room type per property: Studio, 1 Bedroom, Premium, etc."""

    property_ref = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='unit_categories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'unit categories'
        ordering = ['sort_order', 'name']
        unique_together = ['property_ref', 'name']

    def __str__(self):
        return f'{self.property_ref.name} · {self.name}'

    def vacant_count(self):
        return self.units.filter(status=Unit.Status.VACANT).count()


class Unit(models.Model):
    class Status(models.TextChoices):
        VACANT = 'vacant', 'Vacant'
        OCCUPIED = 'occupied', 'Occupied'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='units')
    category = models.ForeignKey(
        UnitCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='units',
    )
    unit_number = models.CharField(max_length=50)
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.VACANT)

    class Meta:
        unique_together = ['property', 'unit_number']
        ordering = ['unit_number']

    def __str__(self):
        return f'{self.property.name} - Unit {self.unit_number}'


class TenantProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tenant_profile',
    )
    current_unit = models.ForeignKey(
        Unit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_tenants',
    )
    phone_number = models.CharField(max_length=15, blank=True)
    id_card_front = models.ImageField(upload_to='tenant_ids/', blank=True, null=True)
    id_card_back = models.ImageField(upload_to='tenant_ids/', blank=True, null=True)

    def __str__(self):
        return f'Profile: {self.user.username}'


class Lease(models.Model):
    tenant = models.ForeignKey(
        TenantProfile,
        on_delete=models.CASCADE,
        related_name='leases',
    )
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='leases')
    start_date = models.DateField()
    end_date = models.DateField()
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    pdf_upload = models.FileField(upload_to='leases/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Lease: {self.tenant.user.username} - {self.unit}'


class UnitTransferRequest(models.Model):
    """Tenant request to move to a different room category/unit."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        WAITLISTED = 'waitlisted', 'Waitlisted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    tenant = models.ForeignKey(TenantProfile, on_delete=models.CASCADE, related_name='transfer_requests')
    current_lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='transfer_requests')
    desired_category = models.ForeignKey(UnitCategory, on_delete=models.CASCADE, related_name='transfer_requests')
    preferred_unit = models.ForeignKey(
        Unit, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='preferred_in_requests',
    )
    assigned_unit = models.ForeignKey(
        Unit, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_from_requests',
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    tenant_note = models.TextField(blank=True)
    manager_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_transfers',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Transfer {self.tenant.user.username} → {self.desired_category.name} ({self.status})'
