<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover }">
      <div class="flex items-center">
        <Button :label="'Filter'" icon-left="filter"
          :class="modelValue.length ? 'rounded-r-none' : ''"
          @click="togglePopover">
          <template v-if="modelValue.length" #suffix>
            <span class="flex size-5 items-center justify-center rounded bg-surface-white text-xs font-medium text-ink-gray-8 shadow-sm">
              {{ modelValue.length }}
            </span>
          </template>
        </Button>
        <Button v-if="modelValue.length" icon="x" class="rounded-l-none border-l"
          @click.stop="clearAll" />
      </div>
    </template>
    <template #body-main>
      <div class="min-w-[360px] p-2">
        <div v-if="modelValue.length" class="flex flex-col gap-2">
          <div v-for="(f, i) in modelValue" :key="i" class="flex items-center gap-1.5">
            <span class="w-10 text-sm text-ink-gray-5">{{ i === 0 ? 'Where' : 'And' }}</span>
            <Autocomplete
              class="w-32"
              :options="fieldOptions"
              :model-value="f.field"
              placeholder="Field"
              @update:model-value="v => setField(i, v)" />
            <FormControl
              class="w-24"
              type="select"
              :options="operatorsFor(f.field)"
              :model-value="f.operator"
              @update:model-value="v => update(i, 'operator', v)" />
            <component
              :is="valueIsSelect(f) ? 'select' : 'input'"
              v-if="!isUnary(f.operator)"
              class="form-input h-7 w-28 text-sm"
              :value="f.value"
              @change="e => update(i, 'value', e.target.value)">
              <template v-if="valueIsSelect(f)">
                <option v-for="o in valueOptions(f.field)" :key="o" :value="o">{{ o }}</option>
              </template>
            </component>
            <div v-else class="w-28" />
            <Button variant="ghost" icon="x" @click="remove(i)" />
          </div>
        </div>
        <div v-else class="px-1 py-2 text-sm text-ink-gray-5">No filters applied</div>
        <div class="mt-2 border-t pt-2">
          <Button variant="ghost" icon-left="plus" label="Add filter" @click="add" />
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Popover, Autocomplete, FormControl } from 'frappe-ui'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  fields:     { type: Array, default: () => [] },  // [{label,fieldname,fieldtype,options?}]
})
const emit = defineEmits(['update:modelValue', 'apply'])

const fieldOptions = computed(() =>
  props.fields.map(f => ({ label: f.label, value: f.fieldname })))

const TEXT_OPS   = ['like', 'not like', 'equals', 'not equals', 'is set', 'is not set']
const NUM_OPS    = ['=', '!=', '>', '<', '>=', '<=']
const SELECT_OPS = ['equals', 'not equals']
const DATE_OPS   = ['=', '>', '<', '>=', '<=']

function fieldDef(fieldname) { return props.fields.find(f => f.fieldname === fieldname) }
function operatorsFor(fieldname) {
  const t = fieldDef(fieldname)?.fieldtype
  if (t === 'Select') return SELECT_OPS
  if (['Int', 'Float', 'Currency'].includes(t)) return NUM_OPS
  if (t === 'Date') return DATE_OPS
  return TEXT_OPS
}
function isUnary(op) { return op === 'is set' || op === 'is not set' }
function valueIsSelect(f) { return fieldDef(f.field)?.fieldtype === 'Select' }
function valueOptions(fieldname) { return fieldDef(fieldname)?.options || [] }

function commit(next) {
  emit('update:modelValue', next)
  emit('apply')
}
function add() {
  const first = props.fields[0]
  commit([...props.modelValue, { field: first.fieldname, operator: operatorsFor(first.fieldname)[0], value: '' }])
}
function remove(i) { commit(props.modelValue.filter((_, idx) => idx !== i)) }
function clearAll() { commit([]) }
function update(i, key, val) {
  const next = props.modelValue.map((f, idx) => idx === i ? { ...f, [key]: val } : f)
  commit(next)
}
function setField(i, val) {
  const fieldname = val?.value ?? val
  const ops = operatorsFor(fieldname)
  const next = props.modelValue.map((f, idx) => idx === i ? { field: fieldname, operator: ops[0], value: '' } : f)
  commit(next)
}
</script>
