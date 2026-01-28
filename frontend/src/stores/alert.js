import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAlerts, updateAlert, getSensitiveWords, addSensitiveWord, deleteSensitiveWord } from '@/api'

export const useAlertStore = defineStore('alert', () => {
  const alerts = ref([])
  const sensitiveWords = ref([])
  const loading = ref(false)

  async function fetchAlerts() {
    loading.value = true
    try {
      const res = await getAlerts()
      alerts.value = res.data
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loading.value = false
    }
  }

  async function editAlert(id, data) {
    try {
      const res = await updateAlert(id, data)
      await fetchAlerts()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  async function fetchSensitiveWords() {
    loading.value = true
    try {
      const res = await getSensitiveWords()
      sensitiveWords.value = res.data
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loading.value = false
    }
  }

  async function createSensitiveWord(data) {
    try {
      const res = await addSensitiveWord(data)
      await fetchSensitiveWords()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  async function removeSensitiveWord(id) {
    try {
      const res = await deleteSensitiveWord(id)
      await fetchSensitiveWords()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  return {
    alerts,
    sensitiveWords,
    loading,
    fetchAlerts,
    editAlert,
    fetchSensitiveWords,
    createSensitiveWord,
    removeSensitiveWord
  }
})
