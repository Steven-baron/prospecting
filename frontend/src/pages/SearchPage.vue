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
        <div class="relative z-20 flex-1 min-w-28">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Category</p>
          <SearchableSelect
            v-model="categoryValue"
            :options="categories"
            placeholder="Any category"
            empty-option="Any category"
            filter-placeholder="Type to filter categories…"
          />
        </div>
        <div class="w-24 shrink-0">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Depth</p>
          <select
            v-model="depth"
            class="form-input w-full rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm text-ink-gray-8"
          >
            <option v-for="o in depthOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
        <Button label="Search" variant="solid" icon-left="search" class="w-full shrink-0 sm:w-auto"
          :loading="searching" @click="search" />
      </div>
    </div>

    <!-- Body: results + map -->
    <div class="relative flex flex-1 overflow-hidden">

      <!-- Mobile list/map toggle -->
      <div class="sm:hidden fixed bottom-4 left-1/2 z-30 -translate-x-1/2 flex rounded-full bg-ink-gray-9 p-0.5 shadow-lg">
        <button @click="mobileView = 'list'"
          class="rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
          :class="mobileView === 'list' ? 'bg-surface-white text-ink-gray-9' : 'text-white'">List</button>
        <button @click="mobileView = 'map'"
          class="rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
          :class="mobileView === 'map' ? 'bg-surface-white text-ink-gray-9' : 'text-white'">Map</button>
      </div>

      <!-- Results panel -->
      <div class="w-full sm:w-[42%] flex-shrink-0 flex-col border-r overflow-hidden"
        :class="mobileView === 'map' ? 'hidden sm:flex' : 'flex'">
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

        <!-- Select-all bar (shown once results exist) -->
        <div v-if="results.length"
          class="flex items-center gap-2 px-4 py-1.5 border-b bg-surface-gray-1 flex-shrink-0">
          <input type="checkbox"
            :checked="selected.size > 0 && selected.size === results.length"
            :indeterminate.prop="selected.size > 0 && selected.size < results.length"
            class="form-checkbox cursor-pointer"
            @click.stop="toggleSelectAll" />
          <span class="text-xs text-ink-gray-5 select-none">
            {{ selected.size === results.length ? 'Deselect all' : 'Select all' }}
          </span>
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
            @click="onRowClick(r)">
            <div class="flex-shrink-0 flex items-start pt-0.5" @click.stop>
              <input type="checkbox"
                :checked="selected.has(r.placeId)"
                class="form-checkbox cursor-pointer"
                @click.stop="toggleSelect(r.placeId)" />
            </div>
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
            <button @click.stop="openDrawer(r)"
              class="flex-shrink-0 self-center rounded p-1.5 text-ink-gray-3 hover:bg-surface-gray-2 hover:text-ink-gray-7"
              title="View details">
              <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Map panel -->
      <div class="relative flex-1 overflow-hidden"
        :class="mobileView === 'list' ? 'hidden sm:block' : 'block'">
        <div ref="mapEl" class="h-full w-full" />
        <div v-if="!mapReady"
          class="absolute inset-0 flex items-center justify-center bg-surface-gray-1 text-ink-gray-5">
          <div class="text-center px-8">
            <div class="text-3xl mb-3 opacity-40">🗺</div>
            <p class="text-sm">Select a city to see its boundary, then search.</p>
          </div>
        </div>
      </div>

      <!-- Search result detail panel -->
      <SearchResultDetail :result="activeResult" @close="activeResult = null" />
    </div>

    <!-- Save to List — buttons + list rows (no Select menus) -->
    <Dialog v-model="showSaveDialog" :options="{ title: 'Save to Prospect List', size: 'sm' }">
      <template #body-content>
        <div class="space-y-4 px-1">
          <div class="flex gap-2">
            <Button
              size="sm"
              :variant="saveMode === 'existing' ? 'solid' : 'subtle'"
              label="Existing list"
              :disabled="!lists.length"
              @click="saveMode = 'existing'"
            />
            <Button
              size="sm"
              :variant="saveMode === 'new' ? 'solid' : 'subtle'"
              label="New list"
              @click="saveMode = 'new'"
            />
          </div>
          <div v-if="saveMode === 'existing'">
            <div
              v-if="lists.length"
              class="max-h-48 overflow-y-auto rounded-md border border-outline-gray-2"
            >
              <button
                v-for="l in lists"
                :key="l.name"
                type="button"
                class="flex w-full items-center justify-between border-b border-outline-gray-1 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-surface-gray-2"
                :class="saveListName === l.name ? 'bg-surface-gray-3 font-medium' : ''"
                @click="saveListName = l.name"
              >
                <span>{{ l.list_name || l.name }}</span>
                <span v-if="saveListName === l.name" class="text-xs text-ink-gray-5">Selected</span>
              </button>
            </div>
            <p v-else class="text-xs text-ink-gray-5">No lists yet — use “New list”.</p>
          </div>
          <div v-else>
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

<script>
// Named so <keep-alive include="SearchPage"> can cache it (preserves search
// state when navigating away to a list and back).
export default { name: 'SearchPage' }
</script>

<script setup>
import { ref, computed, inject, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Button, TextInput, Dialog, FormControl, Badge, toast } from 'frappe-ui'
import SearchableSelect from '../components/SearchableSelect.vue'
import SearchResultDetail from '../components/SearchResultDetail.vue'
import { call } from '../composables/api.js'

// Mobile-only view toggle between the results list and the map
const mobileView = ref('list')

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

// Search state
const what      = ref('')
const whereText = ref('')
const categoryValue = ref('')
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


// Map state
const mapEl         = ref(null)
const mapReady      = ref(false)
const locInputEl    = ref(null)
const resultsListEl = ref(null)
const highlightedId = ref(null)
const activeResult  = ref(null)
let map = null, markers = [], cityFeatures = [], cityGeoJson = null

// When the mobile toggle reveals the map, Google Maps needs a resize nudge
// (it was display:none, so it sized to 0) plus a re-fit to the current markers.
watch(mobileView, (v) => {
  if (v !== 'map' || !map) return
  nextTick(() => {
    google.maps.event.trigger(map, 'resize')
    if (results.value.length) dropMarkers()
    else if (cityBounds.value) map.fitBounds(cityBounds.value, 0)
  })
})

// Save state
const showSaveDialog = ref(false)
const saveMode      = ref('new')
const saveListName  = ref('')
const saveNewName   = ref('')
const enrichEmail   = ref(false)
const saving        = ref(false)

watch(showSaveDialog, async (open) => {
  if (!open) return
  try {
    await reloadLists()
  } catch {
    /* keep cached */
  }
  saveMode.value = lists.value?.length ? 'existing' : 'new'
  saveListName.value = ''
  saveNewName.value = ''
  enrichEmail.value = false
})

onMounted(async () => {
  const r = await call('prospecting.api.get_place_categories')
  categories.value = (r || [])
    .map(c => ({ label: c.label, value: c.value ?? '' }))
    .filter(c => c.label && c.value !== '')

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
    cityGeoJson = geojson
    const features = map.data.addGeoJson({ type: 'Feature', geometry: geojson })
    cityFeatures = Array.isArray(features) ? features : [features]
    map.data.setStyle({ fillColor: '#6366f1', fillOpacity: 0.07, strokeColor: '#ef4444', strokeWeight: 2.5, strokeOpacity: .85 })
  } catch (_) {}
}

function clearPolygon() {
  cityFeatures.forEach(f => { try { map.data.remove(f) } catch(_){} })
  cityFeatures = []
  cityGeoJson = null
}

function pointInGeoJson(lat, lng, geojson) {
  if (!geojson) return true
  const testRing = (ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[i]  // GeoJSON: [longitude, latitude]
      const [x1, y1] = ring[j]
      if (((y0 > lat) !== (y1 > lat)) && (lng < (x1 - x0) * (lat - y0) / (y1 - y0) + x0))
        inside = !inside
    }
    return inside
  }
  const testPoly = (coords) => testRing(coords[0])
  if (geojson.type === 'Polygon') return testPoly(geojson.coordinates)
  if (geojson.type === 'MultiPolygon') return geojson.coordinates.some(testPoly)
  return true
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
      openDrawer(r)
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

function openDrawer(r) {
  activeResult.value = r
  panTo(r)
}

function onRowClick(r) {
  if (activeResult.value) {
    activeResult.value = r
  }
  panTo(r)
}

async function search() {
  // Use category label as the search term when WHAT is left blank
  const catLabel = categories.value.find(c => c.value === categoryValue.value)?.label || ''
  const effectiveWhat = what.value.trim() || catLabel || ''
  if (!effectiveWhat && !whereText.value) return
  const query = effectiveWhat && whereText.value
    ? `${effectiveWhat} in ${whereText.value}`
    : effectiveWhat || whereText.value

  let bounds_arg
  if (cityBounds.value) {
    const ne = cityBounds.value.getNorthEast(), sw = cityBounds.value.getSouthWest()
    bounds_arg = JSON.stringify({ north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() })
  }

  searching.value     = true
  selected.value      = new Set()
  highlightedId.value = null
  activeResult.value  = null
  clearMarkers()
  try {
    const r = await call('prospecting.api.search_places', {
      query, included_type: categoryValue.value || '',
      max_pages: parseInt(depth.value),
      bounds: bounds_arg,
    })
    const raw = r?.results || []
    results.value = cityGeoJson
      ? raw.filter(p => p.lat != null && pointInGeoJson(p.lat, p.lng, cityGeoJson))
      : raw
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

function toggleSelectAll() {
  if (selected.value.size === results.value.length) {
    selected.value = new Set()
  } else {
    selected.value = new Set(results.value.map(r => r.placeId))
  }
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

