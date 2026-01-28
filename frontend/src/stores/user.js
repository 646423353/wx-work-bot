import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))
  const isLoggedIn = computed(() => !!token.value)

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  async function login(credentials) {
    try {
      console.log('User store login called with:', credentials)
      const res = await loginApi(credentials)
      console.log('Login API response:', res)
      
      setToken(res.data.token)
      setUserInfo(res.data.user)
      
      console.log('Token set:', token.value)
      console.log('User info set:', userInfo.value)
      console.log('Is logged in:', isLoggedIn.value)
      
      return Promise.resolve(res)
    } catch (error) {
      console.error('User store login error:', error)
      return Promise.reject(error)
    }
  }

  async function logout() {
    try {
      await logoutApi()
      token.value = ''
      userInfo.value = {}
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    setToken,
    setUserInfo,
    login,
    logout
  }
})
