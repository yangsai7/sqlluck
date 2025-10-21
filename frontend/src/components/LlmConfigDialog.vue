<template>
  <a-modal
    title="配置 LLM"
    :open="visible"
    @ok="handleOk"
    @cancel="handleCancel"
    okText="保存"
    cancelText="取消"
  >
    <a-form layout="vertical">
      <a-form-item label="API 地址">
        <a-input v-model:value="llmConfig.apiAddress" placeholder="请输入LLM API地址" />
      </a-form-item>
      <a-form-item label="API Key">
        <a-input-password v-model:value="llmConfig.apiKey" placeholder="请输入LLM API Key" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch, reactive } from 'vue';
import { Modal as AModal, Form, Input, InputPassword, message } from 'ant-design-vue';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['update:visible']);

const LLM_CONFIG_KEY = 'llm_config';

const llmConfig = reactive({
  apiAddress: '',
  apiKey: '',
});

// Load config from localStorage when component is mounted or visible becomes true
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadLlmConfig();
  }
}, { immediate: true });

const loadLlmConfig = () => {
  const savedConfig = localStorage.getItem(LLM_CONFIG_KEY);
  if (savedConfig) {
    const parsedConfig = JSON.parse(savedConfig);
    llmConfig.apiAddress = parsedConfig.apiAddress || '';
    llmConfig.apiKey = parsedConfig.apiKey || '';
  }
};

const saveLlmConfig = () => {
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(llmConfig));
  message.success('LLM配置已保存');
};

const handleOk = () => {
  saveLlmConfig();
  emit('update:visible', false);
};

const handleCancel = () => {
  emit('update:visible', false);
};
</script>

<style scoped>
/* Future styles will go here */
</style>