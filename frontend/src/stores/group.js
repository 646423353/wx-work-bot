import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getGroups, addGroup, updateGroup, deleteGroup } from '@/api'

export const useGroupStore = defineStore('group', () => {
  const groups = ref([])
  const loading = ref(false)

  async function fetchGroups() {
    loading.value = true
    try {
      const res = await getGroups()
      groups.value = res.data
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      loading.value = false
    }
  }

  async function createGroup(data) {
    try {
      const res = await addGroup(data)
      await fetchGroups()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  async function editGroup(id, data) {
    try {
      const res = await updateGroup(id, data)
      await fetchGroups()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  async function removeGroup(id) {
    try {
      const res = await deleteGroup(id)
      await fetchGroups()
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  return {
    groups,
    loading,
    fetchGroups,
    createGroup,
    editGroup,
    removeGroup
  }
})
