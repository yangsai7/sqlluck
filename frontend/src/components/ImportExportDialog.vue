<template>
  <div class="import-export-dialog">
    <a-tabs v-model:activeKey="activeTab">
      <!-- 数据导出 -->
      <a-tab-pane key="export-data" tab="数据导出">
        <div class="tab-content">
          <a-form :model="exportForm" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
            <a-form-item label="导出表">
              <a-select v-model:value="exportForm.table" placeholder="选择要导出的表">
                <a-select-option v-for="table in connectionStore.tables" :key="table" :value="table">
                  {{ table }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="导出格式">
              <a-radio-group v-model:value="exportForm.format">
                <a-radio value="csv">CSV</a-radio>
                <a-radio value="json" disabled>JSON (开发中)</a-radio>
                <a-radio value="excel" disabled>Excel (开发中)</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item label="导出行数">
              <a-input-number v-model:value="exportForm.limit" :min="1" :max="100000" style="width: 100%" />
              <div class="form-tip">最大支持10万行数据导出</div>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }">
              <a-button type="primary" :loading="exporting" :disabled="!exportForm.table" @click="exportData">
                导出数据
              </a-button>
            </a-form-item>
          </a-form>
        </div>
      </a-tab-pane>

      <!-- 结构导出 -->
      <a-tab-pane key="export-structure" tab="结构导出">
        <div class="tab-content">
          <a-form :model="structureForm" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
            <a-form-item label="导出数据库">
              <a-select v-model:value="structureForm.database" placeholder="选择数据库">
                <a-select-option v-for="db in connectionStore.databases" :key="db" :value="db">
                  {{ db }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }">
              <a-button type="primary" :loading="exportingStructure" :disabled="!structureForm.database" @click="exportStructure">
                导出结构
              </a-button>
            </a-form-item>
          </a-form>
          <div v-if="structureSQL" class="structure-preview">
            <div class="preview-header">
              <h4>结构预览</h4>
              <a-button size="small" @click="copyStructureSQL">复制SQL</a-button>
            </div>
            <a-textarea :value="structureSQL" :rows="15" readonly class="structure-sql" />
          </div>
        </div>
      </a-tab-pane>

      <!-- 数据导入 -->
      <a-tab-pane key="import-data" tab="数据导入">
        <div class="tab-content">
          <a-form :model="importForm" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
            <a-form-item label="目标表">
              <a-select v-model:value="importForm.table" placeholder="选择目标表">
                <a-select-option v-for="table in connectionStore.tables" :key="table" :value="table">
                  {{ table }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="数据文件">
              <a-upload :file-list="importFileList" action="/api/upload" accept=".csv,.txt" @change="handleImportFileChange" :before-upload="beforeUpload">
                <a-button><UploadOutlined /> 选择CSV文件</a-button>
              </a-upload>
            </a-form-item>
            <a-form-item label="文件选项">
              <a-checkbox v-model:checked="importForm.hasHeader">首行包含字段名</a-checkbox>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }" v-if="importForm.filepath">
              <a-button type="primary" :loading="importing" @click="importData">
                开始导入
              </a-button>
            </a-form-item>
          </a-form>
        </div>
      </a-tab-pane>

      <!-- SQL文件执行 -->
      <a-tab-pane key="execute-sql" tab="执行SQL文件">
        <div class="tab-content">
          <a-form :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
            <a-form-item label="SQL文件">
              <a-upload :file-list="sqlFileList" action="/api/upload" accept=".sql,.txt" @change="handleSQLFileChange" :before-upload="beforeUpload">
                <a-button><UploadOutlined /> 选择SQL文件</a-button>
              </a-upload>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }" v-if="sqlForm.filepath">
              <a-button type="primary" :loading="executingSql" @click="executeSQLFile">
                执行SQL文件
              </a-button>
            </a-form-item>
          </a-form>
          <div v-if="sqlExecuteResult" class="execute-result">
            <a-alert :message="sqlExecuteResult.message" :type="sqlExecuteResult.success ? 'success' : 'error'" show-icon />
            <div v-if="sqlExecuteResult.errors?.length" class="error-details">
              <h4>错误详情</h4>
              <div v-for="(error, index) in sqlExecuteResult.errors" :key="index" class="error-item">
                <div class="error-statement">语句 {{ error.statement }}: {{ error.sql }}</div>
                <div class="error-message">{{ error.error }}</div>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import api from '@/api'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible', 'imported'])

const connectionStore = useConnectionStore()

const activeTab = ref('export-data')
const exporting = ref(false)
const exportingStructure = ref(false)
const importing = ref(false)
const executingSql = ref(false)

const exportForm = reactive({ table: '', format: 'csv', limit: 10000 })
const structureForm = reactive({ database: '' })
const structureSQL = ref('')
const importForm = reactive({ table: '', filepath: '', hasHeader: true })
const sqlForm = reactive({ filepath: '' })
const sqlExecuteResult = ref(null)

const importFileList = ref([])
const sqlFileList = ref([])

const exportData = async () => {
  if (!exportForm.table || !connectionStore.activeConnectionId || !connectionStore.activeDatabaseName) {
    message.warning('请选择表'); return;
  }
  exporting.value = true
  try {
    const response = await api.get(
      `/connections/${connectionStore.activeConnectionId}/databases/${connectionStore.activeDatabaseName}/tables/${exportForm.table}/export/csv`,
      { params: { limit: exportForm.limit } }
    )
    if (response.success) {
      const downloadUrl = `/api/download/${response.filename}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = response.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success(`导出成功，共${response.recordCount}条记录`)
    } else {
      message.error(response.error)
    }
  } catch (error) { message.error('导出失败: ' + error.message) } finally { exporting.value = false }
}

const exportStructure = async () => {
  if (!structureForm.database || !connectionStore.activeConnectionId) {
    message.warning('请选择数据库'); return;
  }
  exportingStructure.value = true
  try {
    const response = await api.get(
      `/connections/${connectionStore.activeConnectionId}/databases/${structureForm.database}/export/structure`
    )
    if (response.success) {
      structureSQL.value = response.sql
      message.success('结构导出成功')
    } else { message.error(response.error) }
  } catch (error) { message.error('导出结构失败: ' + error.message) } finally { exportingStructure.value = false }
}

const copyStructureSQL = async () => {
  try {
    await navigator.clipboard.writeText(structureSQL.value)
    message.success('复制成功')
  } catch (error) { message.error('复制失败') }
}

const beforeUpload = (file) => {
  const maxSize = 100 * 1024 * 1024
  if (file.size > maxSize) {
    message.error('文件大小不能超过100MB'); return false;
  }
  return true
}

const handleImportFileChange = ({ file, fileList }) => {
  importFileList.value = fileList.slice(-1)
  if (file.status === 'done' && file.response.success) {
    importForm.filepath = file.response.filepath
    message.success('文件上传成功')
  } else if (file.status === 'error') {
    message.error('文件上传失败')
  }
}

const handleSQLFileChange = ({ file, fileList }) => {
  sqlFileList.value = fileList.slice(-1)
  if (file.status === 'done' && file.response.success) {
    sqlForm.filepath = file.response.filepath
    message.success('SQL文件上传成功')
  } else if (file.status === 'error') {
    message.error('文件上传失败')
  }
}

const importData = async () => {
  if (!importForm.table || !importForm.filepath || !connectionStore.activeConnectionId || !connectionStore.activeDatabaseName) {
    message.warning('请选择表和文件'); return;
  }
  importing.value = true
  try {
    const response = await api.post(
      `/connections/${connectionStore.activeConnectionId}/databases/${connectionStore.activeDatabaseName}/tables/${importForm.table}/import/csv`,
      { filepath: importForm.filepath, hasHeader: importForm.hasHeader }
    )
    if (response.success) {
      message.success(response.message)
      emit('imported')
      importForm.filepath = ''
      importFileList.value = []
    } else { message.error(response.error) }
  } catch (error) { message.error('导入失败: ' + error.message) } finally { importing.value = false }
}

const executeSQLFile = async () => {
  if (!sqlForm.filepath || !connectionStore.activeConnectionId) {
    message.warning('请上传SQL文件'); return;
  }
  executingSql.value = true
  sqlExecuteResult.value = null
  try {
    const response = await api.post(
      `/connections/${connectionStore.activeConnectionId}/execute-sql-file`,
      { filepath: sqlForm.filepath }
    )
    sqlExecuteResult.value = response
    if (response.success) {
      message.success(response.message)
      emit('imported')
      sqlForm.filepath = ''
      sqlFileList.value = []
    } else {
      message.error(response.message || '执行SQL文件出错')
    }
  } catch (error) { message.error('执行失败: ' + error.message) } finally { executingSql.value = false }
}

const initForms = () => {
  if (connectionStore.activeDatabaseName) {
    structureForm.database = connectionStore.activeDatabaseName
  }
  if (connectionStore.tables.length > 0) {
    exportForm.table = connectionStore.tables[0]
    importForm.table = connectionStore.tables[0]
  }
}

watch(() => props.visible, (val) => { if (val) initForms() })
</script>

<style scoped>
.tab-content { padding: 20px; }
.form-tip, .upload-tip { font-size: 12px; color: #999; margin-top: 5px; }
.structure-preview { margin-top: 20px; border: 1px solid #f0f0f0; border-radius: 4px; }
.preview-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }
.preview-header h4 { margin: 0; font-size: 14px; }
.structure-sql { font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
.execute-result { margin-top: 20px; }
.error-details { margin-top: 16px; }
.error-details h4 { margin-bottom: 12px; font-size: 14px; }
.error-item { margin-bottom: 12px; padding: 12px; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 4px; }
.error-statement { font-size: 13px; color: #595959; margin-bottom: 4px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
.error-message { font-size: 12px; color: #cf1322; }
</style>