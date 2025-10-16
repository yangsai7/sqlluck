<template>
  <a-modal
    :open="props.visible"
    :title="isEditMode ? '编辑连接' : '创建数据库连接'"
    width="600px"
    @cancel="handleClose"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      @finish="handleSubmit"
    >
      <a-form-item label="连接名称" name="name">
        <a-input v-model:value="form.name" placeholder="请输入连接名称" />
      </a-form-item>

      <a-form-item label="主机地址" name="host">
        <a-input v-model:value="form.host" placeholder="localhost" />
      </a-form-item>

      <a-form-item label="端口" name="port">
        <a-input-number
          v-model:value="form.port"
          :min="1"
          :max="65535"
          style="width: 100%"
        />
      </a-form-item>

      <a-form-item label="用户名" name="user">
        <a-input v-model:value="form.user" placeholder="root" />
      </a-form-item>

      <a-form-item label="密码" name="password">
        <a-input-password
          v-model:value="form.password"
          placeholder="留空则不修改"
        />
      </a-form-item>

      <a-form-item label="默认数据库">
        <a-input
          v-model:value="form.database"
          placeholder="可选，留空连接到服务器"
        />
      </a-form-item>

      <a-collapse :bordered="false">
        <a-collapse-panel key="advanced" header="高级选项">
          <a-form-item label="连接超时">
            <a-input-number
              v-model:value="form.connectTimeout"
              :min="1000"
              :max="60000"
              :step="1000"
              style="width: 100%"
            />
            <div class="form-tip">毫秒，默认5000ms</div>
          </a-form-item>

          <a-form-item label="时区">
            <a-input v-model:value="form.timezone" placeholder="+00:00" />
          </a-form-item>

          <a-form-item label="使用SSL">
            <a-switch v-model:checked="form.useSSL" />
          </a-form-item>

          <div v-if="form.useSSL">
            <a-form-item label="CA证书路径">
              <a-input
                v-model:value="form.caPath"
                placeholder="CA证书文件路径（可选）"
              />
            </a-form-item>

            <a-form-item label="客户端证书">
              <a-input
                v-model:value="form.clientCertPath"
                placeholder="客户端证书文件路径（可选）"
              />
            </a-form-item>

            <a-form-item label="客户端私钥">
              <a-input
                v-model:value="form.clientKeyPath"
                placeholder="客户端私钥文件路径（可选）"
              />
            </a-form-item>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </a-form>

    <template #footer>
      <div class="dialog-footer">
        <a-button @click="handleClose">取消</a-button>
        <a-button :loading="testing" @click="testConnection">测试连接</a-button>
        <a-button
          type="primary"
          :loading="connecting"
          @click="handleSubmit"
        >
          {{ isEditMode ? '保存' : '连接' }}
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  visible: Boolean,
  connection: { // For editing
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'connected', 'updated'])

const connectionStore = useConnectionStore()

const formRef = ref()
const testing = ref(false)
const connecting = ref(false)

const isEditMode = computed(() => !!props.connection)

const initialFormState = {
  name: '',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: '',
  useSSL: false,
  caPath: '',
  clientCertPath: '',
  clientKeyPath: '',
  connectTimeout: 5000,
  timezone: '+00:00'
}

const form = reactive({ ...initialFormState })

const rules = {
  name: [{ required: true, message: '请输入连接名称', trigger: 'blur' }],
  host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口号', trigger: 'blur' }],
  user: [{ required: true, message: '请输入用户名', trigger: 'blur' }]
}

// 测试连接
const testConnection = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    return
  }

  testing.value = true
  try {
    const result = await connectionStore.testConnection(form)
    if (result.success) {
      message.success('连接测试成功！')
    }
  } catch (error) {
    message.error(`连接测试失败: ${error.message}`)
  } finally {
    testing.value = false
  }
}

// 创建或更新连接
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    return
  }

  connecting.value = true
  try {
    if (isEditMode.value) {
      // Edit mode
      const result = await connectionStore.updateConnection({ ...form, id: props.connection.id })
      if (result.success) {
        message.success('连接更新成功！')
        emit('updated', result.connection)
        handleClose()
      }
    } else {
      // Create mode
      const result = await connectionStore.createConnection(form)
      if (result.success) {
        message.success('连接成功！')
        emit('connected', result.connection)
        handleClose()
      }
    }
  } catch (error) {
    message.error(`操作失败: ${error.message}`)
  } finally {
    connecting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false)
}

// Watch for connection prop changes to populate the form
watch(() => props.connection, (newConnection) => {
  if (newConnection) {
    // Edit mode
    Object.assign(form, newConnection);
    form.password = ''; // Clear password for security
  } else {
    // Create mode
    formRef.value?.resetFields();
    Object.assign(form, initialFormState);
  }
}, { immediate: true });

// Watch for visibility changes to reset form on close
watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    formRef.value?.resetFields();
    Object.assign(form, initialFormState);
  }
});
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.dialog-footer {
  text-align: right;
  margin-top: 24px;
}

:deep(.ant-collapse-content-box) {
  padding: 0 !important;
}

:deep(.ant-form-item-control-input-content) {
  text-align: left;
}
</style>