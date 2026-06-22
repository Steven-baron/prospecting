<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Page header -->
    <div class="flex-shrink-0 border-b bg-surface-white px-6 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold text-ink-gray-9">Search Categories</h1>
        <p class="text-xs text-ink-gray-5 mt-0.5">{{ activeCount }} active · {{ categories.length }} total</p>
      </div>
      <Button label="Save" variant="solid" size="sm" :loading="saving" @click="save" />
    </div>

    <!-- Toolbar — switches between filter mode and selection mode -->
    <div class="flex-shrink-0 border-b bg-surface-gray-1 px-4 py-2 flex items-center gap-3 min-h-[44px]">

      <!-- Selection mode -->
      <template v-if="selected.size > 0">
        <span class="text-sm font-medium text-ink-gray-7 mr-1">{{ selected.size }} selected</span>
        <Button label="Activate" variant="solid" size="sm" @click="setSelected(true)" />
        <Button label="Deactivate" variant="outline" size="sm" @click="setSelected(false)" />
        <button class="ml-auto text-xs text-ink-gray-5 hover:text-ink-gray-8" @click="selected.clear(); selected = new Set()">
          Clear selection
        </button>
      </template>

      <!-- Filter mode -->
      <template v-else>
        <input
          v-model="searchText"
          placeholder="Search categories…"
          class="flex-1 rounded border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm focus:border-outline-blue-2 focus:outline-none" />
        <select
          v-model="statusFilter"
          class="rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm text-ink-gray-7 focus:border-outline-blue-2 focus:outline-none">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </template>
    </div>

    <!-- List header -->
    <div class="flex-shrink-0 border-b bg-surface-gray-1 px-4 py-2 flex items-center gap-3">
      <input
        type="checkbox"
        class="size-4 cursor-pointer rounded"
        :checked="allVisibleSelected"
        :indeterminate.prop="someVisibleSelected"
        @change="toggleSelectAll" />
      <span class="flex-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Category</span>
      <span class="w-20 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Status</span>
      <span class="w-44 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Google Type</span>
    </div>

    <!-- Rows -->
    <div class="flex-1 overflow-y-auto divide-y divide-outline-gray-1">

      <div v-if="filtered.length === 0" class="px-6 py-10 text-center text-sm text-ink-gray-4">
        No categories match your filters.
      </div>

      <div
        v-for="cat in filtered"
        :key="cat._key"
        class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-gray-1 cursor-pointer select-none"
        @click="toggleRow(cat._key)">

        <input
          type="checkbox"
          class="size-4 flex-shrink-0 cursor-pointer rounded"
          :checked="selected.has(cat._key)"
          @click.stop
          @change="toggleRow(cat._key)" />

        <span class="flex-1 text-sm" :class="cat.active ? 'text-ink-gray-9' : 'text-ink-gray-4'">
          {{ cat.label }}
        </span>

        <span :class="[
          'w-20 text-xs font-medium',
          cat.active ? 'text-ink-green-3' : 'text-ink-gray-4'
        ]">
          {{ cat.active ? 'Active' : 'Inactive' }}
        </span>

        <span class="w-44 font-mono text-xs text-ink-gray-3 truncate text-right">{{ cat.value }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 border-t bg-surface-white px-6 py-3 flex items-center justify-between">
      <p class="text-xs text-ink-gray-4">To remove categories, go to Desk → Prospecting Settings.</p>
      <Button label="+ Add custom" variant="ghost" size="sm" @click="showAddDialog = true" />
    </div>

    <!-- Add custom dialog -->
    <Dialog v-model="showAddDialog" :options="{ title: 'Add custom category' }">
      <template #body-content>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-ink-gray-6">Display label</label>
            <input v-model="newLabel" placeholder="e.g. Print Shop"
              class="w-full rounded border border-outline-gray-2 px-3 py-2 text-sm focus:border-outline-blue-2 focus:outline-none" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-ink-gray-6">Google Place Type code</label>
            <input v-model="newValue" placeholder="e.g. printing"
              class="w-full rounded border border-outline-gray-2 px-3 py-2 font-mono text-sm focus:border-outline-blue-2 focus:outline-none" />
            <p class="mt-1 text-xs text-ink-gray-4">Exact Google Places API type code. Leave blank to rely on the label as a text search.</p>
          </div>
        </div>
      </template>
      <template #actions>
        <Button label="Cancel" variant="outline" @click="showAddDialog = false" />
        <Button label="Add" variant="solid" :disabled="!newLabel.trim()" @click="confirmAdd" />
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Button, Dialog, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

let _key = 0
const categories    = ref([])
const searchText    = ref('')
const statusFilter  = ref('all')
const selected      = ref(new Set())
const saving        = ref(false)
const showAddDialog = ref(false)
const newLabel      = ref('')
const newValue      = ref('')

const filtered = computed(() => {
  let list = categories.value
  const q = searchText.value.toLowerCase()
  if (q) list = list.filter(c => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
  if (statusFilter.value === 'active')   list = list.filter(c => c.active)
  if (statusFilter.value === 'inactive') list = list.filter(c => !c.active)
  return list
})

const activeCount          = computed(() => categories.value.filter(c => c.active).length)
const allVisibleSelected   = computed(() => filtered.value.length > 0 && filtered.value.every(c => selected.value.has(c._key)))
const someVisibleSelected  = computed(() => !allVisibleSelected.value && filtered.value.some(c => selected.value.has(c._key)))

onMounted(async () => {
  const rows = await call('prospecting.api.get_all_categories')
  categories.value = (rows || []).map(r => ({ ...r, _key: _key++ }))
})

function toggleRow(key) {
  const s = new Set(selected.value)
  s.has(key) ? s.delete(key) : s.add(key)
  selected.value = s
}

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    const s = new Set(selected.value)
    filtered.value.forEach(c => s.delete(c._key))
    selected.value = s
  } else {
    const s = new Set(selected.value)
    filtered.value.forEach(c => s.add(c._key))
    selected.value = s
  }
}

function setSelected(active) {
  const keys = selected.value
  categories.value.forEach(c => { if (keys.has(c._key)) c.active = active })
  selected.value = new Set()
}

function confirmAdd() {
  if (!newLabel.value.trim()) return
  categories.value.push({ label: newLabel.value.trim(), value: newValue.value.trim(), active: true, _key: _key++ })
  newLabel.value = ''
  newValue.value = ''
  showAddDialog.value = false
}

async function save() {
  const payload = categories.value
    .filter(c => c.label.trim())
    .map(({ label, value, active }) => ({ label, value, active }))
  saving.value = true
  try {
    await call('prospecting.api.save_categories', { categories: payload })
    toast.success('Saved')
  } catch (e) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>
