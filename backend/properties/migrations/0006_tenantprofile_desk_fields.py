# Generated manually for staff tenant desk profile fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0005_backfill_property_units'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantprofile',
            name='date_of_birth',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='nationality',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='interests',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='next_of_kin_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='next_of_kin_phone',
            field=models.CharField(blank=True, max_length=15),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='next_of_kin_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='refund_account_type',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='refund_account_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='refund_bank_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='refund_swift_code',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='refund_account_number',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
