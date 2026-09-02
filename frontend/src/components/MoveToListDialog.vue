<template>
  <Dialog v-model="show" :options="{ title, size: 'sm' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <Button
            :variant="mode === 'existing' ? 'solid' : 'subtle'"
            size="sm"
            :label="__('Existing list')"
            :disabled="!listOptions.length"
            @click="mode = 'existing'"
          />
          <Button
            :variant="mode === 'new' ? 'solid' : 'subtle'"
            size="sm"
            :label="__('New list')"
            @click="mode = 'new'"
          />
        </div>

        <div v-if="mode === 'existing'">
          <div
            v-if="listOptions.length"
            class="max-h-48 overflow-y-auto rounded-md border border-outline-gray-2"
          >
            <button
              v-for="o in listOptions"
              :key="o.value"
              type="button"
              class="flex w-full items-center justify-between border-b border-outline-gray-1 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-surface-gray-2"
              :class="
                targetList === o.value
                  ? 'bg-surface-gray-3 font-medium text-ink-gray-9'
                  : 'text-ink-gray-8'
              "
              @click="targetList = o.value"
            >
              <span>{{ o.label }}</span>
              <span v-if="targetList === o.value" class="text-xs text-ink-gray-5">{{ __('Selected') }}</span>
            </button>
          </div>
          <p v-else class="text-xs text-ink-gray-5">{{ __('No other lists — use "New list".') }}</p>
        </div>

        <TextInput
          v-else
          v-model="newListName"
          :placeholder="__('New list name')"
          @keydown.enter="confirm"
        />
      </div>
    </template>
    <template #actions="{ close }">
      <div class="flex justify-end gap-2">
        <Button :label="__('Cancel')" @click="close" />
        <Button variant="solid" :label="__('Move')" :loading="loading" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Dialog, Button, TextInput, toast } from 'frappe-ui'
import { call } from '../composables/api.js'
import { __ } from '../translation.js'

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  names:       { type: Array,  default: () => [] },
  lists:       { type: Array,  default: () => [] },
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

const title = computed(() => __('Move {0} prospect(s) to…', [props.names.length]))

const listOptions = computed(() =>
  props.lists
    .filter(l => l.name !== props.currentList)
    .map(l => ({ label: l.list_name || l.name, value: l.name }))
)

watch(show, (open) => {
  if (open) {
    mode.value = listOptions.value.length ? 'existing' : 'new'
    targetList.value = ''
    newListName.value = ''
  }
})

async function confirm() {
  if (mode.value === 'existing' && !targetList.value) { toast.warning(__('Pick a list.')); return }
  if (mode.value === 'new' && !newListName.value.trim()) { toast.warning(__('Enter a list name.')); return }
  loading.value = true
  try {
    const r = await call('prospecting.api.move_to_list', {
      prospect_names: props.names,
      target_list:    mode.value === 'existing' ? targetList.value : '',
      new_list_name:  mode.value === 'new' ? newListName.value.trim() : '',
    })
    toast.success(__('Moved {0} prospect(s)', [r.moved]))
    show.value = false
    emit('moved', r)
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>
