<template>
  <FrappeUIProvider>
    <div class="flex h-full overflow-hidden bg-surface-white">

      <AppSidebar :lists="lists" :total-count="totalCount" @create-list="showCreateList = true" />

      <main class="flex flex-1 flex-col overflow-hidden">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>

      <!-- New List dialog -->
      <Dialog v-model="showCreateList" :options="{ title: 'New Prospect List', size: 'sm' }">
        <template #body-content>
          <div class="space-y-4 px-1">
            <FormControl label="List name" type="text" v-model="newListName"
              placeholder="e.g. Toronto Dentists" autofocus @keydown.enter="createList" />
            <div>
              <p class="mb-2 text-sm text-ink-gray-6">Color</p>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="c in COLORS" :key="c"
                  @click="newListColor = c"
                  class="size-6 rounded-full border-2 transition-all"
                  :style="{ background: c, borderColor: newListColor === c ? '#111' : 'transparent' }" />
              </div>
            </div>
          </div>
        </template>
        <template #actions>
          <div class="flex justify-end gap-2">
            <Button label="Cancel" variant="subtle" @click="showCreateList = false" />
            <Button label="Create" variant="solid" :loading="creatingList" @click="createList" />
          </div>
        </template>
      </Dialog>

    </div>
  </FrappeUIProvider>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FrappeUIProvider, Dialog, Button, FormControl, toast } from 'frappe-ui'
import AppSidebar from './components/AppSidebar.vue'
import { call } from './composables/api.js'

const router = useRouter()

const lists      = ref([])
const totalCount = ref(0)

const showCreateList = ref(false)
const newListName    = ref('')
const newListColor   = ref('#6366f1')
const creatingList   = ref(false)

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b']

provide('lists', lists)
provide('totalCount', totalCount)
provide('reloadLists', loadLists)

onMounted(loadLists)

async function loadLists() {
  const r = await call('prospecting.api.get_lists_with_counts')
  lists.value      = r?.lists   || []
  totalCount.value = r?.total   || 0
}

async function createList() {
  const name = newListName.value.trim()
  if (!name) return
  creatingList.value = true
  try {
    const doc = await call('frappe.client.insert', {
      doc: { doctype: 'Prospect List', list_name: name, color: newListColor.value },
    })
    await loadLists()
    showCreateList.value = false
    newListName.value    = ''
    newListColor.value   = '#6366f1'
    if (doc?.name) router.push(`/list/${encodeURIComponent(doc.name)}`)
  } catch (e) {
    toast.error('Failed to create list: ' + e.message)
  } finally {
    creatingList.value = false
  }
}
</script>
