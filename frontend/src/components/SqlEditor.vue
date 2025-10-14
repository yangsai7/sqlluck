<template>
  <div class="sql-editor" ref="sqlEditorRoot">
    <div class="editor-toolbar" ref="editorToolbar">
      <div class="toolbar-left">
        <a-button
          type="primary"
          size="small"
          :loading="queryStore.isExecuting"
          :disabled="!currentSql.trim() || !connectionStore.isConnected || !connectionStore.activeDatabaseName"
          @click="executeQuery"
        >
          <template #icon><PlayCircleOutlined /></template>
          执行查询 (F9)
        </a-button>
        <a-button size="small" @click="formatSQL">
          <template #icon><RedoOutlined /></template>
          格式化
        </a-button>
        <a-button size="small" @click="clearEditor">
          <template #icon><DeleteOutlined /></template>
          清空
        </a-button>
        <a-divider type="vertical" />
        <a-select
          v-model:value="connectionStore.activeDatabaseName"
          size="small"
          placeholder="选择数据库"
          style="width: 150px"
          @change="connectionStore.setActiveDatabase"
          :options="databaseOptions"
        />
      </div>
      <div class="toolbar-right">
        <span v-if="queryStore.queryResults?.executeTime" class="execute-time">
          执行耗时: {{ queryStore.queryResults.executeTime }}
        </span>
      </div>
    </div>

    <div class="editor-container" :style="{ height: editorHeight + 'px' }">
      <textarea
        ref="editorRef"
        v-model="currentSql"
        class="editor-textarea-plain"
        placeholder="请输入 SQL 查询语句..."
        @keydown="handleKeydown"
      />
    </div>

    <div class="splitter-horizontal" @mousedown="startDrag"></div>

    <div v-if="queryStore.queryResults || queryStore.queryError" class="result-container">
      <a-tabs v-model:activeKey="activeTab" type="card" style="height: 100%">
        <a-tab-pane key="result" tab="查询结果">
          <QueryResult :data="queryStore.queryResults" :error="queryStore.queryError" />
        </a-tab-pane>
        <a-tab-pane key="info" tab="执行信息">
          <div class="execution-info">
            <a-descriptions v-if="queryStore.queryResults" :column="1" size="small" bordered>
              <a-descriptions-item label="影响行数">
                {{ queryStore.queryResults.affectedRows || queryStore.queryResults.data?.length || 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="执行耗时">
                {{ queryStore.queryResults.executeTime }}
              </a-descriptions-item>
              <a-descriptions-item label="执行时间">
                {{ new Date().toLocaleString() }}
              </a-descriptions-item>
            </a-descriptions>
            <a-alert v-if="queryStore.queryError" :message="queryStore.queryError" type="error" show-icon />
          </div>
        </a-tab-pane>
        <a-tab-pane key="history" tab="查询历史">
          <QueryHistory @select-query="loadHistoryQuery" />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlayCircleOutlined, RedoOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import { useQueryStore } from '@/stores/query'
import { sqlUtils } from '@/utils/sqlUtils'
import QueryResult from './QueryResult.vue'
import QueryHistory from './QueryHistory.vue'
import './sql-editor.css'

const connectionStore = useConnectionStore()
const queryStore = useQueryStore()

const editorRef = ref()
const sqlEditorRoot = ref()
const editorToolbar = ref()
const currentSql = ref('')
const activeTab = ref('result')
const editorHeight = ref(250)

const databaseOptions = computed(() => 
  connectionStore.databases.map(db => ({ label: db, value: db }))
)

watch(currentSql, (newSql) => {
  queryStore.setCurrentQuery(newSql)
})

const startDrag = (e) => {
  e.preventDefault()
  document.addEventListener('mousemove', doDrag)
  document.addEventListener('mouseup', stopDrag)
}

const doDrag = (e) => {
  if (sqlEditorRoot.value && editorToolbar.value) {
    const containerTop = sqlEditorRoot.value.getBoundingClientRect().top
    const toolbarHeight = editorToolbar.value.offsetHeight
    const newHeight = e.clientY - containerTop - toolbarHeight
    const totalHeight = sqlEditorRoot.value.offsetHeight
    
    // Add constraints
    if (newHeight > 50 && newHeight < totalHeight - 150) {
      editorHeight.value = newHeight
    }
  }
}

const stopDrag = () => {
  document.removeEventListener('mousemove', doDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const executeQuery = async () => {
  if (!currentSql.value.trim()) {
    message.warning('请输入SQL语句'); return;
  }
  if (!connectionStore.activeConnectionId) {
    message.warning('请先连接数据库'); return;
  }
  if (!connectionStore.activeDatabaseName) {
    message.warning('请先选择一个数据库'); return;
  }
  try {
    await queryStore.executeQuery(connectionStore.activeConnectionId, connectionStore.activeDatabaseName, currentSql.value.trim())
    activeTab.value = 'result'
  } catch (error) {
    activeTab.value = 'result'
  }
}

const formatSQL = () => { currentSql.value = sqlUtils.format(currentSql.value) }
const clearEditor = () => { currentSql.value = ''; queryStore.clearResults() }
const loadHistoryQuery = (sql) => { currentSql.value = sql; activeTab.value = 'result' }

const handleKeydown = (event) => {
  if (event.key === 'F9') { event.preventDefault(); executeQuery() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); executeQuery() }
}

const insertSqlTemplate = (template) => {
  const textarea = editorRef.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentValue = currentSql.value
  currentSql.value = currentValue.substring(0, start) + template + currentValue.substring(end)
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + template.length, start + template.length)
  }, 0)
}

onMounted(() => {
  queryStore.loadHistoryFromStorage()
  setTimeout(() => { editorRef.value?.focus() }, 100)
})

defineExpose({ insertSqlTemplate, executeQuery, clearEditor })
</script>

<style scoped>
.sql-editor { height: 100%; display: flex; flex-direction: column; }
.editor-toolbar { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.execute-time { font-size: 12px; color: #909399; }
.editor-container { flex-shrink: 0; }
.editor-textarea-plain {
  width: 100%;
  height: 100%;
  border: none;
  padding: 10px;
  font-family: monospace;
  font-size: 14px;
  resize: none;
  background-color: #f8f8f8;
}
.editor-textarea-plain:focus {
  outline: none;
}
.splitter-horizontal {
  height: 5px;
  background: #e8e8e8;
  cursor: ns-resize;
  flex-shrink: 0;
}
.splitter-horizontal:hover {
  background: #d9d9d9;
}
.result-container { flex: 1; min-height: 100px; display: flex; flex-direction: column; border-top: none; }
.execution-info { padding: 16px; font-size: 14px; line-height: 1.6; }
:deep(.ant-tabs-content) { height: 100%; }
:deep(.ant-tabs-tabpane) { height: 100%; overflow: auto; }
</style>