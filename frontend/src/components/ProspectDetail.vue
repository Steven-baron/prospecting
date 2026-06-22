<template>
  <div :class="['pm-detail-panel', { open: !!doc }]">
    <div v-if="doc" class="pm-detail-inner">

      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
        <span class="truncate text-sm font-semibold text-ink-gray-9">{{ doc.prospect_name }}</span>
        <Button variant="ghost" icon="x" @click="emit('close')" />
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <!-- Status -->
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Status</p>
          <Select
            :options="STATUSES"
            :model-value="doc.status"
            size="sm"
            variant="subtle"
            @update:model-value="onStatus" />
        </div>

        <!-- Category -->
        <div v-if="doc.category">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Category</p>
          <Badge :label="doc.category" theme="gray" />
        </div>

        <!-- Rating -->
        <div v-if="doc.rating != null">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Rating</p>
          <span class="text-amber-500 font-medium">★ {{ Number(doc.rating).toFixed(1) }}</span>
          <span class="ml-1 text-xs text-ink-gray-5">({{ doc.review_count || 0 }} reviews)</span>
        </div>

        <!-- Address -->
        <div v-if="doc.address">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Address</p>
          <p class="text-sm text-ink-gray-7">{{ doc.address }}</p>
        </div>

        <!-- Phone -->
        <div v-if="doc.mobile_no">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Phone</p>
          <a :href="`tel:${doc.mobile_no}`" class="text-sm text-ink-blue-2">{{ doc.mobile_no }}</a>
        </div>

        <!-- Email -->
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Email</p>
          <div class="flex items-center gap-2">
            <a v-if="doc.email_id" :href="`mailto:${doc.email_id}`" class="text-sm text-ink-blue-2 truncate">{{ doc.email_id }}</a>
            <span v-else class="text-sm text-ink-gray-4">None found</span>
            <Button
              variant="ghost"
              size="sm"
              :label="findingEmail ? '…' : '✦ Find'"
              :loading="findingEmail"
              @click="findEmail" />
          </div>
        </div>

        <!-- Website -->
        <div v-if="doc.website">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Website</p>
          <a :href="doc.website" target="_blank" rel="noreferrer"
            class="text-sm text-ink-blue-2 break-all">{{ doc.website }}</a>
        </div>

        <!-- Google Maps link -->
        <div v-if="doc.google_maps_uri">
          <a :href="doc.google_maps_uri" target="_blank" rel="noreferrer">
            <Button label="View on Google Maps" variant="outline" class="w-full justify-center" />
          </a>
        </div>

        <!-- Notes -->
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">Notes</p>
          <textarea
            v-model="localNotes"
            rows="4"
            placeholder="Add notes about this prospect…"
            class="w-full resize-none rounded border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-8 placeholder-ink-gray-3 focus:border-outline-blue-2 focus:outline-none transition-colors"
            @blur="saveNotes" />
          <p v-if="notesSaved" class="mt-1 text-xs text-ink-green-3">Saved</p>
        </div>

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
import { ref, watch } from 'vue'
import { Button, Badge, Select, toast } from 'frappe-ui'
import { call } from '../composables/api.js'

const props = defineProps({
  doc: { type: Object, default: null },
})
const emit = defineEmits(['close', 'delete', 'status-updated'])

const STATUSES     = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']
const findingEmail = ref(false)
const localNotes   = ref('')
const notesSaved   = ref(false)
const pushingOne   = ref(false)
let notesSavedTimer = null

watch(() => props.doc, (d) => {
  localNotes.value = d?.notes || ''
  notesSaved.value = false
}, { immediate: true })

async function onStatus(status) {
  await call('frappe.client.set_value', {
    doctype: 'Prospect', name: props.doc.name, fieldname: 'status', value: status,
  })
  emit('status-updated', { name: props.doc.name, status })
}

async function findEmail() {
  if (!props.doc) return
  findingEmail.value = true
  try {
    const r = await call('prospecting.api.enrich_email', { prospect: props.doc.name })
    if (r?.email) {
      props.doc.email_id = r.email
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
      doctype: 'Prospect',
      name: props.doc.name,
      fieldname: 'notes',
      value: localNotes.value,
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
  // Save unsaved notes first
  await saveNotes()
  pushingOne.value = true
  try {
    const r = await call('prospecting.api.push_to_crm', { prospect_names: [props.doc.name] })
    if (r.created) {
      toast.success('Lead created in CRM')
      props.doc.status = 'Qualified'
      emit('status-updated', { name: props.doc.name, status: 'Qualified' })
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
