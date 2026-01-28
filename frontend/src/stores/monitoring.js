import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMonitoringOverview, getMessages } from '@/api'

export const useMonitoringStore = defineStore('monitoring', () => {
  const overview = ref({})
  const messages = ref([])
  const loading = ref(false)

  async function fetchOverview() {
    loading.value = true
    try {
      const res = await getMonitoringOverview()
      overview.value = res.data
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loading.value = false
    }
  }

  async function fetchMessages(params) {
    loading.value = true
    try {
      const res = await getMessages(params)
      messages.value = res.data
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loading.value = false
    }
  }

  return {
    overview,
    messages,
    loading,
    fetchOverview,
    fetchMessages
  }
})
