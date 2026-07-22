<template>
  <!-- Lightweight searchable picker — no reka-ui Combobox (broken over map / empty values). -->
  <div ref="rootEl" class="relative w-full">
    <button
      type="button"
      class="form-input flex w-full items-center justify-between gap-2 rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-left text-sm text-ink-gray-8"
      :class="{ 'ring-2 ring-outline-gray-3': open }"
      @click="toggle"
    >
      <span class="truncate" :class="displayLabel ? 'text-ink-gray-8' : 'text-ink-gray-4'">
        {{ displayLabel || placeholder }}
      </span>
      <svg
        class="size-4 shrink-0 text-ink-gray-5 transition-transform"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-full z-[1400] mt-1 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white shadow-xl"
    >
      <div class="border-b border-outline-gray-1 p-1.5">
        <input
          ref="filterEl"
          v-model="query"
          type="text"
          class="form-input w-full rounded border border-outline-gray-2 px-2 py-1.5 text-sm"
          :placeholder="filterPlaceholder"
          @keydown.esc.prevent="close"
          @keydown.enter.prevent="pickFirst"
          @keydown.down.prevent="highlightNext(1)"
          @keydown.up.prevent="highlightNext(-1)"
        />
      </div>
      <ul class="max-h-56 overflow-y-auto py-1" role="listbox">
        <li v-if="emptyOption">
          <button
            type="button"
            class="flex w-full px-3 py-2 text-left text-sm hover:bg-surface-gray-2"
            :class="modelValue === '' ? 'bg-surface-gray-3 font-medium' : 'text-ink-gray-8'"
            @click="pick('', emptyOption)"
          >
            {{ emptyOption }}
          </button>
        </li>
        <li v-for="(opt, i) in filtered" :key="opt.value || opt.label">
          <button
            type="button"
            class="flex w-full px-3 py-2 text-left text-sm hover:bg-surface-gray-2"
            :class="[
              modelValue === opt.value ? 'bg-surface-gray-3 font-medium' : 'text-ink-gray-8',
              hi === i ? 'bg-surface-gray-2' : '',
            ]"
            @click="pick(opt.value, opt.label)"
            @mouseenter="hi = i"
          >
            {{ opt.label }}
          </button>
        </li>
        <li v-if="!filtered.length" class="px-3 py-2 text-sm text-ink-gray-5">
          No matches for “{{ query }}”
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: 'Select…' },
  filterPlaceholder: { type: String, default: 'Type to filter…' },
  /** Label for the empty-value option (e.g. "Any category"). Omit to hide. */
  emptyOption: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const query = ref('')
const hi = ref(0)
const rootEl = ref(null)
const filterEl = ref(null)

const displayLabel = computed(() => {
  if (!props.modelValue) return props.emptyOption || ''
  return props.options.find((o) => o.value === props.modelValue)?.label || props.modelValue
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const opts = props.options.filter((o) => o && o.label && o.value !== '' && o.value != null)
  if (!q) return opts
  return opts.filter((o) => String(o.label).toLowerCase().includes(q))
})

function toggle() {
  open.value ? close() : openPanel()
}

async function openPanel() {
  open.value = true
  query.value = ''
  hi.value = 0
  await nextTick()
  filterEl.value?.focus()
}

function close() {
  open.value = false
  query.value = ''
  hi.value = 0
}

function pick(value, _label) {
  emit('update:modelValue', value ?? '')
  close()
}

function pickFirst() {
  if (filtered.value[hi.value]) {
    const o = filtered.value[hi.value]
    pick(o.value, o.label)
  } else if (filtered.value[0]) {
    pick(filtered.value[0].value, filtered.value[0].label)
  } else if (props.emptyOption && !query.value.trim()) {
    pick('', props.emptyOption)
  }
}

function highlightNext(dir) {
  const n = filtered.value.length
  if (!n) return
  hi.value = (hi.value + dir + n) % n
}

function onDocPointer(e) {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(e.target)) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
})

watch(
  () => props.options,
  () => {
    hi.value = 0
  },
)
</script>
