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
def setup_crm_custom_fields(*args, **kwargs):
	"""One-time: create custom fields on CRM doctypes. Run once after install."""
	FIELDS = [
		dict(dt='CRM Lead', fieldname='custom_prospect', label='Source Prospect',
		     fieldtype='Link', options='Prospect', insert_after='source', read_only=1),
		dict(dt='CRM Lead', fieldname='custom_google_rating', label='Google Rating',
		     fieldtype='Float', insert_after='custom_prospect', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_prospect', label='Source Prospect',
		     fieldtype='Link', options='Prospect', insert_after='website', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_google_rating', label='Google Rating',
		     fieldtype='Float', insert_after='custom_prospect', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_google_maps_url', label='Google Maps URL',
		     fieldtype='Data', options='URL', insert_after='custom_google_rating', read_only=1),
		dict(dt='CRM Organization', fieldname='custom_address_text', label='Address',
		     fieldtype='Small Text', insert_after='custom_google_maps_url', read_only=1),
	]
	created = []
	for f in FIELDS:
		name = f'{f["dt"]}-{f["fieldname"]}'
		if not frappe.db.exists('Custom Field', name):
			cf = frappe.new_doc('Custom Field')
			cf.update(f)
			cf.insert(ignore_permissions=True)
			created.append(name)
	frappe.db.commit()
	return {'created': created}


@frappe.whitelist()
def get_maps_api_key():
	settings = frappe.get_single('Prospecting Settings')
	return settings.get_password('google_maps_api_key') or ''


@frappe.whitelist()
def get_place_categories():
	"""Return only active categories for the search dropdown."""
	settings = frappe.get_single('Prospecting Settings')
	if settings.categories:
		return [
			{'label': r.label, 'value': r.value}
			for r in settings.categories
			if r.active
		]
	return PLACE_CATEGORIES


@frappe.whitelist()
def get_all_categories():
	"""Return all categories (including inactive) for the settings UI."""
	settings = frappe.get_single('Prospecting Settings')
	if settings.categories:
		return [
			{'name': r.name, 'label': r.label, 'value': r.value, 'active': bool(r.active)}
			for r in settings.categories
		]
	# First visit — return defaults so the settings page has something to show
	from prospecting.install import DEFAULT_CATEGORIES
	return [{'name': None, 'label': l, 'value': v, 'active': True} for l, v in DEFAULT_CATEGORIES]


@frappe.whitelist()
def save_categories(categories):
	"""Save the full categories list from the settings UI."""
	if isinstance(categories, str):
		categories = frappe.parse_json(categories)
	settings = frappe.get_single('Prospecting Settings')
	settings.categories = []
	for c in categories:
		settings.append('categories', {
			'label':  c.get('label', '').strip(),
			'value':  c.get('value', '').strip(),
			'active': 1 if c.get('active') else 0,
		})
	settings.save(ignore_permissions=True)
	frappe.db.commit()
	return {'saved': len(categories)}


@frappe.whitelist()
def get_api_settings():
	"""Return current API key settings for the prospecting settings UI."""
	settings = frappe.get_single('Prospecting Settings')
	fc_url   = settings.get('firecrawl_url') or ''
	return {
		'google_places_api_key': settings.get_password('google_places_api_key') or '',
		'google_maps_api_key':   settings.get_password('google_maps_api_key')   or '',
		'opencode_api_key':      settings.get_password('opencode_api_key')      or '',
		'opencode_model':        settings.get('opencode_model') or 'opencode-go/deepseek-v4-flash',
		'firecrawl_url':         fc_url,
		'firecrawl_api_key':     (settings.get_password('firecrawl_api_key') or '') if fc_url else '',
	}


@frappe.whitelist()
def save_api_settings(google_places_api_key=None, google_maps_api_key=None,
                      opencode_api_key=None, opencode_model=None,
                      firecrawl_url=None, firecrawl_api_key=None):
	"""Save API keys and AI model setting from the prospecting settings UI."""
	settings = frappe.get_single('Prospecting Settings')
	if google_places_api_key is not None:
		settings.google_places_api_key = google_places_api_key
	if google_maps_api_key is not None:
		settings.google_maps_api_key = google_maps_api_key
	if opencode_api_key is not None:
		settings.opencode_api_key = opencode_api_key
	if opencode_model is not None:
		settings.opencode_model = opencode_model
	if firecrawl_url is not None:
		settings.firecrawl_url = (firecrawl_url or '').strip()
	if firecrawl_api_key is not None:
		settings.firecrawl_api_key = firecrawl_api_key
	settings.save(ignore_permissions=True)
	frappe.db.commit()
	return {'saved': True}


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
	"""Fetch one grid cell across multiple pages; returns all raw place dicts.

	If the request fails due to an invalid includedType, retries once without it.
	"""
	import requests as _req
	places = []
	page_token = None
	body_to_use = dict(base_body)
	for _ in range(max_pages):
		body = dict(body_to_use)
		if page_token:
			body['pageToken'] = page_token
		try:
			resp = _req.post(endpoint, json=body, headers=req_headers, timeout=20)
			if not resp.ok:
				# If includedType was rejected, retry without it (once)
				if resp.status_code == 400 and 'includedType' in body_to_use:
					body_to_use.pop('includedType', None)
					body.pop('includedType', None)
					body.pop('pageToken', None)
					resp = _req.post(endpoint, json=body, headers=req_headers, timeout=20)
					if not resp.ok:
						break
				else:
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
		type_dropped = False
		for _ in range(max_pages):
			body = dict(base_body)
			body['maxResultCount'] = 20
			if region_code:
				body['regionCode'] = region_code.upper()
			if page_token:
				body['pageToken'] = page_token

			resp = _req.post(_PLACES_ENDPOINT, json=body, headers=req_headers, timeout=15)
			if not resp.ok:
				# Retry without includedType if it was rejected
				if resp.status_code == 400 and 'includedType' in base_body and not type_dropped:
					base_body.pop('includedType')
					type_dropped = True
					body.pop('includedType', None)
					body.pop('pageToken', None)
					resp = _req.post(_PLACES_ENDPOINT, json=body, headers=req_headers, timeout=15)
					if not resp.ok:
						break
				else:
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
			url, timeout=5, allow_redirects=True,
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


def _fetch_html_firecrawl(url, firecrawl_url, firecrawl_api_key=''):
	"""Fetch rendered HTML via a self-hosted Firecrawl instance."""
	import requests as _req
	endpoint = firecrawl_url.rstrip('/') + '/v1/scrape'
	headers  = {'Content-Type': 'application/json'}
	if firecrawl_api_key:
		headers['Authorization'] = f'Bearer {firecrawl_api_key}'
	try:
		r = _req.post(endpoint, json={'url': url, 'formats': ['html']},
		              headers=headers, timeout=20)
		if not r.ok:
			return None
		return r.json().get('data', {}).get('html') or None
	except Exception:
		return None


def _find_email_for_website(website, firecrawl_url='', firecrawl_api_key=''):
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

	# Phase 1: fast plain-HTTP scrape (no cost, handles most static/WordPress sites)
	for url in [website, f'{base}/contact']:
		html = _fetch_html(url)
		if html:
			email = _pick_email(html)
			if email:
				return email

	# Phase 2: Firecrawl fallback for JS-rendered sites (Wix, React, etc.)
	if firecrawl_url:
		for url in [website, f'{base}/contact']:
			html = _fetch_html_firecrawl(url, firecrawl_url, firecrawl_api_key)
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
	settings        = frappe.get_single('Prospecting Settings')
	firecrawl_url   = settings.get('firecrawl_url') or ''
	firecrawl_key   = settings.get_password('firecrawl_api_key') if firecrawl_url else ''
	email = _find_email_for_website(doc.website, firecrawl_url, firecrawl_key or '')
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

	def _t(v, n=139):
		"""Truncate a string to n chars; return '' for None/falsy."""
		if not v:
			return ''
		return str(v)[:n]

	created = skipped = 0
	used_names = set()  # track names created in this batch to catch same-batch duplicates

	# Pre-fetch emails concurrently if requested (capped at 20 workers)
	email_map = {}
	if enrich:
		from concurrent.futures import ThreadPoolExecutor
		settings        = frappe.get_single('Prospecting Settings')
		firecrawl_url   = settings.get('firecrawl_url') or ''
		firecrawl_key   = (settings.get_password('firecrawl_api_key') or '') if firecrawl_url else ''
		def _safe_email(p):
			try:
				w = p.get('website') or ''
				if not w:
					return p.get('placeId'), ''
				return p.get('placeId'), (_find_email_for_website(w, firecrawl_url, firecrawl_key) or '')
			except Exception:
				return p.get('placeId'), ''
		needs_email = [p for p in prospects if not p.get('email') and p.get('website')]
		with ThreadPoolExecutor(max_workers=20) as ex:
			for pid, email in ex.map(_safe_email, needs_email):
				if pid:
					email_map[pid] = email

	for p in prospects:
		place_id = p.get('placeId') or ''

		# Deduplicate by Google Place ID
		if place_id and frappe.db.exists('Prospect', {'place_id': place_id}):
			skipped += 1
			continue

		email = p.get('email') or email_map.get(place_id, '')

		# Resolve a unique prospect_name (the doc name).
		# If the same business name already exists in the DB or in this batch,
		# append the street address to differentiate (e.g. two "Staples" locations).
		base_name = _t(p.get('businessName') or '', 120)
		prospect_name = base_name
		if frappe.db.exists('Prospect', prospect_name) or prospect_name in used_names:
			street = _t((p.get('address') or '').split(',')[0].strip(), 60)
			if street:
				prospect_name = f'{base_name} – {street}'[:139]
			if frappe.db.exists('Prospect', prospect_name) or prospect_name in used_names:
				skipped += 1
				continue

		used_names.add(prospect_name)

		doc = frappe.new_doc('Prospect')
		doc.prospect_name   = prospect_name
		doc.place_id        = _t(place_id)
		doc.category        = _t(category or p.get('category') or '')
		doc.email_id        = _t(email)
		doc.mobile_no       = _t(p.get('phone') or '')
		doc.website         = _t(p.get('website') or '')
		doc.address         = _t(p.get('address') or '')
		doc.lat             = p.get('lat')
		doc.lng             = p.get('lng')
		doc.rating          = p.get('rating')
		doc.review_count    = p.get('reviewCount')
		doc.business_status = _t(p.get('businessStatus') or '')
		doc.google_maps_uri = _t(p.get('googleMapsUri') or '')
		doc.google_types    = json.dumps(p.get('types') or [])
		doc.status          = 'New'
		doc.prospect_list   = list_name
		doc.source          = 'google-places'
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
	lead_names = {}  # prospect_name → crm lead name

	for pname in prospect_names:
		p = frappe.get_doc('Prospect', pname)

		# If prospect already has a linked lead, just sync notes
		existing_lead = p.crm_lead or frappe.db.exists('CRM Lead', {'custom_prospect': pname})
		if existing_lead:
			_sync_note_to_crm(p, existing_lead)
			lead_names[pname] = existing_lead
			skipped += 1
			continue

		try:
			# ── 1. Create CRM Lead (placeholder person = company name) ────────
			# first_name is a placeholder — user updates it once a real contact is identified
			lead = frappe.new_doc('CRM Lead')
			lead.first_name          = p.prospect_name
			lead.lead_name           = p.prospect_name
			lead.organization        = p.prospect_name
			lead.email               = p.email_id or ''
			lead.mobile_no           = p.mobile_no or ''
			lead.phone               = p.mobile_no or ''
			lead.website             = p.website or ''
			lead.source              = _get_or_create_source('Prospecting')
			lead.custom_prospect     = pname
			lead.custom_google_rating = p.rating or 0
			lead.insert(ignore_permissions=True)

			# ── 2. Link to CRM Organization via CRM's own mechanism ───────────
			org_name = lead.create_organization()

			# ── 3. Populate custom fields on the CRM Organization ────────────
			if org_name:
				frappe.db.set_value('CRM Organization', org_name, {
					'custom_prospect':        pname,
					'custom_google_rating':   p.rating or 0,
					'custom_google_maps_url': p.google_maps_uri or '',
					'custom_address_text':    p.address or '',
				})

			# ── 4. Sync notes → FCRM Note on the Lead ────────────────────────
			_sync_note_to_crm(p, lead.name)

			# ── 5. Store lead reference + mark Qualified ──────────────────────
			frappe.db.set_value('Prospect', pname, {
				'status':   'Qualified',
				'crm_lead': lead.name,
			})
			lead_names[pname] = lead.name
			created += 1
		except Exception as e:
			errors.append({'prospect': pname, 'error': str(e)})

	frappe.db.commit()
	return {'created': created, 'skipped': skipped, 'errors': errors, 'lead_names': lead_names}


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


# ── Owner Name Intelligence ───────────────────────────────────────────────────

def _fetch_place_reviews(place_id, google_api_key):
	"""Return review text strings for a Google Place (up to 5 via Places API)."""
	import requests as _req
	url = f'https://places.googleapis.com/v1/places/{place_id}'
	resp = _req.get(url, headers={
		'X-Goog-Api-Key': google_api_key,
		'X-Goog-FieldMask': 'reviews',
	}, timeout=10)
	if not resp.ok:
		return []
	texts = []
	for r in resp.json().get('reviews', []):
		text = r.get('text', {}).get('text', '').strip()
		if text:
			texts.append(text)
	return texts


def _ai_extract_owner(business_name, reviews, opencode_api_key, model='opencode-go/deepseek-v4-flash'):
	"""
	Send reviews to OpenCode AI and extract a potential owner name.
	Returns (owner_name_or_None, [example_excerpts]).
	"""
	import re
	import requests as _req

	numbered = '\n\n'.join(f'[{i+1}] {r}' for i, r in enumerate(reviews[:25]))

	prompt = (
		f'You are analyzing Google reviews for a small business called "{business_name}".\n\n'
		f'Task: find the most likely owner or primary manager name from these reviews.\n\n'
		f'In small businesses, the people personally named by customers ARE almost always the owner or a co-owner '
		f'— not random employees. A "designer", "attendant", or "team member" named specifically by a happy customer '
		f'in a small print/service shop is very likely the owner operating hands-on.\n\n'
		f'Rules:\n'
		f'1. If any person\'s name is mentioned by a reviewer (shoutout, thanks, direct address, or praise), '
		f'treat them as a likely owner/manager candidate.\n'
		f'2. Pick the name that appears most across reviews, or the one mentioned most warmly.\n'
		f'3. Return null ONLY if zero names of any people appear in the reviews at all.\n\n'
		f'Reviews:\n{numbered}\n\n'
		f'Respond ONLY with valid JSON, no markdown, no explanation:\n'
		f'{{"owner_name": "First name or full name", "examples": ["exact short excerpt containing the name"]}}\n'
		f'owner_name must be null only if no personal names appear anywhere in the reviews.'
	)

	# Strip the "opencode-go/" config prefix — the HTTP API expects bare model IDs
	api_model = model.replace('opencode-go/', '', 1)

	resp = _req.post(
		'https://opencode.ai/zen/go/v1/chat/completions',
		headers={'Authorization': f'Bearer {opencode_api_key}', 'Content-Type': 'application/json'},
		json={
			'model': api_model,
			'messages': [{'role': 'user', 'content': prompt}],
			'temperature': 0.1,
		},
		timeout=45,
	)
	if not resp.ok:
		raise Exception(f'OpenCode API error {resp.status_code}: {resp.text[:300]}')

	content = resp.json()['choices'][0]['message']['content'].strip()

	# Strip markdown code fences if the model wraps the JSON
	content = re.sub(r'^```(?:json)?\s*', '', content)
	content = re.sub(r'\s*```$', '', content.strip())

	result = json.loads(content)
	return result.get('owner_name') or None, result.get('examples') or []


@frappe.whitelist()
def find_owner_names(prospect_names):
	"""
	For each prospect: fetch Google reviews → ask AI for owner name → store result.
	DB work runs in the main thread; only HTTP calls (reviews + AI) run concurrently.
	"""
	from concurrent.futures import ThreadPoolExecutor, as_completed

	if isinstance(prospect_names, str):
		prospect_names = json.loads(prospect_names)

	settings         = frappe.get_single('Prospecting Settings')
	google_api_key   = settings.get_password('google_places_api_key')
	opencode_api_key = settings.get_password('opencode_api_key')
	ai_model         = settings.get('opencode_model') or 'opencode-go/deepseek-v4-flash'

	if not google_api_key:
		frappe.throw('Google Places API key not configured in Prospecting Settings.')
	if not opencode_api_key:
		frappe.throw('OpenCode Go API key not configured in Prospecting Settings.')

	# Phase 1: load all docs in the main thread (Frappe DB is not thread-safe)
	docs = []
	for pname in prospect_names:
		p = frappe.get_doc('Prospect', pname)
		docs.append({'name': p.name, 'prospect_name': p.prospect_name, 'place_id': p.place_id or ''})

	# Phase 2: all external HTTP calls run concurrently (no Frappe DB access)
	def fetch_and_analyze(doc):
		if not doc['place_id']:
			return doc['name'], None, [], 'no_place_id'
		reviews = _fetch_place_reviews(doc['place_id'], google_api_key)
		if not reviews:
			return doc['name'], None, [], 'no_reviews'
		owner_name, examples = _ai_extract_owner(doc['prospect_name'], reviews, opencode_api_key, model=ai_model)
		return doc['name'], owner_name, examples, None

	raw = {}
	errors = []
	with ThreadPoolExecutor(max_workers=5) as ex:
		futures = {ex.submit(fetch_and_analyze, doc): doc['name'] for doc in docs}
		for future in as_completed(futures):
			pname = futures[future]
			try:
				pname, owner_name, examples, skip = future.result()
				raw[pname] = {'owner_name': owner_name, 'examples': examples, 'skip': skip}
			except Exception as e:
				errors.append({'prospect': pname, 'error': str(e)})

	# Phase 3: save results back in the main thread
	results = {}
	for pname, data in raw.items():
		if data['owner_name'] is not None:
			frappe.db.set_value('Prospect', pname, {
				'owner_name':         data['owner_name'],
				'owner_name_context': json.dumps(data['examples']),
			})
		results[pname] = data

	frappe.db.commit()
	return {'results': results, 'errors': errors}
