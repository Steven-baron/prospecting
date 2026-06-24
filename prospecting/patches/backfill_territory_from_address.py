"""Backfill Prospect.territory (town/city) for existing records.

New imports capture the town from Google Places addressComponents. Existing
prospects predate that, so parse the town best-effort from their stored
address (e.g. '... , Toronto, ON M5B 1S8, Canada' -> 'Toronto').
"""

import frappe
from prospecting.api import _town_from_address


def execute():
	rows = frappe.get_all(
		'Prospect',
		filters={'territory': ('in', ('', None)), 'address': ('is', 'set')},
		fields=['name', 'address'],
	)
	updated = 0
	for r in rows:
		town = _town_from_address(r.address)
		if town:
			frappe.db.set_value('Prospect', r.name, 'territory', town, update_modified=False)
			updated += 1
	frappe.db.commit()
	print(f"backfill_territory: set territory on {updated}/{len(rows)} prospects")
