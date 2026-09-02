<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover }">
      <Button :label="__('Sort')" icon-left="arrow-up-down" @click="togglePopover">
        <template v-if="modelValue.length" #suffix>
          <span class="flex size-5 items-center justify-center rounded bg-surface-white text-xs font-medium text-ink-gray-8 shadow-sm">
            {{ modelValue.length }}
          </span>
        </template>
      </Button>
    </template>
    <template #body-main>
      <div class="min-w-[300px] p-2">
        <div v-if="modelValue.length" class="flex flex-col gap-2">
          <div v-for="(s, i) in modelValue" :key="i" class="flex items-center gap-1.5">
            <Autocomplete
              class="w-40"
              :options="fieldOptions"
              :model-value="s.field"
              :placeholder="__('Field')"
              @update:model-value="v => update(i, 'field', v?.value ?? v)" />
            <FormControl
              class="w-28"
              type="select"
              :options="[{label: __('Asc'), value:'asc'}, {label: __('Desc'), value:'desc'}]"
              :model-value="s.dir"
              @update:model-value="v => update(i, 'dir', v)" />
            <Button variant="ghost" icon="x" @click="remove(i)" />
          </div>
        </div>
        <div v-else class="px-1 py-2 text-sm text-ink-gray-5">{{ __('No sorting applied') }}</div>
        <div class="mt-2 border-t pt-2">
          <Button variant="ghost" icon-left="plus" :label="__('Add sort')" @click="add" />
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Popover, Autocomplete, FormControl } from 'frappe-ui'
import { __ } from '../translation.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },  // [{field, dir}]
  fields:     { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'apply'])

const fieldOptions = computed(() =>
  props.fields.map(f => ({ label: f.label, value: f.fieldname })))

function commit(next) { emit('update:modelValue', next); emit('apply') }
function add() { commit([...props.modelValue, { field: props.fields[0].fieldname, dir: 'desc' }]) }
function remove(i) { commit(props.modelValue.filter((_, idx) => idx !== i)) }
function update(i, key, val) {
  commit(props.modelValue.map((s, idx) => idx === i ? { ...s, [key]: val } : s))
}
</script>
