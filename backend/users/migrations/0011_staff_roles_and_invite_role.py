# Generated manually for org staff roles + staff invite role

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_phone_verification_code_hash'),
    ]

    operations = [
        migrations.AlterField(
            model_name='organizationmember',
            name='role',
            field=models.CharField(
                choices=[
                    ('OWNER', 'Owner'),
                    ('FRONT_DESK', 'Front Desk'),
                    ('MAINTENANCE', 'Maintenance'),
                    ('STAFF', 'Staff'),
                ],
                default='STAFF',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='staffinvite',
            name='role',
            field=models.CharField(
                choices=[
                    ('FRONT_DESK', 'Front Desk'),
                    ('MAINTENANCE', 'Maintenance'),
                    ('STAFF', 'Staff'),
                ],
                default='STAFF',
                max_length=20,
            ),
        ),
    ]
