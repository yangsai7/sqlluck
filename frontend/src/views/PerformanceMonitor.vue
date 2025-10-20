<template>
  <div class="performance-monitor-wrapper">
    <div class="performance-monitor">
      <div class="page-header">
        <h1>{{ connectionName || 'Performance Monitor' }}</h1>
        <div class="header-actions">
          <span>Auto-refreshing every 5 seconds</span>
          <a-button @click="fetchData">Refresh Now</a-button>
          <a-button @click="exportData" type="primary">Export</a-button>
        </div>
      </div>
      <a-row :gutter="[16, 16]">
        <a-col :span="8">
          <a-card :title="`连接数 (Connections)`" class="metric-card">
            <div ref="connectionsChart" style="width: 100%; height: 100%;"></div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :title="`TPS (Transactions Per Second)`" class="metric-card">
            <div class="single-metric">{{ tps }}</div>
            <div class="formula-display">
              <div>计算公式: (Δ(Com_commit) + Δ(Com_rollback)) / Δ(Time)</div>
              <div><b>Δ(Com_commit)</b>: {{ commitDelta }}</div>
              <div><b>Δ(Com_rollback)</b>: {{ rollbackDelta }}</div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :title="`QPS (Queries Per Second)`" class="metric-card">
            <div class="single-metric">{{ qps }}</div>
            <div class="formula-display">
              <div>计算公式: Δ(Queries) / Δ(Time)</div>
              <div><b>Δ(Queries)</b>: {{ queriesDelta }}</div>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="8">
          <a-card :title="`WPS (Writes Per Second)`" class="metric-card">
            <div class="single-metric">{{ wps }}</div>
            <div class="formula-display">
              <div>计算公式: (Δ(Com_insert) + Δ(Com_update) + Δ(Com_delete) + Δ(Com_replace)) / Δ(Time)</div>
              <div><b>Δ(Writes)</b>: {{ writeDelta }}</div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :title="`InnoDB缓冲池命中率 (Buffer Pool Hit Rate)`" class="metric-card">
            <div ref="bufferPoolHitRateChart" style="width: 100%; height: 100%;"></div>
            <div class="formula-display">
              <div>计算公式: (1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)) * 100%</div>
              <div><b>Innodb_buffer_pool_reads</b> (物理磁盘读取数): {{ innodb_buffer_pool_reads }}</div>
              <div><b>Innodb_buffer_pool_read_requests</b> (缓冲池读取数): {{ innodb_buffer_pool_read_requests }}</div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :title="`缓冲池使用情况 (Buffer Pool Usage)`" class="metric-card">
            <div ref="bufferPoolUsageChart" style="width: 100%; height: 100%;"></div>
            <div class="formula-display">
              <div><b>Total</b>: {{ (innodb_buffer_pool_size / 1024 / 1024).toFixed(2) }} MB</div>
              <div><b>Used</b>: {{ (innodb_buffer_pool_used_bytes / 1024 / 1024).toFixed(2) }} MB</div>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="8">
          <a-card :title="`行锁等待频率 (Row Lock Wait Frequency)`" class="metric-card">
            <div ref="rowLockChart" style="width: 100%; height: 100%;"></div>
            <div class="formula-display">
              <div>计算公式: Δ(Innodb_row_lock_waits) / (Δ(Com_commit) + Δ(Com_rollback))</div>
              <div><b>Δ(Innodb_row_lock_waits)</b>: {{ lockWaitsDelta }} ({{ previous_innodb_row_lock_waits }} -> {{ innodb_row_lock_waits }})</div>
              <div><b>Δ(Com_commit)</b>: {{ commitDelta }} ({{ previous_com_commit }} -> {{ com_commit }})</div>
              <div><b>Δ(Com_rollback)</b>: {{ rollbackDelta }} ({{ previous_com_rollback }} -> {{ com_rollback }})</div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="16">
          <a-card :title="`Redo Log`" class="metric-card">
            <a-list item-layout="horizontal" :data-source="redoLogData">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :description="item.description">
                    <template #title>{{ item.title }}</template>
                  </a-list-item-meta>
                  <div>{{ item.value }}</div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>
      <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
          <a-card :title="`锁信息 (Lock Info)`">
            <div v-if="!performanceSchemaEnabled">
              <a-alert
                message="Performance Schema is not enabled"
                description="To view lock information, you need to enable performance_schema in your MySQL configuration."
                type="warning"
                show-icon
              />
            </div>
            <div v-else>
              <a-collapse>
                <a-collapse-panel key="1" header="Show SQL Queries">
                  <pre><b>Lock Waits Query:</b>{{ lockQueries.lockWaits }}</pre>
                  <pre><b>All Locks Query:</b>{{ lockQueries.allLocks }}</pre>
                </a-collapse-panel>
              </a-collapse>
              <a-tabs default-active-key="1" style="margin-top: 16px">
                <a-tab-pane key="1" tab="锁等待 (Lock Waits)">
                  <a-table :columns="lockWaitsColumns" :data-source="lockWaitsData" :pagination="false">
                    <template #headerCell="{ column }">
                      {{ column.title }}
                      <a-tooltip v-if="column.explanation">
                        <template #title>{{ column.explanation }}</template>
                        <InfoCircleOutlined style="margin-left: 4px" />
                      </a-tooltip>
                    </template>
                  </a-table>
                </a-tab-pane>
                <a-tab-pane key="2" tab="所有锁 (All Locks)">
                  <a-table :columns="allLocksColumns" :data-source="allLocksData" :pagination="false">
                    <template #headerCell="{ column }">
                      {{ column.title }}
                      <a-tooltip v-if="column.explanation">
                        <template #title>{{ column.explanation }}</template>
                        <InfoCircleOutlined style="margin-left: 4px" />
                      </a-tooltip>
                    </template>
                  </a-table>
                </a-tab-pane>
              </a-tabs>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
          <a-card :title="`热点SQL (Hot SQL)`">
            <a-table
              :columns="hotSqlColumns"
              :data-source="hotSqlData"
              :pagination="false"
              @expand="handleExpand"
            >
              <template #expandedRowRender="{ record }">
                <div :ref="el => (chartRefs[record.DIGEST] = el)" style="height: 200px"></div>
              </template>
            </a-table>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import * as echarts from 'echarts';
import { performanceAPI } from '@/api';
import { useConnectionStore } from '@/stores/connection';
import { message, Row as ARow, Col as ACol, Card as ACard, Table as ATable, Tabs as ATabs, TabPane as ATabPane, Alert as AAlert, Tooltip as ATooltip, Collapse as ACollapse, CollapsePanel as ACollapsePanel, List as AList, ListItem as AListItem, ListItemMeta as AListItemMeta, Button as AButton } from 'ant-design-vue';
import { InfoCircleOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  connectionId: String,
});

const connectionStore = useConnectionStore();
const connectionName = computed(() => connectionStore.connections.find(c => c.id === props.connectionId)?.name);

let intervalId = null;
let previousData = null;
let lastFetchTime = null;

// Chart refs
const connectionsChart = ref(null);
const bufferPoolHitRateChart = ref(null);
const bufferPoolUsageChart = ref(null);
const rowLockChart = ref(null);
const chartRefs = ref({});
const chartInstances = new Map();

// Chart instances
let connectionsChartInstance = null;
let bufferPoolHitRateChartInstance = null;
let bufferPoolUsageChartInstance = null;
let rowLockChartInstance = null;

// Raw data for formulas
const innodb_buffer_pool_reads = ref(0);
const innodb_buffer_pool_read_requests = ref(0);
const innodb_row_lock_waits = ref(0);
const com_commit = ref(0);
const com_rollback = ref(0);
const previous_innodb_row_lock_waits = ref(0);
const previous_com_commit = ref(0);
const previous_com_rollback = ref(0);
const lockWaitsDelta = ref(0);
const commitDelta = ref(0);
const rollbackDelta = ref(0);
const innodb_buffer_pool_size = ref(0);
const innodb_buffer_pool_used_bytes = ref(0);
const writeDelta = ref(0);
const queriesDelta = ref(0);

// TPS, QPS, WPS
const tps = ref(0);
const qps = ref(0);
const wps = ref(0);

// Redo log data
const redoLogData = ref([]);

const lockWaitsColumns = [
  { title: 'Waiting TRX ID', dataIndex: 'waiting_trx_id', key: 'waiting_trx_id', explanation: '等待锁的事务ID' },
  { title: 'Waiting Thread', dataIndex: 'waiting_thread', key: 'waiting_thread', explanation: '等待锁的线程ID' },
  { title: 'Waiting Query', dataIndex: 'waiting_query', key: 'waiting_query', explanation: '等待锁的SQL查询' },
  { title: 'Blocking TRX ID', dataIndex: 'blocking_trx_id', key: 'blocking_trx_id', explanation: '持有锁的事务ID' },
  { title: 'Blocking Thread', dataIndex: 'blocking_thread', key: 'blocking_thread', explanation: '持有锁的线程ID' },
  { title: 'Blocking Query', dataIndex: 'blocking_query', key: 'blocking_query', explanation: '持有锁的SQL查询' },
  { title: 'Object', dataIndex: 'OBJECT_NAME', key: 'OBJECT_NAME', explanation: '锁定的对象名称' },
  { title: 'Lock Mode', dataIndex: 'LOCK_MODE', key: 'LOCK_MODE', explanation: '锁的模式' },
];
const lockWaitsData = ref([]);

const allLocksColumns = [
  { title: 'Engine', dataIndex: 'ENGINE', key: 'ENGINE', explanation: '存储引擎' },
  { title: 'Engine Lock ID', dataIndex: 'ENGINE_LOCK_ID', key: 'ENGINE_LOCK_ID', explanation: '引擎锁ID' },
  { title: 'Engine TRX ID', dataIndex: 'ENGINE_TRANSACTION_ID', key: 'ENGINE_TRANSACTION_ID', explanation: '引擎事务ID' },
  { title: 'Thread ID', dataIndex: 'THREAD_ID', key: 'THREAD_ID', explanation: '线程ID' },
  { title: 'Object Schema', dataIndex: 'OBJECT_SCHEMA', key: 'OBJECT_SCHEMA', explanation: '对象所属的数据库' },
  { title: 'Object Name', dataIndex: 'OBJECT_NAME', key: 'OBJECT_NAME', explanation: '对象名称' },
  { title: 'Lock Type', dataIndex: 'LOCK_TYPE', key: 'LOCK_TYPE', explanation: '锁的类型' },
  { title: 'Lock Mode', dataIndex: 'LOCK_MODE', key: 'LOCK_MODE', explanation: '锁的模式' },
  { title: 'Lock Status', dataIndex: 'LOCK_STATUS', key: 'LOCK_STATUS', explanation: '锁的状态' },
];
const allLocksData = ref([]);

const hotSqlColumns = [
  { title: '查询 (Query)', dataIndex: 'DIGEST_TEXT', key: 'DIGEST_TEXT', width: '40%' },
  { title: '每秒执行 (Exec/s)', dataIndex: 'executions_per_second', key: 'executions_per_second', align: 'right' },
  { title: '总耗时 (Total Time, ms)', dataIndex: 'SUM_TIMER_WAIT_MS', key: 'SUM_TIMER_WAIT_MS', align: 'right' },
  { title: '平均耗时 (Avg Time, ms)', dataIndex: 'AVG_TIMER_WAIT_MS', key: 'AVG_TIMER_WAIT_MS', align: 'right' },
  { title: '平均发送行数 (Avg Rows Sent)', dataIndex: 'AVG_ROWS_SENT', key: 'AVG_ROWS_SENT', align: 'right' },
  { title: '平均扫描行数 (Avg Rows Examined)', dataIndex: 'AVG_ROWS_EXAMINED', key: 'AVG_ROWS_EXAMINED', align: 'right' },
];
const hotSqlData = ref([]);

const performanceSchemaEnabled = ref(true);
const lockQueries = ref({ lockWaits: '', allLocks: '' });

const exportData = () => {
  const dataToExport = {
    timestamp: new Date().toISOString(),
    connection: connectionName.value,
    metrics: {
      tps: tps.value,
      qps: qps.value,
      wps: wps.value,
      bufferPoolHitRate: previousData?.innodb_buffer_pool_hit_rate,
      bufferPoolUsage: previousData?.innodb_buffer_pool_usage,
      connections: previousData?.connections,
    },
    redoLog: redoLogData.value,
    locks: {
      lockWaits: lockWaitsData.value,
      allLocks: allLocksData.value,
    },
    hotSql: hotSqlData.value,
  };

  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

  const exportFileDefaultName = `performance-data-${new Date().toISOString()}.json`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

const handleExpand = (expanded, record) => {
  if (expanded) {
    nextTick(() => {
      const chartEl = chartRefs.value[record.DIGEST];
      if (chartEl) {
        const chartInstance = echarts.init(chartEl);
        const option = {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: record.history.map(h => new Date(h.timestamp).toLocaleTimeString()) },
          yAxis: [{ type: 'value', name: 'Exec/s' }, { type: 'value', name: 'Avg Time (ms)' }],
          series: [
            { name: 'Exec/s', type: 'line', yAxisIndex: 0, data: record.history.map(h => h.executions_per_second.toFixed(2)) },
            { name: 'Avg Time (ms)', type: 'line', yAxisIndex: 1, data: record.history.map(h => h.AVG_TIMER_WAIT_MS.toFixed(2)) },
          ]
        };
        chartInstance.setOption(option);
        chartInstances.set(record.DIGEST, chartInstance);
      }
    });
  } else {
    const chartInstance = chartInstances.get(record.DIGEST);
    if (chartInstance) {
      chartInstance.dispose();
      chartInstances.delete(record.DIGEST);
    }
  }
};

const fetchData = async () => {
  if (!props.connectionId) {
    message.error('No active connection');
    return;
  }

  try {
    const currentTime = Date.now();
    const timeDelta = lastFetchTime ? (currentTime - lastFetchTime) / 1000 : 5;
    lastFetchTime = currentTime;

    // Fetch performance metrics
    const performanceData = await performanceAPI.getPerformanceMetrics(props.connectionId);
    updateCharts(performanceData, timeDelta);

    if (previousData) {
      previous_innodb_row_lock_waits.value = previousData.innodb_row_lock_waits;
      previous_com_commit.value = previousData.com_commit;
      previous_com_rollback.value = previousData.com_rollback;
    }

    innodb_buffer_pool_reads.value = performanceData.innodb_buffer_pool_reads;
    innodb_buffer_pool_read_requests.value = performanceData.innodb_buffer_pool_read_requests;
    innodb_row_lock_waits.value = performanceData.innodb_row_lock_waits;
    com_commit.value = performanceData.com_commit;
    com_rollback.value = performanceData.com_rollback;
    innodb_buffer_pool_size.value = performanceData.innodb_buffer_pool_size;
    innodb_buffer_pool_used_bytes.value = performanceData.innodb_buffer_pool_used_bytes;

    previousData = performanceData;

    // Fetch lock info
    const lockResponse = await performanceAPI.getLockInfo(props.connectionId);
    performanceSchemaEnabled.value = lockResponse.performanceSchemaEnabled;
    if (performanceSchemaEnabled.value) {
      lockWaitsData.value = lockResponse.lockWaits;
      allLocksData.value = lockResponse.allLocks;
      lockQueries.value = lockResponse.queries;
    }

    // Fetch hot sql
    const hotSqlResponse = await performanceAPI.getHotSql(props.connectionId);
    hotSqlData.value = hotSqlResponse.map(row => ({
      ...row,
      executions_per_second: row.executions_per_second.toFixed(2),
      SUM_TIMER_WAIT_MS: row.SUM_TIMER_WAIT_MS.toFixed(2),
      AVG_TIMER_WAIT_MS: row.AVG_TIMER_WAIT_MS.toFixed(2),
      AVG_ROWS_SENT: row.AVG_ROWS_SENT.toFixed(2),
      AVG_ROWS_EXAMINED: row.AVG_ROWS_EXAMINED.toFixed(2),
    }));

  } catch (error) {
    message.error('Failed to fetch data');
    console.error(error);
  }
};

const updateCharts = (data, timeDelta) => {
  updateLineChart(connectionsChartInstance, [data.connections]);
  updateGaugeChart(bufferPoolHitRateChartInstance, data.innodb_buffer_pool_hit_rate.toFixed(2));
  updateGaugeChart(bufferPoolUsageChartInstance, data.innodb_buffer_pool_usage.toFixed(2));
  
  if (previousData) {
    lockWaitsDelta.value = data.innodb_row_lock_waits - previousData.innodb_row_lock_waits;
    commitDelta.value = data.com_commit - previousData.com_commit;
    rollbackDelta.value = data.com_rollback - previousData.com_rollback;
    const totalTransactions = commitDelta.value + rollbackDelta.value;
    const frequency = totalTransactions > 0 ? (lockWaitsDelta.value / totalTransactions) : 0;
    updateLineChart(rowLockChartInstance, [frequency.toFixed(4)]);

    // Update TPS
    tps.value = (totalTransactions / timeDelta).toFixed(2);

    // Update QPS
    queriesDelta.value = data.queries - previousData.queries;
    qps.value = (queriesDelta.value / timeDelta).toFixed(2);

    // Update WPS
    const insertDelta = data.com_insert - previousData.com_insert;
    const updateDelta = data.com_update - previousData.com_update;
    const deleteDelta = data.com_delete - previousData.com_delete;
    const replaceDelta = data.com_replace - previousData.com_replace;
    writeDelta.value = insertDelta + updateDelta + deleteDelta + replaceDelta;
    wps.value = (writeDelta.value / timeDelta).toFixed(2);

    // Update redo log data
    const writtenDelta = data.innodb_os_log_written - previousData.innodb_os_log_written;
    const fsyncsDelta = data.innodb_os_log_fsyncs - previousData.innodb_os_log_fsyncs;
    const waitsDelta = data.innodb_log_waits - previousData.innodb_log_waits;

    redoLogData.value = [
      { title: '写入量 (Written)', description: 'Bytes written to the redo log per second', value: `${(writtenDelta / timeDelta).toFixed(2)} B/s` },
      { title: 'Flush次数 (Fsyncs)', description: 'Number of fsyncs to the redo log per second', value: `${(fsyncsDelta / timeDelta).toFixed(2)} /s` },
      { title: '等待次数 (Waits)', description: 'Number of waits for the redo log buffer per second', value: `${(waitsDelta / timeDelta).toFixed(2)} /s` },
    ];

  } else {
    updateLineChart(rowLockChartInstance, [0]);
  }
};

const createLineChart = (el, title, seriesName) => {
  const chartInstance = echarts.init(el);
  const option = {
    title: { text: title, show: false },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value' },
    series: [{ name: seriesName, type: 'line', data: [] }]
  };
  chartInstance.setOption(option);
  return chartInstance;
};

const updateLineChart = (chartInstance, data) => {
  if (!chartInstance) return;
  const option = {
    xAxis: {
      data: [...chartInstance.getOption().xAxis[0].data, new Date().toLocaleTimeString()].slice(-10)
    },
    series: [{
      data: [...chartInstance.getOption().series[0].data, ...data].slice(-10)
    }]
  };
  chartInstance.setOption(option);
};

const createGaugeChart = (el, title) => {
  const chartInstance = echarts.init(el);
  const option = {
    series: [
      {
        type: 'gauge',
        detail: { formatter: '{value}%' },
        data: [{ value: 0, name: '命中率' }]
      }
    ]
  };
  chartInstance.setOption(option);
  return chartInstance;
};

const updateGaugeChart = (chartInstance, value) => {
  if (!chartInstance) return;
  const option = {
    series: [
      {
        data: [{ value: value }]
      }
    ]
  };
  chartInstance.setOption(option);
};


onMounted(() => {
  connectionsChartInstance = createLineChart(connectionsChart.value, 'Connections', 'Connections');
  bufferPoolHitRateChartInstance = createGaugeChart(bufferPoolHitRateChart.value, 'Buffer Pool Hit Rate');
  bufferPoolUsageChartInstance = createGaugeChart(bufferPoolUsageChart.value, 'Buffer Pool Usage');
  rowLockChartInstance = createLineChart(rowLockChart.value, 'Row Lock Wait Frequency', 'Frequency');

  fetchData();
  intervalId = setInterval(fetchData, 5000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  [connectionsChartInstance, bufferPoolHitRateChartInstance, bufferPoolUsageChartInstance, rowLockChartInstance].forEach(chart => {
    if (chart) chart.dispose();
  });
  chartInstances.forEach(chart => chart.dispose());
});

</script>

<style scoped>
.performance-monitor-wrapper {
  height: 100vh;
  overflow: auto;
}
.performance-monitor {
  padding: 20px;
  background: #f0f2f5;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.metric-card {
  height: 420px;
  display: flex;
  flex-direction: column;
}
.metric-card > :deep(.ant-card-body) {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.formula-display {
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.single-metric {
  font-size: 36px;
  font-weight: bold;
  text-align: center;
  padding: 20px 0;
}
</style>