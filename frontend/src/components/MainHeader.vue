<template>
  <div class="main-header-menu">
    <a-button type="text" size="large" @click="handleMenuClick('new-connection')">
      <template #icon><PlusOutlined /></template>
      新建连接
    </a-button>
    <a-button type="text" size="large" @click="handleMenuClick('new-query')">
      <template #icon><CodeOutlined /></template>
      新建查询
    </a-button>
    <a-button type="text" size="large" @click="handleMenuClick('views')">
      <template #icon><EyeOutlined /></template>
      视图
    </a-button>
    <a-button type="text" size="large" @click="handleMenuClick('functions')">
      <template #icon><FunctionOutlined /></template>
      函数
    </a-button>
    <a-button type="text" size="large" @click="handleMenuClick('users')">
      <template #icon><UserOutlined /></template>
      用户
    </a-button>
    <a-button type="text" size="large" @click="handleMenuClick('bi')">
      <template #icon><BarChartOutlined /></template>
      BI
    </a-button>
    <ConnectionDialog v-model:visible="showConnectionDialog" @connected="handleConnected" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  Button as AButton
} from 'ant-design-vue';
import {
  PlusOutlined,
  CodeOutlined,
  EyeOutlined,
  FunctionOutlined,
  UserOutlined,
  BarChartOutlined,
} from '@ant-design/icons-vue';
import ConnectionDialog from './ConnectionDialog.vue';
import { useUIStore } from '@/stores/ui';
import { message } from 'ant-design-vue';

const uiStore = useUIStore();
const showConnectionDialog = ref(false);

const handleMenuClick = (action) => {
  if (action === 'new-connection') {
    showConnectionDialog.value = true;
  } else if (action === 'new-query') {
    uiStore.setActiveMainTab('query');
  } else {
    // Placeholder for other actions
    message.info(`功能 '${action}' 暂未实现`);
  }
};

const handleConnected = () => {
  message.success("连接创建成功");
  showConnectionDialog.value = false;
};
</script>

<style scoped>
.main-header-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
}
.main-header-menu .ant-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 56px; /* Taller buttons */
  padding: 0 12px;
  font-size: 12px;
}
.main-header-menu .ant-btn > .anticon {
  font-size: 20px; /* Larger icons */
  margin-bottom: 4px;
}
</style>
