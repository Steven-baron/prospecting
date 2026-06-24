<template>
  <div :class="['pm-detail-panel', { open: !!doc }]">
    <div v-if="doc" class="pm-detail-inner">

      <!-- Header -->
      <div class="flex items-start justify-between gap-2 border-b px-4 py-3 flex-shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-gray-3 text-sm font-semibold text-ink-gray-7">
            {{ (doc.prospect_name || '?').charAt(0).toUpperCase() }}
          </div>
          <input
            :value="doc.prospect_name"
            class="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-base font-semibold text-ink-gray-9 hover:bg-surface-gray-2 focus:bg-surface-white focus:ring-1 focus:ring-outline-gray-3 focus:outline-none transition"
            @blur="e => saveField('prospect_name', e.target.value)"
            @keydown.enter="e => e.target.blur()" />
        </div>
        <Button variant="ghost" icon="x" @click="emit('close')" />
      </div>

      <!-- Quick action icons -->
      <div class="flex items-center gap-1 border-b px-4 py-2 flex-shrink-0">
        <Button variant="subtle" size="sm" :loading="findingEmail"
          label="✦ Find email" @click="findEmail" />
        <a v-if="doc.google_maps_uri" :href="doc.google_maps_uri" target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" icon="map-pin" />
        </a>
        <a v-if="doc.crm_lead" :href="`/crm/leads/${doc.crm_lead}`" target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" icon="external-link" />
        </a>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto">

        <!-- Details -->
        <Section label="Details">
          <FieldRow label="Status">
            <Dropdown :options="STATUSES.map(s => ({ label: s, onClick: () => onStatus(s) }))">
              <button class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-base text-ink-gray-8 hover:bg-surface-gray-2">
                <span :class="['size-2 rounded-full', statusColor(doc.status)]" />
                {{ doc.status || 'New' }}
              </button>
            </Dropdown>
          </FieldRow>
          <FieldRow label="Category"><EditText field="category" /></FieldRow>
          <FieldRow label="Owner Name"><EditText field="owner_name" /></FieldRow>
          <div v-if="ownerExamples.length" class="px-3 pb-1">
            <div v-for="ex in ownerExamples" :key="ex"
              class="mt-1 rounded bg-surface-gray-1 px-2.5 py-1.5 text-xs italic text-ink-gray-6 leading-relaxed">
              "{{ ex }}"
            </div>
          </div>
          <FieldRow label="Source"><EditText field="source" /></FieldRow>
          <FieldRow label="Territory"><EditText field="territory" /></FieldRow>
          <FieldRow label="Follow-up"><EditText field="next_follow_up" type="date" /></FieldRow>
          <FieldRow label="Rating">
            <span v-if="doc.rating != null" class="px-2 text-sm">
              <span class="text-amber-500 font-medium">★ {{ Number(doc.rating).toFixed(1) }}</span>
              <span class="ml-1 text-xs text-ink-gray-5">({{ doc.review_count || 0 }} reviews)</span>
            </span>
            <span v-else class="px-2 text-sm text-ink-gray-4">—</span>
          </FieldRow>
        </Section>

        <!-- Contact -->
        <Section label="Contact">
          <FieldRow label="Phone"><EditText field="mobile_no" /></FieldRow>
          <FieldRow label="Email"><EditText field="email_id" /></FieldRow>
          <FieldRow label="Website"><EditText field="website" /></FieldRow>
          <FieldRow label="Contact"><EditText field="contact_person" /></FieldRow>
          <FieldRow label="Designation"><EditText field="designation" /></FieldRow>
        </Section>

        <!-- Location -->
        <Section label="Location">
          <div class="px-3 py-1">
            <textarea
              :value="doc.address"
              rows="2"
              placeholder="Add address..."
              class="w-full resize-none rounded bg-transparent px-2 py-1 text-sm text-ink-gray-8 placeholder-ink-gray-4 hover:bg-surface-gray-2 focus:bg-surface-white focus:ring-1 focus:ring-outline-gray-3 focus:outline-none transition"
              @blur="e => saveField('address', e.target.value)" />
          </div>
          <div v-if="doc.google_maps_uri" class="px-3 pb-2">
            <a :href="doc.google_maps_uri" target="_blank" rel="noreferrer">
              <Button label="View on Google Maps" variant="outline" class="w-full justify-center" />
            </a>
          </div>
        </Section>

        <!-- Notes -->
        <Section label="Notes">
          <div class="px-3 py-1">
            <textarea
              v-model="localNotes"
              rows="4"
              placeholder="Add notes about this prospect…"
              class="w-full resize-none rounded border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-8 placeholder-ink-gray-3 focus:border-outline-blue-2 focus:outline-none transition-colors"
              @blur="saveNotes" />
            <p v-if="notesSaved" class="mt-1 text-xs text-ink-green-3">Saved</p>
          </div>
        </Section>

      </div>

      <!-- Footer -->
      <div class="border-t px-4 py-3 flex gap-2 flex-shrink-0">
        <Button label="Push to CRM" variant="solid" size="sm" :loading="pushingOne"
          @click="pushOneToCRM" />
        <Button label="Delete" variant="subtle" theme="red" size="sm"
          @click="emit('delete', doc.name)" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import { Button, Dropdown, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

const props = defineProps({
  doc: { type: Object, default: null },
})
const emit = defineEmits(['close', 'delete', 'status-updated', 'field-updated'])

const STATUSES     = ['New', 'Lead', 'Dismissed']
const STATUS_COLORS = { New: 'bg-gray-400', Lead: 'bg-green-500', Dismissed: 'bg-red-400' }
function statusColor(s) { return STATUS_COLORS[s] || 'bg-gray-300' }

const findingEmail = ref(false)
const localNotes   = ref('')
const notesSaved   = ref(false)
const pushingOne   = ref(false)
let notesSavedTimer = null

const ownerExamples = computed(() => {
  try { return JSON.parse(props.doc?.owner_name_context || '[]') } catch { return [] }
})

watch(() => props.doc, (d) => {
  localNotes.value = d?.notes || ''
  notesSaved.value = false
}, { immediate: true })

async function saveField(key, value) {
  value = value ?? ''
  if ((props.doc[key] ?? '') === value) return
  try {
    await call('frappe.client.set_value', {
      doctype: 'Prospect', name: props.doc.name, fieldname: key, value,
    })
    props.doc[key] = value
    emit('field-updated', { name: props.doc.name, key, value })
  } catch (e) {
    toast.error(`Failed to save ${key}`)
  }
}

// Inline editable text field (renders a subtle input that saves on blur/Enter).
const FieldRow = (props_, { slots }) =>
  h('div', { class: 'field flex items-center gap-2 px-2 leading-5 first:mt-2' }, [
    h('div', { class: 'w-[35%] min-w-20 shrink-0 truncate text-sm text-ink-gray-5' }, props_.label),
    h('div', { class: 'w-[65%] min-w-0' }, slots.default?.()),
  ])
FieldRow.props = ['label']

const EditText = (p) =>
  h('input', {
    type: p.type || 'text',
    value: props.doc?.[p.field] ?? '',
    placeholder: `Add ${p.placeholder || p.field.replace(/_/g, ' ')}...`,
    class: 'w-full rounded bg-transparent px-2 py-1 text-base text-ink-gray-8 placeholder-ink-gray-4 hover:bg-surface-gray-2 focus:bg-surface-white focus:ring-1 focus:ring-outline-gray-3 focus:outline-none transition',
    onBlur: (e) => saveField(p.field, e.target.value),
    onKeydown: (e) => { if (e.key === 'Enter') e.target.blur() },
  })
EditText.props = ['field', 'type', 'placeholder']

// Simple collapsible section.
const Section = (p, { slots }) => {
  return h('div', { class: 'border-b' }, [
    h('div', { class: 'px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5' }, p.label),
    h('div', { class: 'pb-2 flex flex-col gap-0.5' }, slots.default?.()),
  ])
}
Section.props = ['label']

async function onStatus(status) {
  await call('frappe.client.set_value', {
    doctype: 'Prospect', name: props.doc.name, fieldname: 'status', value: status,
  })
  props.doc.status = status
  emit('status-updated', { name: props.doc.name, status })
}

async function findEmail() {
  if (!props.doc) return
  findingEmail.value = true
  try {
    const r = await call('prospecting.api.enrich_email', { prospect: props.doc.name })
    if (r?.email) {
      props.doc.email_id = r.email
      emit('field-updated', { name: props.doc.name, key: 'email_id', value: r.email })
      toast.success(`Found: ${r.email}`)
    } else {
      toast.warning(r?.reason || 'No email found.')
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
    await call('frappe.client.set_value', {
      doctype: 'Prospect', name: props.doc.name, fieldname: 'notes', value: localNotes.value,
    })
    props.doc.notes = localNotes.value
    notesSaved.value = true
    clearTimeout(notesSavedTimer)
    notesSavedTimer = setTimeout(() => { notesSaved.value = false }, 2000)
  } catch (e) {
    toast.error('Failed to save notes')
  }
}

async function pushOneToCRM() {
  if (!props.doc) return
  await saveNotes()
  pushingOne.value = true
  try {
    const r = await call('prospecting.api.push_to_crm', { prospect_names: [props.doc.name] })
    if (r.created) {
      toast.success('Lead created in CRM')
      props.doc.status = 'Lead'
      props.doc.crm_lead = r.lead_names?.[props.doc.name] || props.doc.crm_lead
      emit('status-updated', { name: props.doc.name, status: 'Lead' })
    } else if (r.skipped) {
      toast.warning('Lead already exists in CRM')
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
