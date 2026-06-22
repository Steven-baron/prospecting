<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Search bar -->
    <div class="flex-shrink-0 border-b bg-surface-white px-5 py-3">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex-[2] min-w-36">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">What</p>
          <TextInput v-model="what" placeholder="e.g. dentists, ESL schools…"
            @keydown.enter="search" />
        </div>
        <div class="flex-[1.5] min-w-32">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Where</p>
          <input
            ref="locInputEl"
            v-model="whereText"
            @input="onLocationInput"
            placeholder="City or area…"
            autocomplete="off"
            class="form-input w-full text-sm" />
        </div>
        <div class="flex-1 min-w-28">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Category</p>
          <Autocomplete :options="categories" v-model="categoryOption" placeholder="Any category" />
        </div>
        <div class="w-24">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Depth</p>
          <Select :options="depthOptions" v-model="depth" />
        </div>
        <Button label="Search" variant="solid" icon-left="search"
          :loading="searching" @click="search" />
      </div>
    </div>

    <!-- Body: results + map -->
    <div class="flex flex-1 overflow-hidden">

      <!-- Results panel -->
      <div class="flex w-[42%] flex-shrink-0 flex-col border-r overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b flex-shrink-0 min-h-[42px]">
          <span class="text-sm text-ink-gray-6">
            <template v-if="results.length">
              <strong class="text-ink-gray-9">{{ results.length }}</strong> results
              · {{ selected.size }} selected
            </template>
            <template v-else-if="!searching">Search to find prospects</template>
          </span>
          <Button v-if="selected.size > 0"
            :label="`Save ${selected.size}`"
            variant="solid"
            size="sm"
            @click="showSaveDialog = true" />
        </div>

        <div ref="resultsListEl" class="flex-1 overflow-y-auto">
          <div v-if="!results.length && !searching"
            class="flex flex-col items-center justify-center h-full gap-3 text-ink-gray-5 p-8">
            <div class="text-3xl opacity-40">🔍</div>
            <p class="text-sm text-center">Search for businesses to start building a prospect list.</p>
          </div>

          <div
            v-for="r in results" :key="r.placeId"
            :data-place-id="r.placeId"
            class="flex gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:bg-surface-gray-1"
            :class="{
              'bg-surface-blue-1': selected.has(r.placeId),
              'ring-2 ring-inset ring-ink-blue-2': highlightedId === r.placeId,
            }"
            @click="toggleSelect(r.placeId); panTo(r)">
            <input type="checkbox"
              :checked="selected.has(r.placeId)"
              @click.stop @change="toggleSelect(r.placeId)"
              class="form-checkbox mt-0.5 flex-shrink-0 cursor-pointer" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-ink-gray-9">{{ r.businessName }}</span>
                <Badge v-if="r.rating != null" :label="`★ ${r.rating}`" theme="orange" size="sm" />
              </div>
              <Badge v-if="r.category" :label="r.category" theme="gray" size="sm" class="mt-1" />
              <p v-if="r.address" class="mt-0.5 text-xs text-ink-gray-6 truncate">{{ r.address }}</p>
              <div class="mt-0.5 flex gap-3">
                <span v-if="r.phone" class="text-xs text-ink-gray-5">{{ r.phone }}</span>
                <a v-if="r.website" :href="r.website" target="_blank" rel="noreferrer"
                  @click.stop class="text-xs text-ink-blue-2">Website</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map panel -->
      <div class="relative flex-1">
        <div ref="mapEl" class="h-full w-full" />
        <div v-if="!mapReady"
          class="absolute inset-0 flex items-center justify-center bg-surface-gray-1 text-ink-gray-5">
          <div class="text-center px-8">
            <div class="text-3xl mb-3 opacity-40">🗺</div>
            <p class="text-sm">Select a city to see its boundary, then search.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Save to List dialog -->
    <Dialog v-model="showSaveDialog" :options="{ title: 'Save to Prospect List', size: 'sm' }">
      <template #body-content>
        <div class="space-y-4 px-1">
          <div>
            <p class="mb-1 text-sm font-medium text-ink-gray-7">Save to</p>
            <Select :options="saveModeOptions" v-model="saveMode" />
          </div>
          <div v-if="saveMode === 'existing'">
            <p class="mb-1 text-sm font-medium text-ink-gray-7">List</p>
            <Select
              :options="lists.map(l => ({ label: l.list_name, value: l.name }))"
              v-model="saveListName"
              placeholder="Select a list" />
          </div>
          <div v-if="saveMode === 'new'">
            <FormControl label="New list name" type="text" v-model="saveNewName"
              placeholder="e.g. Toronto Dentists" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer text-sm text-ink-gray-7">
            <input type="checkbox" v-model="enrichEmail" class="form-checkbox">
            Try to find emails from websites (slower)
          </label>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" variant="subtle" @click="showSaveDialog = false" />
          <Button :label="`Save ${selected.size} prospects`" variant="solid"
            :loading="saving" @click="save" />
        </div>
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, TextInput, Select, Autocomplete, Dialog, FormControl, Badge, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

// Search state
const what      = ref('')
const whereText = ref('')
const categoryOption = ref(null)   // { label, value } object for Autocomplete
const depth     = ref('2')
const categories = ref([])
const results    = ref([])
const selected   = ref(new Set())
const searching  = ref(false)
const cityBounds = ref(null)

const depthOptions = [
  { label: 'Quick',    value: '1' },
  { label: 'Full',     value: '2' },
  { label: 'Thorough', value: '3' },
]

const saveModeOptions = computed(() => {
  const opts = [{ label: 'New list', value: 'new' }]
  if (lists.value.length) opts.unshift({ label: 'Existing list', value: 'existing' })
  return opts
})

// Map state
const mapEl        = ref(null)
const mapReady     = ref(false)
const locInputEl   = ref(null)
const resultsListEl = ref(null)
const highlightedId = ref(null)
let map = null, markers = [], cityFeatures = []

// Save state
const showSaveDialog = ref(false)
const saveMode      = ref('existing')
const saveListName  = ref('')
const saveNewName   = ref('')
const enrichEmail   = ref(false)
const saving        = ref(false)

onMounted(async () => {
  const r = await call('prospecting.api.get_place_categories')
  categories.value = (r || []).map(c => ({ label: c.label, value: c.value }))

  const kr  = await call('prospecting.api.get_maps_api_key')
  const key = (kr || '').trim()
  if (!key) return
  await loadMapsScript(key)
  map = new google.maps.Map(mapEl.value, {
    center: { lat: 43.6532, lng: -79.3832 }, zoom: 11,
    gestureHandling: 'greedy', mapTypeControl: false,
    streetViewControl: false, fullscreenControl: false,
  })
  mapReady.value = true
  initAutocomplete()
})

function loadMapsScript(key) {
  if (window.google?.maps) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}

function initAutocomplete() {
  const ac = new google.maps.places.Autocomplete(locInputEl.value, {
    types: ['(cities)'], fields: ['name', 'geometry'],
  })
  ac.addListener('place_changed', () => {
    const place = ac.getPlace()
    if (!place?.geometry) return
    // Sync Vue's ref with what Google wrote to the DOM, so re-renders don't overwrite it
    whereText.value = locInputEl.value.value
    cityBounds.value = place.geometry.viewport || null
    if (cityBounds.value) map.fitBounds(cityBounds.value, 0)
    drawPolygon(place.name || locInputEl.value?.value)
  })
}

function onLocationInput() {
  cityBounds.value = null
  clearPolygon()
}

async function drawPolygon(name) {
  clearPolygon()
  if (!map) return
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&polygon_geojson=1&limit=1&featuretype=city&addressdetails=0`,
      { headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'ProspectingTool/1.0' } }
    )
    if (!r.ok) return
    const data = await r.json()
    const geojson = data[0]?.geojson
    if (!geojson) return
    const features = map.data.addGeoJson({ type: 'Feature', geometry: geojson })
    cityFeatures = Array.isArray(features) ? features : [features]
    map.data.setStyle({ fillColor: '#6366f1', fillOpacity: 0.07, strokeColor: '#ef4444', strokeWeight: 2.5, strokeOpacity: .85 })
  } catch (_) {}
}

function clearPolygon() {
  cityFeatures.forEach(f => { try { map.data.remove(f) } catch(_){} })
  cityFeatures = []
}

function clearMarkers() { markers.forEach(m => m.setMap(null)); markers = [] }

function dropMarkers() {
  if (!map) return
  clearMarkers()
  const valid = results.value.filter(r => r.lat != null)
  if (!valid.length) return
  valid.forEach(r => {
    const m = new google.maps.Marker({ position: { lat: r.lat, lng: r.lng }, map, title: r.businessName })
    m.addListener('click', () => {
      highlightedId.value = r.placeId
      panTo(r)
      // Scroll the matching row into view in the results list
      const row = resultsListEl.value?.querySelector(`[data-place-id="${r.placeId}"]`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    markers.push(m)
  })
  const b = new google.maps.LatLngBounds()
  valid.forEach(r => b.extend({ lat: r.lat, lng: r.lng }))
  map.fitBounds(b, 40)
}

function panTo(r) {
  if (!map || r.lat == null) return
  map.panTo({ lat: r.lat, lng: r.lng })
  if ((map.getZoom() || 0) < 14) map.setZoom(15)
}

async function search() {
  // Use category label as the search term when WHAT is left blank
  const effectiveWhat = what.value.trim() || categoryOption.value?.label || ''
  if (!effectiveWhat && !whereText.value) return
  const query = effectiveWhat && whereText.value
    ? `${effectiveWhat} in ${whereText.value}`
    : effectiveWhat || whereText.value

  let bounds_arg
  if (cityBounds.value) {
    const ne = cityBounds.value.getNorthEast(), sw = cityBounds.value.getSouthWest()
    bounds_arg = JSON.stringify({ north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() })
  }

  searching.value   = true
  selected.value    = new Set()
  highlightedId.value = null
  clearMarkers()
  try {
    const r = await call('prospecting.api.search_places', {
      query, included_type: categoryOption.value?.value || '',
      max_pages: parseInt(depth.value),
      bounds: bounds_arg,
    })
    results.value = r?.results || []
    dropMarkers()
  } catch (e) {
    toast.error('Search failed: ' + e.message)
  } finally {
    searching.value = false
  }
}

function toggleSelect(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

async function save() {
  const chosen = results.value.filter(r => selected.value.has(r.placeId))
  if (!chosen.length) return
  const list_name = saveMode.value === 'existing' ? saveListName.value : ''
  const new_name  = saveMode.value === 'new' ? saveNewName.value.trim() : ''
  if (saveMode.value === 'existing' && !list_name) { toast.warning('Pick a list.'); return }
  if (saveMode.value === 'new' && !new_name) { toast.warning('Enter a list name.'); return }

  saving.value = true
  try {
    const r = await call('prospecting.api.import_prospects', {
      prospects: JSON.stringify(chosen),
      list_name, new_list_name: new_name, enrich_email: enrichEmail.value ? 1 : 0,
    })
    toast.success(`Saved ${r.created} prospects${r.skipped ? ` · ${r.skipped} already existed` : ''}`)
    showSaveDialog.value = false
    selected.value       = new Set()
    await reloadLists()
    const target = list_name || r.list_name
    if (target) router.push(`/list/${encodeURIComponent(target)}`)
  } catch (e) {
    toast.error('Save failed: ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>
