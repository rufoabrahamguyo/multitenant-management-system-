from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_mpesa_integration_request'),
    ]

    operations = [
        migrations.AlterField(
            model_name='phoneverificationcode',
            name='code',
            field=models.CharField(max_length=64),
        ),
    ]
