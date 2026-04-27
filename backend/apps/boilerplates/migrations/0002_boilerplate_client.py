import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tickets", "0001_initial"),
        ("boilerplates", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="boilerplate",
            name="client",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="boilerplates",
                to="tickets.client",
            ),
        ),
    ]
