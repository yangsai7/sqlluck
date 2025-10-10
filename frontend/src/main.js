// 应用主入口
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import * as icons from '@ant-design/icons-vue'

import 'ant-design-vue/dist/reset.css'
import './style.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// 状态管理
const pinia = createPinia()
app.use(pinia)

// 路由
app.use(router)

// Ant Design Vue
app.use(Antd)

// 注册所有图标
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component)
}

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('应用错误:', err, info)
}

app.mount('#app')