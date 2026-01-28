import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import MainLayout from '@/components/layout/MainLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '监控仪表盘' }
      },
      {
        path: 'groups',
        name: 'Groups',
        component: () => import('@/views/Groups.vue'),
        meta: { title: '群聊管理' }
      },
      {
        path: 'alerts',
        name: 'Alerts',
        component: () => import('@/views/Alerts.vue'),
        meta: { title: '告警配置' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/Reports.vue'),
        meta: { title: '数据报表' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '系统设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)
  
  console.log('路由守卫执行:', {
    to: to.path,
    from: from.path,
    requiresAuth,
    isLoggedIn: userStore.isLoggedIn,
    token: userStore.token
  })

  if (requiresAuth && !userStore.isLoggedIn) {
    console.log('需要登录但未登录，跳转到登录页')
    next('/login')
  } else if (to.path === '/login' && userStore.isLoggedIn) {
    console.log('已登录但访问登录页，跳转到仪表盘')
    next('/dashboard')
  } else {
    console.log('路由守卫通过')
    next()
  }
})

export default router
