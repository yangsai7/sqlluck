const ConnectionManager = require('./ConnectionManager');

const hotSqlState = new Map(); // Map<connectionId, { previousData: Map, lastFetchTime: number, history: Map<string, any[]> }>

class PerformanceService {
  async getPerformanceMetrics(connectionId) {
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const [statusResult, variablesResult] = await Promise.all([
      connection.query('SHOW GLOBAL STATUS'),
      connection.query('SHOW GLOBAL VARIABLES'),
    ]);

    if (!statusResult.success) {
      throw new Error(statusResult.error);
    }
    if (!variablesResult.success) {
      throw new Error(variablesResult.error);
    }

    const status = statusResult.data.reduce((acc, row) => {
      acc[row.Variable_name] = row.Value;
      return acc;
    }, {});

    const variables = variablesResult.data.reduce((acc, row) => {
      acc[row.Variable_name] = row.Value;
      return acc;
    }, {});

    const innodb_buffer_pool_read_requests = parseInt(status.Innodb_buffer_pool_read_requests, 10);
    const innodb_buffer_pool_reads = parseInt(status.Innodb_buffer_pool_reads, 10);
    const innodb_buffer_pool_hit_rate = innodb_buffer_pool_read_requests > 0 
      ? (1 - (innodb_buffer_pool_reads / innodb_buffer_pool_read_requests)) * 100 
      : 0;

    const innodb_buffer_pool_size = parseInt(variables.innodb_buffer_pool_size, 10);
    const innodb_page_size = parseInt(variables.innodb_page_size, 10);
    const innodb_buffer_pool_pages_total = parseInt(status.Innodb_buffer_pool_pages_total, 10);
    const innodb_buffer_pool_pages_free = parseInt(status.Innodb_buffer_pool_pages_free, 10);
    const innodb_buffer_pool_usage = innodb_buffer_pool_pages_total > 0
      ? ((innodb_buffer_pool_pages_total - innodb_buffer_pool_pages_free) / innodb_buffer_pool_pages_total) * 100
      : 0;
    const innodb_buffer_pool_used_bytes = (innodb_buffer_pool_pages_total - innodb_buffer_pool_pages_free) * innodb_page_size;

    const dbName = connection.config.database;
    let tables = [];
    if (dbName) {
      const tableResult = await connection.query(`
        SELECT table_name, table_rows, data_length, index_length
        FROM information_schema.TABLES
        WHERE table_schema = ?
        ORDER BY (data_length + index_length) DESC
        LIMIT 10;
      `, [dbName]);

      if (tableResult.success) {
        tables = tableResult.data.map(row => ({
          name: row.table_name,
          rows: row.table_rows,
          size: row.data_length + row.index_length,
        }));
      }
    }

    return {
      innodb_buffer_pool_reads,
      innodb_buffer_pool_read_requests,
      innodb_buffer_pool_hit_rate,
      innodb_buffer_pool_size,
      innodb_buffer_pool_used_bytes,
      innodb_buffer_pool_usage,
      connections: parseInt(status.Threads_connected, 10),
      innodb_row_lock_waits: parseInt(status.Innodb_row_lock_waits, 10),
      slow_queries: parseInt(status.Slow_queries, 10),
      innodb_os_log_written: parseInt(status.Innodb_os_log_written, 10),
      innodb_os_log_fsyncs: parseInt(status.Innodb_os_log_fsyncs, 10),
      innodb_log_waits: parseInt(status.Innodb_log_waits, 10),
      com_commit: parseInt(status.Com_commit, 10),
      com_rollback: parseInt(status.Com_rollback, 10),
      com_insert: parseInt(status.Com_insert, 10),
      com_update: parseInt(status.Com_update, 10),
      com_delete: parseInt(status.Com_delete, 10),
      com_replace: parseInt(status.Com_replace, 10),
      queries: parseInt(status.Queries, 10),
      tables,
    };
  }

  async getLockInfo(connectionId) {
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const psCheckResult = await connection.query("SHOW VARIABLES LIKE 'performance_schema'");
    if (!psCheckResult.success) {
      throw new Error(psCheckResult.error);
    }

    const psEnabled = psCheckResult.data.length > 0 && psCheckResult.data[0].Value === 'ON';

    if (!psEnabled) {
      return { lockWaits: [], allLocks: [], performanceSchemaEnabled: false, queries: {} };
    }

    const lockWaitsQuery = `
      SELECT 
        r.trx_id AS waiting_trx_id,
        r.trx_mysql_thread_id AS waiting_thread,
        r.trx_query AS waiting_query,
        b.trx_id AS blocking_trx_id,
        b.trx_mysql_thread_id AS blocking_thread,
        b.trx_query AS blocking_query,
        dl.OBJECT_SCHEMA,
        dl.OBJECT_NAME,
        dl.INDEX_NAME,
        dl.LOCK_TYPE,
        dl.LOCK_MODE,
        dl.LOCK_STATUS
      FROM performance_schema.data_lock_waits w
      JOIN information_schema.INNODB_TRX r ON w.REQUESTING_ENGINE_TRANSACTION_ID = r.trx_id
      JOIN information_schema.INNODB_TRX b ON w.BLOCKING_ENGINE_TRANSACTION_ID = b.trx_id
      JOIN performance_schema.data_locks dl ON w.REQUESTING_ENGINE_LOCK_ID = dl.ENGINE_LOCK_ID;
    `;
    const allLocksQuery = `SELECT * FROM performance_schema.data_locks`;

    const [lockWaits, allLocks] = await Promise.all([
      this.getLockWaits(connectionId, lockWaitsQuery),
      this.getAllLocks(connectionId, allLocksQuery),
    ]);
    return { lockWaits, allLocks, performanceSchemaEnabled: true, queries: { lockWaits: lockWaitsQuery, allLocks: allLocksQuery } };
  }

  async getAllLocks(connectionId, query) {
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const result = await connection.query(query);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  async getLockWaits(connectionId, query) {
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const result = await connection.query(query);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  async getHotSql(connectionId) {
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const psCheckResult = await connection.query("SHOW VARIABLES LIKE 'performance_schema'");
    if (!psCheckResult.success) {
      throw new Error(psCheckResult.error);
    }

    const psEnabled = psCheckResult.data.length > 0 && psCheckResult.data[0].Value === 'ON';

    if (!psEnabled) {
      return [];
    }

    const query = `
      SELECT
        DIGEST,
        DIGEST_TEXT,
        COUNT_STAR,
        SUM_TIMER_WAIT,
        AVG_TIMER_WAIT,
        SUM_ROWS_SENT,
        SUM_ROWS_EXAMINED
      FROM performance_schema.events_statements_summary_by_digest
      ORDER BY SUM_TIMER_WAIT DESC
      LIMIT 20;
    `;

    const result = await connection.query(query);
    if (!result.success) {
      throw new Error(result.error);
    }

    if (!hotSqlState.has(connectionId)) {
      hotSqlState.set(connectionId, {
        previousData: new Map(),
        lastFetchTime: null,
        history: new Map(),
      });
    }
    const state = hotSqlState.get(connectionId);

    const currentTime = Date.now();
    const timeDelta = state.lastFetchTime ? (currentTime - state.lastFetchTime) / 1000 : 5;
    state.lastFetchTime = currentTime;

    const processedData = result.data.map(row => {
      const previousRow = state.previousData.get(row.DIGEST);
      let executions_per_second = 0;
      if (previousRow) {
        const countDelta = row.COUNT_STAR - previousRow.COUNT_STAR;
        executions_per_second = countDelta / timeDelta;
      }

      if (!state.history.has(row.DIGEST)) {
        state.history.set(row.DIGEST, []);
      }
      const history = state.history.get(row.DIGEST);
      history.push({
        timestamp: currentTime,
        executions_per_second,
        AVG_TIMER_WAIT_MS: row.AVG_TIMER_WAIT / 1e9,
      });
      if (history.length > 20) { // Keep last 20 data points
        history.shift();
      }

      return {
        ...row,
        SUM_TIMER_WAIT_MS: row.SUM_TIMER_WAIT / 1e9,
        AVG_TIMER_WAIT_MS: row.AVG_TIMER_WAIT / 1e9,
        executions_per_second,
        AVG_ROWS_SENT: row.COUNT_STAR > 0 ? row.SUM_ROWS_SENT / row.COUNT_STAR : 0,
        AVG_ROWS_EXAMINED: row.COUNT_STAR > 0 ? row.SUM_ROWS_EXAMINED / row.COUNT_STAR : 0,
        history,
      };
    });

    state.previousData.clear();
    result.data.forEach(row => {
      state.previousData.set(row.DIGEST, row);
    });

    return processedData;
  }
}

module.exports = new PerformanceService();
