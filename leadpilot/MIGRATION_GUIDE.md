# 快速迁移指南 - 将现有页面迁移到新架构

## 🎯 迁移目标

将现有页面从旧的 fetch 模式迁移到新的 `useApiCall` Hook，实现：
- ✅ 统一的 Loading 态管理
- ✅ 统一的错误处理
- ✅ 防止重复提交
- ✅ 友好的用户提示

## 📝 迁移步骤

### 步骤 1：导入必要的依赖

```typescript
// 添加这些导入
import { useApiCall } from '@/lib/hooks/useApiCall'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
```

### 步骤 2：替换 useState 和 fetch

**旧代码：**
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

const handleSubmit = async () => {
  setLoading(true)
  try {
    const res = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await res.json()
    if (res.ok) {
      alert('成功')
    } else {
      alert(result.error)
    }
  } catch (err) {
    alert('失败')
  } finally {
    setLoading(false)
  }
}
```

**新代码：**
```typescript
const router = useRouter()
const { loading, execute } = useApiCall({
  successMessage: '操作成功！',
  onSuccess: (data) => {
    // 成功后的逻辑，如跳转
    router.push('/success')
  }
})

const handleSubmit = async () => {
  await execute('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

### 步骤 3：更新按钮组件

**旧代码：**
```typescript
<button onClick={handleSubmit}>
  提交
</button>
```

**新代码：**
```typescript
<Button onClick={handleSubmit} disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      提交中...
    </>
  ) : (
    '提交'
  )}
</Button>
```

### 步骤 4：处理数据加载

**旧代码：**
```typescript
useEffect(() => {
  fetchData()
}, [])

const fetchData = async () => {
  setLoading(true)
  try {
    const res = await fetch('/api/data')
    const data = await res.json()
    setData(data)
  } catch (err) {
    console.error(err)
  } finally {
    setLoading(false)
  }
}
```

**新代码：**
```typescript
const [data, setData] = useState([])
const { loading, execute } = useApiCall({
  onSuccess: (result) => setData(result.data)
})

useEffect(() => {
  execute('/api/data')
}, [])

// 在 JSX 中
{loading ? (
  <Loader2 className="w-8 h-8 animate-spin" />
) : data.length === 0 ? (
  <EmptyState
    icon={Mail}
    title="暂无数据"
    description="这里将显示您的数据"
  />
) : (
  // 渲染数据
)}
```

## 🔄 常见场景迁移

### 场景 1：表单提交

```typescript
// ❌ 旧代码
const [submitting, setSubmitting] = useState(false)

const handleSubmit = async (e) => {
  e.preventDefault()
  setSubmitting(true)
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(formData)
    })
    if (res.ok) {
      alert('提交成功')
      router.push('/success')
    }
  } catch (err) {
    alert('提交失败')
  } finally {
    setSubmitting(false)
  }
}

// ✅ 新代码
const { loading: submitting, execute } = useApiCall({
  successMessage: '提交成功！',
  onSuccess: () => router.push('/success')
})

const handleSubmit = async (e) => {
  e.preventDefault()
  await execute('/api/submit', {
    method: 'POST',
    body: JSON.stringify(formData)
  })
}
```

### 场景 2：删除操作

```typescript
// ❌ 旧代码
const handleDelete = async (id) => {
  if (!confirm('确认删除？')) return
  try {
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    alert('删除成功')
    fetchData() // 重新加载
  } catch (err) {
    alert('删除失败')
  }
}

// ✅ 新代码
const { loading: deleting, execute } = useApiCall({
  successMessage: '删除成功！',
  onSuccess: () => fetchData()
})

const handleDelete = async (id) => {
  if (!confirm('确认删除？')) return
  await execute(`/api/items/${id}`, { method: 'DELETE' })
}
```

### 场景 3：刷新数据

```typescript
// ❌ 旧代码
const [refreshing, setRefreshing] = useState(false)

const handleRefresh = async () => {
  setRefreshing(true)
  try {
    const res = await fetch('/api/data')
    const data = await res.json()
    setData(data)
  } catch (err) {
    console.error(err)
  } finally {
    setRefreshing(false)
  }
}

// ✅ 新代码
const { loading: refreshing, execute } = useApiCall({
  onSuccess: (result) => setData(result.data)
})

const handleRefresh = async () => {
  await execute('/api/data')
}

// 按钮
<Button onClick={handleRefresh} disabled={refreshing}>
  {refreshing ? <Loader2 className="animate-spin" /> : '刷新'}
</Button>
```

## 🎨 UI 模式

### Loading 按钮模式

```typescript
<Button disabled={loading} className="...">
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      处理中...
    </>
  ) : (
    <>
      <Icon className="w-4 h-4 mr-2" />
      操作名称
    </>
  )}
</Button>
```

### 页面 Loading 模式

```typescript
{loading ? (
  <div className="flex justify-center py-12">
    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
  </div>
) : (
  // 内容
)}
```

### 空状态模式

```typescript
import { EmptyState } from '@/components/ui/empty-state'

{data.length === 0 && (
  <EmptyState
    icon={Icon}
    title="标题"
    description="描述"
    actionLabel="操作"
    onAction={handleAction}
  />
)}
```

## ⚠️ 注意事项

1. **不要在 loading 时允许操作**
   ```typescript
   // ✅ 正确
   <Button disabled={loading} onClick={handleAction}>
   
   // ❌ 错误
   <Button onClick={handleAction}>
   ```

2. **移除所有 alert()**
   ```typescript
   // ❌ 错误
   alert('操作成功')
   
   // ✅ 正确 - useApiCall 会自动显示 Toast
   const { execute } = useApiCall({
     successMessage: '操作成功！'
   })
   ```

3. **统一错误处理**
   ```typescript
   // ❌ 错误 - 手动处理每个错误
   try {
     await fetch(...)
   } catch (err) {
     alert(err.message)
   }
   
   // ✅ 正确 - useApiCall 自动处理
   await execute('/api/endpoint')
   ```

## 📋 迁移检查清单

在迁移每个页面后，检查：

- [ ] 所有 fetch 调用都使用 useApiCall
- [ ] 所有按钮都有 loading 态
- [ ] 所有按钮在 loading 时都是 disabled
- [ ] 移除所有 alert()
- [ ] 空状态使用 EmptyState 组件
- [ ] 错误信息友好化（中文）
- [ ] 成功操作有 Toast 提示

## 🚀 批量迁移建议

按优先级迁移：

1. **P0 - 核心业务页面**
   - 登录/注册页面 ✅
   - 发信控制台
   - 充值/支付页面

2. **P1 - 常用功能页面**
   - 数据分析页面 ✅
   - 收件箱页面
   - 知识库页面

3. **P2 - 管理后台页面**
   - 用户管理
   - 订单管理
   - 系统设置

每迁移一个页面，立即测试以下场景：
- ✅ 正常提交
- ✅ 重复点击（应该被阻止）
- ✅ 网络错误（应该显示友好提示）
- ✅ 服务器错误（应该显示友好提示）

## 🎉 迁移完成

迁移完成后，您的应用将具备：
- ✅ 工业级的用户体验
- ✅ 统一的错误处理
- ✅ 防止重复提交
- ✅ 友好的提示信息
