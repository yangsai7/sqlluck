<template>
  <a-modal
    :open="visible"
    title="导出数据"
    @cancel="handleCancel"
    @ok="handleExport"
    ok-text="导出"
    cancel-text="取消"
    :confirm-loading="exporting"
  >
    <a-form layout="vertical">
      <a-form-item label="导出目标">
        <a-input :value="`${tableInfo.database}.${tableInfo.table}`" disabled />
      </a-form-item>
      <a-form-item label="导出格式">
        <a-radio-group v-model:value="exportOptions.format">
          <a-radio value="sql">SQL</a-radio>
          <a-radio value="csv">CSV</a-radio>
          <a-radio value="txt" disabled>TXT (开发中)</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item v-if="exportOptions.format === 'sql'" label="SQL选项">
        <a-checkbox v-model:checked="exportOptions.sql.includeStructure">包含结构 (CREATE TABLE)</a-checkbox>
        <a-checkbox v-model:checked="exportOptions.sql.includeData">包含数据 (INSERT)</a-checkbox>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useQueryStore } from '@/stores/query'

const props = defineProps({
  visible: Boolean,
  tableInfo: { type: Object, required: true }
})

const emit = defineEmits(['update:visible'])

const queryStore = useQueryStore()
const exporting = ref(false)

const exportOptions = reactive({
  format: 'sql',
  sql: {
    includeStructure: true,
    includeData: true
  }
})

const handleCancel = () => {
  emit('update:visible', false)
}

const handleExport = async () => {
  exporting.value = true
  try {
    // 这是一个简化的前端实现，用于演示目的
    // 实际项目中，这部分逻辑应该在后端完成
    let content = ''
    let filename = `${props.tableInfo.table}_export`

    if (exportOptions.format === 'sql') {
      filename += '.sql'
      if (exportOptions.sql.includeStructure) {
        const ddlResult = await queryStore.executeQuery(props.tableInfo.connectionId, props.tableInfo.database, `SHOW CREATE TABLE \`${props.tableInfo.database}\`.\`${props.tableInfo.table}\``)
        content += ddlResult.data[0]['Create Table'] + ';\n\n'
      }
      if (exportOptions.sql.includeData) {
        const dataResult = await queryStore.executeQuery(props.tableInfo.connectionId, props.tableInfo.database, `SELECT * FROM \`${props.tableInfo.database}\`.\`${props.tableInfo.table}\``)
        if (dataResult.data.length > 0) {
          const columns = Object.keys(dataResult.data[0])
          const insertTpl = `INSERT INTO \`${props.tableInfo.table}\` (\`${columns.join('\`, \`')}\`) VALUES\n`
          content += insertTpl
          const values = dataResult.data.map(row => 
            '(' + columns.map(col => 
              row[col] === null ? 'NULL' : `'${String(row[col]).replace(/'/g, "''")}'`
            ).join(', ') + ')'
          ).join(',\n')
          content += values + ';\n'
        }
      }
    } else if (exportOptions.format === 'csv') {
      filename += '.csv'
      const dataResult = await queryStore.executeQuery(props.tableInfo.connectionId, props.tableInfo.database, `SELECT * FROM \`${props.tableInfo.database}\`.\`${props.tableInfo.table}\``)
      if (dataResult.data.length > 0) {
        const columns = Object.keys(dataResult.data[0])
        content += columns.join(',') + '\n'
        content += dataResult.data.map(row => 
          columns.map(col => {
            const val = String(row[col])
            return val.includes(',') ? `"${val}"` : val
          }).join(',')
        ).join('\n')
      }
    }

    if (!content.trim()) {
      message.warning('没有内容可导出'); return;
    }

    downloadFile(filename, content)
    message.success('导出成功')
    handleCancel()

  } catch (error) {
    message.error(`导出失败: ${error.message}`)
  } finally {
    exporting.value = false
  }
}

const downloadFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

</script>