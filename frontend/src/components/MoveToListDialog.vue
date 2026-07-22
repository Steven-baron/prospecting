<template>
  <Dialog v-model="show" :options="{ title, size: 'sm' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <!-- Mode toggle -->
        <div class="flex gap-2">
          <Button
            :variant="mode === 'existing' ? 'solid' : 'subtle'"
            size="sm" label="Existing list" @click="mode = 'existing'" />
          <Button
            :variant="mode === 'new' ? 'solid' : 'subtle'"
            size="sm" label="New list" @click="mode = 'new'" />
        </div>

        <!-- Native select works inside Dialog (frappe-ui Select z-index issue) -->
        <select
          v-if="mode === 'existing'"
          v-model="targetList"
          class="form-input w-full rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm text-ink-gray-8"
        >
          <option disabled value="">Choose a list…</option>
          <option v-for="o in listOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>

        <!-- New list name -->
        <TextInput
          v-else
          v-model="newListName"
          placeholder="New list name"
          @keydown.enter="confirm" />
      </div>
    </template>
    <template #actions="{ close }">
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="close" />
        <Button variant="solid" label="Move" :loading="loading" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Dialog, Button, TextInput, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  names:       { type: Array,  default: () => [] },  // selected prospect names
  lists:       { type: Array,  default: () => [] },  // [{name, list_name}]
  currentList: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue', 'moved'])

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const mode        = ref('existing')
const targetList  = ref('')
const newListName = ref('')
const loading     = ref(false)

const title = computed(() => `Move ${props.names.length} prospect(s) to…`)

const listOptions = computed(() =>
  props.lists
    .filter(l => l.name !== props.currentList)
    .map(l => ({ label: l.list_name || l.name, value: l.name }))
)

// Reset fields each time the dialog opens
watch(show, (open) => {
  if (open) {
    mode.value = listOptions.value.length ? 'existing' : 'new'
    targetList.value = ''
    newListName.value = ''
  }
})

async function confirm() {
  if (mode.value === 'existing' && !targetList.value) { toast.warning('Pick a list.'); return }
  if (mode.value === 'new' && !newListName.value.trim()) { toast.warning('Enter a list name.'); return }
  loading.value = true
  try {
    const r = await call('prospecting.api.move_to_list', {
      prospect_names: props.names,
      target_list:    mode.value === 'existing' ? targetList.value : '',
      new_list_name:  mode.value === 'new' ? newListName.value.trim() : '',
    })
    toast.success(`Moved ${r.moved} prospect(s)`)
    show.value = false
    emit('moved', r)
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>
