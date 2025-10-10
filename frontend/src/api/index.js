// API请求工具
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    console.log('API请求:', config.method.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    console.error('响应错误:', error)
    const message = error.response?.data?.error || error.message || '网络错误'
    return Promise.reject(new Error(message))
  }
)

// 连接管理API
export const connectionAPI = {
  // 测试连接
  test(config) {
    return api.post('/connections/test', config)
  },

  // 创建连接
  create(config) {
    return api.post('/connections', config)
  },

  // 更新连接
  update(connectionId, config) {
    return api.put(`/connections/${connectionId}`, config)
  },

  // 连接
  connect(connectionId) {
    return api.post(`/connections/${connectionId}/connect`)
  },

  // 获取所有连接
  getAll() {
    return api.get('/connections')
  },

  // 关闭连接
  close(connectionId) {
    return api.delete(`/connections/${connectionId}`)
  },

  // 获取数据库列表
  getDatabases(connectionId) {
    return api.get(`/connections/${connectionId}/databases`)
  },

  // 获取表列表
  getTables(connectionId, database) {
    return api.get(`/connections/${connectionId}/databases/${database}/tables`)
  },

  // 获取视图列表
  getViews(connectionId, database) {
    return api.get(`/connections/${connectionId}/databases/${database}/views`)
  },

  // 获取函数列表
  getFunctions(connectionId, database) {
    return api.get(`/connections/${connectionId}/databases/${database}/functions`)
  },

  // 获取存储过程列表
  getProcedures(connectionId, database) {
    return api.get(`/connections/${connectionId}/databases/${database}/procedures`)
  }
}

// 查询管理API
export const queryAPI = {
  // 执行SQL查询
  execute(connectionId, sql, params = []) {
    return api.post(`/connections/${connectionId}/query`, { sql, params })
  },

  // 获取表结构
  getTableStructure(connectionId, database, table) {
    return api.get(`/connections/${connectionId}/databases/${database}/tables/${table}/structure`)
  },

  // 获取表数据
  getTableData(connectionId, database, table, limit = 100, offset = 0) {
    return api.get(`/connections/${connectionId}/databases/${database}/tables/${table}/data`, {
      params: { limit, offset }
    })
  },

  // 插入数据
  insertData(connectionId, database, table, data) {
    return api.post(`/connections/${connectionId}/databases/${database}/tables/${table}/data`, { data })
  },

  // 更新数据
  updateData(connectionId, database, table, data, where) {
    return api.put(`/connections/${connectionId}/databases/${database}/tables/${table}/data`, { data, where })
  },

  // 删除数据
  deleteData(connectionId, database, table, where) {
    return api.delete(`/connections/${connectionId}/databases/${database}/tables/${table}/data`, { data: { where } })
  }
}

export default api