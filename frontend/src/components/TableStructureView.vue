<template>
  <div class="table-structure-view">
    <div class="structure-toolbar">
      <div class="toolbar-left">
        <a-button
          type="primary"
          size="small"
          @click="handleAddClick"
        >
          <template #icon><PlusOutlined /></template>
          添加字段
        </a-button>
        <a-button size="small" @click="loadStructure">
          <template #icon><SyncOutlined /></template>
          刷新
        </a-button>
        <a-divider type="vertical" />
        <span class="table-info"> 表结构: {{ database }}.{{ table }} </span>
      </div>
      <div class="toolbar-right">
        <a-button size="small" @click="showCreateSQL">
          <template #icon><FileTextOutlined /></template>
          查看建表语句
        </a-button>
      </div>
    </div>

    <div class="structure-container">
      <a-table
        :loading="loading"
        :columns="columns"
        :data-source="structureData"
        size="small"
        bordered
        :scroll="{ y: '100%' }"
        :pagination="false"
        row-key="Field"
      />
    </div>

    <a-modal v-model:open="showCreateDialog" title="建表语句" width="80%">
      <a-textarea
        :value="createSQL"
        :rows="15"
        readonly
        class="create-sql"
      />
      <template #footer>
        <a-button @click="showCreateDialog = false">关闭</a-button>
        <a-button type="primary" @click="copySQL">复制</a-button>
      </template>
    </a-modal>

    <a-modal
      v-model:open="showColumnDialog"
      :title="dialogTitle"
      width="500px"
      @ok="saveColumn"
    >
      <a-form
        ref="columnFormRef"
        :model="columnForm"
        :rules="columnRules"
        layout="vertical"
      >
        <a-form-item label="字段名" name="name">
          <a-input v-model:value="columnForm.name" placeholder="字段名称" />
        </a-form-item>
        <a-form-item label="数据类型" name="type">
          <a-select
            v-model:value="columnForm.type"
            placeholder="选择数据类型"
            style="width: 100%"
            show-search
          >
            <a-select-opt-group label="数值类型">
              <a-select-option value="INT">INT</a-select-option>
              <a-select-option value="BIGINT">BIGINT</a-select-option>
              <a-select-option value="DECIMAL(10, 2)">DECIMAL</a-select-option>
              <a-select-option value="FLOAT">FLOAT</a-select-option>
              <a-select-option value="DOUBLE">DOUBLE</a-select-option>
            </a-select-opt-group>
            <a-select-opt-group label="字符串类型">
              <a-select-option value="VARCHAR(255)">VARCHAR</a-select-option>
              <a-select-option value="CHAR(10)">CHAR</a-select-option>
              <a-select-option value="TEXT">TEXT</a-select-option>
              <a-select-option value="LONGTEXT">LONGTEXT</a-select-option>
            </a-select-opt-group>
            <a-select-opt-group label="日期时间">
              <a-select-option value="DATETIME">DATETIME</a-select-option>
              <a-select-option value="DATE">DATE</a-select-option>
              <a-select-option value="TIME">TIME</a-select-option>
              <a-select-option value="TIMESTAMP">TIMESTAMP</a-select-option>
            </a-select-opt-group>
          </a-select>
        </a-form-item>
        <a-form-item label="允许NULL">
          <a-switch v-model:checked="columnForm.nullable" />
        </a-form-item>
        <a-form-item label="默认值">
          <a-input
            v-model:value="columnForm.defaultValue"
            placeholder="默认值 (NULL请留空)"
          />
        </a-form-item>
        <a-form-item label="注释">
          <a-input
            v-model:value="columnForm.comment"
            placeholder="字段注释（可选）"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  SyncOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { useQueryStore } from '@/stores/query'

const props = defineProps({
  connectionId: String,
  database: String,
  table: String
})

const queryStore = useQueryStore()

const loading = ref(false)
const structureData = ref([])
const showCreateDialog = ref(false)
const createSQL = ref('')

const showColumnDialog = ref(false)
const editMode = ref('add')
const originalColumnName = ref('')
const columnFormRef = ref()

const dialogTitle = computed(() => editMode.value === 'add' ? '添加字段' : '编辑字段')

const initialFormState = {
  name: '',
  type: '',
  nullable: true,
  defaultValue: null,
  comment: ''
}
const columnForm = reactive({ ...initialFormState })

const columnRules = {
  name: [{ required: true, message: '请输入字段名', trigger: 'blur' }],
  type: [{ required: true, message: '请选择数据类型', trigger: 'change' }]
}

const columns = [
  { title: '字段名', dataIndex: 'Field', key: 'Field', width: 150, ellipsis: true },
  { title: '数据类型', dataIndex: 'Type', key: 'Type', width: 120, ellipsis: true },
  {
    title: '允许NULL',
    dataIndex: 'Null',
    key: 'Null',
    width: 100,
    customRender: ({ text }) => (
      <a-tag color={text === 'YES' ? 'green' : 'red'}>
        {text === 'YES' ? '是' : '否'}
      </a-tag>
    )
  },
  {
    title: '键',
    dataIndex: 'Key',
    key: 'Key',
    width: 80,
    customRender: ({ text }) => {
      if (text === 'PRI') return <a-tag color="gold">主键</a-tag>
      if (text === 'UNI') return <a-tag color="blue">唯一</a-tag>
      if (text === 'MUL') return <a-tag>索引</a-tag>
      return null
    }
  },
  {
    title: '默认值',
    dataIndex: 'Default',
    key: 'Default',
    width: 120,
    ellipsis: true,
    customRender: ({ text }) =>
      text === null ? <span class="null-value">NULL</span> : text
  },
  { title: '额外信息', dataIndex: 'Extra', key: 'Extra', width: 150, ellipsis: true },
  { title: '注释', dataIndex: 'Comment', key: 'Comment', minWidth: 150, ellipsis: true },
  {
    title: '操作',
    key: 'action',
    width: 150,
    fixed: 'right',
    customRender: ({ record }) => (
      <span>
        <a-button type="link" size="small" onClick={() => editColumn(record)}>
          编辑
        </a-button>
        <a-popconfirm
          title={`确定要删除字段 "${record.Field}" 吗？`}
          onConfirm={() => deleteColumn(record)}
        >
          <a-button type="link" danger size="small">删除</a-button>
        </a-popconfirm>
      </span>
    )
  }
]

const loadStructure = async () => {
  if (!props.connectionId || !props.database || !props.table) return
  loading.value = true
  try {
    const result = await queryStore.getTableStructure(props.connectionId, props.database, props.table)
    if (result.success) structureData.value = result.data
  } catch (error) { message.error(`加载表结构失败: ${error.message}`) }
  finally { loading.value = false }
}

const showCreateSQL = async () => {
  try {
    const sql = `SHOW CREATE TABLE \`${props.database}\`.\`${props.table}\``
    const result = await queryStore.executeQuery(props.connectionId, sql)
    if (result.success && result.data.length > 0) {
      createSQL.value = result.data[0]['Create Table']
      showCreateDialog.value = true
    }
  } catch (error) { message.error(`获取建表语句失败: ${error.message}`) }
}

const copySQL = async () => {
  try {
    await navigator.clipboard.writeText(createSQL.value)
    message.success('复制成功')
  } catch (error) { message.error('复制失败') }
}

const handleAddClick = () => {
  editMode.value = 'add'
  Object.assign(columnForm, initialFormState)
  columnFormRef.value?.clearValidate()
  showColumnDialog.value = true
}

const editColumn = (row) => {
  editMode.value = 'edit'
  originalColumnName.value = row.Field
  columnForm.name = row.Field
  columnForm.type = row.Type.toUpperCase()
  columnForm.nullable = row.Null === 'YES'
  columnForm.defaultValue = row.Default
  columnForm.comment = row.Comment
  columnFormRef.value?.clearValidate()
  showColumnDialog.value = true
}

const deleteColumn = async (row) => {
  try {
    const sql = `ALTER TABLE \`${props.database}\`.\`${props.table}\` DROP COLUMN \`${row.Field}\``
    await queryStore.executeQuery(props.connectionId, sql)
    message.success('字段删除成功')
    loadStructure()
  } catch (error) { message.error(`删除字段失败: ${error.message}`) }
}

const saveColumn = async () => {
  try {
    await columnFormRef.value.validate()
    let sql = `ALTER TABLE \`${props.database}\`.\`${props.table}\` `

    if (editMode.value === 'add') {
      sql += `ADD COLUMN \`${columnForm.name}\` ${columnForm.type}`
    } else {
      sql += `CHANGE COLUMN \`${originalColumnName.value}\` \`${columnForm.name}\` ${columnForm.type}`
    }

    sql += columnForm.nullable ? ' NULL' : ' NOT NULL'

    if (columnForm.defaultValue !== null && columnForm.defaultValue !== undefined) {
      sql += ` DEFAULT '${String(columnForm.defaultValue).replace(/'/g, "''")}'`
    } else if (columnForm.nullable) {
      sql += ' DEFAULT NULL'
    }

    if (columnForm.comment) {
      sql += ` COMMENT '${columnForm.comment.replace(/'/g, "''")}'`
    }

    await queryStore.executeQuery(props.connectionId, sql)
    message.success(`字段${editMode.value === 'add' ? '添加' : '修改'}成功`)
    showColumnDialog.value = false
    loadStructure()
  } catch (error) {
    message.error(`操作失败: ${error.message}`)
  }
}

onMounted(loadStructure)

watch(() => [props.connectionId, props.database, props.table], loadStructure)
</script>

<style scoped>
.table-structure-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.structure-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  flex-shrink: 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-info {
  font-size: 14px;
  color: #606266;
}
.structure-container {
  flex: 1;
  overflow: hidden;
}
.null-value {
  color: #c0c4cc;
  font-style: italic;
}
.create-sql {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>