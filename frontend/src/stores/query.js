// Pinia状态管理 - 查询管理
import { defineStore } from 'pinia'
import { queryAPI } from '@/api'

export const useQueryStore = defineStore('query', {
  state: () => ({
    queryHistory: [], // 查询历史
    currentQuery: '', // 当前查询SQL
    queryResults: null, // 查询结果
    queryError: null, // 查询错误
    isExecuting: false, // 是否正在执行查询
    executeTime: null // 执行耗时
  }),

  actions: {
    // 执行SQL查询
    async executeQuery(connectionId, database, sql, params = []) {
      this.isExecuting = true
      this.queryError = null
      this.queryResults = null

      try {
        const result = await queryAPI.execute(connectionId, database, sql, params)

        if (result.success) {
          this.queryResults = {
            data: result.data,
            fields: result.fields,
            affectedRows: result.affectedRows,
            executeTime: result.executeTime
          }

          // 添加到查询历史
          this.addToHistory(sql, true)
        }

        return result
      } catch (error) {
        this.queryError = error.message
        this.addToHistory(sql, false, error.message)
        throw error
      } finally {
        this.isExecuting = false
      }
    },

    // 获取表结构
    async getTableStructure(connectionId, database, table) {
      try {
        const result = await queryAPI.getTableStructure(connectionId, database, table)
        return result
      } catch (error) {
        throw error
      }
    },

    // 获取表数据
    async getTableData(connectionId, database, table, limit = 100, offset = 0) {
      this.isExecuting = true
      try {
        const result = await queryAPI.getTableData(connectionId, database, table, limit, offset)

        if (result.success) {
          this.queryResults = {
            data: result.data,
            fields: result.fields,
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            executeTime: result.executeTime // 添加执行时间
          }
        }

        return result
      } catch (error) {
        this.queryError = error.message
        throw error
      } finally {
        this.isExecuting = false
      }
    },

    // 插入数据
    async insertData(connectionId, database, table, data) {
      try {
        const result = await queryAPI.insertData(connectionId, database, table, data)
        return result
      } catch (error) {
        throw error
      }
    },

    // 更新数据
    async updateData(connectionId, database, table, data, where) {
      try {
        const result = await queryAPI.updateData(connectionId, database, table, data, where)
        return result
      } catch (error) {
        throw error
      }
    },

    // 删除数据
    async deleteData(connectionId, database, table, where) {
      try {
        const result = await queryAPI.deleteData(connectionId, database, table, where)
        return result
      } catch (error) {
        throw error
      }
    },

    // 设置当前查询
    setCurrentQuery(sql) {
      this.currentQuery = sql
    },

    // 添加到查询历史
    addToHistory(sql, success, error = null) {
      const historyItem = {
        id: Date.now(),
        sql: sql.trim(),
        timestamp: new Date().toLocaleString(),
        success,
        error,
        executeTime: this.executeTime
      }

      this.queryHistory.unshift(historyItem)

      // 保持历史记录在100条以内
      if (this.queryHistory.length > 100) {
        this.queryHistory = this.queryHistory.slice(0, 100)
      }

      // 保存到本地存储
      localStorage.setItem('queryHistory', JSON.stringify(this.queryHistory))
    },

    // 从本地存储加载查询历史
    loadHistoryFromStorage() {
      try {
        const stored = localStorage.getItem('queryHistory')
        if (stored) {
          this.queryHistory = JSON.parse(stored)
        }
      } catch (error) {
        console.error('加载查询历史失败:', error)
      }
    },

    // 清除查询历史
    clearHistory() {
      this.queryHistory = []
      localStorage.removeItem('queryHistory')
    },

    // 清除查询结果
    clearResults() {
      this.queryResults = null
      this.queryError = null
    }
  }
})