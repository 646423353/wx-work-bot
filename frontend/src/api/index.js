import request from '@/utils/request'

export function getMonitoringOverview() {
  return request({
    url: '/monitoring/overview',
    method: 'get'
  })
}

export function getMessages(params) {
  return request({
    url: '/monitoring/messages',
    method: 'get',
    params
  })
}

export function getGroups() {
  return request({
    url: '/groups',
    method: 'get'
  })
}

export function addGroup(data) {
  return request({
    url: '/groups',
    method: 'post',
    data
  })
}

export function updateGroup(id, data) {
  return request({
    url: `/groups/${id}`,
    method: 'put',
    data
  })
}

export function deleteGroup(id) {
  return request({
    url: `/groups/${id}`,
    method: 'delete'
  })
}

export function getAlerts() {
  return request({
    url: '/alerts',
    method: 'get'
  })
}

export function updateAlert(id, data) {
  return request({
    url: `/alerts/${id}`,
    method: 'put',
    data
  })
}

export function getSensitiveWords() {
  return request({
    url: '/sensitive-words',
    method: 'get'
  })
}

export function addSensitiveWord(data) {
  return request({
    url: '/sensitive-words',
    method: 'post',
    data
  })
}

export function deleteSensitiveWord(id) {
  return request({
    url: `/sensitive-words/${id}`,
    method: 'delete'
  })
}

export function getReports(params) {
  return request({
    url: '/reports',
    method: 'get',
    params
  })
}

export function exportReport(params) {
  return request({
    url: '/reports/export',
    method: 'get',
    params,
    responseType: 'blob'
  })
}

export function login(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

export function logout() {
  return request({
    url: '/auth/logout',
    method: 'post'
  })
}

export function getSettings() {
  return request({
    url: '/settings',
    method: 'get'
  })
}

export function updateSettings(data) {
  return request({
    url: '/settings',
    method: 'put',
    data
  })
}
