<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Select-all bar -->
    <div v-if="prospects.length"
      class="flex flex-shrink-0 items-center gap-2 border-b bg-surface-gray-1 px-4 py-2">
      <input type="checkbox"
        :checked="allSelected"
        :indeterminate.prop="someSelected && !allSelected"
        class="form-checkbox cursor-pointer"
        @click.stop="toggleSelectAll" />
      <span class="select-none text-xs text-ink-gray-5">
        {{ selected.size ? `${selected.size} selected` : 'Select all' }}
      </span>
    </div>

    <!-- Cards -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="p in prospects" :key="p.name"
        class="flex gap-3 border-b px-4 py-3 active:bg-surface-gray-1"
        :class="{ 'bg-surface-blue-1': selected.has(p.name) }"
        @click="emit('open', p.name)">

        <input type="checkbox"
          :checked="selected.has(p.name)"
          class="form-checkbox mt-0.5 cursor-pointer"
          @click.stop="toggleOne(p.name)" />

        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <span class="truncate text-sm font-medium text-ink-gray-9">{{ p.prospect_name }}</span>
            <span v-if="p.rating != null" class="flex-shrink-0 text-sm text-amber-500">
              ★ {{ Number(p.rating).toFixed(1) }}
            </span>
          </div>
          <p v-if="p.category" class="truncate text-xs text-ink-gray-6">{{ p.category }}</p>
          <p v-if="p.owner_name" class="truncate text-xs text-ink-gray-6">{{ p.owner_name }}</p>
          <p v-if="p._address_short" class="truncate text-xs text-ink-gray-5">{{ p._address_short }}</p>

          <!-- Quick contact actions -->
          <div v-if="p.mobile_no || p.email_id || p.website" class="mt-1.5 flex flex-wrap gap-3" @click.stop>
            <a v-if="p.mobile_no" :href="`tel:${p.mobile_no}`" class="text-xs text-ink-blue-2">Call</a>
            <a v-if="p.email_id" :href="`mailto:${p.email_id}`" class="text-xs text-ink-blue-2">Email</a>
            <a v-if="p.website" :href="p.website" target="_blank" rel="noreferrer" class="text-xs text-ink-blue-2">Website</a>
          </div>

          <!-- Status pill + overflow menu -->
          <div class="mt-2 flex items-center gap-2" @click.stop>
            <Dropdown :options="statuses.map(s => ({ label: s, onClick: () => emit('update-status', { name: p.name, status: s }) }))">
              <button class="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-ink-gray-7 hover:bg-surface-gray-2">
                <span :class="['size-2 rounded-full', statusColor(p.status)]" />
                {{ p.status || 'New' }}
              </button>
            </Dropdown>
            <Dropdown class="ml-auto" :options="rowMenu(p)" placement="bottom-end">
              <Button variant="ghost" icon="more-horizontal" size="sm" />
            </Dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selected.size"
      class="flex flex-shrink-0 items-center gap-2 border-t bg-surface-white px-4 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <span class="text-sm font-medium text-ink-gray-8">{{ selected.size }} selected</span>
      <Button variant="subtle" size="sm" label="Clear" class="ml-auto" @click="clearSelection" />
      <Dropdown :options="bulkActions([...selected], clearSelection)" placement="top-end">
        <Button variant="solid" size="sm" label="Actions" icon-right="chevron-down" />
      </Dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Dropdown } from 'frappe-ui'

const props = defineProps({
  prospects:   { type: Array,    default: () => [] },
  modelValue:  { type: Object,   default: () => new Set() }, // Set of selected names
  statuses:    { type: Array,    default: () => [] },
  statusColor: { type: Function, default: () => '' },
  rowMenu:     { type: Function, default: () => [] },
  bulkActions: { type: Function, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'open', 'update-status'])

const selected     = computed(() => props.modelValue)
const allSelected  = computed(() => props.prospects.length > 0 && selected.value.size === props.prospects.length)
const someSelected = computed(() => selected.value.size > 0)

function setSelected(s) { emit('update:modelValue', s) }
function toggleOne(name) {
  const s = new Set(selected.value)
  s.has(name) ? s.delete(name) : s.add(name)
  setSelected(s)
}
function toggleSelectAll() {
  setSelected(allSelected.value ? new Set() : new Set(props.prospects.map(p => p.name)))
}
function clearSelection() { setSelected(new Set()) }
</script>
