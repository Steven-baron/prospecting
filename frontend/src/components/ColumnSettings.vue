<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover }">
      <Button variant="subtle" label="Columns" icon-left="columns" @click="togglePopover" />
    </template>
    <template #body-main>
      <div class="min-w-[260px] p-1.5">
        <!-- Active columns: drag to reorder, × to remove -->
        <ul>
          <li
            v-for="(col, i) in active"
            :key="col.key"
            draggable="true"
            class="group flex items-center justify-between gap-6 rounded px-2 py-1.5 text-base text-ink-gray-8 hover:bg-surface-gray-2"
            :class="dragOverIndex === i ? 'border-t-2 border-outline-blue-2' : ''"
            @dragstart="onDragStart(i)"
            @dragover.prevent="dragOverIndex = i"
            @drop="onDrop(i)"
            @dragend="onDragEnd">
            <div class="flex items-center gap-2 cursor-grab">
              <FeatherIcon name="menu" class="size-3.5 text-ink-gray-4" />
              <span>{{ col.label }}</span>
            </div>
            <button
              v-if="col.key !== pinnedKey"
              class="opacity-0 group-hover:opacity-100 rounded p-0.5 text-ink-gray-5 hover:bg-surface-gray-3"
              @click="remove(col.key)">
              <FeatherIcon name="x" class="size-3.5" />
            </button>
          </li>
        </ul>

        <!-- Add column + reset -->
        <div class="mt-1.5 flex flex-col gap-1 border-t pt-1.5">
          <Dropdown v-if="addable.length" :options="addable.map(c => ({ label: c.label, onClick: () => add(c.key) }))">
            <Button class="w-full !justify-start !text-ink-gray-5" variant="ghost" label="Add Column" icon-left="plus" />
          </Dropdown>
          <Button
            v-if="!isDefault"
            class="w-full !justify-start !text-ink-gray-5"
            variant="ghost" label="Reset to Default" icon-left="rotate-ccw"
            @click="reset" />
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Button, Popover, Dropdown, FeatherIcon } from 'frappe-ui'

const props = defineProps({
  catalog:    { type: Array,  required: true },  // all selectable columns [{label,key,width}]
  defaults:   { type: Array,  required: true },  // default active keys, in order
  pinnedKey:  { type: String, default: 'prospect_name' },  // always-present, first, non-removable
  storageKey: { type: String, default: 'prospecting.columns' },
})
const emit = defineEmits(['update'])

function byKey(key) { return props.catalog.find(c => c.key === key) }

// Active = ordered list of column objects; persisted to localStorage.
const active = ref([])

function load() {
  let keys = props.defaults.slice()
  try {
    const saved = JSON.parse(localStorage.getItem(props.storageKey) || 'null')
    if (Array.isArray(saved) && saved.length) keys = saved
  } catch { /* ignore */ }
  // Ensure pinned key is present and first; drop unknown keys
  keys = keys.filter(k => byKey(k) && k !== props.pinnedKey)
  active.value = [byKey(props.pinnedKey), ...keys.map(byKey)].filter(Boolean)
}
load()

const isDefault = computed(() => {
  const cur = active.value.map(c => c.key).join(',')
  const def = [props.pinnedKey, ...props.defaults.filter(k => k !== props.pinnedKey)].join(',')
  return cur === def
})

const addable = computed(() => {
  const present = new Set(active.value.map(c => c.key))
  return props.catalog.filter(c => !present.has(c.key) && c.key !== props.pinnedKey)
})

function persistAndEmit() {
  localStorage.setItem(props.storageKey, JSON.stringify(active.value.map(c => c.key)))
  emit('update', active.value.slice())
}

function add(key)    { const c = byKey(key); if (c) { active.value.push(c); persistAndEmit() } }
function remove(key) { active.value = active.value.filter(c => c.key !== key); persistAndEmit() }
function reset() {
  localStorage.removeItem(props.storageKey)
  load()
  persistAndEmit()
}

// Native drag-and-drop reorder
const dragIndex     = ref(null)
const dragOverIndex = ref(null)
function onDragStart(i) { dragIndex.value = i }
function onDrop(i) {
  const from = dragIndex.value
  if (from == null || from === i) return
  const arr = active.value.slice()
  const [moved] = arr.splice(from, 1)
  arr.splice(i, 0, moved)
  // keep pinned column first
  arr.sort((a, b) => (a.key === props.pinnedKey ? -1 : b.key === props.pinnedKey ? 1 : 0))
  active.value = arr
  persistAndEmit()
}
function onDragEnd() { dragIndex.value = null; dragOverIndex.value = null }

// Emit initial set once mounted
watch(active, () => {}, { immediate: true })
emit('update', active.value.slice())
</script>
