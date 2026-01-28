import axios from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: '/api',
  timeout: 30000
})

service.interceptors.request.use(
  config => {
    return config
  },
  error => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code !== 200) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  error => {
    console.error('Response error:', error)
    
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || '请求失败'
      
      if (status === 401) {
        ElMessage.error(message || '用户名或密码错误')
      } else if (status === 500) {
        ElMessage.error(message || '服务器错误')
      } else {
        ElMessage.error(message)
      }
      
      return Promise.reject(new Error(message))
    } else {
      ElMessage.error(error.message || '网络错误')
      return Promise.reject(error)
    }
  }
)

export default service
