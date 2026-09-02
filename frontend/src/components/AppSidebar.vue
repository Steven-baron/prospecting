<template>
  <Sidebar :sections="navSections" v-model:collapsed="collapsed" :disable-collapse="disableCollapse">
    <template #header>
      <!-- Legacy sidebar — ModuleSidebar is the live CRM nav now. Kept for reference. -->
      <div class="flex h-12 items-center gap-2 px-2 py-1">
        <div class="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-gray-7 text-sm font-semibold text-ink-white">
          <LucideUsers class="size-4" />
        </div>
        <span v-if="!collapsed" class="text-base font-semibold text-ink-gray-9">
          {{ __('CRM') }}
        </span>
      </div>
    </template>

    <template #sidebar-item="{ item, isCollapsed }">
      <SidebarItem
        :label="item.label"
        :suffix="item.suffix"
        :to="item.to"
        :isActive="item.isActive"
        :isCollapsed="isCollapsed"
        :onClick="item.onClick">
        <template #icon>
          <!-- colored dot for list items -->
          <span v-if="item._dotColor"
            class="size-2 rounded-full flex-shrink-0"
            :style="{ background: item._dotColor }" />
          <!-- lucide icon component -->
          <component v-else-if="item._icon" :is="item._icon" class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
    </template>

    <template #footer-items="{ isCollapsed }">
      <SidebarItem
        :label="__('New List')"
        :isCollapsed="isCollapsed"
        :onClick="() => emit('create-list')">
        <template #icon>
          <LucidePlus class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
      <SidebarItem :label="__('Settings')" :isCollapsed="isCollapsed" to="/prospecting/settings" :isActive="route.path === '/prospecting/settings'">
        <template #icon>
          <LucideSettings class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
    </template>
  </Sidebar>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sidebar, SidebarItem } from 'frappe-ui'
import LucideSearch from '~icons/lucide/search'
import LucideUsers from '~icons/lucide/users'
import LucidePlus from '~icons/lucide/plus'
import LucideSettings from '~icons/lucide/settings'

const props = defineProps({
  lists:      { type: Array,   default: () => [] },
  totalCount: { type: Number,  default: 0 },
  // In the mobile drawer we force the sidebar expanded — otherwise frappe-ui's
  // Sidebar auto-collapses to an icon rail below the `sm` breakpoint.
  disableCollapse: { type: Boolean, default: false },
})
const emit = defineEmits(['create-list'])

const route    = useRoute()
const collapsed = ref(false)


const navSections = computed(() => [
  {
    label: '',
    items: [
      {
        label: __('Find Prospects'),
        _icon: LucideSearch,
        to: '/prospecting/search',
        isActive: route.path === '/prospecting/search',
      },
      {
        label: __('All Prospects'),
        _icon: LucideUsers,
        to: '/prospecting',
        isActive: route.path === '/prospecting',
        suffix: String(props.totalCount || 0),
      },
    ],
  },
  {
    label: __('Lists'),
    items: props.lists.map(l => ({
      label:     l.list_name,
      to:        `/prospecting/list/${encodeURIComponent(l.name)}`,
      isActive:  route.params.name === l.name,
      suffix:    String(l._count || 0),
      _dotColor: l.color || '#6366f1',
    })),
  },
])
</script>
