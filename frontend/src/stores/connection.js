import { defineStore } from 'pinia';
import { connectionAPI } from '@/api';
import { useUIStore } from './ui';

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    connections: [],
    activeConnectionId: null,
    connectionDetails: {}, // { [connId]: { databases: [], activeDatabaseName: null, dbObjects: {} } }
    openedDatabases: new Set(), // Tracks opened DBs for the session (connId-dbName)
    loading: false,
    error: null
  }),

  getters: {
    activeConnection: (state) => {
      return state.connections.find(conn => conn.id === state.activeConnectionId)
    },
    isConnected: (state) => {
      return state.activeConnectionId !== null
    },
    activeDatabaseName: (state) => {
      if (!state.activeConnectionId || !state.connectionDetails[state.activeConnectionId]) return null;
      return state.connectionDetails[state.activeConnectionId].activeDatabaseName;
    },
    databases: (state) => {
      if (!state.activeConnectionId || !state.connectionDetails[state.activeConnectionId]) return [];
      return state.connectionDetails[state.activeConnectionId].databases;
    },
    dbObjects: (state) => {
        if (!state.activeConnectionId || !state.connectionDetails[state.activeConnectionId]) return {};
        return state.connectionDetails[state.activeConnectionId].dbObjects;
    }
  },

  actions: {
    async testConnection(config) {
      this.loading = true
      this.error = null
      try {
        return await connectionAPI.test(config)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async createConnection(config) {
      this.loading = true
      this.error = null
      try {
        const result = await connectionAPI.create(config)
        if (result.success) {
          await this.loadConnections()
          await this.setActiveConnection(result.connectionId)
        }
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateConnection(config) {
      this.loading = true;
      this.error = null;
      try {
        const result = await connectionAPI.update(config.id, config);
        if (result.success) {
          await this.loadConnections();
        }
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadConnections() {
      try {
        const result = await connectionAPI.getAll()
        this.connections = result?.success && Array.isArray(result.connections) ? result.connections : []
      } catch (error) {
        this.error = error.message
        this.connections = []
        console.error('加载连接失败:', error)
      }
    },

    async setActiveConnection(connectionId) {
      if (this.activeConnectionId === connectionId) return;

      this.loading = true;
      this.error = null;

      try {
        // Ensure the connection is active on the backend
        const connectResult = await connectionAPI.connect(connectionId); 
        if (!connectResult.success) throw new Error(connectResult.error);

        this.activeConnectionId = connectionId;

        // Initialize details if not present
        if (!this.connectionDetails[connectionId]) {
          this.connectionDetails[connectionId] = {
            databases: [],
            activeDatabaseName: null,
            dbObjects: {}
          };
          // Fetch databases if they haven't been loaded for this connection
          await this.loadDatabases();
        }

      } catch (error) {
        this.error = error.message;
        this.activeConnectionId = null;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async closeConnection(connectionId) {
      const uiStore = useUIStore();
      try {
        await connectionAPI.close(connectionId);
        
        const index = this.connections.findIndex(c => c.id === connectionId);
        if (index > -1) {
          this.connections.splice(index, 1);
        }

        delete this.connectionDetails[connectionId];
        if (this.activeConnectionId === connectionId) {
          this.activeConnectionId = null;
        }

        uiStore.closeTabsForConnection(connectionId);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async loadDatabases() {
      if (!this.activeConnectionId) return
      this.loading = true
      try {
        const result = await connectionAPI.getDatabases(this.activeConnectionId)
        const dbs = result?.success && Array.isArray(result.databases) ? result.databases : [];
        this.connectionDetails[this.activeConnectionId].databases = dbs;
      } catch (error) {
        this.error = error.message
        this.connectionDetails[this.activeConnectionId].databases = [];
      } finally {
        this.loading = false
      }
    },

    async setActiveDatabase(databaseName, force = false) {
      if (!this.activeConnectionId) return;
      const dbKey = `${this.activeConnectionId}-${databaseName}`;
      this.connectionDetails[this.activeConnectionId].activeDatabaseName = databaseName;
      if (!databaseName) return;

      const currentDbObjects = this.connectionDetails[this.activeConnectionId].dbObjects[databaseName];
      if (currentDbObjects && !force) return; // Already loaded

      this.loading = true;
      try {
        const results = await Promise.all([
          connectionAPI.getTables(this.activeConnectionId, databaseName),
          connectionAPI.getViews(this.activeConnectionId, databaseName),
          connectionAPI.getFunctions(this.activeConnectionId, databaseName),
          connectionAPI.getProcedures(this.activeConnectionId, databaseName),
        ]);

        this.connectionDetails[this.activeConnectionId].dbObjects[databaseName] = {
          tables: results[0]?.success && Array.isArray(results[0].tables) ? results[0].tables : [],
          views: results[1]?.success && Array.isArray(results[1].views) ? results[1].views : [],
          functions: results[2]?.success && Array.isArray(results[2].functions) ? results[2].functions : [],
          procedures: results[3]?.success && Array.isArray(results[3].procedures) ? results[3].procedures : [],
        };

        // Mark as opened for this session
        this.openedDatabases.add(dbKey);

      } catch (error) {
        this.error = error.message;
        this.connectionDetails[this.activeConnectionId].dbObjects[databaseName] = { tables: [], views: [], functions: [], procedures: [] };
      } finally {
        this.loading = false;
      }
    },

    clearError() {
      this.error = null
    }
  }
})