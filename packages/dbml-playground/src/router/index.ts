import { createRouter, createWebHistory } from 'vue-router'
import PlaygroundPage from '../pages/PlaygroundPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'DBML Playground', component: PlaygroundPage, },
  ]
})

export default router
