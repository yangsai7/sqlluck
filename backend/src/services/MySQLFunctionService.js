const ConnectionManager = require('./ConnectionManager');
const MySQLDialect = require('./MySQLDialect');

class MySQLFunctionService {
  constructor() {
    this.availableFunctions = {
      get_table_schema: this.getTableSchema.bind(this),
      get_all_table_schemas: this.getAllTableSchemas.bind(this),
      query: this.query.bind(this),
      // Add other MySQL related functions here
    };
  }

  async getTableSchema(connectionId, database, tableName) {
    try {
      const connection = ConnectionManager.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} not found.`);
      }

      const sql = MySQLDialect.showCreateTable(database, tableName);
      const queryResult = await connection.query(sql);

      if (queryResult.success && queryResult.data && queryResult.data.length > 0 && queryResult.data[0]['Create Table']) {
        return queryResult.data[0]['Create Table'];
      }
      return `Table ${tableName} schema not found.`;
    } catch (error) {
      console.error('Error in getTableSchema:', error);
      throw error;
    }
  }

  async getAllTableSchemas(connectionId, database) {
    try {
      const connection = ConnectionManager.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} not found.`);
      }

      const listTablesSql = MySQLDialect.showTables(database);
      const tablesResult = await connection.query(listTablesSql);

      if (!tablesResult.success || !tablesResult.data || tablesResult.data.length === 0) {
        return `No tables found in database ${database}.`;
      }

      const tableNames = tablesResult.data.map(row => Object.values(row)[0]);
      const allSchemas = {};

      for (const tableName of tableNames) {
        try {
          const schema = await this.getTableSchema(connectionId, database, tableName);
          allSchemas[tableName] = schema;
        } catch (error) {
          console.warn(`Could not get schema for table ${tableName}: ${error.message}`);
          allSchemas[tableName] = `Error getting schema: ${error.message}`;
        }
      }
      return allSchemas;

    } catch (error) {
      console.error('Error in getAllTableSchemas:', error);
      throw error;
    }
  }

  async query(connectionId, database, sql) {
    try {
      const connection = ConnectionManager.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} not found.`);
      }
      const queryResult = await connection.query(sql, [], database);
      if (queryResult.success) {
        return queryResult.data;
      }
      throw new Error(queryResult.error);
    } catch (error) {
      console.error('Error in query function:', error);
      throw error;
    }
  }

  async executeFunction(functionName, args) {
    if (!this.availableFunctions[functionName]) {
      throw new Error(`Function ${functionName} not found.`);
    }
    return this.availableFunctions[functionName](...args);
  }
}

module.exports = MySQLFunctionService;