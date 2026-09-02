<template>
  <Dialog v-model="show" :options="{ size: '2xl' }">
    <template #body-header>
      <div v-if="doc" class="mb-4 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-gray-3 text-sm font-semibold text-ink-gray-7">
            {{ (doc.prospect_name || '?').charAt(0).toUpperCase() }}
          </div>
          <input
            :value="doc.prospect_name"
            class="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-lg font-semibold text-ink-gray-9 hover:bg-surface-gray-2 focus:bg-surface-white focus:ring-1 focus:ring-outline-gray-3 focus:outline-none transition"
            @blur="e => saveField('prospect_name', e.target.value)"
            @keydown.enter="e => e.target.blur()" />
        </div>
        <div class="flex flex-shrink-0 items-center gap-0.5">
          <Dropdown :options="menuOptions" placement="bottom-end">
            <Button variant="ghost" icon="more-horizontal" />
          </Dropdown>
          <Button variant="ghost" icon="chevron-left" :disabled="!hasPrev" @click="emit('prev')" />
          <Button variant="ghost" icon="chevron-right" :disabled="!hasNext" @click="emit('next')" />
          <Button variant="ghost" icon="x" @click="emit('close')" />
        </div>
      </div>
    </template>
    <template #body-content>
      <div v-if="doc" class="flex flex-col">

        <!-- Action row: icon buttons + status -->
        <div class="mt-3 flex flex-wrap items-center gap-1">
          <Button v-if="doc.prospect_list" variant="subtle" size="sm" icon="list"
            :tooltip="__('View list')" @click="emit('go-to-list', doc.prospect_list)" />
          <a v-if="doc.google_maps_uri" :href="doc.google_maps_uri" target="_blank" rel="noreferrer">
            <Button variant="subtle" size="sm" icon="map-pin" :tooltip="__('Open in Google Maps')" />
          </a>
          <a v-if="doc.website" :href="doc.website" target="_blank" rel="noreferrer">
            <Button variant="subtle" size="sm" icon="globe" :tooltip="__('Open website')" />
          </a>
          <a v-if="doc.crm_lead" :href="`/crm/leads/${doc.crm_lead}`" target="_blank" rel="noreferrer">
            <Button variant="subtle" size="sm" icon="external-link" :tooltip="__('Open in CRM')" />
          </a>
          <Dropdown class="ml-auto" :options="STATUSES.map(s => ({ label: statusLabel(s), onClick: () => onStatus(s) }))">
            <button class="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-gray-8 hover:bg-surface-gray-2">
              <span :class="['size-2 rounded-full', statusColor(doc.status)]" />
              {{ statusLabel(doc.status) }}
            </button>
          </Dropdown>
        </div>

        <!-- Tabs -->
        <div class="mt-3 flex gap-1 border-b">
          <button v-for="t in TABS" :key="t.id"
            class="-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition"
            :class="tab === t.id ? 'border-outline-gray-4 text-ink-gray-9' : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7'"
            @click="tab = t.id">
            {{ t.label }}
          </button>
        </div>

        <!-- Tab content -->
        <div class="min-h-[260px] py-3">
          <!-- Details -->
          <div v-show="tab === 'Details'" class="flex flex-col gap-0.5">
            <FieldRow :label="__('Status')">
              <Dropdown :options="STATUSES.map(s => ({ label: statusLabel(s), onClick: () => onStatus(s) }))">
                <button class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-base text-ink-gray-8 hover:bg-surface-gray-2">
                  <span :class="['size-2 rounded-full', statusColor(doc.status)]" />
                  {{ statusLabel(doc.status) }}
                </button>
              </Dropdown>
            </FieldRow>
            <FieldRow :label="__('Category')"><EditText field="category" /></FieldRow>
            <FieldRow :label="__('Owner Name')"><EditText field="owner_name" /></FieldRow>
            <div v-if="ownerExamples.length" class="px-3 pb-1">
              <div v-for="ex in ownerExamples" :key="ex"
                class="mt-1 rounded bg-surface-gray-1 px-2.5 py-1.5 text-xs italic text-ink-gray-6 leading-relaxed">
                "{{ ex }}"
              </div>
            </div>
            <FieldRow :label="__('Town')"><EditText field="territory" /></FieldRow>
            <FieldRow :label="__('Source')"><EditText field="source" /></FieldRow>
            <FieldRow :label="__('Follow-up')"><EditText field="next_follow_up" type="date" /></FieldRow>
            <FieldRow :label="__('Rating')">
              <span v-if="doc.rating != null" class="px-2 text-sm">
                <span class="text-amber-500 font-medium">★ {{ Number(doc.rating).toFixed(1) }}</span>
                <span class="ml-1 text-xs text-ink-gray-5">({{ __('{0} reviews', [doc.review_count || 0]) }})</span>
              </span>
              <span v-else class="px-2 text-sm text-ink-gray-4">—</span>
            </FieldRow>
          </div>

          <!-- Contact -->
          <div v-show="tab === 'Contact'" class="flex flex-col gap-0.5">
            <FieldRow :label="__('Phone')"><EditText field="mobile_no" /></FieldRow>
            <FieldRow :label="__('Email')">
              <div class="flex items-center gap-1">
                <div class="min-w-0 flex-1"><EditText field="email_id" /></div>
                <Button variant="ghost" size="sm" icon="search" :loading="findingEmail"
                  :tooltip="__('Find email')" @click="findEmail" />
              </div>
            </FieldRow>
            <FieldRow :label="__('Website')"><EditText field="website" /></FieldRow>
            <FieldRow :label="__('Contact')"><EditText field="contact_person" /></FieldRow>
            <FieldRow :label="__('Designation')"><EditText field="designation" /></FieldRow>
            <div class="px-3 pt-2">
              <p class="mb-1 text-sm text-ink-gray-5">{{ __('Address') }}</p>
              <textarea
                :value="doc.address"
                rows="2"
                :placeholder="__('Add address...')"
                class="w-full resize-none rounded border border-transparent bg-transparent px-2 py-1 text-sm text-ink-gray-8 placeholder-ink-gray-5 focus:border-outline-gray-3 focus:bg-surface-white focus:outline-none transition"
                @blur="e => saveField('address', e.target.value)" />
              <a v-if="doc.google_maps_uri" :href="doc.google_maps_uri" target="_blank" rel="noreferrer" class="mt-1 inline-block">
                <Button :label="__('View on Google Maps')" variant="outline" size="sm" />
              </a>
            </div>
          </div>

          <!-- Notes -->
          <div v-show="tab === 'Notes'" class="px-1">
            <textarea
              v-model="localNotes"
              rows="9"
              :placeholder="__('Add notes about this prospect…')"
              class="w-full resize-none rounded border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-8 placeholder-ink-gray-3 focus:border-outline-blue-2 focus:outline-none transition-colors"
              @blur="saveNotes" />
            <p v-if="notesSaved" class="mt-1 text-xs text-ink-green-3">{{ __('Saved') }}</p>
          </div>
        </div>

        <!-- Inline delete confirm (triggered from the ⋯ menu) -->
        <div v-if="confirmingDelete" class="flex items-center gap-2 border-t pt-3">
          <span class="text-sm text-ink-gray-7">{{ __('Delete this prospect? (can re-import later)') }}</span>
          <Button :label="__('Cancel')" variant="subtle" size="sm" class="ml-auto" @click="confirmingDelete = false" />
          <Button :label="__('Delete')" variant="solid" theme="red" size="sm" @click="emit('delete', doc.name)" />
        </div>

      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { prospectingApi } from '@/api/prospecting'
import { ref, computed, watch, h } from 'vue'
import { Dialog, Button, Dropdown, FormControl, toast } from 'frappe-ui'
import { call } from '@/composables/api.js'

const props = defineProps({
  doc:     { type: Object,  default: null },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'delete', 'status-updated', 'field-updated', 'prev', 'next', 'go-to-list', 'action'])

// ⋯ menu — full single-record action set
const menuOptions = computed(() => {
  const o = [
    { label: __('Push to CRM'), icon: 'external-link', onClick: pushOneToCRM },
    { label: __('Find Owner Names'), icon: 'user', onClick: findOwnerNames },
  ]
  if (props.doc?.status === 'Dismissed')
    o.push({ label: __('Restore'), icon: 'rotate-ccw', onClick: () => emit('action', 'restore') })
  else
    o.push({ label: __('Dismiss'), icon: 'eye-off', onClick: () => emit('action', 'dismiss') })
  o.push({ label: __('Move to list'), icon: 'corner-up-right', onClick: () => emit('action', 'move') })
  if (props.doc?.prospect_list)
    o.push({ label: __('Remove from list'), icon: 'x', onClick: () => emit('action', 'remove') })
  o.push({ label: __('Delete (allow re-import)'), icon: 'trash-2', theme: 'red', onClick: () => { confirmingDelete.value = true } })
  return o
})

const show = computed({
  get: () => !!props.doc,
  set: (v) => { if (!v) emit('close') },
})

const TABS = [
  { id: 'Details', label: __('Details') },
  { id: 'Contact', label: __('Contact') },
  { id: 'Notes', label: __('Notes') },
]
const tab = ref('Details')

const STATUSES = ['New', 'Lead', 'Dismissed']
const STATUS_COLORS = { New: 'bg-gray-400', Lead: 'bg-green-500', Dismissed: 'bg-red-400' }
function statusColor(s) { return STATUS_COLORS[s] || 'bg-gray-300' }
function statusLabel(s) {
  if (s === 'Lead') return __('Lead')
  if (s === 'Dismissed') return __('Dismissed')
  return __('New')
}

const findingEmail    = ref(false)
const localNotes      = ref('')
const notesSaved      = ref(false)
const pushingOne      = ref(false)
const confirmingDelete = ref(false)
let notesSavedTimer = null

const ownerExamples = computed(() => {
  try { return JSON.parse(props.doc?.owner_name_context || '[]') } catch { return [] }
})

watch(() => props.doc?.name, () => {
  localNotes.value = props.doc?.notes || ''
  notesSaved.value = false
  confirmingDelete.value = false  // reset on navigate / new prospect
  tab.value = 'Details'  // reset to first tab when navigating to another prospect
}, { immediate: true })

async function saveField(key, value) {
  value = value ?? ''
  if ((props.doc[key] ?? '') === value) return
  try {
    await call('frappe.client.set_value', { doctype: 'Prospect', name: props.doc.name, fieldname: key, value })
    props.doc[key] = value
    emit('field-updated', { name: props.doc.name, key, value })
  } catch (e) {
    toast.error(__('Failed to save {0}', [key]))
  }
}

const FieldRow = (p, { slots }) =>
  h('div', { class: 'field flex items-center gap-2 px-2 leading-5' }, [
    h('div', { class: 'w-[32%] min-w-20 shrink-0 truncate text-sm text-ink-gray-5' }, p.label),
    h('div', { class: 'w-[68%] min-w-0' }, slots.default?.()),
  ])
FieldRow.props = ['label']

// CRM-style inline field: looks like plain text, becomes an input on focus.
const EditText = (p) =>
  h('div', { class: 'form-control' }, [
    h(FormControl, {
      type: p.type === 'date' ? 'date' : 'text',
      size: 'sm',
      modelValue: props.doc?.[p.field] ?? '',
      placeholder: FIELD_PLACEHOLDERS[p.field] || '',
      onChange: (e) => saveField(p.field, e?.target ? e.target.value : e),
    }),
  ])
EditText.props = ['field', 'type']

const FIELD_PLACEHOLDERS = {
  category: __('Add category...'),
  owner_name: __('Add owner name...'),
  territory: __('Add territory...'),
  source: __('Add source...'),
  next_follow_up: __('Add next follow up...'),
  mobile_no: __('Add mobile no...'),
  email_id: __('Add email id...'),
  website: __('Add website...'),
  contact_person: __('Add contact person...'),
  designation: __('Add designation...'),
}

async function onStatus(status) {
  await call('frappe.client.set_value', { doctype: 'Prospect', name: props.doc.name, fieldname: 'status', value: status })
  props.doc.status = status
  emit('status-updated', { name: props.doc.name, status })
}

const findingOwners = ref(false)
async function findOwnerNames() {
  if (!props.doc) return
  findingOwners.value = true
  const tid = toast.create({ message: __('Finding owner name…'), type: 'info', duration: 600 })
  try {
    const r = await call(prospectingApi.findOwnerNames, { prospect_names: [props.doc.name] })
    const data = r.results?.[props.doc.name]
    if (data?.owner_name) {
      props.doc.owner_name = data.owner_name
      props.doc.owner_name_context = JSON.stringify(data.examples || [])
      emit('field-updated', { name: props.doc.name, key: 'owner_name', value: data.owner_name })
      toast.success(__('Owner: {0}', [data.owner_name]))
    } else if (r.errors?.length) {
      toast.error(r.errors[0].error)
    } else {
      toast.warning(__('No owner name found.'))
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    toast.remove(tid)
    findingOwners.value = false
  }
}

async function findEmail() {
  if (!props.doc) return
  findingEmail.value = true
  try {
    const r = await call(prospectingApi.enrichEmail, { prospect: props.doc.name })
    if (r?.email) {
      props.doc.email_id = r.email
      emit('field-updated', { name: props.doc.name, key: 'email_id', value: r.email })
      toast.success(__('Found: {0}', [r.email]))
    } else {
      toast.warning(r?.reason || __('No email found.'))
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    findingEmail.value = false
  }
}

async function saveNotes() {
  if (!props.doc || localNotes.value === (props.doc.notes || '')) return
  try {
    await call('frappe.client.set_value', { doctype: 'Prospect', name: props.doc.name, fieldname: 'notes', value: localNotes.value })
    props.doc.notes = localNotes.value
    notesSaved.value = true
    clearTimeout(notesSavedTimer)
    notesSavedTimer = setTimeout(() => { notesSaved.value = false }, 2000)
  } catch (e) {
    toast.error(__('Failed to save notes'))
  }
}

async function pushOneToCRM() {
  if (!props.doc) return
  await saveNotes()
  pushingOne.value = true
  try {
    const r = await call(prospectingApi.pushToCrm, { prospect_names: [props.doc.name] })
    if (r.created) {
      toast.success(__('Lead created in CRM'))
      props.doc.status = 'Lead'
      props.doc.crm_lead = r.lead_names?.[props.doc.name] || props.doc.crm_lead
      emit('status-updated', { name: props.doc.name, status: 'Lead' })
    } else if (r.skipped) {
      toast.warning(__('Lead already exists in CRM'))
    } else if (r.errors?.length) {
      toast.error(r.errors[0].error)
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    pushingOne.value = false
  }
}
</script>

<style scoped>
/* CRM-style inline fields: transparent at rest (look like plain text),
   the FormControl's own focus border returns when the input is focused. */
.form-control {
  margin: 1px 0;
}
:deep(.form-control input:not([type='checkbox'])),
:deep(.form-control select),
:deep(.form-control button) {
  border-color: transparent;
  background: transparent;
}
</style>
