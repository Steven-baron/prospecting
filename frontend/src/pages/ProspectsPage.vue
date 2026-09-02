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
        <Button :label="showMap ? __('Hide Map') : __('Show Map')" variant="subtle" @click="toggleMap" />
        <Button v-if="listName" :label="__('Delete list')" variant="subtle"
          class="text-ink-red-3" @click="confirmDeleteList" />
        <Button :label="__('Find Prospects')" variant="solid" icon-left="search"
          @click="router.push('/prospecting/search')" />
      </div>

      <!-- Mobile actions: icon buttons + overflow -->
      <div class="flex sm:hidden flex-shrink-0 items-center gap-1">
        <Button variant="subtle" :icon="showMap ? 'list' : 'map'"
          :label="undefined" @click="toggleMap" />
        <Button variant="solid" icon="search" @click="router.push('/prospecting/search')" />
        <Dropdown v-if="listName" :options="[
          { label: __('Delete list'), icon: 'trash-2', theme: 'red', onClick: confirmDeleteList },
        ]" placement="bottom-end">
          <Button variant="ghost" icon="more-vertical" />
        </Dropdown>
      </div>
    </div>

    <!-- Toolbar: quick filters + refresh / filter / sort / columns -->
    <div class="flex flex-wrap items-center gap-2 border-b px-3 sm:px-5 py-2 flex-shrink-0">
      <TextInput v-model="fName" :placeholder="__('Business name')" class="w-full sm:w-40" />
      <TextInput v-model="fCategory" :placeholder="__('Category')" class="flex-1 sm:flex-none sm:w-32" />
      <Select v-model="fStatus" :options="STATUS_FILTER_OPTIONS" class="flex-1 sm:flex-none sm:w-28" />
      <Button
        :variant="hideInCrm ? 'solid' : 'subtle'"
        :label="hideInCrm ? __('Hidden in CRM') : __('Hide in CRM')"
        :tooltip="__('Hide prospects already pushed to the CRM')"
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
          v-model="selectedSet"
          :prospects="prospects"
          :statuses="STATUSES"
          :status-color="statusColor"
          :row-menu="rowMenuOptions"
          :bulk-actions="bulkActions"
          @open="openDetail"
          @update-status="e => updateStatus(e.name, e.status)" />

        <!-- Desktop: kit CollectionTable (sheet = prospecting grid) -->
        <CollectionTable
          v-else-if="prospects.length || loading"
          class="min-h-0"
          variant="sheet"
          :columns="kitColumns"
          :rows="kitRows"
          row-key="name"
          :loading="loading"
          :show-toolbar="false"
          :show-column-picker="false"
          show-peek
          :row-actions="kitRowActions"
          :on-row-click="handleRowClick"
          v-model:selections="selectedIds"
          v-model:active-cell="activeCell"
          @peek="onPeek"
          @row-action="onKitRowAction"
        >
          <template #selection-actions="{ selected, clear }">
            <Dropdown :options="bulkActions(selected, clear)">
              <Button variant="ghost" :label="__('Actions')" />
            </Dropdown>
          </template>
        </CollectionTable>

        <!-- Empty state -->
        <div v-if="!loading && !prospects.length"
          class="flex flex-1 flex-col items-center justify-center gap-3 text-ink-gray-5">
          <div class="text-4xl opacity-40">👥</div>
          <p class="font-medium text-ink-gray-7">{{ __('No prospects yet') }}</p>
          <p class="text-sm">{{ __('Use Find Prospects to search for businesses.') }}</p>
          <Button :label="__('Find Prospects')" variant="solid" @click="router.push('/prospecting/search')" />
        </div>

        <!-- Load more -->
        <div v-if="hasMore && !loading" class="flex justify-center border-t p-3">
          <Button :label="__('Load more')" variant="subtle" @click="loadMore" />
        </div>
      </div>

      <!-- Map panel (always in DOM so the map instance persists) -->
      <div v-show="showMap" class="relative flex-1 overflow-hidden">
        <div ref="mapEl" class="h-full w-full" />
        <div v-if="showMap && !prospects.filter(p => p.lat).length"
          class="absolute inset-0 flex items-center justify-center bg-surface-gray-1 text-ink-gray-5 pointer-events-none">
          <p class="text-sm">{{ __('No location data for prospects in this list.') }}</p>
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
import { prospectingApi } from '@/api/prospecting'
import { ref, computed, watch, inject, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Select, TextInput } from 'frappe-ui'
import {
  Badge,
  Button,
  CollectionTable,
  Dialog,
  Dropdown,
  toast,
} from '@/kit'
import ProspectDetail from '@/components/prospecting/ProspectDetail.vue'
import ProspectCardList from '@/components/prospecting/ProspectCardList.vue'
import FilterControl from '@/components/prospecting/FilterControl.vue'
import SortControl from '@/components/prospecting/SortControl.vue'
import ColumnSettings from '@/components/prospecting/ColumnSettings.vue'
import MoveToListDialog from '@/components/prospecting/MoveToListDialog.vue'
import { call } from '@/composables/api.js'
import { useIsMobile } from '@/composables/breakpoint.js'

const isMobile = useIsMobile()

const props = defineProps({
  listName: { type: String, default: null },
})

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

const STATUSES = ['New', 'Lead', 'Dismissed']

// ── Confirm dialog (frappe-ui Dialog) ────────────────────────────────────────
const confirmDialog = ref({ show: false, title: '', message: '', confirmLabel: __('Confirm'), danger: false })
let confirmCb = null
function askConfirm({ title, message, confirmLabel = __('Confirm'), danger = false }, onYes) {
  confirmDialog.value = { show: true, title, message, confirmLabel, danger }
  confirmCb = onYes
}
const confirmActions = computed(() => [{
  label: confirmDialog.value.confirmLabel,
  variant: 'solid',
  theme: confirmDialog.value.danger ? 'red' : 'gray',
  onClick: (close) => { close(); const cb = confirmCb; confirmCb = null; cb?.() },
}])

// Full catalog of selectable columns (Business Name is pinned first).
const COLUMN_CATALOG = [
  { label: __('Business Name'), key: 'prospect_name',  width: '220px' },
  { label: __('Category'),      key: 'category',        width: '130px' },
  { label: __('Owner Name'),    key: 'owner_name',      width: '150px' },
  { label: __('Address'),       key: '_address_short',  width: '180px' },
  { label: __('Phone'),         key: 'mobile_no',        width: '140px' },
  { label: __('Email'),         key: 'email_id',         width: '180px' },
  { label: __('Website'),       key: 'website',          width: '160px' },
  { label: __('Rating'),        key: 'rating',           width: '80px'  },
  { label: __('Reviews'),       key: 'review_count',     width: '90px'  },
  { label: __('Source'),        key: 'source',           width: '120px' },
  { label: __('Town'),          key: 'territory',        width: '120px' },
  { label: __('Follow-up'),     key: 'next_follow_up',   width: '110px' },
  { label: __('Status'),        key: 'status',           width: '130px' },
  { label: __('In CRM'),        key: 'crm_lead',         width: '80px'  },
]
const DEFAULT_COLUMN_KEYS = [
  'prospect_name', 'category', 'territory', 'owner_name', '_address_short', 'mobile_no', 'rating', 'status', 'crm_lead',
]
const MAP_COLUMNS = [
  { label: __('Business Name'), key: 'prospect_name', width: '200px' },
  { label: __('Rating'),        key: 'rating',        width: '70px'  },
  { label: __('Status'),        key: 'status',        width: '120px' },
]

const COL_TYPE = {
  prospect_name: 'identity',
  category: 'text',
  owner_name: 'person',
  _address_short: 'text',
  mobile_no: 'phone',
  email_id: 'email',
  website: 'url',
  rating: 'number',
  review_count: 'number',
  source: 'text',
  territory: 'location',
  next_follow_up: 'date',
  status: 'status',
  crm_lead: 'status',
}

const activeColumns = ref(DEFAULT_COLUMN_KEYS.map(k => COLUMN_CATALOG.find(c => c.key === k)).filter(Boolean))

function kitCol(col) {
  return {
    key: col.key,
    label: col.label,
    type: COL_TYPE[col.key] || 'text',
    width: parseInt(String(col.width), 10) || 160,
  }
}

const kitColumns = computed(() => {
  const src = showMap.value ? MAP_COLUMNS : activeColumns.value
  return src.map(kitCol)
})

const STATUS_DOT = { New: 'gray', Lead: 'green', Dismissed: 'red' }
function statusLabel(s) {
  if (s === 'Lead') return __('Lead')
  if (s === 'Dismissed') return __('Dismissed')
  return __('New')
}

const kitRows = computed(() =>
  prospects.value.map((p) => ({
    ...p,
    prospect_name: { label: p.prospect_name || '' },
    owner_name: p.owner_name ? { label: p.owner_name } : '',
    status: { label: statusLabel(p.status), color: STATUS_DOT[p.status] || 'gray' },
    crm_lead: p.crm_lead ? { label: __('In CRM'), color: 'green' } : '',
  })),
)

const kitRowActions = [
  { id: 'push', label: __('Push to CRM'), icon: 'open' },
  { id: 'dismiss', label: __('Dismiss'), icon: 'eye' },
]

function onPeek(row) {
  if (row?.name) openDetail(row.name)
}

function onKitRowAction({ id, row }) {
  if (!row?.name) return
  if (id === 'push') {
    doPushToCRM([row.name], null)
    return
  }
  if (id === 'dismiss') {
    const status = row.status?.label || row.status
    if (status === 'Dismissed') doRestore([row.name], null)
    else doDismiss([row.name], null)
  }
}

function onColumnsUpdate(cols) { activeColumns.value = cols }

// Quick-filter + sort state
const STATUS_FILTER_OPTIONS = [
  { label: __('Active'),    value: ''          },  // New + Lead (hides Dismissed)
  { label: __('New'),       value: 'New'       },
  { label: __('Lead'),      value: 'Lead'      },
  { label: __('Dismissed'), value: 'Dismissed' },
  { label: __('All'),       value: 'All'       },
]
// Fields available in the Filter / Sort builders
const FILTER_FIELDS = [
  { label: __('Business Name'), fieldname: 'prospect_name',  fieldtype: 'Data'   },
  { label: __('Category'),      fieldname: 'category',        fieldtype: 'Data'   },
  { label: __('Owner Name'),    fieldname: 'owner_name',      fieldtype: 'Data'   },
  { label: __('Email'),         fieldname: 'email_id',        fieldtype: 'Data'   },
  { label: __('Phone'),         fieldname: 'mobile_no',       fieldtype: 'Data'   },
  { label: __('Website'),       fieldname: 'website',         fieldtype: 'Data'   },
  { label: __('Address'),       fieldname: 'address',         fieldtype: 'Data'   },
  { label: __('Rating'),        fieldname: 'rating',          fieldtype: 'Float'  },
  { label: __('Reviews'),       fieldname: 'review_count',    fieldtype: 'Int'    },
  { label: __('Status'),        fieldname: 'status',          fieldtype: 'Select', options: [
    { label: __('New'), value: 'New' },
    { label: __('Lead'), value: 'Lead' },
    { label: __('Dismissed'), value: 'Dismissed' },
  ] },
  { label: __('Source'),        fieldname: 'source',          fieldtype: 'Data'   },
  { label: __('Town'),          fieldname: 'territory',       fieldtype: 'Data'   },
  { label: __('Follow-up'),     fieldname: 'next_follow_up',  fieldtype: 'Date'   },
  { label: __('CRM Lead'),      fieldname: 'crm_lead',        fieldtype: 'Data'   },
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
const selectedIds = ref([])
const selectedSet = computed({
  get: () => new Set(selectedIds.value),
  set: (next) => {
    selectedIds.value = next instanceof Set ? [...next] : [...(next || [])]
  },
})
const activeCell = ref(null)
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
  if (!props.listName) return __('All Prospects')
  return lists.value.find(l => l.name === props.listName)?.list_name || props.listName
})

const STATUS_COLORS = { New: 'bg-gray-400', Lead: 'bg-green-500', Dismissed: 'bg-red-400' }
function statusColor(s) { return STATUS_COLORS[s] || 'bg-gray-300' }

function bulkActions(names, unselectAll) {
  const opts = []
  if (viewingDismissed.value) {
    opts.push({ label: __('Restore'), icon: 'rotate-ccw', onClick: () => doRestore(names, unselectAll) })
  } else {
    opts.push({ label: __('Dismiss'), icon: 'eye-off', onClick: () => doDismiss(names, unselectAll) })
  }
  opts.push({ label: __('Move to list'), icon: 'corner-up-right', onClick: () => openMoveDialog(names, unselectAll) })
  if (props.listName) {
    opts.push({ label: __('Remove from list'), icon: 'x', onClick: () => doRemoveFromList(names, unselectAll) })
  }
  opts.push({ label: __('Find Owner Names'), icon: 'user', onClick: () => doFindOwnerNames(names, unselectAll) })
  opts.push({ label: __('Push to CRM'), icon: 'external-link', onClick: () => doPushToCRM(names, unselectAll) })
  opts.push({ label: __('Delete (allow re-import)'), icon: 'trash-2', theme: 'red', onClick: () => doDeleteBulk(names, unselectAll) })
  return opts
}

function rowMenuOptions(row) {
  const opts = [
    { label: __('Push to CRM'), icon: 'external-link', onClick: () => doPushToCRM([row.name], null) },
  ]
  if (row.status === 'Dismissed') {
    opts.push({ label: __('Restore'), icon: 'rotate-ccw', onClick: () => doRestore([row.name], null) })
  } else {
    opts.push({ label: __('Dismiss'), icon: 'eye-off', onClick: () => doDismiss([row.name], null) })
  }
  opts.push({ label: __('Move to list'), icon: 'corner-up-right', onClick: () => openMoveDialog([row.name], null) })
  if (props.listName) {
    opts.push({ label: __('Remove from list'), icon: 'x', onClick: () => doRemoveFromList([row.name], null) })
  }
  opts.push({ label: __('Delete (allow re-import)'), icon: 'trash-2', theme: 'red', onClick: () => doDeleteBulk([row.name], null) })
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
    const kr  = await call(prospectingApi.getMapsApiKey)
    const key = (kr || '').trim()
    if (!key) { toast.error(__('Google Maps API key not configured.')); return }
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
  selectedIds.value = []
  activeCell.value = null
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

function setActiveRow(name) {
  if (!name) return
  activeCell.value = { rowId: name, columnId: 'prospect_name' }
}

async function openDetail(name) {
  const r = await call('frappe.client.get', { doctype: 'Prospect', name })
  openDoc.value = r
  setActiveRow(name)
}

// Prev/next navigation through the loaded rows without closing the modal
const openIndex = computed(() =>
  openDoc.value ? prospects.value.findIndex(p => p.name === openDoc.value.name) : -1)
const hasPrevDetail = computed(() => openIndex.value > 0)
const hasNextDetail = computed(() => openIndex.value >= 0 && openIndex.value < prospects.value.length - 1)
async function goPrevDetail() { if (hasPrevDetail.value) await openDetail(prospects.value[openIndex.value - 1].name) }
async function goNextDetail() { if (hasNextDetail.value) await openDetail(prospects.value[openIndex.value + 1].name) }
function goToList(listName) { if (listName) { openDoc.value = null; router.push(`/prospecting/list/${listName}`) } }

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
    () => call(prospectingApi.deleteProspects, { prospect_names: [name] }), __('Deleted'))
}

// ⋯ menu actions dispatched from the detail modal
function onModalAction(type) {
  const name = openDoc.value?.name
  if (!name) return
  if (type === 'dismiss') {
    modalActionAdvance(name,
      () => call(prospectingApi.dismissProspects, { prospect_names: [name] }), __('Dismissed'))
  } else if (type === 'remove') {
    modalActionAdvance(name,
      () => call(prospectingApi.removeFromList, { prospect_names: [name] }), __('Removed from list'))
  } else if (type === 'restore') {
    // restore keeps the modal on the same prospect (just flips status)
    call(prospectingApi.restoreProspects, { prospect_names: [name] }).then(() => {
      if (openDoc.value?.name === name) openDoc.value.status = 'New'
      onStatusUpdated({ name, status: 'New' })
      toast.success(__('Restored'))
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
    const r = await call(prospectingApi.removeFromList, { prospect_names: names })
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    unselectAll?.()
    toast.success(__('Removed {0} prospect(s) from list', [r.removed]))
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
    title: __('Delete {0} prospect(s)?', [names.length]),
    message: __('This removes the record entirely — unlike Dismiss, the same business CAN reappear on a future search.'),
    confirmLabel: __('Delete'),
    danger: true,
  }, async () => {
    deleting.value = true
    try {
      const r = await call(prospectingApi.deleteProspects, { prospect_names: names })
      if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
      unselectAll?.()
      toast.success(__('Deleted {0} prospect(s)', [r.deleted]))
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
    const r = await call(prospectingApi.dismissProspects, { prospect_names: names })
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    unselectAll?.()
    toast.success(__('Dismissed {0} prospect(s)', [r.dismissed]))
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
    const r = await call(prospectingApi.restoreProspects, { prospect_names: names })
    unselectAll?.()
    toast.success(__('Restored {0} prospect(s)', [r.restored]))
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
    message: __('Pushing {0} prospect(s) to CRM…', [names.length]),
    type: 'info', duration: 600,
  })
  try {
    const r = await call(prospectingApi.pushToCrm, { prospect_names: names })
    const parts = []
    if (r.created)        parts.push(__('{0} lead(s) created', [r.created]))
    if (r.skipped)        parts.push(__('{0} already exist', [r.skipped]))
    if (r.errors?.length) parts.push(__('{0} failed', [r.errors.length]))
    toast.success(parts.join(' · ') || __('Done'))
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
    message: __('Finding owner names for {0} prospect(s)…', [names.length]),
    type: 'info', duration: 600,
  })
  try {
    const r = await call(prospectingApi.findOwnerNames, { prospect_names: names })
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
    if (found)            parts.push(__('{0} owner name(s) found', [found]))
    if (skipped)          parts.push(__('{0} no name found', [skipped]))
    if (r.errors?.length) parts.push(__('{0} error(s)', [r.errors.length]))
    if (r.errors?.length) {
      const firstErr = r.errors[0]?.error || __('Unknown error')
      toast.error(__('Error ({0} prospect(s)): {1}', [r.errors.length, firstErr]))
    } else {
      toast.success(parts.join(' · ') || __('Done'))
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
    title: __('Delete list "{0}"?', [label]),
    message: count
      ? __('This deletes the list and its {0} prospect(s).', [count])
      : __('This deletes the list.'),
    confirmLabel: __('Delete list'),
    danger: true,
  }, async () => {
    await call(prospectingApi.deleteList, { list_name: props.listName })
    toast.success(__('List "{0}" deleted', [label]))
    await reloadLists()
    router.push('/prospecting')
  })
}
</script>

