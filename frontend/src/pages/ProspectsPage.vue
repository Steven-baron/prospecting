<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between border-b px-5 py-3 flex-shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold text-ink-gray-9">{{ pageTitle }}</h1>
        <Badge v-if="prospects.length" :label="String(prospects.length)" theme="gray" size="sm" />
      </div>
      <div class="flex gap-2">
        <Button :label="showMap ? 'Hide Map' : 'Show Map'" variant="subtle" @click="toggleMap" />
        <Button v-if="listName" label="Delete list" variant="subtle"
          class="text-ink-red-3" @click="confirmDeleteList" />
        <Button label="Find Prospects" variant="solid" icon-left="search"
          @click="router.push('/search')" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 overflow-hidden">

      <!-- List panel -->
      <div :class="showMap ? 'w-[42%] flex-shrink-0 border-r' : 'flex-1'"
        class="relative flex flex-col overflow-hidden">

        <ListView v-if="prospects.length || loading"
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
                <div class="flex items-center gap-2">
                  <Button
                    v-if="listName"
                    label="Remove from list"
                    variant="subtle"
                    size="sm"
                    :loading="removing"
                    @click="doRemoveFromList([...selections], unselectAll)" />
                  <Button
                    label="Find Owner Names"
                    variant="outline"
                    size="sm"
                    :loading="findingOwners"
                    @click="doFindOwnerNames([...selections], unselectAll)" />
                  <Button
                    label="Push to CRM"
                    variant="solid"
                    size="sm"
                    :loading="pushing"
                    @click="doPushToCRM([...selections], unselectAll)" />
                </div>
              </template>
            </ListSelectBanner>
          </template>

          <template #cell="{ column, row, item }">
            <div v-if="column.key === 'status'" @click.stop>
              <Select
                :options="STATUSES"
                :model-value="item"
                size="sm"
                variant="subtle"
                @update:model-value="v => updateStatus(row.name, v)" />
            </div>
            <span v-else-if="column.key === 'rating'" class="text-amber-500 text-sm">
              {{ item != null ? `★ ${Number(item).toFixed(1)}` : '—' }}
            </span>
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

      <!-- Full detail slide-over -->
      <ProspectDetail
        :doc="openDoc"
        @close="openDoc = null"
        @delete="deleteProspect"
        @status-updated="onStatusUpdated" />

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  ListView, ListHeader, ListRows, ListEmptyState, ListSelectBanner,
  Button, Badge, Select, Dropdown, toast,
} from 'frappe-ui'
import ProspectDetail from '../components/ProspectDetail.vue'
import { call } from '../composables/api.js'

const props = defineProps({
  listName: { type: String, default: null },
})

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']

const ALL_COLUMNS = [
  { label: 'Business Name', key: 'prospect_name',  width: '220px' },
  { label: 'Category',      key: 'category',        width: '130px' },
  { label: 'Address',       key: '_address_short',  width: '200px' },
  { label: 'Phone',         key: 'mobile_no',        width: '140px' },
  { label: 'Rating',        key: 'rating',           width: '80px'  },
  { label: 'Status',        key: 'status',           width: '130px' },
  { label: '',              key: '_actions',          width: '60px'  },
]

const MAP_COLUMNS = [
  { label: 'Business Name', key: 'prospect_name', width: '200px' },
  { label: 'Rating',        key: 'rating',        width: '70px'  },
  { label: 'Status',        key: 'status',        width: '120px' },
  { label: '',              key: '_actions',       width: '60px'  },
]

const columns = computed(() => showMap.value ? MAP_COLUMNS : ALL_COLUMNS)

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

// Map state
const showMap = ref(false)
const mapEl   = ref(null)
let map = null, markers = []

const pageTitle = computed(() => {
  if (!props.listName) return 'All Prospects'
  return lists.value.find(l => l.name === props.listName)?.list_name || props.listName
})

function rowMenuOptions(row) {
  const opts = [
    { label: 'Push to CRM', icon: 'external-link', onClick: () => doPushToCRM([row.name], null) },
  ]
  if (props.listName) {
    opts.push({ label: 'Remove from list', icon: 'x', onClick: () => doRemoveFromList([row.name], null) })
  }
  opts.push({ label: 'Delete', icon: 'trash-2', theme: 'red', onClick: () => deleteProspect(row.name) })
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
    const rows = await call('frappe.client.get_list', {
      doctype: 'Prospect',
      fields: [
        'name', 'prospect_name', 'category', 'address', 'mobile_no',
        'email_id', 'website', 'rating', 'review_count', 'status',
        'prospect_list', 'lat', 'lng', 'google_maps_uri', 'notes', 'crm_lead',
        'owner_name',
      ],
      filters,
      limit:       500,
      limit_start: reset ? 0 : start.value,
      order_by:    'modified desc',
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

async function openDetail(name) {
  const r = await call('frappe.client.get', { doctype: 'Prospect', name })
  openDoc.value = r
}

async function updateStatus(name, status) {
  await call('frappe.client.set_value', { doctype: 'Prospect', name, fieldname: 'status', value: status })
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
}

function onStatusUpdated({ name, status }) {
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
  if (openDoc.value?.name === name) openDoc.value.status = status
}

async function deleteProspect(name) {
  await call('frappe.client.delete', { doctype: 'Prospect', name })
  prospects.value = prospects.value.filter(p => p.name !== name)
  if (openDoc.value?.name === name) openDoc.value = null
  if (map) dropMarkers()
  reloadLists()
  toast.success('Prospect deleted')
}

async function doRemoveFromList(names, unselectAll) {
  if (!names.length) return
  removing.value = true
  try {
    const r = await call('prospecting.api.remove_from_list', { prospect_names: names })
    prospects.value = prospects.value.filter(p => !names.includes(p.name))
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    if (map) dropMarkers()
    unselectAll?.()
    reloadLists()
    toast.success(`Removed ${r.removed} prospect(s) from list`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    removing.value = false
  }
}

async function doPushToCRM(names, unselectAll) {
  if (!names.length) return
  pushing.value = true
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
    pushing.value = false
  }
}

async function doFindOwnerNames(names, unselectAll) {
  if (!names.length) return
  findingOwners.value = true
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
    findingOwners.value = false
  }
}

async function confirmDeleteList() {
  const listObj = lists.value.find(l => l.name === props.listName)
  const label   = listObj?.list_name || props.listName
  const count   = listObj?._count || 0
  const msg     = count
    ? `Delete list "${label}" and its ${count} prospect(s)?`
    : `Delete list "${label}"?`
  if (!confirm(msg)) return
  await call('prospecting.api.delete_list', { list_name: props.listName })
  toast.success(`List "${label}" deleted`)
  await reloadLists()
  router.push('/all')
}
</script>

