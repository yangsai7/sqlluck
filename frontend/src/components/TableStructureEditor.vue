<template>
  <div class="table-structure-editor">
    <div class="structure-toolbar">
      <div class="toolbar-left">
        <a-input v-model:value="tableName" placeholder="表名" style="width: 200px" />
      </div>
      <div class="toolbar-right">
        <a-button size="small" type="primary" @click="createTable" :loading="loading">
          <template #icon><CheckOutlined /></template>
          创建表
        </a-button>
      </div>
    </div>

    <a-tabs default-active-key="fields" style="height: 100%">
      <a-tab-pane key="fields" tab="字段">
        <div class="structure-container">
          <a-table
            :columns="columns"
            :data-source="structureData"
            size="small"
            bordered
            :scroll="{ y: '100%' }"
            :pagination="false"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <a-input v-model:value="record.Field" placeholder="字段名" />
              </template>
              <template v-if="column.key === 'type'">
                <a-select v-model:value="record.Type" placeholder="类型" style="width: 100%" show-search>
                    <a-select-opt-group label="数值类型">
                        <a-select-option value="INT">INT</a-select-option>
                        <a-select-option value="BIGINT">BIGINT</a-select-option>
                        <a-select-option value="DECIMAL">DECIMAL</a-select-option>
                        <a-select-option value="FLOAT">FLOAT</a-select-option>
                        <a-select-option value="DOUBLE">DOUBLE</a-select-option>
                    </a-select-opt-group>
                    <a-select-opt-group label="字符串类型">
                        <a-select-option value="VARCHAR">VARCHAR</a-select-option>
                        <a-select-option value="CHAR">CHAR</a-select-option>
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
              </template>
              <template v-if="column.key === 'length'">
                <a-input v-model:value="record.Length" placeholder="长度/值" />
              </template>
              <template v-if="column.key === 'nullable'">
                <a-checkbox v-model:checked="record.Null"></a-checkbox>
              </template>
              <template v-if="column.key === 'default'">
                <a-input v-model:value="record.Default" placeholder="默认值" />
              </template>
              <template v-if="column.key === 'comment'">
                <a-input v-model:value="record.Comment" placeholder="注释" />
              </template>
              <template v-if="column.key === 'action'">
                <a-button type="link" danger size="small" @click="removeColumn(record.id)">删除</a-button>
              </template>
            </template>
          </a-table>
          <a-button @click="addColumn" size="small" style="margin-top: 8px">
            <template #icon><PlusOutlined /></template>
            添加字段
          </a-button>
        </div>
      </a-tab-pane>
      <a-tab-pane key="indexes" tab="索引">
        <div class="structure-container">
            <a-table
                :columns="indexColumns"
                :data-source="indexesData"
                size="small"
                bordered
                :scroll="{ y: '100%' }"
                :pagination="false"
                row-key="id"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                        <a-input v-model:value="record.name" placeholder="索引名" />
                    </template>
                    <template v-if="column.key === 'type'">
                        <a-select v-model:value="record.type" placeholder="类型" style="width: 100%">
                            <a-select-option value="PRIMARY">PRIMARY</a-select-option>
                            <a-select-option value="UNIQUE">UNIQUE</a-select-option>
                            <a-select-option value="INDEX">INDEX</a-select-option>
                            <a-select-option value="FULLTEXT">FULLTEXT</a-select-option>
                        </a-select>
                    </template>
                    <template v-if="column.key === 'method'">
                        <a-select v-model:value="record.method" placeholder="方法" style="width: 100%">
                            <a-select-option value="BTREE">BTREE</a-select-option>
                            <a-select-option value="HASH">HASH</a-select-option>
                        </a-select>
                    </template>
                    <template v-if="column.key === 'columns'">
                        <a-select v-model:value="record.columns" placeholder="选择列" style="width: 100%" mode="multiple">
                            <a-select-option v-for="col in availableColumns" :key="col.Field" :value="col.Field">{{ col.Field }}</a-select-option>
                        </a-select>
                    </template>
                    <template v-if="column.key === 'action'">
                        <a-button type="link" danger size="small" @click="removeIndex(record.id)">删除</a-button>
                    </template>
                </template>
            </a-table>
            <a-button @click="addIndex" size="small" style="margin-top: 8px">
                <template #icon><PlusOutlined /></template>
                添加索引
            </a-button>
        </div>
      </a-tab-pane>
      <a-tab-pane key="options" tab="选项">
        <a-form layout="vertical">
            <a-form-item label="引擎">
                <a-select v-model:value="tableEngine" show-search>
                    <a-select-option v-for="engine in engines" :key="engine.Engine" :value="engine.Engine">{{ engine.Engine }}</a-select-option>
                </a-select>
            </a-form-item>
            <a-form-item label="字符集">
                <a-select v-model:value="tableCharset" show-search>
                    <a-select-option v-for="charset in charsets" :key="charset.Charset" :value="charset.Charset">{{ charset.Charset }}</a-select-option>
                </a-select>
            </a-form-item>
            <a-form-item label="排序规则">
                <a-select v-model:value="tableCollation" show-search>
                    <a-select-option v-for="collation in filteredCollations" :key="collation.Collation" :value="collation.Collation">{{ collation.Collation }}</a-select-option>
                </a-select>
            </a-form-item>
        </a-form>
      </a-tab-pane>
      <a-tab-pane key="comment" tab="注释">
        <a-textarea v-model:value="tableComment" placeholder="表注释" :rows="4" />
      </a-tab-pane>
      <a-tab-pane key="sql" tab="SQL预览">
        <a-textarea :value="previewSql" :rows="15" readonly />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue'
import { useQueryStore } from '@/stores/query'

const props = defineProps({
  connectionId: String,
  database: String,
})

const queryStore = useQueryStore()

const loading = ref(false)
const tableName = ref('')
const tableComment = ref('')
const tableEngine = ref('InnoDB')
const tableCharset = ref('utf8mb4')
const tableCollation = ref('utf8mb4_0900_ai_ci')

const structureData = ref([])
const indexesData = ref([])
let idCounter = 0;
let indexIdCounter = 0;

const engines = ref([])
const charsets = ref([])
const collations = ref([])

const columns = [
  { title: '字段名', key: 'name', width: 150 },
  { title: '数据类型', key: 'type', width: 120 },
  { title: '长度/值', key: 'length', width: 100 },
  { title: '允许NULL', key: 'nullable', width: 80 },
  { title: '默认值', key: 'default', width: 120 },
  { title: '注释', key: 'comment' },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

const indexColumns = [
    { title: '索引名', key: 'name', width: 150 },
    { title: '索引类型', key: 'type', width: 120 },
    { title: '索引方法', key: 'method', width: 120 },
    { title: '列', key: 'columns' },
    { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

const availableColumns = computed(() => structureData.value.filter(c => c.Field));
const filteredCollations = computed(() => collations.value.filter(c => c.Charset === tableCharset.value));

const addColumn = () => {
  structureData.value.push({
    id: idCounter++,
    Field: '',
    Type: '',
    Length: '',
    Null: true,
    Default: null,
    Comment: ''
  });
}

const removeColumn = (id) => {
  structureData.value = structureData.value.filter(col => col.id !== id);
}

const addIndex = () => {
    indexesData.value.push({
        id: indexIdCounter++,
        name: '',
        type: 'INDEX',
        method: 'BTREE',
        columns: []
    });
}

const removeIndex = (id) => {
    indexesData.value = indexesData.value.filter(idx => idx.id !== id);
}

const loadOptions = async () => {
    try {
        const [enginesRes, charsetsRes, collationsRes] = await Promise.all([
            queryStore.executeQuery(props.connectionId, 'SHOW ENGINES'),
            queryStore.executeQuery(props.connectionId, 'SHOW CHARACTER SET'),
            queryStore.executeQuery(props.connectionId, 'SHOW COLLATION'),
        ]);
        if (enginesRes.success) engines.value = enginesRes.data;
        if (charsetsRes.success) charsets.value = charsetsRes.data;
        if (collationsRes.success) collations.value = collationsRes.data;
    } catch (error) {
        message.error('加载表选项失败: ' + error.message);
    }
}

onMounted(loadOptions);

const previewSql = computed(() => {
    if (!tableName.value) return '-- 请输入表名';

    const columnDefs = structureData.value.map(col => {
        if (!col.Field || !col.Type) return null;
        let colType = col.Length ? `${col.Type}(${col.Length})` : col.Type;
        let colSql = '  `' + col.Field + '` ' + colType;
        if (!col.Null) {
            colSql += ' NOT NULL';
        }
        if (col.Default) {
            if (col.Default.toUpperCase() === 'CURRENT_TIMESTAMP') {
                colSql += " DEFAULT CURRENT_TIMESTAMP";
            } else {
                colSql += " DEFAULT '" + String(col.Default).replace(/'/g, "''") + "'";
            }
        }
        if (col.Comment) {
            colSql += " COMMENT '" + col.Comment.replace(/'/g, "''") + "'";
        }
        return colSql;
    }).filter(Boolean);

    const indexDefs = indexesData.value.map(idx => {
        if (!idx.name || idx.columns.length === 0) return null;
        const cols = idx.columns.map(c => '`' + c + '`').join(', ');
        if (idx.type === 'PRIMARY') {
            return '  PRIMARY KEY (' + cols + ')'
        }
        return '  ' + idx.type + ' KEY `' + idx.name + '` (' + cols + ') USING ' + idx.method;
    }).filter(Boolean);

    let sql = 'CREATE TABLE `' + props.database + '`.`' + tableName.value + '` (\n';
    sql += [...columnDefs, ...indexDefs].join(',\n');
    sql += `\n) ENGINE=${tableEngine.value} DEFAULT CHARSET=${tableCharset.value} COLLATE=${tableCollation.value}`;
    if (tableComment.value) {
        sql += " COMMENT='" + tableComment.value.replace(/'/g, "''") + "'";
    }
    sql += ';';

    return sql;
});

const createTable = async () => {
    if (!tableName.value) {
        message.error('请输入表名');
        return;
    }
    if (structureData.value.filter(c => c.Field).length === 0) {
        message.error('请至少添加一个字段');
        return;
    }

    loading.value = true;
    try {
        await queryStore.executeQuery(props.connectionId, previewSql.value);
        message.success('表创建成功');
        // TODO: Close tab and refresh tree
    } catch (error) {
        message.error(`创建表失败: ${error.message}`);
    } finally {
        loading.value = false;
    }
}

</script>

<style scoped>
.table-structure-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.structure-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  flex-shrink: 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.structure-container {
  flex: 1;
  overflow: hidden;
}
</style>