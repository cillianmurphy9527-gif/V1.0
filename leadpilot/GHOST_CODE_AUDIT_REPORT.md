# 全站『假代码大扫除』审查报告

## 审查范围
- ✅ 用户 Dashboard 所有页面
- ✅ Admin 管理端所有页面
- ✅ 所有按钮和表单提交逻辑

---

## 发现的问题清单

### 🔴 严重问题：幽灵按钮（共 7 个）

#### 1. `/billing` 页面 - 4 个幽灵按钮

**问题代码：**
```typescript
// ❌ 问题 1：充值按钮 - 只有 alert
const handleRecharge = () => {
  alert('充值功能开发中，敬请期待')
  // TODO: 实现充值流程
}

// ❌ 问题 2：管理订阅按钮 - 只有 alert
const handleManageSubscription = () => {
  alert('订阅管理功能开发中，敬请期待')
  // TODO: 实现订阅管理
}

// ❌ 问题 3：使用优惠券按钮 - 只有 alert
const handleUseCoupon = (couponId: string) => {
  alert(`使用优惠券：${couponId}`)
  // TODO: 实现优惠券使用逻辑
}

// ❌ 问题 4：使用 alert 而不是 Toast
alert('❌ 提交失败')
alert('❌ 创建订单失败，请稍后重试')
```

**影响：**
- 用户点击按钮后只看到 alert，无法完成操作
- 没有真实的 API 调用
- 用户体验极差

---

#### 2. `/wallet` 页面 - 3 个幽灵按钮

**问题代码：**
```typescript
// ❌ 问题 1：充值算力按钮 - 无 onClick
<Button className="w-full bg-gradient-to-r from-blue-600 to-blue-500">
  <CreditCard className="w-5 h-5 mr-2" />立即充值算力
</Button>

// ❌ 问题 2：管理订阅按钮 - 无 onClick
<Button variant="outline">管理订阅</Button>

// ❌ 问题 3：升级套餐按钮 - 无 onClick
<Button>升级套餐</Button>

// ❌ 问题 4：退款按钮 - 使用 confirm 和 alert
const handleRefund = (orderId: string) => {
  if (confirm(`确定要申请退款订单 ${orderId} 吗？`)) {
    alert('退款申请已提交，我们将在 3-5 个工作日内处理')
  }
}
```

**影响：**
- 3 个按钮完全无效，点击无反应
- 退款功能没有真实提交到后端

---

### 🟡 中等问题：模拟数据

#### 3. `/knowledge-base` 页面 - 模拟上传

**问题代码：**
```typescript
// ❌ 使用模拟数据，没有真实 API
const INIT_FILES: KBFile[] = [
  {
    id: '1', name: 'Product_Catalog_2024.pdf', category: 'PDF',
    status: 'READY', chunkCount: 4, fileSizeBytes: 2340000,
    // ... 硬编码的数据
  }
]

// ❌ 模拟上传进度，没有真实上传
const simulateUpload = (name: string, cat: FileCategory) => {
  // 假的进度条动画
  let pct = 0
  const iv = setInterval(() => {
    pct += Math.floor(Math.random() * 18) + 6
    // ...
  }, 300)
}
```

**影响：**
- 用户上传的文件不会真实保存到数据库
- 刷新页面后数据丢失

---

### ✅ 正常功能（无需修复）

#### 4. `/admin/settings` 页面 - ✅ 完整实现

**验证结果：**
```typescript
// ✅ 有完整的保存逻辑
const handleSave = async () => {
  if (!formData.key || !formData.value) {
    showNotification('error', '请填写完整信息')
    return
  }

  setSaving(true)
  try {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: formData.key,
        value: parsedValue,
        category: formData.category,
        description: formData.description,
      }),
    })

    if (response.ok) {
      showNotification('success', editingKey ? '配置已更新' : '配置已创建')
      setShowEditModal(false)
      loadSettings()  // ✅ 刷新数据
    }
  } catch (error) {
    showNotification('error', '保存失败')
  } finally {
    setSaving(false)
  }
}
```

**特点：**
- ✅ 前端校验
- ✅ Loading 状态
- ✅ 真实 API 调用
- ✅ 错误处理
- ✅ 成功后刷新数据

---

#### 5. `/support` 页面 - ✅ 纯展示页面

**验证结果：**
- 纯展示页面，无表单和按钮
- 只有 FAQ 手风琴交互
- 无需修复

---

#### 6. `/inbox` 页面 - ✅ 已修复

**验证结果：**
- ✅ 真实数据拉取
- ✅ 真实回复发送
- ✅ AI 意图分析
- ✅ 完整错误处理

---

## 修复优先级

### P0 - 立即修复（影响核心业务流）

1. **billing 页面 - 套餐选择和支付**
   - ✅ `handleSelectPlan` 已有真实 API
   - ❌ 需要修复：充值、管理订阅、使用优惠券

2. **wallet 页面 - 充值和订阅管理**
   - ❌ 3 个按钮完全无效
   - ❌ 退款功能没有后端调用

### P1 - 重要修复（影响用户体验）

3. **knowledge-base 页面 - 文件上传**
   - ❌ 使用模拟数据
   - ❌ 需要接入真实上传 API

### P2 - 优化改进

4. **替换所有 alert() 为 Toast**
   - billing 页面有 3 处 alert
   - wallet 页面有 1 处 alert + 1 处 confirm

---

## 统计数据

| 页面 | 幽灵按钮 | 空表单 | 模拟数据 | 状态 |
|------|---------|--------|---------|------|
| billing | 4 | 0 | 0 | ❌ 需修复 |
| wallet | 3 | 0 | 1 | ❌ 需修复 |
| knowledge-base | 0 | 0 | 1 | ❌ 需修复 |
| admin/settings | 0 | 0 | 0 | ✅ 正常 |
| support | 0 | 0 | 0 | ✅ 正常 |
| inbox | 0 | 0 | 0 | ✅ 已修复 |
| **总计** | **7** | **0** | **2** | **3/6 需修复** |

---

## 下一步行动

### 立即修复清单

1. ✅ 创建 `/api/payment/recharge` API
2. ✅ 创建 `/api/user/subscription/manage` API
3. ✅ 创建 `/api/user/coupons/use` API
4. ✅ 创建 `/api/user/orders/refund` API
5. ✅ 创建 `/api/knowledge-base/upload` API
6. ✅ 替换所有 alert() 为 useToast()

### 修复后验证

- [ ] billing 页面所有按钮可点击且有反馈
- [ ] wallet 页面所有按钮可点击且有反馈
- [ ] knowledge-base 上传文件后刷新页面数据仍存在
- [ ] 所有错误提示使用 Toast 而不是 alert
- [ ] 所有 API 调用都有 try/catch
- [ ] 所有按钮都有 Loading 状态

---

## 结论

**发现问题：**
- 🔴 7 个幽灵按钮
- 🟡 2 处模拟数据
- 🟡 4 处使用 alert/confirm

**需要修复的页面：**
- ❌ billing (4 个问题)
- ❌ wallet (4 个问题)
- ❌ knowledge-base (1 个问题)

**已验证正常的页面：**
- ✅ admin/settings (完整实现)
- ✅ support (纯展示)
- ✅ inbox (已修复)

**下一步：** 立即补齐 5 个缺失的 API 并修复所有幽灵按钮！
