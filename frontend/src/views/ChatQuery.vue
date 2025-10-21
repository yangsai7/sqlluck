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
          <div v-else v-html="message.content"></div>
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
import { ref, nextTick, onMounted, watch } from 'vue';
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

const handleConnectionChange = (connId) => {
  selectedConnectionId.value = connId;
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

  try {
    // Filter out the loading message if it's there, and send the actual conversation history
    const conversationHistory = messages.value.filter(msg => msg.role !== 'loading');

    const response = await chatAPI.sendMessage(
      conversationHistory,
      selectedConnectionId.value,
      selectedDatabaseName.value
    );
    const assistantMessage = { role: 'assistant', content: md.render(response.content) };
    messages.value.push(assistantMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    const errorMessage = { role: 'assistant', content: '抱歉，出错了，请稍后再试。' };
    messages.value.push(errorMessage);
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesArea.value) {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
    }
  });
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
</style>