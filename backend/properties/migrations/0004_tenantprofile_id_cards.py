from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0003_unitcategory_unit_category_unittransferrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantprofile',
            name='id_card_front',
            field=models.ImageField(blank=True, null=True, upload_to='tenant_ids/'),
        ),
        migrations.AddField(
            model_name='tenantprofile',
            name='id_card_back',
            field=models.ImageField(blank=True, null=True, upload_to='tenant_ids/'),
        ),
    ]
