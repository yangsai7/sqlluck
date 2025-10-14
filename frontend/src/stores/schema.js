import { defineStore } from 'pinia';
import { connectionAPI, queryAPI } from '@/api';

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {},
    loading: false,
  }),

  actions: {
    async fetchSchema(connectionId, databaseName) {
      if (!connectionId || !databaseName) return;

      this.loading = true;
      try {
        const [tables, views, functions, procedures] = await Promise.all([
          connectionAPI.getTables(connectionId, databaseName),
          connectionAPI.getViews(connectionId, databaseName),
          connectionAPI.getFunctions(connectionId, databaseName),
          connectionAPI.getProcedures(connectionId, databaseName),
        ]);

        const tableStructures = await Promise.all(
          tables.tables.map(table => 
            queryAPI.getTableStructure(connectionId, databaseName, table.name)
              .then(structure => ({ tableName: table.name, columns: structure.data }))
          )
        );

        const schemaForDb = {
          tables: tableStructures,
          views: views.views,
          functions: functions.functions,
          procedures: procedures.procedures,
        };

        this.schema[databaseName] = schemaForDb;
      } catch (error) {
        console.error('Failed to fetch schema:', error);
      } finally {
        this.loading = false;
      }
    },

    getSchema(databaseName) {
      return this.schema[databaseName];
    },
  },
});
