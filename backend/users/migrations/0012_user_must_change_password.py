# Generated manually for tenant desk profile + must_change_password

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_staff_roles_and_invite_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(default=False),
        ),
    ]
