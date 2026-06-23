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
              <button @click="openDrawer(row)"
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

        <!-- Detail drawer -->
        <Transition name="drawer">
          <div v-if="activeRow"
            class="absolute inset-y-0 right-0 w-[480px] flex flex-col bg-surface-white border-l shadow-xl z-10 overflow-hidden">

            <!-- Header -->
            <div class="flex items-start gap-3 px-4 py-3 border-b flex-shrink-0">
              <div class="flex-1 min-w-0">
                <h2 class="text-sm font-semibold text-ink-gray-9 leading-snug">{{ activeRow.prospect_name }}</h2>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span v-if="activeRow.rating != null" class="text-xs text-amber-600 font-medium">
                    ★ {{ activeRow.rating }}
                    <template v-if="activeRow.review_count">
                      ({{ Number(activeRow.review_count).toLocaleString() }} reviews)
                    </template>
                  </span>
                  <Badge v-if="activeRow.category" :label="activeRow.category" theme="gray" size="sm" />
                </div>
              </div>
              <button @click="activeRow = null"
                class="flex-shrink-0 rounded p-1 text-ink-gray-4 hover:bg-surface-gray-2 hover:text-ink-gray-7">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Details -->
            <div class="px-4 py-4 space-y-3 overflow-y-auto flex-1">
              <div v-if="activeRow.address" class="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 mt-0.5 flex-shrink-0 text-ink-gray-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span class="text-sm text-ink-gray-7">{{ activeRow.address }}</span>
              </div>
              <div v-if="activeRow.mobile_no" class="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 mt-0.5 flex-shrink-0 text-ink-gray-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.09 6.09l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
                <a :href="`tel:${activeRow.mobile_no}`" class="text-sm text-ink-blue-2 hover:underline">{{ activeRow.mobile_no }}</a>
              </div>
              <div v-if="activeRow.website" class="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 mt-0.5 flex-shrink-0 text-ink-gray-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10ZM2 12h20"/></svg>
                <a :href="activeRow.website" target="_blank" rel="noreferrer"
                  class="text-sm text-ink-blue-2 hover:underline break-all">{{ activeRow.website }}</a>
              </div>
              <div class="flex gap-2 items-center pt-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 flex-shrink-0 text-ink-gray-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <Select :options="STATUSES" :model-value="activeRow.status" size="sm" variant="subtle"
                  @update:model-value="v => updateStatus(activeRow.name, v)" />
              </div>
            </div>

            <!-- Footer -->
            <div class="flex gap-2 px-4 py-3 border-t flex-shrink-0">
              <Button label="Full Details" variant="subtle" size="sm"
                class="flex-1 justify-center" @click="openDetail(activeRow.name)" />
              <a v-if="activeRow.crm_lead" :href="`/crm/leads/${activeRow.crm_lead}`"
                target="_blank" rel="noreferrer">
                <Button label="View in CRM" variant="outline" size="sm" />
              </a>
            </div>
          </div>
        </Transition>
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
const removing     = ref(false)
const pushing      = ref(false)

// Map state
const showMap   = ref(false)
const mapEl     = ref(null)
const activeRow = ref(null)
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

async function ensureMapReady() {
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
    m.addListener('click', () => openDrawer(p))
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
  } else {
    activeRow.value = null
  }
}

async function openDrawer(row) {
  activeRow.value = row
  if (!showMap.value) {
    showMap.value = true
    await ensureMapReady()
    dropMarkers()
  }
  panTo(row)
}

function handleRowClick(row) {
  if (showMap.value) {
    panTo(row)
    if (activeRow.value) activeRow.value = row
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
  activeRow.value    = null
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
      ],
      filters,
      limit:       50,
      limit_start: reset ? 0 : start.value,
      order_by:    'modified desc',
    }) || []
    rows.forEach(r => { r._address_short = (r.address || '').split(',')[0] })
    if (reset) { prospects.value = rows } else { prospects.value.push(...rows) }
    start.value   = prospects.value.length
    hasMore.value = rows.length === 50
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
  if (activeRow.value?.name === name) activeRow.value.status = status
}

function onStatusUpdated({ name, status }) {
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
  if (openDoc.value?.name === name) openDoc.value.status = status
  if (activeRow.value?.name === name) activeRow.value.status = status
}

async function deleteProspect(name) {
  await call('frappe.client.delete', { doctype: 'Prospect', name })
  prospects.value = prospects.value.filter(p => p.name !== name)
  if (openDoc.value?.name === name) openDoc.value = null
  if (activeRow.value?.name === name) activeRow.value = null
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
    if (activeRow.value && names.includes(activeRow.value.name)) activeRow.value = null
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

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
