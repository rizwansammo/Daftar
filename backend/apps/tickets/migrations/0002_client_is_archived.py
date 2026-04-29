from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
    ]
