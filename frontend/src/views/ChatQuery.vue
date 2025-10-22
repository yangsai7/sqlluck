<template>
  <div class="chat-query-container">
    <div class="chat-header">
      <a-select
        v-model:value="selectedConnectionId"
        placeholder="选择连接"
        style="width: 180px; margin-right: 10px;"
        @change="handleConnectionChange"
      >
        <a-select-option v-for="conn in connectionStore.connections" :key="conn.id" :value="conn.id">
          {{ conn.name || conn.host }}
        </a-select-option>
      </a-select>
      <a-select
        v-model:value="selectedDatabaseName"
        placeholder="选择数据库"
        style="width: 180px;"
        :disabled="!selectedConnectionId || connectionStore.databases.length === 0"
      >
        <a-select-option v-for="db in connectionStore.databases" :key="db" :value="db">
          {{ db }}
        </a-select-option>
      </a-select>
    </div>

    <div class="messages-area" ref="messagesArea">
      <div v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
        <div class="message-content">
          <p v-if="message.role === 'user'">{{ message.content }}</p>
          <div v-else-if="message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0" class="tool-call-request">
            <p><strong>AI requested tool call:</strong></p>
            <div v-for="(toolCall, tcIndex) in message.tool_calls" :key="tcIndex">
              <template v-if="toolCall.function">
                <p><strong>Tool:</strong> {{ toolCall.function.name }}</p>
                <p><strong>Arguments:</strong> <pre>{{ toolCall.function.arguments ? JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2) : '' }}</pre></p>
              </template>
              <template v-else>
                <p><strong>Tool:</strong> Unknown</p>
                <p><strong>Arguments:</strong> <pre>N/A</pre></p>
              </template>
            </div>
          </div>
          <div v-else-if="message.role === 'assistant'" v-html="renderAssistantContent(message.content)"></div>
          <div v-else-if="message.role === 'tool'" class="tool-message">
            <p><strong>Tool Executed:</strong> {{ message.name }}</p>
            <p><strong>Output:</strong> <pre>{{ message.content }}</pre></p>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant">
        <div class="message-content">
          <p>正在思考中...</p>
        </div>
      </div>
    </div>
    <div class="input-area">
      <textarea v-model="userInput" @keyup.enter="sendMessage" placeholder="请输入您的问题..."></textarea>
      <button @click="sendMessage" :disabled="isLoading">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch, onUnmounted } from 'vue';
import { chatAPI } from '../api';
import MarkdownIt from 'markdown-it';
import { useConnectionStore } from '@/stores/connection';
import { Select as ASelect, SelectOption as ASelectOption, message } from 'ant-design-vue';

const md = new MarkdownIt();
const connectionStore = useConnectionStore();

const messages = ref([]);
const userInput = ref('');
const isLoading = ref(false);
const messagesArea = ref(null);
const eventSource = ref(null); // Declare eventSource as a ref

const selectedConnectionId = ref(null);
const selectedDatabaseName = ref(null);

// Load connections on mount
onMounted(() => {
  connectionStore.loadConnections();
});

// Watch for selectedConnectionId changes to load databases
watch(selectedConnectionId, (newVal) => {
  if (newVal) {
    connectionStore.loadDatabases(newVal);
    selectedDatabaseName.value = null; // Reset database selection
  } else {
    connectionStore.databases = []; // Clear databases if no connection selected
  }
});

const handleConnectionChange = async (connId) => {
  selectedConnectionId.value = connId;
  if (connId) {
    try {
      await connectionStore.setActiveConnection(connId);
      await connectionStore.loadDatabases();
    } catch (error) {
      message.error(`连接失败: ${error.message}`);
      console.error('Failed to set active connection or load databases:', error);
    }
  }
};

const sendMessage = async () => {
  if (userInput.value.trim() === '' || isLoading.value) {
    return;
  }

  if (!selectedConnectionId.value || !selectedDatabaseName.value) {
    message.warning('请先选择数据库连接和数据库！');
    return;
  }

  const userMessage = { role: 'user', content: userInput.value };
  messages.value.push(userMessage);
  isLoading.value = true;
  userInput.value = '';

  // Filter out the system message from the history sent to the backend
  const conversationHistoryToSend = messages.value.filter(msg => msg.role !== 'loading');

  try {
    eventSource.value = chatAPI.sendMessage(
      conversationHistoryToSend,
      selectedConnectionId.value,
      selectedDatabaseName.value,
      (event) => {
        if (event.type === 'message') {
          // For message events, add to the messages array
          messages.value.push(event.message);
        } else if (event.type === 'status') {
          // For status events, log them or display in a status bar
          console.log('Backend Status:', event.message);
        } else if (event.type === 'error') {
          // Handle errors from the stream
          console.error('Stream error:', event.error);
          const errorMessage = { role: 'assistant', content: `抱歉，出错了: ${event.error}` };
          messages.value.push(errorMessage);
          isLoading.value = false;
          if (eventSource.value) eventSource.value.close();
        } else if (event.type === 'end') {
          // Stream ended, finalize loading state
          isLoading.value = false;
          if (eventSource.value) eventSource.value.close();
        }
        scrollToBottom();
      }
    );
  } catch (error) {
    console.error('Error setting up stream:', error);
    const errorMessage = { role: 'assistant', content: '抱歉，出错了，请稍后再试。' };
    messages.value.push(errorMessage);
    isLoading.value = false;
    if (eventSource.value) eventSource.value.close();
  } finally {
    // isLoading.value is set to false when 'end' event is received
    // or on error
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesArea.value) {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
    }
  });
};

// Close EventSource on component unmount if it's still open
onUnmounted(() => {
  if (eventSource.value) {
    eventSource.value.close();
  }
});

const isTabularData = (str) => {
  try {
    const data = JSON.parse(str);
    return Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null);
  } catch (e) {
    return false;
  }
};

const generateHtmlTable = (data) => {
  if (!data || data.length === 0) {
    return '<p>No data to display.</p>';
  }

  const headers = Object.keys(data[0]);
  let tableHtml = '<table class="data-table"><thead><tr>';
  headers.forEach(header => {
    tableHtml += `<th>${header}</th>`;
  });
  tableHtml += '</tr></thead><tbody>';

  data.forEach(row => {
    tableHtml += '<tr>';
    headers.forEach(header => {
      tableHtml += `<td>${row[header]}</td>`;
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody></table>';
  return tableHtml;
};

const renderAssistantContent = (content) => {
  // Ensure content is a string before processing
  if (typeof content !== 'string') {
    return String(content); // Convert to string if not already
  }

  if (isTabularData(content)) {
    return generateHtmlTable(JSON.parse(content));
  } else {
    return md.render(content);
  }
};
</script>

<style scoped>
.chat-query-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f7f7f7;
}
.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #ccc;
  background-color: #fff;
  display: flex;
  align-items: center;
}
.messages-area {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1rem;
}
.message {
  margin-bottom: 1rem;
  display: flex;
}
.message.user {
  justify-content: flex-end;
}
.message.assistant {
  justify-content: flex-start;
}
.message-content {
  max-width: 80%;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.message.user .message-content {
  background-color: #dcf8c6;
}
.input-area {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #ccc;
  background-color: #fff;
}
.input-area textarea {
  flex-grow: 1;
  margin-right: 1rem;
  resize: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
}
.input-area button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
}
.input-area button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.data-table th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.tool-message {
  background-color: #e6f7ff; /* Light blue background */
  border-left: 4px solid #1890ff; /* Blue left border */
  padding: 10px;
  margin-top: 10px;
  font-size: 0.9em;
  white-space: pre-wrap; /* Preserve whitespace and wrap text */
  word-break: break-all; /* Break long words */
}

.tool-message pre {
  background-color: #f0f2f5;
  padding: 5px;
  border-radius: 4px;
  overflow-x: auto;
}

.tool-call-request {
  background-color: #fffbe6; /* Light yellow background */
  border-left: 4px solid #faad14; /* Yellow left border */
  padding: 10px;
  margin-top: 10px;
  font-size: 0.9em;
  white-space: pre-wrap; /* Preserve whitespace and wrap text */
  word-break: break-all; /* Break long words */
}

.tool-call-request pre {
  background-color: #fff0b8;
  padding: 5px;
  border-radius: 4px;
  overflow-x: auto;
}</style>