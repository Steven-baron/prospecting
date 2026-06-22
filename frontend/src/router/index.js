import { createRouter, createWebHistory } from 'vue-router'
import ProspectsPage from '../pages/ProspectsPage.vue'
import SearchPage from '../pages/SearchPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'

const routes = [
  { path: '/',               redirect: '/all' },
  { path: '/all',            component: ProspectsPage, props: { listName: null } },
  { path: '/list/:name',     component: ProspectsPage, props: r => ({ listName: r.params.name }) },
  { path: '/search',         component: SearchPage },
  { path: '/settings',       component: SettingsPage },
]

export default createRouter({
  history: createWebHistory('/prospecting'),
  routes,
})
