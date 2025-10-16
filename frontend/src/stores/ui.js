// Pinia状态管理 - 全局UI状态
import { defineStore } from 'pinia'
import { useQueryStore } from './query'
import { useConnectionStore } from './connection'
import { message } from 'ant-design-vue'

export const useUIStore = defineStore('ui', {
  state: () => ({
    clipboard: null, // { type: 'table', data: { ... } | [{...}] }
    activeMainTab: 'objects', // The key of the active tab in Home.vue
    objectsViewTarget: null, // { connectionId, dbName }
    dataTabs: [], // { name, label, type, database, table }
  }),

  actions: {
    copy(type, data) {
      this.clipboard = { type, data };
    },

    clearClipboard() {
      this.clipboard = null;
    },

        async paste(targetDb) {
          if (!this.clipboard || this.clipboard.type !== 'table') {
            return;
          }
          if (!targetDb || !targetDb.dbName || !targetDb.connectionId) {
            message.error('粘贴操作失败: 无效的目标数据库。');
            return;
          }
    
          const queryStore = useQueryStore();
          const connectionStore = useConnectionStore();
          
          const sources = Array.isArray(this.clipboard.data) ? this.clipboard.data : [this.clipboard.data];
          const targetDbName = targetDb.dbName;
          const targetConnectionId = targetDb.connectionId;
    
          const hide = message.loading(`正在粘贴 ${sources.length} 个对象到 "${targetDbName}"...`, 0);
    
          try {
            for (const source of sources) {
              if (!source || !source.table || !source.database || !source.connectionId) {
                console.warn('Skipping invalid source object in clipboard:', source);
                continue;
              }
    
              const newName = `${source.table || source.view}_copy`;
              const sourceConnectionId = source.connectionId;
              const sourceDb = source.database;
    
              // 1. Get DDL
              const ddlSql = `SHOW CREATE TABLE \`${sourceDb}\`.\`${source.table || source.view}\``;
              const ddlResult = await queryStore.executeQuery(sourceConnectionId, sourceDb, ddlSql);
              if (!ddlResult.success || !ddlResult.data.length) {
                throw new Error(`获取原对象DDL失败: ${source.table}`);
              }
              let createSql = ddlResult.data[0]['Create Table'];
    
              // 2. Modify DDL for new table
              createSql = createSql.replace(
                new RegExp(`CREATE TABLE \`${source.table || source.view}\``),
                `CREATE TABLE \`${targetDbName}\`.\`${newName}\``
              );
    
              // 3. Create new table
              await queryStore.executeQuery(targetConnectionId, targetDbName, createSql);
    
                        // 4. Copy data
                        const selectSql = `SELECT * FROM \`${sourceDb}\`.\`${source.table || source.view}\``;
                        const dataResult = await queryStore.executeQuery(sourceConnectionId, sourceDb, selectSql);
              
                        if (dataResult.success && dataResult.data.length > 0) {
                          const columns = Object.keys(dataResult.data[0]);
                          const insertTpl = `INSERT INTO \`${targetDbName}\`.\`${newName}\` (\`${columns.join('\`, \`')}\`) VALUES \n`;
                          
                          const values = dataResult.data.map(row => 
                            '(' + columns.map(col => 
                              row[col] === null ? 'NULL' : `'${String(row[col]).replace(/'/g, "''")}'`
                            ).join(', ') + ')'
                          ).join(',\n');
              
                          const insertSql = insertTpl + values + ';';
              
                          await queryStore.executeQuery(targetConnectionId, targetDbName, insertSql);
                        }            }
            
    hide();
            message.success(`成功粘贴 ${sources.length} 个对象!`);
            await connectionStore.setActiveDatabase(targetDbName, true);
    
          } catch (error) {
            hide();
            console.error('Paste operation failed:', error);
            message.error(`粘贴失败: ${error.message}`);
          }
        },
    setActiveMainTab(key) {
      this.activeMainTab = key;
    },

    showObjectsView(target) { // target: { connectionId, dbName }
      this.objectsViewTarget = target;
      this.activeMainTab = 'objects';
    },

    openDataTab(tabInfo) { // { connectionId, table, database, type: 'data' | 'structure' }
      const tabType = tabInfo.type || 'data';
      const tabName = `${tabInfo.connectionId}-${tabInfo.database}-${tabInfo.table}-${tabType}`; // Changed
      const existingTab = this.dataTabs.find(tab => tab.name === tabName);

      if (!existingTab) {
        const tabLabel = tabType === 'structure'
          ? `${tabInfo.table} (结构)`
          : `${tabInfo.table} (数据)`;
        
        this.dataTabs.push({
          name: tabName,
          label: tabLabel,
          type: tabType,
          connectionId: tabInfo.connectionId, // Add connectionId to tab data
          database: tabInfo.database,
          table: tabInfo.table
        });
      }
      this.activeMainTab = tabName;
    },

    openNewTableTab(tabInfo) { // { connectionId, database }
      const tabName = `new-table-${tabInfo.connectionId}-${tabInfo.database}`; // Changed
      const existingTab = this.dataTabs.find(tab => tab.name === tabName);

      if (!existingTab) {
        const tabLabel = `新建表`;
        this.dataTabs.push({
          name: tabName,
          label: tabLabel,
          type: 'new_table',
          connectionId: tabInfo.connectionId, // Add connectionId
          database: tabInfo.database,
          table: null
        });
      }
      this.activeMainTab = tabName;
    },

    closeDataTab(tabKey) {
      const index = this.dataTabs.findIndex(tab => tab.name === tabKey);
      if (index > -1) {
        this.dataTabs.splice(index, 1);
      }
      if (this.activeMainTab === tabKey) {
        this.activeMainTab = 'objects';
      }
    },

    closeTabsForConnection(connectionId) {
      this.dataTabs = this.dataTabs.filter(tab => tab.connectionId !== connectionId);
      if (this.activeMainTab !== 'objects' && this.activeMainTab !== 'query') {
        const activeTabExists = this.dataTabs.some(tab => tab.name === this.activeMainTab);
        if (!activeTabExists) {
          this.activeMainTab = 'objects';
        }
      }
    }
  }
})
