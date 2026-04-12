# 🚨 重要：如何查看新功能

## 问题说明

您看到的是旧版本，因为：
- ✅ 所有代码已经更新完成
- ❌ 但服务器还在运行旧的构建版本（端口 8032）

## ✅ 已完成的更新

### 1. 示例模板（dashboard 页面）
**文件**：`app/(dashboard)/dashboard/page.tsx`
- ✅ 第 605-650 行：已添加 3 个示例模板 Badge
- ✅ 🇫🇷 法国钢筋行业
- ✅ 🇩🇪 德国机械制造  
- ✅ 🇮🇹 意大利旅游供应商

### 2. 服务监控大屏（monitoring 页面）
**文件**：`app/(admin)/admin/monitoring/page.tsx`
- ✅ 第 250-450 行：已添加 4 个服务监控卡片
- ✅ 🧠 主备模型调用状态
- ✅ 📨 域名与发信池
- ✅ 🎯 数据源雷达
- ✅ ⚡ BullMQ 队列

### 3. 全局反馈按钮
**文件**：`components/FeedbackButton.tsx`（已创建）
**集成**：`app/(dashboard)/layout.tsx`（第 147 行）
- ✅ 右下角悬浮按钮
- ✅ 精致反馈对话框

### 4. AI 容灾系统
**文件**：`services/LLMService.ts`
- ✅ 已移除所有 Mock 代码
- ✅ 已实现 DeepSeek + Gemini 双引擎容灾

### 5. 数据库更新
**文件**：`prisma/schema.prisma`
- ✅ Order 模型已添加 tradeNo, refundStatus, receiptSent 字段

---

## 🔧 如何查看新功能

### 方法 1：重启开发服务器（推荐）

在您的终端中执行：

```bash
# 1. 进入项目目录
cd /Users/liuyijia/agentcross

# 2. 停止旧服务器（如果有）
# 在运行服务器的终端按 Ctrl+C

# 3. 启动开发服务器
npm run dev
```

然后访问：http://localhost:3000

---

### 方法 2：使用桌面备份重新构建

```bash
# 1. 进入桌面备份
cd ~/Desktop/Leadpilot

# 2. 安装依赖（如果需要）
npm install

# 3. 启动开发服务器
npm run dev
```

然后访问：http://localhost:3000

---

## 📍 新功能预览地址

启动开发服务器后，访问以下地址：

### 1. 示例模板
**地址**：http://localhost:3000/dashboard

**查看位置**：
- 在指令输入框**上方**
- 有 3 个彩色的 Badge 按钮
- 点击可自动填入模板

### 2. 服务监控大屏
**地址**：http://localhost:3000/admin/monitoring

**查看位置**：
- 页面顶部有 4 个大卡片
- 显示 AI 引擎、发信池、数据源、队列状态
- 下方是实时日志终端

### 3. 全局反馈按钮
**地址**：任何 dashboard 页面

**查看位置**：
- 页面**右下角**
- 蓝紫色渐变的悬浮按钮
- 点击弹出反馈对话框

---

## 🔍 验证代码已更新

您可以在代码编辑器中查看：

### 示例模板
打开：`app/(dashboard)/dashboard/page.tsx`
跳转到：**第 605 行**
应该看到：`{/* 高转化示例模板 - 消除白纸恐惧症 */}`

### 服务监控
打开：`app/(admin)/admin/monitoring/page.tsx`
跳转到：**第 250 行**
应该看到：`{/* 服务进度与资源监控大屏 */}`

### 反馈按钮
打开：`components/FeedbackButton.tsx`
应该看到：完整的反馈按钮组件（216 行）

### AI 容灾
打开：`services/LLMService.ts`
跳转到：**第 1-50 行**
应该看到：双引擎容灾系统的注释和代码

---

## ⚠️ 为什么看不到新功能？

**原因**：端口 8032 上运行的是**旧的构建版本**（production build）

**解决方案**：
1. 停止端口 8032 的服务器
2. 启动开发服务器（`npm run dev`）
3. 访问 http://localhost:3000

---

## 📊 完成状态确认

| 功能 | 代码状态 | 文件位置 |
|-----|---------|---------|
| 示例模板 | ✅ 已完成 | app/(dashboard)/dashboard/page.tsx:605 |
| 服务监控 | ✅ 已完成 | app/(admin)/admin/monitoring/page.tsx:250 |
| 反馈按钮 | ✅ 已完成 | components/FeedbackButton.tsx |
| AI 容灾 | ✅ 已完成 | services/LLMService.ts |
| 数据库更新 | ✅ 已完成 | prisma/schema.prisma |

**所有代码都已更新，只需要重启服务器即可看到新功能！**

---

**生成时间**：2026-03-09 22:45
