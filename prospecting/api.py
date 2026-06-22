import re
import json
import frappe

_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

_FIELD_MASK = ','.join([
	'places.id',
	'places.displayName',
	'places.formattedAddress',
	'places.location',
	'places.internationalPhoneNumber',
	'places.nationalPhoneNumber',
	'places.websiteUri',
	'places.rating',
	'places.userRatingCount',
	'places.businessStatus',
	'places.types',
	'places.primaryType',
	'places.primaryTypeDisplayName',
	'places.googleMapsUri',
	'nextPageToken',
])

PLACE_CATEGORIES = [
	{'label': 'Any category',        'value': ''},
	{'label': 'Restaurant',          'value': 'restaurant'},
	{'label': 'Cafe',                'value': 'cafe'},
	{'label': 'Bar',                 'value': 'bar'},
	{'label': 'Bakery',              'value': 'bakery'},
	{'label': 'Dentist',             'value': 'dentist'},
	{'label': 'Doctor',              'value': 'doctor'},
	{'label': 'Physiotherapist',     'value': 'physiotherapist'},
	{'label': 'Lawyer',              'value': 'lawyer'},
	{'label': 'Accounting',          'value': 'accounting'},
	{'label': 'Insurance agency',    'value': 'insurance_agency'},
	{'label': 'Real estate agency',  'value': 'real_estate_agency'},
	{'label': 'Plumber',             'value': 'plumber'},
	{'label': 'Electrician',         'value': 'electrician'},
	{'label': 'Contractor',          'value': 'general_contractor'},
	{'label': 'Roofing contractor',  'value': 'roofing_contractor'},
	{'label': 'Car repair',          'value': 'car_repair'},
	{'label': 'Car dealer',          'value': 'car_dealer'},
	{'label': 'Gym',                 'value': 'gym'},
	{'label': 'Hair salon',          'value': 'hair_salon'},
	{'label': 'Beauty salon',        'value': 'beauty_salon'},
	{'label': 'Spa',                 'value': 'spa'},
	{'label': 'Veterinary care',     'value': 'veterinary_care'},
	{'label': 'Pharmacy',            'value': 'pharmacy'},
	{'label': 'School',              'value': 'school'},
	{'label': 'Lodging / hotel',     'value': 'lodging'},
	{'label': 'Store',               'value': 'store'},
]


@frappe.whitelist()
def get_maps_api_key():
	settings = frappe.get_single('Prospecting Settings')
	return settings.get_password('google_maps_api_key') or ''


@frappe.whitelist()
def get_place_categories():
	return PLACE_CATEGORIES


@frappe.whitelist()
def get_lists_with_counts():
	lists = frappe.get_all('Prospect List',
		fields=['name', 'list_name', 'color'],
		order_by='list_name asc',
	)
	rows = frappe.db.sql("""
		SELECT prospect_list, COUNT(*) AS cnt
		FROM `tabProspect`
		WHERE docstatus < 2
		GROUP BY prospect_list
	""", as_dict=True)
	count_map = {r.prospect_list: r.cnt for r in rows}
	for l in lists:
		l['_count'] = count_map.get(l.name, 0)
	total = sum(count_map.values())
	return {'lists': lists, 'total': total}


@frappe.whitelist()
def delete_list(list_name):
	prospects = frappe.get_all('Prospect', filters={'prospect_list': list_name}, pluck='name')
	for p in prospects:
		frappe.delete_doc('Prospect', p, ignore_permissions=True, force=True)
	frappe.delete_doc('Prospect List', list_name, ignore_permissions=True, force=True)
	frappe.db.commit()
	return {'deleted': len(prospects)}


def _map_place(p):
	loc  = p.get('location') or {}
	ptd  = p.get('primaryTypeDisplayName') or {}
	types = p.get('types') or []
	return {
		'placeId':        p.get('id'),
		'businessName':   (p.get('displayName') or {}).get('text') or '(unnamed)',
		'address':        p.get('formattedAddress'),
		'phone':          p.get('internationalPhoneNumber') or p.get('nationalPhoneNumber'),
		'website':        p.get('websiteUri'),
		'category':       ptd.get('text') or p.get('primaryType') or (types[0] if types else None),
		'types':          types,
		'rating':         p.get('rating'),
		'reviewCount':    p.get('userRatingCount'),
		'businessStatus': p.get('businessStatus'),
		'googleMapsUri':  p.get('googleMapsUri'),
		'lat':            loc.get('latitude'),
		'lng':            loc.get('longitude'),
	}


def _search_cell_paginated(endpoint, req_headers, base_body, max_pages):
	"""Fetch one grid cell across multiple pages; returns all raw place dicts."""
	import requests as _req
	places = []
	page_token = None
	for _ in range(max_pages):
		body = dict(base_body)
		if page_token:
			body['pageToken'] = page_token
		try:
			resp = _req.post(endpoint, json=body, headers=req_headers, timeout=20)
			if not resp.ok:
				break
			data = resp.json()
			places.extend(data.get('places', []))
			page_token = data.get('nextPageToken')
			if not page_token:
				break
		except Exception:
			break
	return places


# Grid config per depth: (rows, cols, pages_per_cell)
# Cells run in parallel; pages within a cell are sequential (need pageToken).
# Capacity: rows×cols × pages×20 results before dedup.
#   depth 1 → 2×2 × 1×20  = up to  80 unique  (4 API calls)
#   depth 2 → 3×3 × 2×20  = up to 360 unique  (18 API calls, ~same wall-clock as 2s)
#   depth 3 → 4×4 × 3×20  = up to 960 unique  (48 API calls, ~same wall-clock as 6s)
_GRID = {1: (2, 2, 1), 2: (3, 3, 2), 3: (4, 4, 3)}


@frappe.whitelist()
def search_places(query, included_type='', region_code='', max_pages=2, bounds=None):
	from concurrent.futures import ThreadPoolExecutor

	settings = frappe.get_single('Prospecting Settings')
	api_key = settings.get_password('google_places_api_key')
	if not api_key:
		frappe.throw('Google Places API key not configured. Go to Prospecting Settings.')

	max_pages = min(max(int(max_pages), 1), 3)

	parsed_bounds = None
	if bounds:
		try:
			parsed_bounds = json.loads(bounds) if isinstance(bounds, str) else bounds
		except Exception:
			pass

	req_headers = {
		'Content-Type': 'application/json',
		'X-Goog-Api-Key': api_key,
		'X-Goog-FieldMask': _FIELD_MASK,
	}
	base_body = {'textQuery': query, 'languageCode': 'en'}
	if included_type:
		base_body['includedType'] = included_type

	results = []
	seen    = set()

	if parsed_bounds:
		# ── Grid search: cells run in parallel; each cell paginates internally ──
		rows, cols, pages_per_cell = _GRID[max_pages]
		north = parsed_bounds['north']
		south = parsed_bounds['south']
		east  = parsed_bounds['east']
		west  = parsed_bounds['west']
		lat_step = (north - south) / rows
		lng_step = (east  - west)  / cols

		cell_bodies = []
		for row in range(rows):
			for col in range(cols):
				cs = south + row * lat_step
				cw = west  + col * lng_step
				body = dict(base_body)
				body['maxResultCount'] = 20
				body['locationRestriction'] = {
					'rectangle': {
						'low':  {'latitude': cs,            'longitude': cw},
						'high': {'latitude': cs + lat_step, 'longitude': cw + lng_step},
					}
				}
				cell_bodies.append(body)

		with ThreadPoolExecutor(max_workers=len(cell_bodies)) as ex:
			fetch = lambda b: _search_cell_paginated(_PLACES_ENDPOINT, req_headers, b, pages_per_cell)
			for places in ex.map(fetch, cell_bodies):
				for p in places:
					pid = p.get('id')
					if pid and pid not in seen:
						seen.add(pid)
						results.append(_map_place(p))
	else:
		# ── Original pagination (no city bounds selected) ─────────────────
		import requests as _req
		page_token = None
		for _ in range(max_pages):
			body = dict(base_body)
			body['maxResultCount'] = 20
			if region_code:
				body['regionCode'] = region_code.upper()
			if page_token:
				body['pageToken'] = page_token

			resp = _req.post(_PLACES_ENDPOINT, json=body, headers=req_headers, timeout=15)
			if not resp.ok:
				break
			data = resp.json()
			for p in data.get('places', []):
				pid = p.get('id')
				if pid and pid not in seen:
					seen.add(pid)
					results.append(_map_place(p))
			page_token = data.get('nextPageToken')
			if not page_token:
				break

	return {'results': results, 'count': len(results)}


# ── Email enrichment ──────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

_EMAIL_BLOCKLIST = [
	'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com', 'squarespace.com',
	'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js',
]


def _pick_email(html):
	matches = _EMAIL_RE.findall(html)
	cleaned = [m.lower() for m in matches if not any(b in m.lower() for b in _EMAIL_BLOCKLIST)]
	if not cleaned:
		return None
	preferred = next(
		(m for m in cleaned if re.match(r'^(info|contact|hello|sales|admin|office)@', m)),
		None,
	)
	return preferred or cleaned[0]


def _fetch_html(url):
	import requests
	try:
		r = requests.get(
			url, timeout=8, allow_redirects=True,
			headers={'User-Agent': 'Mozilla/5.0 (compatible; ProspectingBot/1.0)'},
		)
		if not r.ok:
			return None
		ct = r.headers.get('content-type', '')
		if 'text/html' not in ct and 'text/plain' not in ct:
			return None
		return r.text
	except Exception:
		return None


def _find_email_for_website(website):
	if not website:
		return None
	if not website.startswith('http'):
		website = 'https://' + website
	try:
		from urllib.parse import urlparse
		parsed = urlparse(website)
		base = f'{parsed.scheme}://{parsed.netloc}'
	except Exception:
		return None
	for url in [website, f'{base}/contact', f'{base}/contact-us']:
		html = _fetch_html(url)
		if html:
			email = _pick_email(html)
			if email:
				return email
	return None


@frappe.whitelist()
def enrich_email(prospect):
	doc = frappe.get_doc('Prospect', prospect)
	if not doc.website:
		return {'email': None, 'reason': 'No website on file.'}
	email = _find_email_for_website(doc.website)
	if not email:
		return {'email': None, 'reason': 'No email found on website.'}
	doc.email_id = email
	doc.save(ignore_permissions=True)
	return {'email': email}


# ── Bulk import from Google Places search results ─────────────────────────────

@frappe.whitelist()
def import_prospects(prospects, list_name='', new_list_name='', enrich_email=0, category=''):
	if isinstance(prospects, str):
		prospects = json.loads(prospects)

	enrich = frappe.utils.cint(enrich_email)

	# Resolve / create the list
	if not list_name and new_list_name:
		doc = frappe.new_doc('Prospect List')
		doc.list_name = new_list_name.strip()
		if category:
			doc.category = category
		doc.insert(ignore_permissions=True)
		list_name = doc.name

	if not list_name:
		frappe.throw('Provide an existing list name or a new list name.')

	created = skipped = 0

	for p in prospects:
		place_id = p.get('placeId') or ''

		# Deduplicate by Google Place ID
		if place_id and frappe.db.exists('Prospect', {'place_id': place_id}):
			skipped += 1
			continue

		email = p.get('email') or ''
		if enrich and not email and p.get('website'):
			email = _find_email_for_website(p['website']) or ''

		doc = frappe.new_doc('Prospect')
		doc.prospect_name  = p.get('businessName') or ''
		doc.place_id       = place_id
		doc.category       = category or p.get('category') or ''
		doc.email_id       = email
		doc.mobile_no      = p.get('phone') or ''
		doc.website        = p.get('website') or ''
		doc.address        = p.get('address') or ''
		doc.lat            = p.get('lat')
		doc.lng            = p.get('lng')
		doc.rating         = p.get('rating')
		doc.review_count   = p.get('reviewCount')
		doc.business_status = p.get('businessStatus') or ''
		doc.google_maps_uri = p.get('googleMapsUri') or ''
		doc.google_types   = json.dumps(p.get('types') or [])
		doc.status         = 'New'
		doc.prospect_list  = list_name
		doc.source         = 'google-places'
		doc.insert(ignore_permissions=True)
		created += 1

	frappe.db.commit()
	return {'created': created, 'skipped': skipped, 'list_name': list_name}


@frappe.whitelist()
def remove_from_list(prospect_names):
	"""Remove prospects from their current list (keeps the prospect record)."""
	if isinstance(prospect_names, str):
		prospect_names = json.loads(prospect_names)
	for name in prospect_names:
		frappe.db.set_value('Prospect', name, 'prospect_list', None)
	frappe.db.commit()
	return {'removed': len(prospect_names)}


@frappe.whitelist()
def push_to_crm(prospect_names):
	"""
	Push prospects to CRM.
	Creates a CRM Organization + CRM Lead per prospect.
	- Organization holds the company info (name, website).
	- Lead is a placeholder person (company name) to be updated once
	  a real contact is identified. Phone/email live on the Lead.
	- Notes are saved to the Lead's FCRM Note (Notes tab in CRM).
	Re-pushing an existing record only syncs the notes.
	"""
	if isinstance(prospect_names, str):
		prospect_names = json.loads(prospect_names)

	created, skipped, errors = 0, 0, []

	for pname in prospect_names:
		p = frappe.get_doc('Prospect', pname)

		# If a lead already exists for this org, just sync notes
		existing_lead = frappe.db.exists('CRM Lead', {'organization': p.prospect_name})
		if existing_lead:
			_sync_note_to_crm(p, existing_lead)
			skipped += 1
			continue

		try:
			# ── 1. Create or reuse CRM Organization ──────────────────────────
			org_name = frappe.db.exists('CRM Organization', {'organization_name': p.prospect_name})
			if not org_name:
				org = frappe.get_doc({
					'doctype':           'CRM Organization',
					'organization_name': p.prospect_name,
					'website':           p.website or '',
				})
				org.insert(ignore_permissions=True)
				org_name = org.name

			# ── 2. Create CRM Lead (placeholder person = company name) ────────
			lead = frappe.new_doc('CRM Lead')
			lead.first_name   = p.prospect_name   # placeholder — update once real contact is known
			lead.lead_name    = p.prospect_name
			lead.organization = p.prospect_name   # text field on Lead
			lead.email        = p.email_id or ''
			lead.mobile_no    = p.mobile_no or ''
			lead.phone        = p.mobile_no or ''
			lead.website      = p.website or ''
			lead.source       = _get_or_create_source('Prospecting')
			lead.insert(ignore_permissions=True)

			# ── 3. Sync notes → FCRM Note on the Lead ────────────────────────
			_sync_note_to_crm(p, lead.name)

			# ── 4. Mark prospect as Qualified ────────────────────────────────
			frappe.db.set_value('Prospect', pname, 'status', 'Qualified')
			created += 1
		except Exception as e:
			errors.append({'prospect': pname, 'error': str(e)})

	frappe.db.commit()
	return {'created': created, 'skipped': skipped, 'errors': errors}


def _sync_note_to_crm(prospect, lead_name):
	"""Create or update an FCRM Note on the CRM Lead with the prospect's notes + metadata."""
	# Build note content
	lines = []
	if prospect.notes:
		lines.append(prospect.notes)
	meta_parts = []
	if prospect.address:
		meta_parts.append(f'<strong>Address:</strong> {prospect.address}')
	if prospect.rating:
		meta_parts.append(f'<strong>Google Rating:</strong> ★ {prospect.rating}')
	if meta_parts:
		lines.append('<p>' + ' &nbsp;·&nbsp; '.join(meta_parts) + '</p>')

	if not lines:
		return

	content = '\n'.join(lines)
	title = f'Notes from Prospecting'

	# Update existing note if one already exists for this lead from prospecting
	existing_note = frappe.db.get_value('FCRM Note', {
		'reference_doctype': 'CRM Lead',
		'reference_docname': lead_name,
		'title': title,
	}, 'name')

	if existing_note:
		frappe.db.set_value('FCRM Note', existing_note, 'content', content)
	else:
		frappe.get_doc({
			'doctype': 'FCRM Note',
			'title': title,
			'content': content,
			'reference_doctype': 'CRM Lead',
			'reference_docname': lead_name,
		}).insert(ignore_permissions=True)


def _get_or_create_source(source_name):
	"""Return a Lead Source link value, creating it if needed."""
	try:
		if not frappe.db.exists('CRM Lead Source', source_name):
			frappe.get_doc({'doctype': 'CRM Lead Source', 'source_name': source_name}).insert(ignore_permissions=True)
			frappe.db.commit()
		return source_name
	except Exception:
		return ''
