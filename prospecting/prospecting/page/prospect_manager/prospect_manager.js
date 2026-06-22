frappe.pages['prospect-manager'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Prospects'),
		single_column: true,
	});
	new ProspectManager(page);
};

const PM_STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost'];

class ProspectManager {
	constructor(page) {
		this.page  = page;

		// browse state
		this.lists          = [];
		this.total_count    = 0;
		this.selected_list  = null;   // null = All
		this.prospects      = [];
		this.prospect_start = 0;
		this.has_more       = false;
		this.open_name      = null;
		this._current_doc   = null;

		// search state
		this.search_results  = [];
		this.search_selected = new Set();
		this.map             = null;
		this.markers         = [];
		this.city_bounds     = null;
		this.city_features   = [];
		this._search_inited  = false;
		this._view           = 'browse';   // 'browse' | 'search'

		this.render();
		this.load_data();
	}

	// ── SHELL ─────────────────────────────────────────────────────────────────

	render() {
		this.$body = $(this.page.main).css('padding', 0);
		this.$body.html(`
<div class="pm-wrap" style="
  display:flex;
  height:calc(100vh - 60px);
  overflow:hidden;
  background:var(--bg-color);
">

  <!-- ════════════════ SIDEBAR ════════════════ -->
  <div class="pm-sidebar" style="
    width:220px;
    flex-shrink:0;
    border-right:1px solid var(--border-color);
    background:var(--fg-color);
    display:flex;
    flex-direction:column;
    overflow:hidden;
  ">

    <!-- Find Prospects action -->
    <div style="padding:12px 10px 8px;">
      <button class="btn btn-primary btn-sm w-100 pm-find-btn" style="justify-content:center;">
        <i class="fa fa-search" style="margin-right:6px;"></i>${__('Find Prospects')}
      </button>
    </div>

    <div style="flex:1;overflow-y:auto;padding:4px 8px 12px;">

      <!-- All Prospects -->
      <div class="standard-sidebar-section" style="margin-bottom:4px;">
        <div class="standard-sidebar-item selected pm-list-item" data-list="">
          <svg style="width:14px;height:14px;flex-shrink:0;margin-right:8px;opacity:.6;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="6" cy="5" r="2.5"/><circle cx="11.5" cy="5" r="2.5"/>
            <path d="M1 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4M9 10c1.2-.5 4 0 4 3.5"/>
          </svg>
          <span class="sidebar-item-label" style="flex:1;">${__('All Prospects')}</span>
          <span class="pm-list-badge pm-all-badge" style="font-size:11px;font-weight:600;color:var(--text-muted);margin-left:4px;">0</span>
        </div>
      </div>

      <!-- Lists section -->
      <div class="standard-sidebar-section">
        <div class="standard-sidebar-label" style="
          font-size:11px;font-weight:600;text-transform:uppercase;
          letter-spacing:.07em;color:var(--text-muted);padding:4px 12px 4px;
          margin-bottom:2px;
        ">${__('Lists')}</div>
        <div class="pm-lists-nav"></div>
        <div class="standard-sidebar-item pm-new-list-btn" style="color:var(--text-muted);">
          <svg style="width:13px;height:13px;flex-shrink:0;margin-right:8px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          <span class="sidebar-item-label">${__('New List')}</span>
        </div>
      </div>

    </div>
  </div>

  <!-- ════════════════ MAIN ════════════════ -->
  <div class="pm-main" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">

    <!-- ── BROWSE VIEW ── -->
    <div class="pm-browse" style="flex:1;display:flex;overflow:hidden;">

      <!-- table section -->
      <div class="pm-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">
        <div class="pm-content-hdr" style="
          display:flex;align-items:center;justify-content:space-between;
          padding:8px 16px;border-bottom:1px solid var(--border-color);
          background:var(--card-bg);flex-shrink:0;
        ">
          <span class="pm-content-title" style="font-weight:600;font-size:14px;"></span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-xs btn-danger pm-delete-list-btn" style="display:none;">${__('Delete list')}</button>
          </div>
        </div>
        <div class="pm-table-wrap" style="flex:1;overflow-y:auto;">
          <div class="pm-table-inner"></div>
        </div>
      </div>

      <!-- detail drawer -->
      <div class="pm-drawer" style="
        width:0;overflow:hidden;transition:width .22s ease;
        flex-shrink:0;border-left:1px solid transparent;display:flex;
      ">
        <div class="pm-drawer-inner" style="width:320px;display:flex;flex-direction:column;height:100%;overflow:hidden;">
          <div style="
            display:flex;align-items:center;justify-content:space-between;
            padding:9px 14px;border-bottom:1px solid var(--border-color);flex-shrink:0;
          ">
            <span class="pm-drawer-title" style="font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <button class="btn btn-xs pm-close-drawer" style="line-height:1;padding:2px 7px;">✕</button>
          </div>
          <div class="pm-drawer-body" style="flex:1;overflow-y:auto;padding:14px;"></div>
          <div style="padding:10px 14px;border-top:1px solid var(--border-color);flex-shrink:0;">
            <button class="btn btn-xs btn-danger pm-delete-prospect-btn">${__('Delete prospect')}</button>
          </div>
        </div>
      </div>

    </div><!-- /.pm-browse -->

    <!-- ── SEARCH VIEW ── -->
    <div class="pm-search" style="flex:1;display:none;flex-direction:column;overflow:hidden;">

      <div style="padding:10px 16px;border-bottom:1px solid var(--border-color);background:var(--card-bg);flex-shrink:0;">
        <div class="row g-2 align-items-end">
          <div class="col-lg-4">
            <label class="control-label text-muted small mb-1">${__('What')}</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="fa fa-search text-muted"></i></span>
              <input class="form-control pm-sq" type="text" placeholder="${__('e.g. dentists, ESL schools…')}">
            </div>
          </div>
          <div class="col-lg-3">
            <label class="control-label text-muted small mb-1">${__('Where')}</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="fa fa-map-marker text-muted"></i></span>
              <input class="form-control pm-loc" type="text" placeholder="${__('City or area…')}" autocomplete="off">
            </div>
          </div>
          <div class="col-lg-2">
            <label class="control-label text-muted small mb-1">${__('Category')}</label>
            <select class="form-select form-select-sm pm-cat"></select>
          </div>
          <div class="col-lg-1">
            <label class="control-label text-muted small mb-1">${__('Depth')}</label>
            <select class="form-select form-select-sm pm-depth">
              <option value="1">${__('Quick')}</option>
              <option value="2" selected>${__('Full')}</option>
              <option value="3">${__('Thorough')}</option>
            </select>
          </div>
          <div class="col-lg-2">
            <button class="btn btn-primary btn-sm w-100 pm-search-btn">
              <i class="fa fa-search"></i> ${__('Search')}
            </button>
          </div>
        </div>
      </div>

      <div style="flex:1;display:flex;overflow:hidden;">

        <!-- results -->
        <div style="width:42%;display:flex;flex-direction:column;border-right:1px solid var(--border-color);overflow:hidden;">
          <div style="padding:7px 12px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;min-height:40px;flex-shrink:0;">
            <div class="pm-results-summary text-muted small"></div>
            <button class="btn btn-primary btn-sm pm-save-btn" style="display:none;">${__('Save to list')}</button>
          </div>
          <div class="pm-results-list" style="flex:1;overflow-y:auto;">
            <div class="pm-results-empty" style="padding:48px 20px;text-align:center;color:var(--text-muted);">
              ${__('Search for businesses to start building a prospect list.')}
            </div>
          </div>
        </div>

        <!-- map -->
        <div style="flex:1;position:relative;">
          <div class="pm-map-el" style="width:100%;height:100%;"></div>
          <div class="pm-map-cover" style="
            position:absolute;inset:0;display:flex;align-items:center;
            justify-content:center;background:var(--bg-light-gray);
            color:var(--text-muted);text-align:center;padding:32px;
          ">
            <div>
              <i class="fa fa-map-o" style="font-size:28px;display:block;margin-bottom:10px;opacity:.35;"></i>
              ${__('Select a city in the Where field to see its boundary, then search.')}
            </div>
          </div>
        </div>

      </div>
    </div><!-- /.pm-search -->

  </div><!-- /.pm-main -->
</div><!-- /.pm-wrap -->`);

		this.bind_events();
	}

	$(sel) { return this.$body.find(sel); }

	bind_events() {
		const me = this;

		// sidebar — find prospects toggles search view
		this.$('.pm-find-btn').on('click', () => me.set_view('search'));

		// sidebar — list items switch browse view
		this.$('.pm-sidebar').on('click', '.pm-list-item', function () {
			me.set_view('browse');
			me.select_list($(this).data('list') || null);
		});
		this.$('.pm-new-list-btn').on('click', () => me.show_create_list_dialog());
		this.$('.pm-delete-list-btn').on('click', () => me.delete_list());

		// table row → drawer; inline status change
		this.$('.pm-table-wrap').on('click', '.pm-row', function (e) {
			if ($(e.target).is('select,a,button,input')) return;
			me.open_detail($(this).data('name'));
		});
		this.$('.pm-table-wrap').on('change', '.pm-status-sel', function (e) {
			e.stopPropagation();
			me.update_status($(this).closest('.pm-row').data('name'), $(this).val());
		});
		this.$('.pm-table-wrap').on('click', '.pm-load-more', () => me.load_more_prospects());

		// drawer
		this.$('.pm-close-drawer').on('click',           () => me.close_detail());
		this.$('.pm-delete-prospect-btn').on('click',    () => me.delete_prospect());

		// search
		this.$('.pm-search-btn').on('click', () => me.run_search());
		this.$('.pm-sq').on('keydown',       e => { if (e.key === 'Enter') me.run_search(); });
		this.$('.pm-save-btn').on('click',   () => me.show_save_dialog());
	}

	// ── VIEW SWITCHING ────────────────────────────────────────────────────────

	set_view(view) {
		this._view = view;
		const is_search = view === 'search';
		this.$('.pm-browse').toggle(!is_search).css('display', is_search ? 'none' : 'flex');
		this.$('.pm-search').toggle(is_search).css('display',  is_search ? 'flex' : 'none');

		// highlight "Find Prospects" button when in search mode
		this.$('.pm-find-btn').toggleClass('btn-default', is_search).toggleClass('btn-primary', !is_search);

		// clear sidebar active when in search, restore when browsing
		if (is_search) {
			this.$('.pm-list-item').removeClass('selected');
			if (!this._search_inited) {
				this._search_inited = true;
				this._load_categories();
				this.init_map();
			}
		} else {
			this._sync_sidebar();
		}
	}

	// ── DATA ──────────────────────────────────────────────────────────────────

	async load_data() {
		const r = await frappe.call({ method: 'prospecting.api.get_lists_with_counts' });
		const d = r.message || {};
		this.lists       = d.lists || [];
		this.total_count = d.total || 0;
		this.render_sidebar();
		this.select_list(this.selected_list);
	}

	// ── SIDEBAR ───────────────────────────────────────────────────────────────

	render_sidebar() {
		this.$('.pm-all-badge').text(this.total_count || 0);

		const $nav = this.$('.pm-lists-nav').empty();
		this.lists.forEach(l => $nav.append(this._list_item(l)));
	}

	_list_item(l) {
		const color = l.color || '#2563eb';
		return $(`
<div class="standard-sidebar-item pm-list-item" data-list="${frappe.utils.escape_html(l.name)}">
  <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-right:8px;display:inline-block;"></span>
  <span class="sidebar-item-label" style="flex:1;">${frappe.utils.escape_html(l.list_name)}</span>
  <span style="font-size:11px;font-weight:600;color:var(--text-muted);margin-left:4px;">${l._count || 0}</span>
</div>`);
	}

	_sync_sidebar() {
		this.$('.pm-list-item').removeClass('selected');
		const key = this.selected_list || '';
		this.$('.pm-list-item').filter(`[data-list="${key}"]`).addClass('selected');
	}

	select_list(name) {
		this.selected_list = (name !== undefined) ? name : null;
		this._sync_sidebar();
		this.close_detail();

		const listObj = name ? this.lists.find(l => l.name === name) : null;
		this.$('.pm-content-title').text(listObj ? listObj.list_name : __('All Prospects'));
		this.$('.pm-delete-list-btn').toggle(!!name);

		this.prospects      = [];
		this.prospect_start = 0;
		this.load_prospects(true);
	}

	// ── PROSPECTS TABLE ───────────────────────────────────────────────────────

	async load_prospects(reset = true) {
		if (reset) {
			this.prospect_start = 0;
			this.$('.pm-table-inner').html(
				`<div style="padding:40px;text-align:center;color:var(--text-muted);">
				   <i class="fa fa-spinner fa-spin fa-2x"></i>
				 </div>`
			);
		}

		const filters = [];
		if (this.selected_list) filters.push(['prospect_list', '=', this.selected_list]);

		const r = await frappe.call('frappe.client.get_list', {
			doctype:     'Prospect',
			fields:      ['name','prospect_name','category','address','mobile_no',
			              'email_id','website','rating','review_count','status',
			              'prospect_list','lat','lng','google_maps_uri'],
			filters,
			limit:       50,
			limit_start: this.prospect_start,
			order_by:    'modified desc',
		});

		const rows = r.message || [];
		this.prospects      = reset ? rows : [...this.prospects, ...rows];
		this.prospect_start = this.prospects.length;
		this.has_more       = rows.length === 50;
		this.render_table(reset);
	}

	load_more_prospects() { this.load_prospects(false); }

	render_table(reset = true) {
		const $inner = this.$('.pm-table-inner');

		if (!this.prospects.length) {
			$inner.html(`
<div style="padding:60px 20px;text-align:center;color:var(--text-muted);">
  <i class="fa fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;opacity:.3;"></i>
  ${__('No prospects in this list yet.')}<br>
  <button class="btn btn-primary btn-sm pm-find-from-empty" style="margin-top:14px;">
    <i class="fa fa-search"></i> ${__('Find Prospects')}
  </button>
</div>`);
			this.$('.pm-find-from-empty').on('click', () => this.set_view('search'));
			return;
		}

		if (reset) {
			$inner.html(`
<table class="table" style="font-size:13px;margin:0;table-layout:fixed;width:100%;">
  <colgroup>
    <col style="width:28px;"><col style="width:25%;"><col style="width:15%;">
    <col style="width:25%;"><col style="width:14%;"><col style="width:10%;"><col>
  </colgroup>
  <thead>
    <tr>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;"></th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Business Name')}</th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Category')}</th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Address')}</th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Phone')}</th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Rating')}</th>
      <th style="position:sticky;top:0;background:var(--card-bg);z-index:1;border-top:none!important;padding:8px 12px!important;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);font-weight:600;">${__('Status')}</th>
    </tr>
  </thead>
  <tbody class="pm-tbody"></tbody>
</table>
<div class="pm-load-more-wrap" style="padding:10px;text-align:center;"></div>`);
		}

		const $tbody = this.$('.pm-tbody');
		const from   = reset ? 0 : $tbody.children().length;
		this.prospects.slice(from).forEach(p => $tbody.append(this._render_row(p)));

		const $lm = this.$('.pm-load-more-wrap');
		$lm.html(this.has_more
			? `<button class="btn btn-default btn-sm pm-load-more">${__('Load more')}</button>`
			: '');

		if (this.open_name)
			this.$(`[data-name="${this.open_name}"]`).addClass('pm-row-open');
	}

	_render_row(p) {
		const stars = p.rating != null ? `★ ${Number(p.rating).toFixed(1)}` : '—';
		const opts  = PM_STATUSES.map(s =>
			`<option value="${s}"${p.status === s ? ' selected' : ''}>${__(s)}</option>`
		).join('');
		const openCls = this.open_name === p.name ? ' pm-row-open' : '';
		return $(`
<tr class="pm-row${openCls}" data-name="${frappe.utils.escape_html(p.name)}"
  style="cursor:pointer;transition:background .1s;"
  onmouseenter="this.style.background='var(--sidebar-select-color)'"
  onmouseleave="this.classList.contains('pm-row-open')||this.classList.contains('pm-row-open')?'':this.style.background=''">
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;color:var(--text-muted);font-size:12px;vertical-align:middle!important;">›</td>
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle!important;">${frappe.utils.escape_html(p.prospect_name || '')}</td>
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle!important;color:var(--text-muted);font-size:12px;">${frappe.utils.escape_html(p.category || '')}</td>
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle!important;color:var(--text-muted);font-size:12px;">${frappe.utils.escape_html((p.address || '').split(',')[0])}</td>
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle!important;font-size:12px;">${frappe.utils.escape_html(p.mobile_no || '')}</td>
  <td style="padding:8px 12px!important;border-top:1px solid var(--border-color)!important;vertical-align:middle!important;color:#f59e0b;font-size:12px;">${stars}</td>
  <td style="padding:6px 12px!important;border-top:1px solid var(--border-color)!important;vertical-align:middle!important;">
    <select class="form-select form-select-sm pm-status-sel" style="font-size:11px;padding:2px 6px;height:auto;">
      ${opts}
    </select>
  </td>
</tr>`);
	}

	// ── DETAIL DRAWER ─────────────────────────────────────────────────────────

	async open_detail(name) {
		this.open_name = name;
		this.$('.pm-row').css('background', '').removeClass('pm-row-open');
		const $row = this.$(`[data-name="${name}"]`);
		$row.addClass('pm-row-open').css('background', 'var(--sidebar-select-color)');

		const r = await frappe.call('frappe.client.get', { doctype: 'Prospect', name });
		this._current_doc = r.message;
		if (!this._current_doc) return;

		this.$('.pm-drawer-title').text(this._current_doc.prospect_name || name);
		this.render_detail(this._current_doc);
		this.$('.pm-drawer').css({ width: '320px', borderLeftColor: 'var(--border-color)' });
	}

	close_detail() {
		this.$('.pm-drawer').css({ width: '0', borderLeftColor: 'transparent' });
		this.$('.pm-row').css('background', '').removeClass('pm-row-open');
		this.open_name    = null;
		this._current_doc = null;
	}

	render_detail(doc) {
		const opts = PM_STATUSES.map(s =>
			`<option value="${s}"${doc.status === s ? ' selected' : ''}>${__(s)}</option>`
		).join('');
		const rating = doc.rating != null
			? `<span style="color:#f59e0b;">★</span> ${Number(doc.rating).toFixed(1)} <span class="text-muted">(${doc.review_count || 0})</span>`
			: '—';
		const listLabel = (this.lists.find(l => l.name === doc.prospect_list) || {}).list_name || doc.prospect_list || '';
		const fld = (label, html) => html
			? `<div style="margin-bottom:13px;">
			     <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:3px;">${label}</div>
			     <div style="font-size:13px;">${html}</div>
			   </div>`
			: '';

		this.$('.pm-drawer-body').html(`
<div>
  <div style="margin-bottom:13px;">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px;">${__('Status')}</div>
    <select class="form-select form-select-sm pm-detail-status">${opts}</select>
  </div>
  ${fld(__('Category'), doc.category ? `<span class="badge text-bg-secondary">${frappe.utils.escape_html(doc.category)}</span>` : '')}
  ${fld(__('Rating'), rating)}
  ${fld(__('Address'), frappe.utils.escape_html(doc.address || ''))}
  ${fld(__('Phone'),   doc.mobile_no ? `<a href="tel:${frappe.utils.escape_html(doc.mobile_no)}">${frappe.utils.escape_html(doc.mobile_no)}</a>` : '')}
  <div style="margin-bottom:13px;">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:3px;">${__('Email')}</div>
    <div style="display:flex;align-items:center;gap:8px;" class="pm-email-row">
      <span style="font-size:13px;flex:1;">
        ${doc.email_id
          ? `<a href="mailto:${frappe.utils.escape_html(doc.email_id)}">${frappe.utils.escape_html(doc.email_id)}</a>`
          : `<span class="text-muted">${__('None found')}</span>`}
      </span>
      <button class="btn btn-xs btn-default pm-find-email-btn" title="${__('Find from website')}">
        <i class="fa fa-magic"></i>
      </button>
    </div>
  </div>
  ${fld(__('Website'), doc.website ? `<a href="${frappe.utils.escape_html(doc.website)}" target="_blank" rel="noreferrer" style="word-break:break-all;">${frappe.utils.escape_html(doc.website)}</a>` : '')}
  ${doc.google_maps_uri ? `<div style="margin-bottom:13px;"><a href="${frappe.utils.escape_html(doc.google_maps_uri)}" target="_blank" rel="noreferrer" class="btn btn-default btn-sm w-100"><i class="fa fa-map-marker"></i> ${__('Google Maps')}</a></div>` : ''}
  ${fld(__('List'), frappe.utils.escape_html(listLabel))}
</div>`);

		this.$('.pm-detail-status').off('change').on('change', e =>
			this.update_status(doc.name, $(e.target).val())
		);
		this.$('.pm-find-email-btn').off('click').on('click', () => this.find_email(doc.name));
	}

	async update_status(name, status) {
		await frappe.call('frappe.client.set_value', {
			doctype: 'Prospect', name, fieldname: 'status', value: status,
		});
		this.$(`[data-name="${name}"] .pm-status-sel`).val(status);
		if (this.open_name === name) this.$('.pm-detail-status').val(status);
	}

	async find_email(name) {
		const $btn = this.$('.pm-find-email-btn').prop('disabled', true)
		                 .html('<i class="fa fa-spinner fa-spin"></i>');
		const r = await frappe.call({ method: 'prospecting.api.enrich_email', args: { prospect: name } });
		$btn.prop('disabled', false).html('<i class="fa fa-magic"></i>');
		const email = r.message?.email;
		if (email) {
			this.$('.pm-email-row span').html(
				`<a href="mailto:${frappe.utils.escape_html(email)}">${frappe.utils.escape_html(email)}</a>`
			);
			frappe.show_alert({ message: `${__('Found')}: ${email}`, indicator: 'green' });
		} else {
			frappe.show_alert({ message: r.message?.reason || __('No email found.'), indicator: 'orange' });
		}
	}

	async delete_prospect() {
		if (!this._current_doc) return;
		const doc = this._current_doc;
		frappe.confirm(__('Delete {0}?', [doc.prospect_name]), async () => {
			await frappe.call('frappe.client.delete', { doctype: 'Prospect', name: doc.name });
			this.close_detail();
			this.prospects = this.prospects.filter(p => p.name !== doc.name);
			this.total_count = Math.max(0, this.total_count - 1);
			const l = this.lists.find(l => l.name === this.selected_list);
			if (l) l._count = Math.max(0, (l._count || 0) - 1);
			this.render_sidebar();
			this._sync_sidebar();
			this.render_table(true);
			frappe.show_alert({ message: __('Deleted.'), indicator: 'green' });
		});
	}

	// ── LIST MANAGEMENT ───────────────────────────────────────────────────────

	show_create_list_dialog() {
		const me = this;
		const d  = new frappe.ui.Dialog({
			title: __('New Prospect List'),
			fields: [
				{ fieldtype: 'Data',  fieldname: 'list_name', label: __('List Name'), reqd: 1 },
				{ fieldtype: 'Data',  fieldname: 'category',  label: __('Category (optional)') },
				{ fieldtype: 'Color', fieldname: 'color',     label: __('Color'), default: '#2563eb' },
			],
			primary_action_label: __('Create'),
			async primary_action(vals) {
				const name = (vals.list_name || '').trim();
				if (!name) return;
				const r = await frappe.call('frappe.client.insert', {
					doc: { doctype: 'Prospect List', list_name: name, category: vals.category || '', color: vals.color || '#2563eb' },
				});
				me.lists.push({ name: r.message.name, list_name: r.message.list_name, _count: 0, color: vals.color || '#2563eb' });
				me.render_sidebar();
				me.set_view('browse');
				me.select_list(r.message.name);
				d.hide();
				frappe.show_alert({ message: __('List created.'), indicator: 'green' });
			},
		});
		d.show();
	}

	async delete_list() {
		if (!this.selected_list) return;
		const listObj = this.lists.find(l => l.name === this.selected_list);
		const label   = listObj?.list_name || this.selected_list;
		const count   = listObj?._count || 0;
		frappe.confirm(
			count
				? __('Delete list "{0}" and its {1} prospect(s)?', [label, count])
				: __('Delete list "{0}"?', [label]),
			async () => {
				await frappe.call({ method: 'prospecting.api.delete_list', args: { list_name: this.selected_list } });
				this.total_count = Math.max(0, this.total_count - count);
				this.lists = this.lists.filter(l => l.name !== this.selected_list);
				this.select_list(null);
				this.render_sidebar();
				frappe.show_alert({ message: __('List deleted.'), indicator: 'green' });
			}
		);
	}

	// ── GOOGLE MAPS ───────────────────────────────────────────────────────────

	async _load_categories() {
		const r = await frappe.call({ method: 'prospecting.api.get_place_categories' });
		const $s = this.$('.pm-cat').empty();
		(r.message || []).forEach(c => $s.append(`<option value="${c.value}">${c.label}</option>`));
	}

	async init_map() {
		let key = '';
		try {
			const r = await frappe.call({ method: 'prospecting.api.get_maps_api_key' });
			key = (r.message || '').trim();
		} catch (_) {}
		if (!key) return;
		await this._load_maps_script(key);
		this.map = new google.maps.Map(this.$('.pm-map-el')[0], {
			center: { lat: 43.6532, lng: -79.3832 },
			zoom: 11,
			gestureHandling: 'greedy',
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,
		});
		this.$('.pm-map-cover').hide();
		this._init_autocomplete();
	}

	_load_maps_script(key) {
		if (window.google?.maps) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
			s.onload = resolve; s.onerror = reject;
			document.head.appendChild(s);
		});
	}

	_init_autocomplete() {
		const input = this.$('.pm-loc')[0];
		const ac    = new google.maps.places.Autocomplete(input, { types: ['(cities)'], fields: ['name', 'geometry'] });
		ac.addListener('place_changed', () => {
			const place = ac.getPlace();
			if (!place?.geometry) return;
			this.city_bounds = place.geometry.viewport || null;
			if (this.city_bounds) this.map.fitBounds(this.city_bounds, 0);
			this._draw_city_polygon(place.name || input.value);
		});
		this.$('.pm-loc').on('input', () => { this.city_bounds = null; this._clear_city_polygon(); });
	}

	async _draw_city_polygon(name) {
		this._clear_city_polygon();
		if (!this.map) return;
		try {
			const r = await fetch(
				`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&polygon_geojson=1&limit=1&featuretype=city&addressdetails=0`,
				{ headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'ProspectingTool/1.0' } }
			);
			if (!r.ok) return;
			const data = await r.json();
			const geojson = data[0]?.geojson;
			if (!geojson) return;
			const features = this.map.data.addGeoJson({ type: 'Feature', geometry: geojson });
			this.city_features = Array.isArray(features) ? features : [features];
			this.map.data.setStyle({ fillColor: '#2563eb', fillOpacity: 0.07, strokeColor: '#ff4500', strokeWeight: 2.5, strokeOpacity: 0.85 });
		} catch (_) {}
	}

	_clear_city_polygon() {
		if (!this.map) return;
		this.city_features.forEach(f => { try { this.map.data.remove(f); } catch (_) {} });
		this.city_features = [];
	}

	_clear_markers() { this.markers.forEach(m => m.setMap(null)); this.markers = []; }

	_drop_markers() {
		if (!this.map) return;
		this._clear_markers();
		const valid = this.search_results.filter(r => r.lat != null);
		if (!valid.length) return;
		valid.forEach(r => {
			const m = new google.maps.Marker({ position: { lat: r.lat, lng: r.lng }, map: this.map, title: r.businessName });
			m.addListener('click', () => {
				this._toggle_search(r.placeId);
				this.$(`[data-pid="${r.placeId}"] .pm-schk`).prop('checked', this.search_selected.has(r.placeId));
				this._update_search_actions();
			});
			this.markers.push(m);
		});
		if (valid.length === 1) {
			this.map.setCenter({ lat: valid[0].lat, lng: valid[0].lng });
			this.map.setZoom(14);
		} else {
			const b = new google.maps.LatLngBounds();
			valid.forEach(r => b.extend({ lat: r.lat, lng: r.lng }));
			this.map.fitBounds(b, 40);
		}
	}

	_pan_to(pid) {
		if (!this.map) return;
		const r = this.search_results.find(r => r.placeId === pid);
		if (!r?.lat) return;
		this.map.panTo({ lat: r.lat, lng: r.lng });
		if ((this.map.getZoom() || 0) < 14) this.map.setZoom(15);
	}

	// ── SEARCH ────────────────────────────────────────────────────────────────

	async run_search() {
		const what = this.$('.pm-sq').val().trim();
		const loc  = this.$('.pm-loc').val().trim();
		if (!what && !loc) { frappe.show_alert({ message: __('Enter what or where.'), indicator: 'orange' }); return; }

		const query = what && loc ? `${what} in ${loc}` : what || loc;
		let bounds_arg = '';
		if (this.city_bounds) {
			const ne = this.city_bounds.getNorthEast(), sw = this.city_bounds.getSouthWest();
			bounds_arg = JSON.stringify({ north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() });
		}

		this._set_search_loading(true);
		this.search_selected.clear();
		this._clear_markers();

		try {
			const r = await frappe.call({
				method: 'prospecting.api.search_places',
				args: { query, included_type: this.$('.pm-cat').val(), max_pages: parseInt(this.$('.pm-depth').val()), bounds: bounds_arg || undefined },
			});
			this.search_results = r.message?.results || [];
			this._render_search_results();
			this._drop_markers();
		} catch (_) {
			frappe.show_alert({ message: __('Search failed.'), indicator: 'red' });
		} finally {
			this._set_search_loading(false);
		}
	}

	_set_search_loading(on) {
		this.$('.pm-search-btn').prop('disabled', on).html(
			on ? `<i class="fa fa-spinner fa-spin"></i> ${__('Searching…')}`
			   : `<i class="fa fa-search"></i> ${__('Search')}`
		);
	}

	_render_search_results() {
		const $list = this.$('.pm-results-list').empty();
		if (!this.search_results.length) {
			$list.append(this.$('.pm-results-empty').show());
			this.$('.pm-results-summary').text('');
			this._update_search_actions();
			return;
		}
		this.$('.pm-results-empty').hide();
		this.$('.pm-results-summary').html(
			`<strong>${this.search_results.length}</strong> ${__('results')} · <span class="pm-ssel">0</span> ${__('selected')}`
		);
		this.search_results.forEach(r => {
			const $row = $(`
<div style="display:flex;gap:10px;padding:9px 12px;border-bottom:1px solid var(--border-color);cursor:pointer;align-items:flex-start;"
  data-pid="${frappe.utils.escape_html(r.placeId)}">
  <input type="checkbox" class="pm-schk" style="margin-top:3px;flex-shrink:0;cursor:pointer;">
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-weight:600;font-size:13px;">${frappe.utils.escape_html(r.businessName)}</span>
      ${r.rating != null ? `<span style="font-size:12px;color:#f59e0b;">★ ${r.rating}</span>` : ''}
    </div>
    ${r.category ? `<span class="badge text-bg-secondary" style="font-size:10px;margin-top:2px;">${frappe.utils.escape_html(r.category)}</span>` : ''}
    ${r.address  ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${frappe.utils.escape_html(r.address)}</div>` : ''}
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;gap:10px;">
      ${r.phone   ? `<span>${frappe.utils.escape_html(r.phone)}</span>` : ''}
      ${r.website ? `<a href="${frappe.utils.escape_html(r.website)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Website</a>` : ''}
    </div>
  </div>
</div>`);
			$row.on('mouseenter', () => this._pan_to(r.placeId));
			$row.on('click', e => {
				if ($(e.target).is('a,input')) return;
				this._toggle_search(r.placeId);
				$row.find('.pm-schk').prop('checked', this.search_selected.has(r.placeId));
				this._update_search_actions();
			});
			$row.find('.pm-schk').on('change', e => { e.stopPropagation(); this._toggle_search(r.placeId); this._update_search_actions(); });
			$list.append($row);
		});
		this._update_search_actions();
	}

	_toggle_search(id) {
		this.search_selected.has(id) ? this.search_selected.delete(id) : this.search_selected.add(id);
	}

	_update_search_actions() {
		const n = this.search_selected.size;
		this.$('.pm-ssel').text(n);
		this.$('.pm-save-btn').toggle(n > 0).text(`${__('Save')} ${n} ${__('to list')}`);
	}

	show_save_dialog() {
		const chosen    = this.search_results.filter(r => this.search_selected.has(r.placeId));
		if (!chosen.length) return;
		const me        = this;
		const has_lists = this.lists.length > 0;
		const d = new frappe.ui.Dialog({
			title: __('Save to Prospect List'),
			fields: [
				{
					fieldtype: 'Select', fieldname: 'list_mode', label: __('Save to'),
					options: has_lists ? `${__('Existing list')}\n${__('New list')}` : __('New list'),
					default: has_lists ? __('Existing list') : __('New list'),
					onchange() {
						const is_new = d.get_value('list_mode') === __('New list');
						d.set_df_property('list_name',     'hidden', is_new);
						d.set_df_property('new_list_name', 'hidden', !is_new);
					},
				},
				{ fieldtype: 'Link', fieldname: 'list_name',     label: __('List'),          options: 'Prospect List', hidden: !has_lists ? 1 : 0 },
				{ fieldtype: 'Data', fieldname: 'new_list_name', label: __('New list name'), hidden: has_lists ? 1 : 0 },
				{ fieldtype: 'Check', fieldname: 'enrich_email', label: __('Find emails from websites (slower)'), default: 0 },
			],
			primary_action_label: `${__('Save')} ${chosen.length} ${__('prospects')}`,
			async primary_action(vals) {
				const is_new    = vals.list_mode === __('New list');
				const list_name = is_new ? '' : (vals.list_name || '');
				const new_name  = is_new ? (vals.new_list_name || '').trim() : '';
				if (!is_new && !list_name) { frappe.show_alert({ message: __('Pick a list.'), indicator: 'orange' }); return; }
				if (is_new && !new_name)   { frappe.show_alert({ message: __('Enter a name.'), indicator: 'orange' }); return; }
				d.disable_primary_action();
				try {
					const r = await frappe.call({
						method: 'prospecting.api.import_prospects',
						args: { prospects: JSON.stringify(chosen), list_name, new_list_name: new_name, enrich_email: vals.enrich_email ? 1 : 0 },
					});
					const data = r.message;
					frappe.show_alert({
						message: `${__('Saved')} ${data.created} ${__('prospects')}` + (data.skipped ? ` · ${data.skipped} ${__('already existed')}` : ''),
						indicator: 'green',
					});
					d.hide();
					me.search_selected.clear();
					me._update_search_actions();
					const target = list_name || data.list_name;
					await me.load_data();
					me.set_view('browse');
					if (target) me.select_list(target);
				} catch (_) {
					d.enable_primary_action();
					frappe.show_alert({ message: __('Save failed.'), indicator: 'red' });
				}
			},
		});
		d.show();
	}
}
