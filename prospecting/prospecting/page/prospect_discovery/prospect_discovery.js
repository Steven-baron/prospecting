frappe.pages['prospect-discovery'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Find Prospects'),
		single_column: true,
	});
	new ProspectDiscoveryPage(page);
};

class ProspectDiscoveryPage {
	constructor(page) {
		this.page    = page;
		this.results = [];
		this.selected = new Set();
		this.lists   = [];
		this.map     = null;
		this.markers = [];

		// City selection state
		this.city_bounds   = null;   // google.maps.LatLngBounds from autocomplete
		this.city_features = [];     // Data-layer features for the boundary polygon

		this.render();
		this.load_lists();
		this.load_categories();
		this.init_map();
	}

	render() {
		this.$body = $(this.page.main).css('padding', '0');
		this.$body.html(`
<div class="pd-wrap" style="padding:20px;">

  <!-- ── Search bar ─────────────────────────────── -->
  <div class="frappe-card pd-search" style="padding:16px;margin-bottom:16px;">
    <div class="row g-2 align-items-end">
      <div class="col-lg-4">
        <label class="control-label text-muted small mb-1">${__('What')}</label>
        <div class="input-group input-group-sm">
          <span class="input-group-text"><i class="fa fa-search text-muted"></i></span>
          <input class="form-control pd-query"
            placeholder="${__('e.g. dentists, ESL schools, plumbers…')}"
            type="text">
        </div>
      </div>
      <div class="col-lg-3">
        <label class="control-label text-muted small mb-1">${__('Where')}</label>
        <div class="input-group input-group-sm">
          <span class="input-group-text"><i class="fa fa-map-marker text-muted"></i></span>
          <input class="form-control pd-location"
            placeholder="${__('City or area…')}"
            type="text" autocomplete="off">
        </div>
      </div>
      <div class="col-lg-2">
        <label class="control-label text-muted small mb-1">${__('Category')}</label>
        <select class="form-select form-select-sm pd-category"></select>
      </div>
      <div class="col-lg-1">
        <label class="control-label text-muted small mb-1">${__('Depth')}</label>
        <select class="form-select form-select-sm pd-depth">
          <option value="1">${__('Quick')}</option>
          <option value="2" selected>${__('Full')}</option>
          <option value="3">${__('Thorough')}</option>
        </select>
      </div>
      <div class="col-lg-2">
        <button class="btn btn-primary btn-sm w-100 pd-search-btn">
          <i class="fa fa-search"></i> ${__('Search')}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Results + Map ──────────────────────────── -->
  <div class="row g-3">

    <!-- Results list -->
    <div class="col-lg-6">
      <div class="frappe-card pd-results-panel"
           style="display:flex;flex-direction:column;height:65vh;">
        <div class="pd-results-header"
             style="padding:10px 16px;border-bottom:1px solid var(--border-color);
                    display:flex;align-items:center;justify-content:space-between;
                    flex-shrink:0;min-height:44px;">
          <div class="pd-summary text-muted small"></div>
          <button class="btn btn-sm btn-primary pd-save-btn" style="display:none;">
            ${__('Save to list')}
          </button>
        </div>
        <div class="pd-results-list" style="flex:1;overflow-y:auto;"></div>
        <div class="pd-empty"
             style="flex:1;display:flex;align-items:center;justify-content:center;
                    color:var(--text-muted);font-size:13px;padding:40px;text-align:center;">
          ${__('Search for businesses to start building a prospect list.')}
        </div>
      </div>
    </div>

    <!-- Map -->
    <div class="col-lg-6">
      <div style="height:65vh;border-radius:var(--border-radius);
                  overflow:hidden;border:1px solid var(--border-color);position:relative;">
        <div class="pd-map" style="width:100%;height:100%;"></div>
        <div class="pd-map-placeholder"
             style="position:absolute;inset:0;display:flex;align-items:center;
                    justify-content:center;background:var(--bg-light-gray);
                    color:var(--text-muted);font-size:13px;text-align:center;padding:32px;">
          <div>
            <i class="fa fa-map-o" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.4;"></i>
            ${__('Type a city in the Where field to see its boundary,<br>then search to drop pins.')}<br>
            <span class="pd-map-key-hint" style="display:none;margin-top:8px;display:block;">
              ${__('Add a Google Maps API key in')}
              <a href="/app/prospecting-settings">${__('Prospecting Settings')}</a>
              ${__('to enable the map.')}
            </span>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>`);
		this.bind_events();
	}

	bind_events() {
		const me = this;
		this.$('.pd-search-btn').on('click',  () => me.run_search());
		this.$('.pd-query').on('keydown',     e => { if (e.key === 'Enter') me.run_search(); });
		this.$('.pd-save-btn').on('click',    () => me.show_save_dialog());
	}

	$(sel) { return this.$body.find(sel); }

	// ── Data loaders ─────────────────────────────────────────────────────────

	async load_lists() {
		const r = await frappe.call('frappe.client.get_list', {
			doctype: 'Prospect List',
			fields: ['name', 'list_name'],
			limit: 200,
			order_by: 'list_name asc',
		});
		this.lists = r.message || [];
	}

	async load_categories() {
		const r = await frappe.call({ method: 'prospecting.api.get_place_categories' });
		const cats = r.message || [];
		const $sel = this.$('.pd-category').empty();
		cats.forEach(c => $sel.append(`<option value="${c.value}">${c.label}</option>`));
	}

	// ── Google Maps setup ─────────────────────────────────────────────────────

	async init_map() {
		let key = '';
		try {
			const r = await frappe.call({ method: 'prospecting.api.get_maps_api_key' });
			key = (r.message || '').trim();
		} catch (_) {}

		if (!key) {
			this.$('.pd-map-key-hint').show();
			return;
		}

		await this._load_maps_script(key);

		const mapEl = this.$('.pd-map')[0];
		this.map = new google.maps.Map(mapEl, {
			center: { lat: 43.6532, lng: -79.3832 },
			zoom: 11,
			gestureHandling: 'greedy',
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,
		});

		this.$('.pd-map-placeholder').hide();
		this._init_autocomplete();
	}

	_load_maps_script(key) {
		if (window.google && window.google.maps) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
			s.onload = resolve;
			s.onerror = reject;
			document.head.appendChild(s);
		});
	}

	// ── City autocomplete + boundary polygon ──────────────────────────────────

	_init_autocomplete() {
		const input = this.$('.pd-location')[0];
		const ac = new google.maps.places.Autocomplete(input, {
			types: ['(cities)'],
			fields: ['name', 'formatted_address', 'geometry'],
		});

		ac.addListener('place_changed', () => {
			const place = ac.getPlace();
			if (!place || !place.geometry) return;

			// Store viewport bounds for Places API restriction
			this.city_bounds = place.geometry.viewport || null;
			if (this.city_bounds) {
				this.map.fitBounds(this.city_bounds, 0);
			}

			// Fetch real boundary polygon from Nominatim (OpenStreetMap)
			const name = place.name || input.value;
			this._draw_city_polygon(name);
		});

		// Clear boundary if user edits the field manually
		this.$('.pd-location').on('input', () => {
			this.city_bounds = null;
			this._clear_city_polygon();
		});
	}

	async _draw_city_polygon(city_name) {
		this._clear_city_polygon();
		if (!this.map) return;

		try {
			const url = 'https://nominatim.openstreetmap.org/search?' +
				`q=${encodeURIComponent(city_name)}&format=json` +
				`&polygon_geojson=1&limit=1&featuretype=city&addressdetails=0`;

			const r = await fetch(url, {
				headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'ProspectingTool/1.0' },
			});
			if (!r.ok) return;

			const data = await r.json();
			const geojson = data[0] && data[0].geojson;
			if (!geojson) return;

			const features = this.map.data.addGeoJson({
				type: 'Feature',
				geometry: geojson,
			});

			this.city_features = Array.isArray(features) ? features : [features];

			this.map.data.setStyle({
				fillColor: '#2563eb',
				fillOpacity: 0.07,
				strokeColor: '#ff4500',
				strokeWeight: 2.5,
				strokeOpacity: 0.85,
			});
		} catch (_) {}
	}

	_clear_city_polygon() {
		if (!this.map) return;
		this.city_features.forEach(f => { try { this.map.data.remove(f); } catch (_) {} });
		this.city_features = [];
	}

	// ── Markers ───────────────────────────────────────────────────────────────

	_clear_markers() {
		this.markers.forEach(m => m.setMap(null));
		this.markers = [];
	}

	_drop_markers() {
		if (!this.map) return;
		this._clear_markers();

		const valid = this.results.filter(r => r.lat != null && r.lng != null);
		if (!valid.length) return;

		valid.forEach(r => {
			const m = new google.maps.Marker({
				position: { lat: r.lat, lng: r.lng },
				map: this.map,
				title: r.businessName,
			});
			m.addListener('click', () => {
				this.toggle(r.placeId);
				this.$(`[data-id="${r.placeId}"] .pd-chk`).prop('checked', this.selected.has(r.placeId));
				this.update_actions();
			});
			this.markers.push(m);
		});

		if (valid.length === 1) {
			this.map.setCenter({ lat: valid[0].lat, lng: valid[0].lng });
			this.map.setZoom(14);
		} else {
			const bounds = new google.maps.LatLngBounds();
			valid.forEach(r => bounds.extend({ lat: r.lat, lng: r.lng }));
			this.map.fitBounds(bounds, 48);
		}
	}

	_pan_to(placeId) {
		if (!this.map) return;
		const r = this.results.find(r => r.placeId === placeId);
		if (!r || r.lat == null) return;
		this.map.panTo({ lat: r.lat, lng: r.lng });
		if ((this.map.getZoom() || 0) < 14) this.map.setZoom(15);
	}

	// ── Search ────────────────────────────────────────────────────────────────

	async run_search() {
		const what     = this.$('.pd-query').val().trim();
		const location = this.$('.pd-location').val().trim();

		if (!what && !location) {
			frappe.show_alert({ message: __('Enter what you\'re looking for.'), indicator: 'orange' });
			return;
		}

		// Natural-language query: "dentists in Toronto"
		const query = what && location ? `${what} in ${location}` : what || location;

		// Pass bounding box if a city was chosen from autocomplete
		let bounds_arg = '';
		if (this.city_bounds) {
			const ne = this.city_bounds.getNorthEast();
			const sw = this.city_bounds.getSouthWest();
			bounds_arg = JSON.stringify({
				north: ne.lat(), east: ne.lng(),
				south: sw.lat(), west: sw.lng(),
			});
		}

		this.set_loading(true);
		this.selected.clear();
		this._clear_markers();

		try {
			const r = await frappe.call({
				method: 'prospecting.api.search_places',
				args: {
					query,
					included_type: this.$('.pd-category').val(),
					max_pages:     parseInt(this.$('.pd-depth').val()),
					bounds:        bounds_arg || undefined,
				},
			});
			this.results = (r.message && r.message.results) || [];
			this.render_results();
			this._drop_markers();
		} catch (e) {
			frappe.show_alert({ message: __('Search failed.'), indicator: 'red' });
		} finally {
			this.set_loading(false);
		}
	}

	set_loading(on) {
		const $btn = this.$('.pd-search-btn');
		if (on) {
			$btn.prop('disabled', true).html(`<i class="fa fa-spinner fa-spin"></i> ${__('Searching…')}`);
		} else {
			$btn.prop('disabled', false).html(`<i class="fa fa-search"></i> ${__('Search')}`);
		}
	}

	// ── Results rendering ─────────────────────────────────────────────────────

	render_results() {
		const $list  = this.$('.pd-results-list').empty();
		const $empty = this.$('.pd-empty');

		if (!this.results.length) {
			$empty.show();
			this.$('.pd-summary').html('');
			this.update_actions();
			return;
		}

		$empty.hide();
		this.update_summary();

		this.results.forEach(r => {
			const stars = r.rating != null
				? `<span style="color:#f59e0b;">★</span> ${r.rating} <span class="text-muted">(${r.reviewCount || 0})</span>`
				: '';
			const $row = $(`
<div class="pd-row" data-id="${r.placeId}"
  style="display:flex;gap:12px;padding:12px 16px;
         border-bottom:1px solid var(--border-color);
         cursor:pointer;align-items:flex-start;">
  <input type="checkbox" class="pd-chk" data-id="${r.placeId}"
    style="margin-top:3px;cursor:pointer;flex-shrink:0;"
    ${this.selected.has(r.placeId) ? 'checked' : ''}>
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-weight:600;">${frappe.utils.escape_html(r.businessName)}</span>
      ${stars ? `<span style="font-size:12px;">${stars}</span>` : ''}
    </div>
    ${r.category ? `<span class="badge text-bg-secondary" style="font-size:10px;margin-top:3px;">${frappe.utils.escape_html(r.category)}</span>` : ''}
    ${r.address  ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px;"><i class="fa fa-map-marker"></i> ${frappe.utils.escape_html(r.address)}</div>` : ''}
    <div style="display:flex;gap:14px;margin-top:4px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;">
      ${r.phone         ? `<span><i class="fa fa-phone"></i> ${frappe.utils.escape_html(r.phone)}</span>` : ''}
      ${r.website       ? `<a href="${frappe.utils.escape_html(r.website)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()"><i class="fa fa-globe"></i> ${__('Website')}</a>` : ''}
      ${r.googleMapsUri ? `<a href="${frappe.utils.escape_html(r.googleMapsUri)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()"><i class="fa fa-map"></i> ${__('Map')}</a>` : ''}
    </div>
  </div>
</div>`);

			$row.on('mouseenter', () => this._pan_to(r.placeId));
			$row.on('click', e => {
				if ($(e.target).is('a, input')) return;
				this.toggle(r.placeId);
				$row.find('.pd-chk').prop('checked', this.selected.has(r.placeId));
				this.update_actions();
			});
			$row.find('.pd-chk').on('change', e => {
				e.stopPropagation();
				this.toggle(r.placeId);
				this.update_actions();
			});

			$list.append($row);
		});

		this.update_actions();
	}

	toggle(id) {
		if (this.selected.has(id)) this.selected.delete(id);
		else this.selected.add(id);
	}

	update_summary() {
		const total = this.results.length;
		const sel   = this.selected.size;
		const allOn = total > 0 && sel === total;
		this.$('.pd-summary').html(`
<label style="cursor:pointer;user-select:none;margin:0;">
  <input type="checkbox" class="pd-chk-all" ${allOn ? 'checked' : ''}
         style="margin-right:6px;">
  <strong>${total}</strong> ${__('results')} &nbsp;·&nbsp;
  <span class="pd-sel-count">${sel}</span> ${__('selected')}
</label>`);
		this.$('.pd-chk-all').off('change').on('change', e => {
			if (e.target.checked) this.results.forEach(r => this.selected.add(r.placeId));
			else this.selected.clear();
			this.$('.pd-chk').prop('checked', e.target.checked);
			this.update_actions();
		});
	}

	update_actions() {
		const sel = this.selected.size;
		this.$('.pd-sel-count').text(sel);
		this.$('.pd-save-btn').toggle(sel > 0).text(`${__('Save')} ${sel} ${__('to list')}`);
		if (this.results.length) this.$('.pd-chk-all').prop('checked', sel === this.results.length);
	}

	// ── Save dialog ───────────────────────────────────────────────────────────

	show_save_dialog() {
		const chosen = this.results.filter(r => this.selected.has(r.placeId));
		if (!chosen.length) return;

		const me        = this;
		const has_lists = this.lists.length > 0;

		const d = new frappe.ui.Dialog({
			title: __('Save to Prospect List'),
			fields: [
				{
					fieldtype: 'Select',
					fieldname: 'list_mode',
					label: __('Save to'),
					options: has_lists
						? `${__('Existing list')}\n${__('New list')}`
						: __('New list'),
					default: has_lists ? __('Existing list') : __('New list'),
					onchange() {
						const is_new = d.get_value('list_mode') === __('New list');
						d.set_df_property('list_name',     'hidden', is_new);
						d.set_df_property('new_list_name', 'hidden', !is_new);
					},
				},
				{
					fieldtype: 'Link',
					fieldname: 'list_name',
					label: __('List'),
					options: 'Prospect List',
					hidden: !has_lists ? 1 : 0,
				},
				{
					fieldtype: 'Data',
					fieldname: 'new_list_name',
					label: __('New list name'),
					hidden: has_lists ? 1 : 0,
				},
				{
					fieldtype: 'Check',
					fieldname: 'enrich_email',
					label: __('Try to find emails from business websites (slower)'),
					default: 1,
				},
			],
			primary_action_label: `${__('Save')} ${chosen.length} ${__('prospects')}`,
			async primary_action(vals) {
				const is_new    = vals.list_mode === __('New list');
				const list_name = is_new ? '' : (vals.list_name || '');
				const new_name  = is_new ? (vals.new_list_name || '').trim() : '';

				if (!is_new && !list_name) {
					frappe.show_alert({ message: __('Pick a list.'), indicator: 'orange' }); return;
				}
				if (is_new && !new_name) {
					frappe.show_alert({ message: __('Enter a list name.'), indicator: 'orange' }); return;
				}

				d.disable_primary_action();
				d.set_title(__('Saving…'));

				try {
					const r = await frappe.call({
						method: 'prospecting.api.import_prospects',
						args: {
							prospects:     JSON.stringify(chosen),
							list_name,
							new_list_name: new_name,
							enrich_email:  vals.enrich_email ? 1 : 0,
						},
					});
					const data = r.message;
					frappe.show_alert({
						message: `${__('Saved')} ${data.created} ${__('prospects')}` +
						         (data.skipped ? ` · ${data.skipped} ${__('already existed')}` : ''),
						indicator: 'green',
					});
					d.hide();
					me.selected.clear();
					me.update_actions();
					me.load_lists();
				} catch (_) {
					d.enable_primary_action();
					d.set_title(__('Save to Prospect List'));
					frappe.show_alert({ message: __('Save failed.'), indicator: 'red' });
				}
			},
		});
		d.show();
	}
}
