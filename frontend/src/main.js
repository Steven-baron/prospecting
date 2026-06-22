import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import 'frappe-ui/style.css'
import './index.css'

createApp(App).use(router).mount('#app')
