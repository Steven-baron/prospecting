<template>
  <FrappeUIProvider>
    <div class="flex h-full overflow-hidden bg-surface-white">

      <!-- Desktop: docked sidebar -->
      <AppSidebar v-if="!isMobile"
        :lists="lists" :total-count="totalCount" @create-list="showCreateList = true" />

      <!-- Mobile: off-canvas drawer + backdrop -->
      <template v-else>
        <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/40"
          @click="drawerOpen = false" />
        <div
          class="fixed inset-y-0 left-0 z-50 w-60 max-w-[85%] transform shadow-xl transition-transform duration-200 ease-out"
          :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'">
          <AppSidebar
            disable-collapse
            :lists="lists" :total-count="totalCount"
            @create-list="showCreateList = true; drawerOpen = false" />
        </div>
      </template>

      <main class="flex flex-1 flex-col overflow-hidden">
        <!-- Mobile top bar with hamburger -->
        <div v-if="isMobile"
          class="flex h-12 flex-shrink-0 items-center gap-2 border-b bg-surface-white px-2">
          <button class="-ml-0.5 rounded p-2 text-ink-gray-7 hover:bg-surface-gray-2"
            :aria-label="__('Open menu')" @click="drawerOpen = true">
            <LucideMenu class="size-5" />
          </button>
          <span class="truncate text-base font-semibold text-ink-gray-9">{{ mobileTitle }}</span>
        </div>

        <router-view v-slot="{ Component }">
          <keep-alive include="SearchPage">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </main>

      <!-- New List dialog -->
      <Dialog v-model="showCreateList" :options="{ title: __('New Prospect List'), size: 'sm' }">
        <template #body-content>
          <div class="space-y-4 px-1">
            <FormControl :label="__('List name')" type="text" v-model="newListName"
              :placeholder="__('e.g. Toronto Dentists')" autofocus @keydown.enter="createList" />
            <div>
              <p class="mb-2 text-sm text-ink-gray-6">{{ __('Color') }}</p>
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
            <Button :label="__('Cancel')" variant="subtle" @click="showCreateList = false" />
            <Button :label="__('Create')" variant="solid" :loading="creatingList" @click="createList" />
          </div>
        </template>
      </Dialog>

    </div>
  </FrappeUIProvider>
</template>

<script setup>
import { ref, computed, provide, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FrappeUIProvider, Dialog, Button, FormControl, toast } from 'frappe-ui'
import LucideMenu from '~icons/lucide/menu'
import AppSidebar from './components/AppSidebar.vue'
import { call } from './composables/api.js'
import { useIsMobile } from './composables/breakpoint.js'
import { __ } from './translation.js'

const router = useRouter()
const route  = useRoute()

const isMobile   = useIsMobile()
const drawerOpen = ref(false)

// Close the drawer whenever the route changes (e.g. tapping a nav item)
watch(() => route.fullPath, () => { drawerOpen.value = false })

const lists      = ref([])
const totalCount = ref(0)

// Title shown in the mobile top bar, derived from the current route
const mobileTitle = computed(() => {
  const p = route.path
  if (p === '/search')   return __('Find Prospects')
  if (p === '/settings') return __('Settings')
  if (p.startsWith('/list/')) {
    const name = decodeURIComponent(route.params.name || '')
    return lists.value.find(l => l.name === name)?.list_name || __('List')
  }
  return __('All Prospects')
})

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
    toast.error(__('Failed to create list: {0}', [e.message]))
  } finally {
    creatingList.value = false
  }
}
</script>
