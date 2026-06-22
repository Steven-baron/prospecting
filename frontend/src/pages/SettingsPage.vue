<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Header -->
    <div class="flex-shrink-0 border-b bg-surface-white px-6 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold text-ink-gray-9">Search Categories</h1>
        <p class="text-xs text-ink-gray-5 mt-0.5">
          {{ activeCount }} active · {{ categories.length }} total
        </p>
      </div>
      <Button label="Save" variant="solid" size="sm" :loading="saving" @click="save" />
    </div>

    <!-- Toolbar -->
    <div class="flex-shrink-0 border-b bg-surface-gray-1 px-6 py-2 flex items-center gap-3">
      <input
        v-model="filterText"
        placeholder="Search categories…"
        class="flex-1 rounded border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm focus:border-outline-blue-2 focus:outline-none" />
      <Button
        :label="filterText ? `Activate (${filteredCategories.length})` : 'Activate all'"
        variant="outline" size="sm"
        @click="setAll(true)" />
      <Button
        :label="filterText ? `Deactivate (${filteredCategories.length})` : 'Deactivate all'"
        variant="outline" size="sm"
        @click="setAll(false)" />
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      <div class="divide-y divide-outline-gray-1">

        <div v-if="filteredCategories.length === 0" class="px-6 py-10 text-center text-sm text-ink-gray-4">
          No categories match "{{ filterText }}"
        </div>

        <div
          v-for="cat in filteredCategories"
          :key="cat._key"
          class="flex items-center gap-4 px-6 py-2.5 hover:bg-surface-gray-1 cursor-pointer"
          @click="cat.active = !cat.active">

          <!-- Toggle -->
          <div :class="[
            'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
            cat.active ? 'bg-ink-blue-2' : 'bg-surface-gray-4'
          ]">
            <span :class="[
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
              cat.active ? 'translate-x-4' : 'translate-x-0'
            ]" />
          </div>

          <!-- Label -->
          <span :class="['flex-1 text-sm', cat.active ? 'text-ink-gray-9' : 'text-ink-gray-4']">
            {{ cat.label }}
          </span>

          <!-- Google type code -->
          <span class="font-mono text-xs text-ink-gray-3">{{ cat.value }}</span>
        </div>

      </div>
    </div>

    <!-- Footer: add custom + save feedback -->
    <div class="flex-shrink-0 border-t bg-surface-white px-6 py-3 flex items-center justify-between">
      <p class="text-xs text-ink-gray-4">
        To remove categories, go to Desk → Prospecting Settings.
      </p>
      <Button label="+ Add custom" variant="ghost" size="sm" @click="showAddDialog = true" />
    </div>

    <!-- Add custom category dialog -->
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
            <p class="mt-1 text-xs text-ink-gray-4">Must be an exact Google Places API type. Leave blank to use label as free-text search instead.</p>
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
const filterText    = ref('')
const saving        = ref(false)
const showAddDialog = ref(false)
const newLabel      = ref('')
const newValue      = ref('')

const filteredCategories = computed(() => {
  const q = filterText.value.toLowerCase()
  return q
    ? categories.value.filter(c =>
        c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
    : categories.value
})

const activeCount = computed(() => categories.value.filter(c => c.active).length)

onMounted(async () => {
  const rows = await call('prospecting.api.get_all_categories')
  categories.value = (rows || []).map(r => ({ ...r, _key: _key++ }))
})

function setAll(active) {
  const keys = new Set(filteredCategories.value.map(c => c._key))
  categories.value.forEach(c => { if (keys.has(c._key)) c.active = active })
}

function confirmAdd() {
  if (!newLabel.value.trim()) return
  categories.value.push({
    label: newLabel.value.trim(),
    value: newValue.value.trim(),
    active: true,
    _key: _key++,
  })
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
