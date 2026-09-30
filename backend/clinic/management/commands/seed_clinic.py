
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from clinic.models import ClinicContent
from clinic.validation import validate_content


class Command(BaseCommand):
    help = 'Initialize clinic content once; preserves existing edits.'

    def handle(self, *args, **options):
        seed = Path(__file__).resolve().parents[3] / 'seed_content.json'
        data = validate_content(
            json.loads(seed.read_text(encoding='utf-8'))
        )

        row, created = ClinicContent.objects.get_or_create(
            pk=1,
            defaults={'data': data, 'version': 1}
        )

        if not created:
            # Add newly introduced bilingual fields without overwriting existing clinic edits.
            changed = False
            current = row.data

            for section in ('welcome', 'about', 'contact'):
                for key, value in data.get(section, {}).items():
                    if key.endswith('_ar') and key not in current.get(section, {}):
                        current.setdefault(section, {})[key] = value
                        changed = True

            for group in ('categories', 'services', 'doctors', 'packages', 'banners'):
                current_by_id = {
                    x.get('id'): x
                    for x in current.get(group, [])
                    if isinstance(x, dict)
                }

                for seed_row in data.get(group, []):
                    target = current_by_id.get(seed_row.get('id'))

                    if not target:
                        continue

                    for key, value in seed_row.items():
                        if key.endswith('_ar') and key not in target:
                            target[key] = value
                            changed = True

            if changed:
                row.data = current
                row.version += 1
                row.save(update_fields=['data', 'version', 'updated_at'])

        self.stdout.write(
            'Clinic content initialized.'
            if created
            else 'Existing content preserved; missing bilingual fields were added when needed.'
        )

