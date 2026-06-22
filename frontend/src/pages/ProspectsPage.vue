<template>
  <div class="flex flex-1 flex-col overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between border-b px-5 py-3 flex-shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold text-ink-gray-9">{{ pageTitle }}</h1>
        <Badge v-if="prospects.length" :label="String(prospects.length)" theme="gray" size="sm" />
      </div>
      <div class="flex gap-2">
        <Button v-if="listName" label="Delete list" variant="subtle"
          class="text-ink-red-3" @click="confirmDeleteList" />
        <Button label="Find Prospects" variant="solid" icon-left="search"
          @click="router.push('/search')" />
      </div>
    </div>

    <!-- Content row -->
    <div class="flex flex-1 overflow-hidden">

      <!-- List view -->
      <div class="relative flex flex-1 flex-col overflow-hidden">
        <ListView v-if="prospects.length || loading"
          :columns="columns"
          :rows="prospects"
          row-key="name"
          :options="{
            onRowClick: row => openDetail(row.name),
            showTooltip: false,
            selectable: true,
            enableActive: true,
            rowHeight: 40,
            emptyState: { title: 'No prospects', description: '' },
          }"
          @update:selections="sel => (selectedRows = sel)">

          <template #default="{ selectable }">
            <ListHeader />
            <ListRows v-if="prospects.length" />
            <ListEmptyState v-else />
            <ListSelectBanner v-if="selectable">
              <template #actions="{ selections, unselectAll }">
                <div class="flex items-center gap-2">
                  <Button
                    v-if="listName"
                    label="Remove from list"
                    variant="subtle"
                    size="sm"
                    :loading="removing"
                    @click="doRemoveFromList([...selections], unselectAll)" />
                  <Button
                    label="Push to CRM"
                    variant="solid"
                    size="sm"
                    :loading="pushing"
                    @click="doPushToCRM([...selections], unselectAll)" />
                </div>
              </template>
            </ListSelectBanner>
          </template>

          <template #cell="{ column, row, item }">
            <!-- Status cell — inline select -->
            <div v-if="column.key === 'status'" @click.stop>
              <Select
                :options="STATUSES"
                :model-value="item"
                size="sm"
                variant="subtle"
                @update:model-value="v => updateStatus(row.name, v)" />
            </div>
            <!-- Rating cell -->
            <span v-else-if="column.key === 'rating'" class="text-amber-500 text-sm">
              {{ item != null ? `★ ${Number(item).toFixed(1)}` : '—' }}
            </span>
            <!-- Row actions (ellipsis) -->
            <div v-else-if="column.key === '_actions'" class="flex justify-end" @click.stop>
              <Dropdown :options="rowMenuOptions(row)" placement="right">
                <template #default="{ open }">
                  <Button
                    icon="more-horizontal"
                    variant="ghost"
                    size="sm"
                    :class="open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'" />
                </template>
              </Dropdown>
            </div>
            <!-- Default text cell -->
            <span v-else class="truncate text-sm">{{ item ?? '—' }}</span>
          </template>

        </ListView>

        <!-- Empty state -->
        <div v-if="!loading && !prospects.length" class="flex flex-1 flex-col items-center justify-center gap-3 text-ink-gray-5">
          <div class="text-4xl opacity-40">👥</div>
          <p class="font-medium text-ink-gray-7">No prospects yet</p>
          <p class="text-sm">Use Find Prospects to search for businesses.</p>
          <Button label="Find Prospects" variant="solid" @click="router.push('/search')" />
        </div>

        <!-- Load more -->
        <div v-if="hasMore && !loading" class="flex justify-center border-t p-3">
          <Button label="Load more" variant="subtle" @click="loadMore" />
        </div>
      </div>

      <!-- Slide-over detail panel -->
      <ProspectDetail
        :doc="openDoc"
        @close="openDoc = null"
        @delete="deleteProspect"
        @status-updated="onStatusUpdated" />

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ListView, ListHeader, ListRows, ListEmptyState, ListSelectBanner,
  Button, Badge, Select, Dropdown, toast,
} from 'frappe-ui'
import ProspectDetail from '../components/ProspectDetail.vue'
import { call } from '../composables/api.js'

const props = defineProps({
  listName: { type: String, default: null },
})

const router      = useRouter()
const lists       = inject('lists', ref([]))
const reloadLists = inject('reloadLists', () => {})

const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']

const columns = [
  { label: 'Business Name', key: 'prospect_name', width: '220px' },
  { label: 'Category',      key: 'category',      width: '130px' },
  { label: 'Address',       key: '_address_short', width: '200px' },
  { label: 'Phone',         key: 'mobile_no',      width: '140px' },
  { label: 'Rating',        key: 'rating',         width: '80px'  },
  { label: 'Status',        key: 'status',         width: '130px' },
  { label: '',              key: '_actions',        width: '40px'  },
]

const prospects    = ref([])
const loading      = ref(false)
const hasMore      = ref(false)
const start        = ref(0)
const openDoc      = ref(null)
const selectedRows = ref(new Set())
const removing     = ref(false)
const pushing      = ref(false)

const pageTitle = computed(() => {
  if (!props.listName) return 'All Prospects'
  return lists.value.find(l => l.name === props.listName)?.list_name || props.listName
})

function rowMenuOptions(row) {
  const opts = [
    {
      label: 'Push to CRM',
      icon: 'external-link',
      onClick: () => doPushToCRM([row.name], null),
    },
  ]
  if (props.listName) {
    opts.push({
      label: 'Remove from list',
      icon: 'x',
      onClick: () => doRemoveFromList([row.name], null),
    })
  }
  opts.push({
    label: 'Delete',
    icon: 'trash-2',
    theme: 'red',
    onClick: () => deleteProspect(row.name),
  })
  return opts
}

watch(() => props.listName, () => reload())
onMounted(reload)

async function reload() {
  prospects.value    = []
  start.value        = 0
  hasMore.value      = false
  openDoc.value      = null
  selectedRows.value = new Set()
  await loadPage(true)
}

async function loadMore() { await loadPage(false) }

async function loadPage(reset) {
  loading.value = true
  try {
    const filters = props.listName ? [['prospect_list', '=', props.listName]] : []
    const rows = await call('frappe.client.get_list', {
      doctype: 'Prospect',
      fields:  ['name','prospect_name','category','address','mobile_no',
                'email_id','website','rating','review_count','status',
                'prospect_list','lat','lng','google_maps_uri','notes'],
      filters,
      limit:       50,
      limit_start: reset ? 0 : start.value,
      order_by:    'modified desc',
    }) || []
    rows.forEach(r => { r._address_short = (r.address || '').split(',')[0] })
    if (reset) { prospects.value = rows } else { prospects.value.push(...rows) }
    start.value   = prospects.value.length
    hasMore.value = rows.length === 50
  } finally {
    loading.value = false
  }
}

async function openDetail(name) {
  const r = await call('frappe.client.get', { doctype: 'Prospect', name })
  openDoc.value = r
}

async function updateStatus(name, status) {
  await call('frappe.client.set_value', { doctype: 'Prospect', name, fieldname: 'status', value: status })
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
}

function onStatusUpdated({ name, status }) {
  const p = prospects.value.find(p => p.name === name)
  if (p) p.status = status
  if (openDoc.value?.name === name) openDoc.value.status = status
}

async function deleteProspect(name) {
  await call('frappe.client.delete', { doctype: 'Prospect', name })
  prospects.value = prospects.value.filter(p => p.name !== name)
  if (openDoc.value?.name === name) openDoc.value = null
  reloadLists()
  toast.success('Prospect deleted')
}

async function doRemoveFromList(names, unselectAll) {
  if (!names.length) return
  removing.value = true
  try {
    const r = await call('prospecting.api.remove_from_list', { prospect_names: names })
    prospects.value = prospects.value.filter(p => !names.includes(p.name))
    if (openDoc.value && names.includes(openDoc.value.name)) openDoc.value = null
    unselectAll?.()
    reloadLists()
    toast.success(`Removed ${r.removed} prospect(s) from list`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    removing.value = false
  }
}

async function doPushToCRM(names, unselectAll) {
  if (!names.length) return
  pushing.value = true
  try {
    const r = await call('prospecting.api.push_to_crm', { prospect_names: names })
    const parts = []
    if (r.created)       parts.push(`${r.created} lead(s) created`)
    if (r.skipped)       parts.push(`${r.skipped} already exist`)
    if (r.errors?.length) parts.push(`${r.errors.length} failed`)
    toast.success(parts.join(' · ') || 'Done')
    unselectAll?.()
    await reload()
  } catch (e) {
    toast.error(e.message)
  } finally {
    pushing.value = false
  }
}

async function confirmDeleteList() {
  const listObj = lists.value.find(l => l.name === props.listName)
  const label   = listObj?.list_name || props.listName
  const count   = listObj?._count || 0
  const msg     = count
    ? `Delete list "${label}" and its ${count} prospect(s)?`
    : `Delete list "${label}"?`
  if (!confirm(msg)) return
  await call('prospecting.api.delete_list', { list_name: props.listName })
  toast.success(`List "${label}" deleted`)
  await reloadLists()
  router.push('/all')
}
</script>
