<template>
  <div class="database-tree">
    <div class="tree-header">
      <a-input-search
        v-model:value="searchText"
        :placeholder="searchPlaceholder"
        :disabled="!connectionStore.activeDatabaseName"
      />
    </div>

    <div class="tree-content">
      <a-tree
        :tree-data="treeData"
        show-icon
        @select="handleNodeSelect"
        v-model:expandedKeys="expandedKeys"
        @dblclick="handleNodeDoubleClick"
      >
        <template #title="{ dataRef }">
          <a-dropdown
            :trigger="['contextmenu']"
            style="width: 100%; display: block"
          >
            <div class="tree-node">
              <span class="node-label">{{ dataRef.title }}</span>

            </div>
            <template #overlay>
              <a-menu @click="({ key }) => handleContextCommand(key, dataRef)">
                <!-- Connection Menu -->
                <a-menu-item key="refresh" v-if="dataRef.type === 'connection'">
                  <template #icon><SyncOutlined /></template> 刷新
                </a-menu-item>
                <a-menu-item key="newDatabase" v-if="dataRef.type === 'connection'">
                  <template #icon><PlusOutlined /></template> 新建数据库
                </a-menu-item>
                <a-menu-item key="editConnection" v-if="dataRef.type === 'connection'">
                  <template #icon><EditOutlined /></template> 编辑连接
                </a-menu-item>
                <a-menu-item
                  key="deleteConnection"
                  v-if="dataRef.type === 'connection'"
                  danger
                >
                  <template #icon><DeleteOutlined /></template> 删除连接
                </a-menu-item>

                <!-- Database Menu -->
                <a-menu-item
                  key="pasteTable"
                  v-if="dataRef.type === 'database'"
                  :disabled="
                    !uiStore.clipboard || uiStore.clipboard.type !== 'table'
                  "
                >
                  <template #icon><SnippetsOutlined /></template> 粘贴表
                </a-menu-item>

                <a-menu-item key="newTable" v-if="dataRef.type === 'database' || (dataRef.type === 'folder' && dataRef.title === '表')">
                  <template #icon><PlusOutlined /></template> 新建表
                </a-menu-item>

                <!-- Table Menu -->
                <a-menu-item
                  key="viewData"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><TableOutlined /></template> 查看数据
                </a-menu-item>
                <a-menu-item
                  key="viewStructure"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><ApartmentOutlined /></template> 查看结构
                </a-menu-item>
                <a-menu-item
                  key="viewDDL"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><FileTextOutlined /></template> 查看DDL
                </a-menu-item>
                <a-menu-item
                  key="renameTable"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><EditOutlined /></template> 重命名
                </a-menu-item>
                <a-menu-divider
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                />
                <a-menu-item
                  key="copyTable"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><CopyOutlined /></template> 复制
                </a-menu-item>
                <a-menu-item
                  key="export"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                >
                  <template #icon><ExportOutlined /></template> 导出
                </a-menu-item>
                <a-menu-divider
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                />
                <a-menu-item
                  key="clearTable"
                  v-if="dataRef.type === 'table'"
                  danger
                >
                  <template #icon><ClearOutlined /></template> 清空表
                </a-menu-item>
                <a-menu-item
                  key="truncateTable"
                  v-if="dataRef.type === 'table'"
                  danger
                >
                  <template #icon><StopOutlined /></template> 截断表
                </a-menu-item>
                <a-menu-item
                  key="deleteTable"
                  v-if="dataRef.type === 'table' || dataRef.type === 'view'"
                  danger
                >
                  <template #icon><DeleteOutlined /></template> 删除
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
        <template #icon="{ dataRef }">
          <CloudServerOutlined v-if="dataRef.type === 'connection'" />
          <DatabaseOutlined v-else-if="dataRef.type === 'database'" />
          <FolderOutlined v-else-if="dataRef.type === 'folder'" />
          <TableOutlined v-else-if="dataRef.type === 'table'" />
          <EyeOutlined v-else-if="dataRef.type === 'view'" />
          <FunctionOutlined
            v-else-if="
              dataRef.type === 'function' || dataRef.type === 'procedure'
            "
          />
        </template>
      </a-tree>
    </div>



    <ConnectionDialog
      v-if="connectionToEdit"
      v-model:visible="showEditConnectionDialog"
      :connection="connectionToEdit"
      @updated="handleUpdated"
    />

    <a-modal v-model:open="ddlVisible" title="查看DDL" width="70%">
      <a-textarea
        :value="ddlContent"
        :rows="15"
        readonly
        class="ddl-textarea"
      />
      <template #footer>
        <a-button @click="ddlVisible = false">关闭</a-button>
        <a-button type="primary" @click="copyDDL">复制</a-button>
      </template>
    </a-modal>

    <ExportDialog
      v-if="tableToExport"
      v-model:visible="exportDialogVisible"
      :table-info="tableToExport"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h, reactive, watch } from "vue";
import { message, Modal, Input, Select } from "ant-design-vue";
import {
  PlusOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  TableOutlined,
  CheckCircleFilled,
  SyncOutlined,
  DisconnectOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CopyOutlined,
  SnippetsOutlined,
  ExportOutlined,
  FolderOutlined,
  EyeOutlined,
  FunctionOutlined,
  EditOutlined,
  ClearOutlined,
  StopOutlined,
} from "@ant-design/icons-vue";
import { useConnectionStore } from "@/stores/connection";
import { useQueryStore } from "@/stores/query";
import { useUIStore } from "@/stores/ui";
import ConnectionDialog from "./ConnectionDialog.vue";
import ExportDialog from "./ExportDialog.vue";

const emit = defineEmits(["node-click"]);

const connectionStore = useConnectionStore();
const queryStore = useQueryStore();
const uiStore = useUIStore();

const showEditConnectionDialog = ref(false);
const connectionToEdit = ref(null);
const ddlVisible = ref(false);
const ddlContent = ref("");
const exportDialogVisible = ref(false);
const tableToExport = ref(null);
const searchText = ref("");
const expandedKeys = ref([]);

const searchPlaceholder = computed(() =>
  connectionStore.activeDatabaseName
    ? `在 ${connectionStore.activeDatabaseName} 中搜索...`
    : "请先选择一个数据库"
);

const treeData = computed(() => {
  const search = searchText.value.toLowerCase().trim();

  return connectionStore.connections.map((connection) => {
    const connectionNode = {
      key: connection.id,
      title: connection.name || `${connection.host}:${connection.port}`,
      type: "connection",
      connection,
      children: [],
    };

    const details = connectionStore.connectionDetails[connection.id];
    if (details && details.databases.length > 0) {
      connectionNode.children = details.databases.map((database) => {
        const databaseNode = {
          key: `${connection.id}-${database}`,
          title: database,
          type: "database",
          database,
          connectionId: connection.id,
          children: [],
        };

        const dbObjects = details.dbObjects[database];
        if (dbObjects) {
          const dbChildren = [];
          const objectGroups = [
            { type: "table", title: "表", items: dbObjects.tables },
            { type: "view", title: "视图", items: dbObjects.views },
            { type: "function", title: "函数", items: dbObjects.functions },
            {
              type: "procedure",
              title: "存储过程",
              items: dbObjects.procedures,
            },
          ];

          objectGroups.forEach((group) => {
            let items = group.items || [];
            if (search && connection.id === connectionStore.activeConnectionId && database === details.activeDatabaseName) {
                items = items.filter((item) =>
                    (item.name || item).toLowerCase().includes(search)
                );
            }

            if (items.length > 0) {
              dbChildren.push({
                key: `${databaseNode.key}-${group.type}-folder`,
                title: group.title,
                type: "folder",
                database: databaseNode.database,
                connectionId: databaseNode.connectionId,
                children: items.map((item) => {
                  const title = item.name || item;
                  const nodeData = {
                    key: `${databaseNode.key}-${title}`,
                    title: title,
                    type: group.type,
                    database,
                    connectionId: connection.id,
                  };
                  nodeData[group.type] = item.name || item;
                  return nodeData;
                }),
              });
            }
          });
          databaseNode.children = dbChildren;
        }
        return databaseNode;
      });
    }
    return connectionNode;
  });
});

const handleNodeDoubleClick = async (e, node) => {
  const data = node.dataRef;
  if (data.type === "connection") {
    if (data.key !== connectionStore.activeConnectionId) {
      await connectionStore.setActiveConnection(data.key);
    }
    const key = data.key;
    const index = expandedKeys.value.indexOf(key);
    if (index > -1) {
      expandedKeys.value.splice(index, 1);
    } else {
      expandedKeys.value.push(key);
    }
  } else if (data.type === "database") {
    // Ensure parent connection is active
    if (data.connectionId !== connectionStore.activeConnectionId) {
      await connectionStore.setActiveConnection(data.connectionId);
    }
    // Load the data (this will also set it as active)
    await connectionStore.setActiveDatabase(data.database);
    // Show the objects view
    uiStore.showObjectsView({ connectionId: data.connectionId, dbName: data.database });

    // Toggle expansion
    const key = data.key;
    const index = expandedKeys.value.indexOf(key);
    if (index > -1) {
      expandedKeys.value.splice(index, 1);
    } else {
      expandedKeys.value.push(key);
    }
  } else if (data.type === 'folder') {
    const key = data.key;
    const index = expandedKeys.value.indexOf(key);
    if (index > -1) {
      expandedKeys.value.splice(index, 1);
    } else {
      expandedKeys.value.push(key);
    }
  }
};

const handleNodeSelect = async (selectedKeys, { node }) => {
  const data = node.dataRef;

  // Universal check to ensure correct connection is active
  if (data.connectionId && data.connectionId !== connectionStore.activeConnectionId) {
    await connectionStore.setActiveConnection(data.connectionId);
  }

  if (data.type === "database") {
    const details = connectionStore.connectionDetails[data.connectionId];
    const dbObjects = details ? details.dbObjects[data.database] : undefined;
    await connectionStore.setActiveDatabase(data.database);
    if (dbObjects) {
      uiStore.showObjectsView({ connectionId: data.connectionId, dbName: data.database });
    }
  } else if (data.type === 'folder') {
    if (data.database !== connectionStore.activeDatabaseName) {
      await connectionStore.setActiveDatabase(data.database);
    }
    uiStore.showObjectsView({ connectionId: data.connectionId, dbName: data.database });
  } else if (data.type === "table" || data.type === "view") {
    // We also need to make sure the database is active before emitting
    if (data.database !== connectionStore.activeDatabaseName) {
      await connectionStore.setActiveDatabase(data.database);
    }
    emit("node-click", {
      ...data,
      table: data.table || data.view,
      type: "table",
    });
  }
};

const handleContextCommand = async (command, dataRef) => {
  if (dataRef.type === "view") dataRef.table = dataRef.view;

  // For delete, we don't need to connect first.
  if (command === 'deleteConnection') {
    deleteConnection(dataRef.key);
    return;
  }

  // Ensure the connection is active before performing any other action
  if (dataRef.connectionId && dataRef.connectionId !== connectionStore.activeConnectionId) {
    await connectionStore.setActiveConnection(dataRef.connectionId);
  } else if (dataRef.type === 'connection' && dataRef.key !== connectionStore.activeConnectionId) {
    await connectionStore.setActiveConnection(dataRef.key);
  }

  switch (command) {
    case "refresh":
      await connectionStore.loadDatabases();
      message.success("已刷新");
      break;
    case "newDatabase":
      confirmNewDatabase(dataRef);
      break;
    case "editConnection":
      connectionToEdit.value = dataRef.connection;
      showEditConnectionDialog.value = true;
      break;
    case "viewData":
      emit("node-click", { ...dataRef, action: "viewData" });
      break;
    case "viewStructure":
      emit("node-click", { ...dataRef, action: "viewStructure" });
      break;
    case "viewDDL":
      await showDDL(dataRef);
      break;
    case "renameTable":
      confirmRenameTable(dataRef);
      break;
    case "clearTable":
      confirmClearTable(dataRef);
      break;
    case "truncateTable":
      confirmTruncateTable(dataRef);
      break;
    case "deleteTable":
      confirmDeleteTable(dataRef);
      break;
    case "copyTable":
      uiStore.copy("table", dataRef);
      message.success(`对象 "${dataRef.table || dataRef.view}" 已复制`);
      break;
    case "pasteTable":
      await uiStore.paste({ connectionId: dataRef.connectionId, dbName: dataRef.database });
      break;
    case "export":
      tableToExport.value = dataRef;
      exportDialogVisible.value = true;
      break;
    case "newTable":
      emit("node-click", { ...dataRef, action: "newTable" });
      break;
  }
};

const confirmNewDatabase = async (connectionNode) => {
  // Fetch charsets and collations first
  const charsetResult = await queryStore.executeQuery(connectionNode.key, null, 'SHOW CHARACTER SET');
  const collationResult = await queryStore.executeQuery(connectionNode.key, null, 'SHOW COLLATION');

  if (!charsetResult.success || !collationResult.success) {
      message.error("无法获取字符集和排序规则列表");
      return;
  }

  const allCharsets = charsetResult.data.map(row => ({ value: row.Charset, label: row.Charset }));
  const allCollations = collationResult.data.map(row => ({ value: row.Collation, label: row.Collation, charset: row.Charset }));

  const newDbInfo = reactive({
    name: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_0900_ai_ci'
  });

  const filteredCollations = computed(() => {
      return allCollations.filter(c => c.charset === newDbInfo.charset);
  });

  // Reset collation if charset changes
  watch(() => newDbInfo.charset, () => {
      newDbInfo.collation = filteredCollations.value[0]?.value;
  });

  Modal.confirm({
    title: "新建数据库",
    content: () => h('div', { style: 'margin-top: 1em;' }, [
      h('p', "数据库名称:"),
      h(Input, {
        placeholder: "e.g., my_new_database",
        onChange: (e) => { newDbInfo.name = e.target.value; },
      }),
      h('p', { style: 'margin-top: 1em;' }, '字符集:'),
      h(Select, {
          style: { width: '100%' },
          value: newDbInfo.charset,
          options: allCharsets,
          onChange: (val) => { newDbInfo.charset = val; }
      }),
      h('p', { style: 'margin-top: 1em;' }, '排序规则:'),
      h(Select, {
          style: { width: '100%' },
          value: newDbInfo.collation,
          options: filteredCollations.value,
          onChange: (val) => { newDbInfo.collation = val; }
      })
    ]),
    onOk: async () => {
      if (!newDbInfo.name || newDbInfo.name.trim() === "") {
        message.error("数据库名称不能为空");
        return Promise.reject("数据库名称不能为空");
      }
      try {
        let sql = `CREATE DATABASE 
${newDbInfo.name.trim()}
`;
        if (newDbInfo.charset) {
            sql += ` CHARACTER SET ${newDbInfo.charset}`;
        }
        if (newDbInfo.collation) {
            sql += ` COLLATE ${newDbInfo.collation}`;
        }
        await queryStore.executeQuery(connectionNode.key, null, sql);
        message.success("数据库创建成功");
        await connectionStore.loadDatabases(); // Refresh database list
      } catch (error) {
        message.error(`创建失败: ${error.message}`);
        return Promise.reject(error);
      }
    },
  });
};

const confirmRenameTable = (tableNode) => {
  let newTableName = tableNode.table || tableNode.view;
  Modal.confirm({
    title: `重命名 "${newTableName}"`,
    content: h("div", { style: "margin-top: 1em;" }, [
      h("p", "请输入新的名称:"),
      h(Input, {
        defaultValue: newTableName,
        onChange: (e) => {
          newTableName = e.target.value;
        },
      }),
    ]),
    onOk: async () => {
      if (!newTableName || newTableName.trim() === "") {
        message.error("名称不能为空");
        return Promise.reject("名称不能为空");
      }
      if (newTableName === (tableNode.table || tableNode.view)) return;
      try {
        // ✅ 修复语法错误，正确拼接 SQL 语句
        const sql =
          "RENAME TABLE `" +
          tableNode.database +
          "`.`" +
          (tableNode.table || tableNode.view) +
          "` TO `" +
          tableNode.database +
          "`.`" +
          newTableName +
          "`";

        await queryStore.executeQuery(tableNode.connectionId, tableNode.database, sql);
        message.success("重命名成功");
        await connectionStore.setActiveDatabase(tableNode.database, true); // Force refresh
      } catch (error) {
        message.error(`重命名失败: ${error.message}`);
        return Promise.reject(error);
      }
    },
  });
};

const showDDL = async (node) => {
  try {
    const sql = `SHOW CREATE ${node.type.toUpperCase()} 
${node.database}
.
${node.table || node.view}
`;
    const result = await queryStore.executeQuery(node.connectionId, node.database, sql);
    if (result.success && result.data.length > 0) {
      ddlContent.value =
        result.data[0]["Create Table"] || result.data[0]["Create View"];
      ddlVisible.value = true;
    }
  } catch (error) {
    message.error(`获取DDL失败: ${error.message}`);
  }
};

const copyDDL = async () => {
  try {
    await navigator.clipboard.writeText(ddlContent.value);
    message.success("复制成功");
  } catch (error) {
    message.error("复制失败");
  }
};

const confirmClearTable = (node) => {
  Modal.confirm({
    title: `确认清空表`,
    content: `您确定要清空表 "${node.database}.${node.table}" 中的所有数据吗？此操作不可恢复。`,
    okText: "确认清空",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      try {
        const sql = `DELETE FROM 
${node.database}
.
${node.table}
`;
        await queryStore.executeQuery(node.connectionId, node.database, sql);
        message.success("表已清空");
        await connectionStore.setActiveDatabase(node.database, true); // Force refresh
      } catch (error) {
        message.error(`清空失败: ${error.message}`);
      }
    },
  });
};

const confirmTruncateTable = (node) => {
  Modal.confirm({
    title: `确认截断表`,
    content: `您确定要截断表 "${node.database}.${node.table}" 吗？此操作会重置自增计数器，且不可恢复。`,
    okText: "确认截断",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      try {
        const sql = `TRUNCATE TABLE 
${node.database}
.
${node.table}
`;
        await queryStore.executeQuery(node.connectionId, node.database, sql);
        message.success("表已截断");
        await connectionStore.setActiveDatabase(node.database, true); // Force refresh
      } catch (error) {
        message.error(`截断失败: ${error.message}`);
      }
    },
  });
};

const confirmDeleteTable = (node) => {
  Modal.confirm({
    title: `确认删除${node.type === "view" ? "视图" : "表"}`,
    content: `您确定要删除 "${node.database}.${node.table || node.view}" 吗？此操作不可恢复。`,
    okText: "确认删除",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      try {
        const sql = `DROP ${node.type.toUpperCase()} 
${node.database}
.
${node.table || node.view}
`;
        await queryStore.executeQuery(node.connectionId, node.database, sql);
        message.success("删除成功");
        await connectionStore.setActiveDatabase(node.database, true); // Force refresh
      } catch (error) {
        message.error(`删除失败: ${error.message}`);
      }
    },
  });
};

const deleteConnection = (connectionId) => {
  Modal.confirm({
    title: "确认删除连接",
    content: "您确定要删除此连接吗？此操作不可恢复。",
    okText: "确认删除",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      try {
        await connectionStore.closeConnection(connectionId);
        message.success("连接已删除");
      } catch (error) {
        message.error(`删除连接失败: ${error.message}`);
      }
    },
  });
};

const handleUpdated = () => {
  showEditConnectionDialog.value = false;
  connectionToEdit.value = null;
  connectionStore.loadConnections();
};

onMounted(() => {
  connectionStore.loadConnections();
});
</script>

<style scoped>
.database-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tree-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.tree-header :deep(.ant-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.node-label {
  flex: 1;
}
.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-connected {
  color: #52c41a;
}
:deep(.ant-tree-treenode) {
  width: 100%;
}
:deep(.ant-tree-node-content-wrapper) {
  display: flex;
  align-items: center;
  flex: 1;
}
:deep(.ant-tree-iconEle) {
  margin-right: 6px;
}
.ddl-textarea {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}
</style>