<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b px-3 sm:px-5 py-3 flex-shrink-0">
      <div class="flex min-w-0 items-center gap-3">
        <h1 class="truncate text-lg font-semibold text-ink-gray-9">{{ pageTitle }}</h1>
        <Badge v-if="prospects.length" :label="String(prospects.length)" theme="gray" size="sm" />
      </div>

      <!-- Desktop actions -->
      <div class="hidden sm:flex flex-shrink-0 gap-2">
        <Button :label="showMap ? 'Hide Map' : 'Show Map'" variant="subtle" @click="toggleMap" />
        <Button v-if="listName" label="Delete list" variant="subtle"
          class="text-ink-red-3" @click="confirmDeleteList" />
        <Button label="Find Prospects" variant="solid" icon-left="search"
          @click="router.push('/search')" />
      </div>

      <!-- Mobile actions: icon buttons + overflow -->
      <div class="flex sm:hidden flex-shrink-0 items-center gap-1">
        <Button variant="subtle" :icon="showMap ? 'list' : 'map'"
          :label="undefined" @click="toggleMap" />
        <Button variant="solid" icon="search" @click="router.push('/search')" />
        <Dropdown v-if="listName" :options="[
          { label: 'Delete list', icon: 'trash-2', theme: 'red', onClick: confirmDeleteList },
        ]" placement="bottom-end">
          <Button variant="ghost" icon="more-vertical" />
        </Dropdown>
      </div>
    </div>

    <!-- Toolbar: quick filters + refresh / filter / sort / columns -->
    <div class="flex flex-wrap items-center gap-2 border-b px-3 sm:px-5 py-2 flex-shrink-0">
      <TextInput v-model="fName" placeholder="Business name" class="w-full sm:w-40" />
      <TextInput v-model="fCategory" placeholder="Category" class="flex-1 sm:flex-none sm:w-32" />
      <Select v-model="fStatus" :options="STATUS_FILTER_OPTIONS" class="flex-1 sm:flex-none sm:w-28" />
      <Button
        :variant="hideInCrm ? 'solid' : 'subtle'"
        :label="hideInCrm ? 'Hidden in CRM' : 'Hide in CRM'"
        :tooltip="'Hide prospects already pushed to the CRM'"
        @click="hideInCrm = !hideInCrm" />
      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" icon="refresh-cw" :loading="loading" @click="reload" />
        <FilterControl v-model="advFilters" :fields="FILTER_FIELDS" @apply="reload" />
        <SortControl v-model="sortRules" :fields="FILTER_FIELDS" @apply="reload" />
        <span class="hidden sm:block">
          <ColumnSettings
            :catalog="COLUMN_CATALOG"
            :defaults="DEFAULT_COLUMN_KEYS"
            storage-key="prospecting.columns"
            @update="onColumnsUpdate" />
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 overflow-hidden">

      <!-- List panel -->
      <div :class="showMap ? 'hidden sm:flex sm:w-[42%] sm:flex-shrink-0 sm:border-r' : 'flex flex-1'"
        class="relative flex-col overflow-hidden">

        <!-- Mobile: card list -->
        <ProspectCardList v-if="isMobile && (prospects.length || loading)"
          v-model="selectedRows"
          :prospects="prospects"
          :statuses="STATUSES"
          :status-color="statusColor"
          :row-menu="rowMenuOptions"
          :bulk-actions="bulkActions"
          @open="openDetail"
          @update-status="e => updateStatus(e.name, e.status)" />

        <!-- Desktop: dense table -->
        <ListView v-else-if="prospects.length || loading"
          ref="listViewRef"
          :columns="columns"
          :rows="prospects"
          row-key="name"
          :options="{
            onRowClick: handleRowClick,
            showTooltip: false,
            selectable: true,
            enableActive: true,
            rowHeight: 40,
            emptyState: { title: 'No prospects', description: '' },
          }"
          @update:selections="sel => (selectedRows = sel)">

          <template #default="{ selectable }">
            <ListHeader />
            <ListRows v-if="prospects.length" />
            <ListEmptyState v-else />
            <ListSelectBanner v-if="selectable">
              <template #actions="{ selections, unselectAll }">
                <Dropdown :options="bulkActions([...selections], unselectAll)">
                  <Button variant="ghost" icon="more-horizontal" />
                </Dropdown>
              </template>
            </ListSelectBanner>
          </template>

          <template #cell="{ column, row, item }">
            <div v-if="column.key === 'status'" @click.stop>
              <Dropdown :options="STATUSES.map(s => ({ label: s, onClick: () => updateStatus(row.name, s) }))">
                <button class="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm text-ink-gray-7 hover:bg-surface-gray-2">
                  <span :class="['size-2 rounded-full', statusColor(item)]" />
                  {{ item || 'New' }}
                </button>
              </Dropdown>
            </div>
            <a v-else-if="column.key === 'crm_lead' && item" :href="`/crm/leads/${item}`" target="_blank"
              rel="noreferrer" @click.stop title="Open in CRM"
              class="inline-flex items-center gap-1 text-sm font-medium text-ink-green-3 hover:underline">
              <span class="size-2 rounded-full bg-green-500" /> In CRM
            </a>
            <span v-else-if="column.key === 'crm_lead'" class="text-sm text-ink-gray-4">—</span>
            <span v-else-if="column.key === 'rating'" class="text-amber-500 text-sm">
              {{ item != null ? `★ ${Number(item).toFixed(1)}` : '—' }}
            </span>
            <a v-else-if="column.key === 'email_id' && item" :href="`mailto:${item}`" @click.stop
              class="truncate text-sm text-ink-blue-2">{{ item }}</a>
            <a v-else-if="column.key === 'website' && item" :href="item" target="_blank" rel="noreferrer" @click.stop
              class="truncate text-sm text-ink-blue-2">{{ item.replace(/^https?:\/\/(www\.)?/, '') }}</a>
            <div v-else-if="column.key === '_actions'" class="flex justify-end items-center gap-0.5" @click.stop>
              <button @click="openDetail(row.name)"
                class="rounded p-1 text-ink-gray-3 hover:bg-surface-gray-2 hover:text-ink-gray-7"
                title="View details">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              </button>
              <Dropdown :options="rowMenuOptions(row)" placement="right">
                <template #default="{ open }">
                  <Button
                    icon="more-horizontal"
                    variant="ghost"
                    size="sm"
                    :class="open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'" />
                </template>
              </Dropdown>
            </div>
            <span v-else class="truncate text-sm">{{ item ?? '—' }}</span>
          </template>

        </ListView>

        <!-- Empty state -->
        <div v-if="!loading && !prospects.length"
          class="flex flex-1 flex-col items-center justify-center gap-3 text-ink-gray-5">
          <div class="text-4xl opacity-40">👥</div>
          <p class="font-medium text-ink-gray-7">No prospects yet</p>
          <p class="text-sm">Use Find Prospects to search for businesses.</p>
          <Button label="Find Prospects" variant="solid" @click="router.push('/search')" />
        </div>

        <!-- Load more -->
        <div v-if="hasMore && !loading" class="flex justify-center border-t p-3">
          <Button label="Load more" variant="subtle" @click="loadMore" />
        </div>
      </div>

      <!-- Map panel (always in DOM so the map instance persists) -->
      <div v-show="showMap" class="relative flex-1 overflow-hidden">
        <div ref="mapEl" class="h-full w-full" />
        <div v-if="showMap && !prospects.filter(p => p.lat).length"
          class="absolute inset-0 flex items-center justify-center bg-surface-gray-1 text-ink-gray-5 pointer-events-none">
          <p class="text-sm">No location data for prospects in this list.</p>
        </div>
      </div>

      <!-- Detail modal (with prev/next navigation between rows) -->
      <ProspectDetail
        :doc="openDoc"
        :has-prev="hasPrevDetail"
        :has-next="hasNextDetail"
        @close="openDoc = null"
        @prev="goPrevDetail"
        @next="goNextDetail"
        @go-to-list="goToList"
        @action="onModalAction"
        @delete="deleteFromModal"
        @status-updated="onStatusUpdated"
        @field-updated="onFieldUpdated" />

    </div>

    <!-- Confirm dialog -->
    <Dialog v-model="confirmDialog.show" :options="{
      title: confirmDialog.title,
      message: confirmDialog.message,
      size: 'sm',
      actions: confirmActions,
    }" />

    <!-- Move to list dialog -->
    <MoveToListDialog
      v-model="showMoveDialog"
      :names="moveNames"
      :lists="lists"
      :current-list="listName"
      @moved="onMoved" />
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  ListView, ListHeader, ListRows, ListEmptyState, ListSelectBanner,
  Button, Badge, Dropdown, Select, TextInput, Dialog, toast,
} from 'frappe-ui'
import ProspectDetail from '../components/ProspectDetail.vue'
import ProspectCardList from '../components/ProspectCardList.vue'
import FilterControl from '../components/FilterControl.vue'
import SortControl from '../components/SortControl.vue'
import ColumnSettings from '../components/ColumnSettings.vue'
import MoveToListDialog from '../components/MoveToListDialog.vue'
import { call } from '../composables/api.js'
import { useIsMobile } from '../composables/breakpoint.js'

const isMobile = useIsMobile()

const props = defineProps({
  listName: { type: String, default: null },
})

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

const STATUSES = ['New', 'Lead', 'Dismissed']

// ── Confirm dialog (frappe-ui Dialog) ────────────────────────────────────────
const confirmDialog = ref({ show: false, title: '', message: '', confirmLabel: 'Confirm', danger: false })
let confirmCb = null
function askConfirm({ title, message, confirmLabel = 'Confirm', danger = false }, onYes) {
  confirmDialog.value = { show: true, title, message, confirmLabel, danger }
  confirmCb = onYes
}
const confirmActions = computed(() => [{
  label: confirmDialog.value.confirmLabel,
  variant: 'solid',
  theme: confirmDialog.value.danger ? 'red' : 'gray',
  onClick: (close) => { close(); const cb = confirmCb; confirmCb = null; cb?.() },
}])

// Full catalog of selectable columns (Business Name is pinned first; actions
// are appended automatically and not user-managed).
const COLUMN_CATALOG = [
  { label: 'Business Name', key: 'prospect_name',  width: '220px' },
  { label: 'Category',      key: 'category',        width: '130px' },
  { label: 'Owner Name',    key: 'owner_name',      width: '150px' },
  { label: 'Address',       key: '_address_short',  width: '180px' },
  { label: 'Phone',         key: 'mobile_no',        width: '140px' },
  { label: 'Email',         key: 'email_id',         width: '180px' },
  { label: 'Website',       key: 'website',          width: '160px' },
  { label: 'Rating',        key: 'rating',           width: '80px'  },
  { label: 'Reviews',       key: 'review_count',     width: '90px'  },
  { label: 'Source',        key: 'source',           width: '120px' },
  { label: 'Town',          key: 'territory',        width: '120px' },
  { label: 'Follow-up',     key: 'next_follow_up',   width: '110px' },
  { label: 'Status',        key: 'status',           width: '130px' },
  { label: 'In CRM',        key: 'crm_lead',         width: '80px'  },
]
const DEFAULT_COLUMN_KEYS = [
  'prospect_name', 'category', 'territory', 'owner_name', '_address_short', 'mobile_no', 'rating', 'status', 'crm_lead',
]
const ACTIONS_COL = { label: '', key: '_actions', width: '60px' }

const MAP_COLUMNS = [
  { label: 'Business Name', key: 'prospect_name', width: '200px' },
  { label: 'Rating',        key: 'rating',        width: '70px'  },
  { label: 'Status',        key: 'status',        width: '120px' },
  ACTIONS_COL,
]

// User-managed active columns (set by ColumnSettings via @update), + actions appended.
const activeColumns = ref(DEFAULT_COLUMN_KEYS.map(k => COLUMN_CATALOG.find(c => c.key === k)).filter(Boolean))

const columns = computed(() => {
  if (showMap.value) return MAP_COLUMNS
  return [...activeColumns.value, ACTIONS_COL]
})

function onColumnsUpdate(cols) { activeColumns.value = cols }

// Quick-filter + sort state
const STATUS_FILTER_OPTIONS = [
  { label: 'Active',    value: ''          },  // New + Lead (hides Dismissed)
  { label: 'New',       value: 'New'       },
  { label: 'Lead',      value: 'Lead'      },
  { label: 'Dismissed', value: 'Dismissed' },
  { label: 'All',       value: 'All'       },
]
// Fields available in the Filter / Sort builders
const FILTER_FIELDS = [
  { label: 'Business Name', fieldname: 'prospect_name',  fieldtype: 'Data'   },
  { label: 'Category',      fieldname: 'category',        fieldtype: 'Data'   },
  { label: 'Owner Name',    fieldname: 'owner_name',      fieldtype: 'Data'   },
  { label: 'Email',         fieldname: 'email_id',        fieldtype: 'Data'   },
  { label: 'Phone',         fieldname: 'mobile_no',       fieldtype: 'Data'   },
  { label: 'Website',       fieldname: 'website',         fieldtype: 'Data'   },
  { label: 'Address',       fieldname: 'address',         fieldtype: 'Data'   },
  { label: 'Rating',        fieldname: 'rating',          fieldtype: 'Float'  },
  { label: 'Reviews',       fieldname: 'review_count',    fieldtype: 'Int'    },
  { label: 'Status',        fieldname: 'status',          fieldtype: 'Select', options: ['New', 'Lead', 'Dismissed'] },
  { label: 'Source',        fieldname: 'source',          fieldtype: 'Data'   },
  { label: 'Town',          fieldname: 'territory',       fieldtype: 'Data'   },
  { label: 'Follow-up',     fieldname: 'next_follow_up',  fieldtype: 'Date'   },
  { label: 'CRM Lead',      fieldname: 'crm_lead',        fieldtype: 'Data'   },
]
const fName      = ref('')
const fCategory  = ref('')
const fStatus    = ref('')
const hideInCrm  = ref(false)  // hide prospects already pushed to the CRM (crm_lead set)
const advFilters = ref([])  // [{field, operator, value}]
const sortRules  = ref([{ field: 'modified', dir: 'desc' }])
const viewingDismissed = computed(() => fStatus.value === 'Dismissed')

// Map a builder condition to a frappe.client.get_list filter triple.
function toFilterTriple(f) {
  const v = f.value
  switch (f.operator) {
    case 'like':       return [f.field, 'like', `%${v}%`]
    case 'not like':   return [f.field, 'not like', `%${v}%`]
    case 'equals':     return [f.field, '=', v]
    case 'not equals': return [f.field, '!=', v]
    case 'is set':     return [f.field, 'is', 'set']
    case 'is not set': return [f.field, 'is', 'not set']
    default:           return [f.field, f.operator, v]  // = != > < >= <=
  }
}

// List state
const prospects    = ref([])
const loading      = ref(false)
const hasMore      = ref(false)
const start        = ref(0)
const openDoc      = ref(null)
const selectedRows = ref(new Set())
const removing      = ref(false)
const pushing       = ref(false)
const findingOwners = ref(false)
const dismissing    = ref(false)
const restoring     = ref(false)
const deleting      = ref(false)

// Move-to-list dialog state
const showMoveDialog = ref(false)
const moveNames      = ref([])
const moveUnselect   = ref(null)
function openMoveDialog(names, unselectAll) {
  if (!names.length) return
  moveNames.value = names
  moveUnselect.value = unselectAll || null
  showMoveDialog.value = true
}
async function onMoved() {
  moveUnselect.value?.()
  await reload()
  reloadLists()
}

// Map state
const showMap = ref(false)
const mapEl   = ref(null)
let map = null, markers = []

const pageTitle = computed(() => {
  if (!props.listName) return 'All Prospects'
  return lists.value.find(l => l.name === props.listName)?.list_name || props.listName
})

const STATUS_COLORS = { New: 'bg-gray-400', Lead: 'bg-green-500', Dismissed: 'bg-red-400' }
function statusColor(s) { return STATUS_COLORS[s] || 'bg-gray-300' }

function bulkActions(names, unselectAll) {
  const opts = []
  if (viewingDismissed.value) {
    opts.push({ label: 'Restore', icon: 'rotate-ccw', onClick: () => doRestore(names, unselectAll) })
  } else {
    opts.push({ label: 'Dismiss', icon: 'eye-off', onClick: () => doDismiss(names, unselectAll) })
  }
  opts.push({ label: 'Move to list', icon: 'corner-up-right', onClick: () => openMoveDialog(names, unselectAll) })
  if (props.listName) {
    opts.push({ label: 'Remove from list', icon: 'x', onClick: () => doRemoveFromList(names, unselectAll) })
  }
  opts.push({ label: 'Find Owner Names', icon: 'user', onClick: () => doFindOwnerNames(names, unselectAll) })
  opts.push({ label: 'Push to CRM', icon: 'external-link', onClick: () => doPushToCRM(names, unselectAll) })
  opts.push({ label: 'Delete (allow re-import)', icon: 'trash-2', theme: 'red', onClick: () => doDeleteBulk(names, unselectAll) })
  return opts
}

function rowMenuOptions(row) {
  const opts = [
    { label: 'Push to CRM', icon: 'external-link', onClick: () => doPushToCRM([row.name], null) },
  ]
  if (row.status === 'Dismissed') {
    opts.push({ label: 'Restore', icon: 'rotate-ccw', onClick: () => doRestore([row.name], null) })
  } else {
    opts.push({ label: 'Dismiss', icon: 'eye-off', onClick: () => doDismiss([row.name], null) })
  }
  opts.push({ label: 'Move to list', icon: 'corner-up-right', onClick: () => openMoveDialog([row.name], null) })
  if (props.listName) {
    opts.push({ label: 'Remove from list', icon: 'x', onClick: () => doRemoveFromList([row.name], null) })
  }
  opts.push({ label: 'Delete (allow re-import)', icon: 'trash-2', theme: 'red', onClick: () => doDeleteBulk([row.name], null) })
  return opts
}

// ── Map helpers ──────────────────────────────────────────────────────────────

function loadMapsScript(key) {
  if (window.google?.maps) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}

async function ensureMapReady() {
  if (!window.google?.maps) {
    const kr  = await call('prospecting.api.get_maps_api_key')
    const key = (kr || '').trim()
    if (!key) { toast.error('Google Maps API key not configured.'); return }
    await loadMapsScript(key)
  }
  await nextTick()  // let v-show apply so the div has real dimensions
  if (!map) {
    map = new google.maps.Map(mapEl.value, {
      zoom: 10,
      center: { lat: 43.65, lng: -79.38 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
  } else {
    google.maps.event.trigger(map, 'resize')
  }
}

function clearMarkers() {
  markers.forEach(m => m.setMap(null))
  markers = []
}

function dropMarkers() {
  if (!map) return
  clearMarkers()
  const valid = prospects.value.filter(p => p.lat != null && p.lng != null)
  if (!valid.length) return
  valid.forEach(p => {
    const m = new google.maps.Marker({
      position: { lat: parseFloat(p.lat), lng: parseFloat(p.lng) },
      map,
      title: p.prospect_name,
    })
    m.addListener('click', () => { panTo(p); openDetail(p.name) })
    markers.push(m)
  })
  if (valid.length === 1) {
    map.setCenter({ lat: parseFloat(valid[0].lat), lng: parseFloat(valid[0].lng) })
    map.setZoom(14)
  } else {
    const b = new google.maps.LatLngBounds()
    valid.forEach(p => b.extend({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }))
    map.fitBounds(b, 40)
  }
}

function panTo(row) {
  if (!map || row.lat == null) return
  map.panTo({ lat: parseFloat(row.lat), lng: parseFloat(row.lng) })
  if ((map.getZoom() || 0) < 14) map.setZoom(15)
}

async function toggleMap() {
  showMap.value = !showMap.value
  if (showMap.value) {
    await ensureMapReady()
    dropMarkers()
  }
}

function handleRowClick(row) {
  if (showMap.value) {
    panTo(row)
    if (openDoc.value) openDetail(row.name)
  } else {
    openDetail(row.name)
  }
}

// ── Data loading ─────────────────────────────────────────────────────────────

watch(() => props.listName, () => reload())
// status applies immediately; text quick-filters debounce
watch(fStatus, () => reload())
watch(hideInCrm, () => reload())
let filterTimer
watch([fName, fCategory], () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => reload(), 300)
})
onMounted(reload)

async function reload() {
  prospects.value    = []
  start.value        = 0
  hasMore.value      = false
  openDoc.value      = null
  selectedRows.value = new Set()
  await loadPage(true)
}

async function loadMore() { await loadPage(false) }

async function loadPage(reset) {
  loading.value = true
  try {
    const filters = props.listName ? [['prospect_list', '=', props.listName]] : []
    if (fStatus.value === '')              filters.push(['status', '!=', 'Dismissed'])
    else if (fStatus.value !== 'All')      filters.push(['status', '=', fStatus.value])
    if (fName.value.trim())                filters.push(['prospect_name', 'like', `%${fName.value.trim()}%`])
    if (fCategory.value.trim())            filters.push(['category', 'like', `%${fCategory.value.trim()}%`])
    if (hideInCrm.value)                   filters.push(['crm_lead', 'is', 'not set'])
    // Advanced filters from the Filter builder
    for (const f of advFilters.value) {
      if (!f.field) continue
      if (!['is set', 'is not set'].includes(f.operator) && (f.value === '' || f.value == null)) continue
      filters.push(toFilterTriple(f))
    }
    const orderBy = (sortRules.value.length ? sortRules.value : [{ field: 'modified', dir: 'desc' }])
      .filter(s => s.field)
      .map(s => `${s.field} ${s.dir}`)
      .join(', ')
    const rows = await call('frappe.client.get_list', {
      doctype: 'Prospect',
      fields: [
        'name', 'prospect_name', 'category', 'address', 'mobile_no',
        'email_id', 'website', 'rating', 'review_count', 'status',
        'prospect_list', 'lat', 'lng', 'google_maps_uri', 'notes', 'crm_lead',
        'owner_name', 'source', 'territory', 'next_follow_up',
      ],
      filters,
      limit_page_length: 500,
      limit_start:       reset ? 0 : start.value,
      order_by:          orderBy || 'modified desc',
    }) || []
    rows.forEach(r => { r._address_short = (r.address || '').split(',')[0] })
    if (reset) { prospects.value = rows } else { prospects.value.push(...rows) }
    start.value   = prospects.value.length
    hasMore.value = rows.length === 500
    if (showMap.value && map) dropMarkers()
  } finally {
    loading.value = false
  }
}

const listViewRef = ref(null)

// Set the ListView's highlighted (active) row. activeRow isn't exposed, but the
// ListView provides it via provide('list', ...) — reach it through the instance.
function setActiveRow(name) {
  const provided = listViewRef.value?.$?.provides?.list
  if (provided?.value?.activeRow) provided.value.activeRow.value = name
}

async function openDetail(name) {
  const r = await call('frappe.client.get', { doctype: 'Prospect', name })
  openDoc.value = r
  // Keep the list highlight on whatever the modal is showing (follows prev/next,
  // and persists after close so the last-viewed row stays selected).
  setActiveRow(name)
}

// Prev/next navigation through the loaded rows without closing the modal
const openIndex = computed(() =>
  openDoc.value ? prospects.value.findIndex(p => p.name === openDoc.value.name) : -1)
const hasPrevDetail = computed(() => openIndex.value > 0)
const hasNextDetail = computed(() => openIndex.value >= 0 && openIndex.value < prospects.value.length - 1)
async function goPrevDetail() { if (hasPrevDetail.value) await openDetail(prospects.value[openIndex.value - 1].name) }
async function goNextDetail() { if (hasNextDetail.value) await openDetail(prospects.value[openIndex.value + 1].name) }
function goToList(listName) { if (listName) { openDoc.value = null; router.push(`/list/${listName}`) } }

// Run an action on the current prospect, drop it from the active view, then
// advance the modal to the next row (or close if it was the last). Updates the
// list locally — reload() would clear openDoc and close the modal.
async function modalActionAdvance(name, apiFn, successMsg) {
  const idx = prospects.value.findIndex(p => p.name === name)
  const neighbor = prospects.value[idx + 1]?.name || prospects.value[idx - 1]?.name || null
  try {
    await apiFn()
    if (successMsg) toast.success(successMsg)
    prospects.value = prospects.value.filter(p => p.name !== name)
    start.value = Math.max(0, start.value - 1)
    if (map) dropMarkers()
    reloadLists()
    if (neighbor) await openDetail(neighbor)  // keep modal open on the next prospect
    else openDoc.value = null
  } catch (e) {
    toast.error(e.message)
  }
}

function deleteFromModal(name) {
  modalActionAdvance(name,
    () => call('prospecting.api.delete_prospects', { prospect_names: [name] }), 'Deleted')
}

// ⋯ menu actions dispatched from the detail modal
function onModalAction(type) {
  const name = openDoc.value?.name
  if (!name) return
  if (type === 'dismiss') {
    modalActionAdvance(name,
      () => call('prospecting.api.dismiss_prospects', { prospect_names: [name] }), 'Dismissed')
  } else if (type === 'remove') {
    modalActionAdvance(name,
      () => call('prospecting.api.remove_from_list', { prospect_names: [name] }), 'Removed from list')
  } else if (type === 'restore') {
    // restore keeps the modal on the same prospect (just flips status)
    call('prospecting.api.restore_prospects', { prospect_names: [name] }).then(() => {
      if (openDoc.value?.name === name) openDoc.value.status = 'New'
      onStatusUpdated({ name, status: 'New' })
      toast.success('Restored')
    })
  } else if (type === 'move') {
    openDoc.value = null            // close modal so the move dialog isn't stacked behind it
    openMoveDialog([name], null)
  }
}

// Does a prospect with this status belong in the current filtered view?
function matchesStatusFilter(status) {
  if (fStatus.value === '')    return status !== 'Dismissed'  // Active
  if (fStatus.value === 'All') return true
  return status === fStatus.value
}

// Drop a row from the view if its new status no longer matches the active filter.
// If the dropped row is the one open in the modal, advance to the next row
// (or the previous, or close if it was the only one) instead of closing.
function reconcileRow(name, status) {
  if (matchesStatusFilter(status)) return
  const wasOpen = openDoc.value?.name === name
  const idx = prospects.value.findIndex(p => p.name === name)
  const neighbor = wasOpen ? (prospects.value[idx + 1]?.name || prospects.value[idx - 1]?.name || null) : null
  prospects.value = prospects.value.filter(p => p.name !== name)
  if (wasOpen) {
    if (neighbor) openDetail(neighbor)  // keep modal open on the next prospect
    else openDoc.value = null
  }
  if (map) dropMarkers()
  reloadLists()
}

async function updateStatus(name, status) {
  await call('frappe.client.set_value', { doctype: 'Prospect', name, fieldname: 'status', value: status })
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
  reconcileRow(name, status)
}

function onStatusUpdated({ name, status }) {
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
  if (openDoc.value?.name === name) openDoc.value.status = status
  reconcileRow(name, status)
}

function onFieldUpdated({ name, key, value }) {
  const p = prospects.value.find(p => p.name === name)
  if (p) {
    p[key] = value
    if (key === 'address') p._address_short = (value || '').split(',')[0]
  }
}

async function doRemoveFromList(names, unselectAll) {
  if (!names.length) return
  removing.value = true
  try {
    const r = await call('prospecting.api.remove_from_list', { prospect_names: names })
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    unselectAll?.()
    toast.success(`Removed ${r.removed} prospect(s) from list`)
    await reload()
    reloadLists()
  } catch (e) {
    toast.error(e.message)
  } finally {
    removing.value = false
  }
}

function doDeleteBulk(names, unselectAll) {
  if (!names.length) return
  askConfirm({
    title: `Delete ${names.length} prospect(s)?`,
    message: 'This removes the record entirely — unlike Dismiss, the same business ' +
      'CAN reappear on a future search.',
    confirmLabel: 'Delete',
    danger: true,
  }, async () => {
    deleting.value = true
    try {
      const r = await call('prospecting.api.delete_prospects', { prospect_names: names })
      if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
      unselectAll?.()
      toast.success(`Deleted ${r.deleted} prospect(s)`)
      await reload()
      reloadLists()
    } catch (e) {
      toast.error(e.message)
    } finally {
      deleting.value = false
    }
  })
}

async function doDismiss(names, unselectAll) {
  if (!names.length) return
  dismissing.value = true
  try {
    const r = await call('prospecting.api.dismiss_prospects', { prospect_names: names })
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    unselectAll?.()
    toast.success(`Dismissed ${r.dismissed} prospect(s)`)
    await reload()
    reloadLists()
  } catch (e) {
    toast.error(e.message)
  } finally {
    dismissing.value = false
  }
}

async function doRestore(names, unselectAll) {
  if (!names.length) return
  restoring.value = true
  try {
    const r = await call('prospecting.api.restore_prospects', { prospect_names: names })
    unselectAll?.()
    toast.success(`Restored ${r.restored} prospect(s)`)
    await reload()
    reloadLists()
  } catch (e) {
    toast.error(e.message)
  } finally {
    restoring.value = false
  }
}

async function doPushToCRM(names, unselectAll) {
  if (!names.length) return
  pushing.value = true
  const tid = toast.create({
    message: `Pushing ${names.length} prospect(s) to CRM…`,
    type: 'info', duration: 600,
  })
  try {
    const r = await call('prospecting.api.push_to_crm', { prospect_names: names })
    const parts = []
    if (r.created)        parts.push(`${r.created} lead(s) created`)
    if (r.skipped)        parts.push(`${r.skipped} already exist`)
    if (r.errors?.length) parts.push(`${r.errors.length} failed`)
    toast.success(parts.join(' · ') || 'Done')
    unselectAll?.()
    await reload()
  } catch (e) {
    toast.error(e.message)
  } finally {
    toast.remove(tid)
    pushing.value = false
  }
}

async function doFindOwnerNames(names, unselectAll) {
  if (!names.length) return
  findingOwners.value = true
  const tid = toast.create({
    message: `Finding owner names for ${names.length} prospect(s)…`,
    type: 'info', duration: 600,
  })
  try {
    const r = await call('prospecting.api.find_owner_names', { prospect_names: names })
    let found = 0
    for (const [pname, data] of Object.entries(r.results || {})) {
      if (data.owner_name) {
        found++
        const p = prospects.value.find(p => p.name === pname)
        if (p) p.owner_name = data.owner_name
        if (openDoc.value?.name === pname) {
          openDoc.value.owner_name = data.owner_name
          openDoc.value.owner_name_context = JSON.stringify(data.examples || [])
        }
      }
    }
    const skipped = names.length - found - (r.errors?.length || 0)
    const parts = []
    if (found)            parts.push(`${found} owner name(s) found`)
    if (skipped)          parts.push(`${skipped} no name found`)
    if (r.errors?.length) parts.push(`${r.errors.length} error(s)`)
    if (r.errors?.length) {
      const firstErr = r.errors[0]?.error || 'Unknown error'
      toast.error(`Error (${r.errors.length} prospect(s)): ${firstErr}`)
    } else {
      toast.success(parts.join(' · ') || 'Done')
    }
    unselectAll?.()
  } catch (e) {
    toast.error(e.message)
  } finally {
    toast.remove(tid)
    findingOwners.value = false
  }
}

function confirmDeleteList() {
  const listObj = lists.value.find(l => l.name === props.listName)
  const label   = listObj?.list_name || props.listName
  const count   = listObj?._count || 0
  askConfirm({
    title: `Delete list "${label}"?`,
    message: count
      ? `This deletes the list and its ${count} prospect(s).`
      : 'This deletes the list.',
    confirmLabel: 'Delete list',
    danger: true,
  }, async () => {
    await call('prospecting.api.delete_list', { list_name: props.listName })
    toast.success(`List "${label}" deleted`)
    await reloadLists()
    router.push('/all')
  })
}
</script>

