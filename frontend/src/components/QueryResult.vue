<template>
  <div class="query-result">
    <div v-if="error" class="error-container">
      <a-alert message="查询错误" :description="error" type="error" show-icon />
    </div>

    <div v-else-if="data" class="result-container">
      <div class="result-header">
        <div class="result-info">
          <span v-if="data.data">共 {{ data.total || data.data.length }} 行</span>
          <span v-if="data.affectedRows !== undefined">影响 {{ data.affectedRows }} 行</span>
          <span v-if="data.executeTime"> · 耗时 {{ data.executeTime }}</span>
        </div>
        <div class="result-actions">
          <a-button v-if="data.data && data.data.length > 0" size="small" @click="exportData">
            导出为CSV
          </a-button>
        </div>
      </div>

      <div class="table-container">
        <a-table
          v-if="data.data && data.data.length > 0"
          :columns="tableColumns"
          :data-source="data.data"
          size="small"
          bordered
          :scroll="{ y: '100%', x: 'max-content' }"
          :pagination="false"
          row-key="__row_key__"
        >
          <template #bodyCell="{ column, text }">
            <div class="cell-content">
              <span v-if="text === null" class="null-value">NULL</span>
              <span v-else-if="isLongText(text)" class="long-text" @click="showFullText(text)">
                {{ formatCellValue(text) }}
              </span>
              <span v-else>{{ formatCellValue(text) }}</span>
            </div>
          </template>
        </a-table>

        <div v-else-if="data.affectedRows !== undefined" class="execute-result">
          <a-result
            status="success"
            :title="`操作成功，影响 ${data.affectedRows} 行`"
            :sub-title="`执行耗时: ${data.executeTime}`"
          />
        </div>

        <div v-else class="empty-result">
          <a-empty description="查询结果为空" />
        </div>
      </div>

      <div v-if="data.total > data.limit" class="pagination">
        <a-pagination
          v-model:current="currentPage"
          v-model:pageSize="pageSize"
          :total="data.total"
          :page-size-options="['50', '100', '200', '500']"
          size="small"
          show-size-changer
          show-quick-jumper
          :show-total="(t) => `共 ${t} 条`"
          @change="handlePageChange"
        />
      </div>
    </div>

    <div v-else class="empty-state">
      <a-empty description="请执行查询语句" />
    </div>

    <a-modal v-model:open="showFullTextDialog" title="查看完整内容" width="70%" :footer="null">
      <pre class="full-text-content">{{ fullTextContent }}</pre>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'

const props = defineProps({ data: Object, error: String })
const emit = defineEmits(['page-change'])

const currentPage = ref(1)
const pageSize = ref(100)
const showFullTextDialog = ref(false)
const fullTextContent = ref('')

const tableColumns = computed(() => {
  if (!props.data?.fields) return []
  return props.data.fields.map(field => ({
    title: field.name || field.columnName,
    dataIndex: field.name || field.columnName,
    key: field.name || field.columnName,
    resizable: true,
    width: getColumnWidth(field),
    ellipsis: true,
  }))
})

watch(() => props.data, () => {
  if (props.data?.offset !== undefined) {
    currentPage.value = Math.floor(props.data.offset / props.data.limit) + 1
    pageSize.value = props.data.limit
  }
}, { immediate: true })

const getColumnWidth = (field) => {
  const name = field.name || ''
  const minWidth = Math.max(name.length * 10, 100)
  const maxWidth = 300
  const type = (typeof field.type === 'string') ? field.type.toLowerCase() : ''
  if (type.includes('text') || type.includes('blob')) return Math.min(200, maxWidth)
  if (type.includes('int') || type.includes('decimal')) return Math.min(120, maxWidth)
  if (type.includes('date') || type.includes('time')) return Math.min(180, maxWidth)
  return Math.min(minWidth, maxWidth)
}

const formatCellValue = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'string' && value.length > 100) return value.substring(0, 100) + '...'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const isLongText = (value) => typeof value === 'string' && value.length > 100

const showFullText = (content) => {
  fullTextContent.value = content
  showFullTextDialog.value = true
}

const handlePageChange = (page, size) => {
  currentPage.value = page
  pageSize.value = size
  const offset = (page - 1) * size
  emit('page-change', { limit: size, offset })
}

const exportData = () => {
  if (!props.data?.data?.length) {
    message.warning('没有数据可以导出'); return;
  }
  try {
    const headers = tableColumns.value.map(col => col.key)
    const csvContent = [
      headers.join(','),
      ...props.data.data.map(row =>
        headers.map(header => {
          const value = row[header]
          if (value === null) return 'NULL'
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return String(value)
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `query_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('数据导出成功')
  } catch (error) {
    message.error('导出失败: ' + error.message)
  }
}
</script>

<style scoped>
.query-result { height: 100%; display: flex; flex-direction: column; }
.error-container { padding: 16px; }
.result-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.result-info { font-size: 13px; color: #595959; }
.table-container { flex: 1; overflow: auto; }
.cell-content { min-height: 20px; }
.null-value { color: #bfbfbf; font-style: italic; }
.long-text { cursor: pointer; color: #1890ff; }
.long-text:hover { text-decoration: underline; }
.execute-result, .empty-result, .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; }
.pagination { padding: 8px; border-top: 1px solid #f0f0f0; text-align: center; }
.full-text-content { maxHeight: 60vh; overflow-y: auto; white-space: pre-wrap; word-break: break-word; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 13px; line-height: 1.4; }
</style>