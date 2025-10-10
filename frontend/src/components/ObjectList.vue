<template>
  <div class="object-list-view">
    <div v-if="!targetDB" class="no-selection">
      <a-empty description="在左侧双击一个数据库以查看其对象" />
    </div>
    <div v-else>
      <a-table
        :columns="columns"
        :data-source="tables"
        :loading="connectionStore.loading"
        :pagination="{ pageSize: 20 }"
        size="small"
        row-key="name"
        :custom-row="customRow"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'name'">
            <TableOutlined style="margin-right: 8px" />
            <span>{{ text }}</span>
          </template>
          <template v-else-if="column.key === 'dataLength'">
            {{ formatBytes(text) }}
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useConnectionStore } from '@/stores/connection';
import { Empty as AEmpty, Table as ATable } from 'ant-design-vue';
import { TableOutlined } from '@ant-design/icons-vue';

const uiStore = useUIStore();
const connectionStore = useConnectionStore();

const targetDB = computed(() => uiStore.objectsViewTarget);

const tables = computed(() => {
  if (!targetDB.value) return [];
  const { connectionId, dbName } = targetDB.value;
  const details = connectionStore.connectionDetails[connectionId];
  if (!details || !details.dbObjects || !details.dbObjects[dbName]) return [];
  return details.dbObjects[dbName].tables;
});

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: '行数', dataIndex: 'rows', key: 'rows', sorter: (a, b) => a.rows - b.rows },
  { title: '数据长度', dataIndex: 'dataLength', key: 'dataLength', sorter: (a, b) => a.dataLength - b.dataLength },
  { title: '引擎', dataIndex: 'engine', key: 'engine', sorter: (a, b) => a.engine.localeCompare(b.engine) },
  { title: '修改日期', dataIndex: 'updateTime', key: 'updateTime', sorter: (a, b) => new Date(a.updateTime) - new Date(b.updateTime) },
  { title: '注释', dataIndex: 'comment', key: 'comment' },
];

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const customRow = (record) => {
  return {
    onDblclick: () => {
      uiStore.openDataTab({ 
        table: record.name, 
        database: targetDB.value.dbName, 
        type: 'data' 
      });
    },
  };
};

</script>

<style scoped>
.object-list-view {
  height: 100%;
  width: 100%;
}
.no-selection {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
:deep(.ant-table-row) {
  cursor: pointer;
}
</style>
