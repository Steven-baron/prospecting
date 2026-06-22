<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Header -->
    <div class="flex-shrink-0 border-b bg-surface-white px-6 py-4">
      <h1 class="text-base font-semibold text-ink-gray-9">Settings</h1>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-8 max-w-2xl">

      <!-- Categories section -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-sm font-semibold text-ink-gray-9">Search Categories</h2>
            <p class="text-xs text-ink-gray-5 mt-0.5">
              Toggle which categories appear in the search dropdown.
              Active: {{ activeCount }} / {{ categories.length }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button label="Add category" variant="outline" size="sm" @click="addRow" />
            <Button label="Save" variant="solid" size="sm" :loading="saving" @click="save" />
          </div>
        </div>

        <!-- Search filter -->
        <input
          v-model="filterText"
          placeholder="Filter categories…"
          class="mb-3 w-full rounded border border-outline-gray-2 px-3 py-1.5 text-sm focus:border-outline-blue-2 focus:outline-none" />

        <!-- Category rows -->
        <div class="divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2 bg-surface-white">
          <div v-if="filteredCategories.length === 0" class="px-4 py-6 text-center text-sm text-ink-gray-4">
            No categories match "{{ filterText }}"
          </div>
          <div
            v-for="(cat, idx) in filteredCategories"
            :key="cat._key"
            class="flex items-center gap-3 px-4 py-2.5">
            <!-- Toggle -->
            <button
              :class="[
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                cat.active ? 'bg-ink-blue-2' : 'bg-surface-gray-4'
              ]"
              @click="cat.active = !cat.active">
              <span :class="[
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
                cat.active ? 'translate-x-4' : 'translate-x-0'
              ]" />
            </button>
            <!-- Label -->
            <input
              v-model="cat.label"
              placeholder="Display label"
              class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-ink-gray-8 hover:border-outline-gray-2 focus:border-outline-blue-2 focus:outline-none" />
            <!-- Google type code -->
            <input
              v-model="cat.value"
              placeholder="google_place_type"
              class="w-44 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-xs text-ink-gray-5 hover:border-outline-gray-2 focus:border-outline-blue-2 focus:outline-none" />
            <!-- Remove -->
            <button
              class="ml-1 text-ink-gray-3 hover:text-ink-red-3 transition-colors"
              @click="removeRow(cat._key)">
              <svg class="size-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <p v-if="saved" class="mt-2 text-xs text-ink-green-3">Saved successfully</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Button, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

let _key = 0
const categories  = ref([])
const filterText  = ref('')
const saving      = ref(false)
const saved       = ref(false)
let savedTimer    = null

const filteredCategories = computed(() => {
  const q = filterText.value.toLowerCase()
  return q
    ? categories.value.filter(c => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
    : categories.value
})

const activeCount = computed(() => categories.value.filter(c => c.active).length)

onMounted(async () => {
  const rows = await call('prospecting.api.get_all_categories')
  categories.value = (rows || []).map(r => ({ ...r, _key: _key++ }))
})

function addRow() {
  categories.value.push({ label: '', value: '', active: true, _key: _key++ })
  filterText.value = ''
}

function removeRow(key) {
  categories.value = categories.value.filter(c => c._key !== key)
}

async function save() {
  const payload = categories.value
    .filter(c => c.label.trim() && c.value.trim())
    .map(({ label, value, active }) => ({ label, value, active }))
  saving.value = true
  try {
    await call('prospecting.api.save_categories', { categories: payload })
    saved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { saved.value = false }, 2500)
    toast.success('Categories saved')
  } catch (e) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>
