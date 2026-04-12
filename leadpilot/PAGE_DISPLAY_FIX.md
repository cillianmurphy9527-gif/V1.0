# LeadPilot 页面显示问题诊断报告

**生成时间**: 2026-03-12  
**问题**: 页面无法正常显示，所有路由返回 404

---

## 🔍 问题诊断

### 当前状态
- ✅ 构建成功（`npm run build` 通过）
- ✅ 所有路由已正确编译
- ❌ 开发服务器运行在 `localhost:3005`（端口被占用）
- ❌ 所有请求返回 404
- ❌ 文件监听器错误：`EMFILE: too many open files`

### 根本原因

**主要问题**: 文件描述符限制过低
```
Watchpack Error (watcher): Error: EMFILE: too many open files, watch
```

这个错误表示系统打开的文件数量超过了限制。在 macOS 上，默认限制通常是 256，而 Next.js 开发服务器需要监听数百个文件。

**次要问题**: 端口被占用
```
⚠ Port 3000 is in use, trying 3001 instead.
⚠ Port 3001 is in use, trying 3002 instead.
...
⚠ Port 3005 is in use, trying 3005 instead.
```

---

## ✅ 快速修复方案

### 方案 1: 增加文件描述符限制（推荐）

**在 macOS 上**:

```bash
# 临时增加（仅当前终端会话）
ulimit -n 4096

# 验证
ulimit -n
# 应该输出: 4096

# 然后启动开发服务器
npm run dev
```

**永久增加（所有终端会话）**:

编辑 `~/.zshrc` 或 `~/.bash_profile`，添加：

```bash
# 增加文件描述符限制
ulimit -n 4096
```

然后重新加载配置：

```bash
source ~/.zshrc
```

---

### 方案 2: 使用提供的重启脚本

```bash
# 给脚本添加执行权限
chmod +x RESTART_SERVER.sh

# 运行脚本
./RESTART_SERVER.sh
```

这个脚本会：
1. 增加文件描述符限制到 4096
2. 清理 `.next` 缓存
3. 清理 `node_modules/.cache`
4. 启动开发服务器

---

### 方案 3: 清理并重启

```bash
# 1. 停止所有 Next.js 进程
pkill -f "next dev"

# 2. 清理缓存
rm -rf .next
rm -rf node_modules/.cache

# 3. 增加文件描述符限制
ulimit -n 4096

# 4. 启动开发服务器
npm run dev
```

---

## 🔧 详细修复步骤

### 步骤 1: 检查当前文件描述符限制

```bash
ulimit -n
```

如果输出小于 1024，需要增加。

### 步骤 2: 增加限制

```bash
# 临时增加到 4096
ulimit -n 4096

# 验证
ulimit -n
```

### 步骤 3: 清理缓存

```bash
cd /Users/liuyijia/Desktop/leadpoilt

# 清理 Next.js 构建缓存
rm -rf .next

# 清理 node_modules 缓存
rm -rf node_modules/.cache

# 清理 Prisma 缓存
rm -rf node_modules/.prisma
```

### 步骤 4: 重新生成 Prisma 客户端

```bash
npx prisma generate
```

### 步骤 5: 启动开发服务器

```bash
npm run dev
```

### 步骤 6: 验证

打开浏览器访问：
- `http://localhost:3000` （或显示的端口）
- 应该看到 LeadPilot 首页
- 点击"登录"或"开始使用"应该能正常导航

---

## 📊 预期结果

修复后，你应该看到：

```
✓ Ready in 1083ms
✓ Compiled / in 4.8s (642 modules)
GET / 200 in 123ms
GET /api/auth/session 200 in 45ms
```

而不是：

```
Watchpack Error (watcher): Error: EMFILE: too many open files, watch
GET / 404 in 4895ms
GET /api/auth/session 404 in 18ms
```

---

## 🚨 如果问题仍然存在

### 检查清单

- [ ] 文件描述符限制已增加到 4096
- [ ] `.next` 目录已删除
- [ ] `node_modules/.cache` 已删除
- [ ] 运行了 `npx prisma generate`
- [ ] 没有其他 Next.js 进程在运行
- [ ] 端口 3000-3010 都没有被占用

### 检查端口占用

```bash
# 查看哪些进程占用了 3000-3010 端口
lsof -i :3000
lsof -i :3001
lsof -i :3002
# ... 等等

# 杀死占用端口的进程
kill -9 <PID>
```

### 检查 Prisma 连接

```bash
# 打开 Prisma Studio
npx prisma studio

# 如果能打开，说明数据库连接正常
```

### 查看完整的错误日志

```bash
# 启动开发服务器并保存日志
npm run dev > dev.log 2>&1

# 查看日志
tail -f dev.log
```

---

## 🔐 环境变量检查

确保 `.env.local` 中有以下配置：

```bash
# 必需
NEXTAUTH_SECRET="leadpilot-dev-secret-2026-x9k2m"
NEXTAUTH_URL="http://localhost:3000"

# 可选（开发环境）
DATABASE_URL="file:./prisma/dev.db"
```

如果缺少这些，会导致认证系统无法工作。

---

## 📝 长期解决方案

### 1. 永久增加文件描述符限制

编辑 `~/.zshrc`：

```bash
# 在文件末尾添加
ulimit -n 4096
```

### 2. 优化 Next.js 配置

编辑 `next.config.js`：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // 添加以下配置以减少文件监听
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

module.exports = nextConfig
```

### 3. 使用 `.watchmanconfig` 优化文件监听

在项目根目录创建 `.watchmanconfig`：

```json
{
  "ignore_dirs": [
    ".git",
    ".next",
    "node_modules",
    ".DS_Store",
    "dist",
    "build"
  ]
}
```

---

## 🎯 验证清单

在访问页面前，确保：

- [ ] 文件描述符限制 ≥ 4096
- [ ] 开发服务器显示 "Ready in XXXms"
- [ ] 没有 "Watchpack Error" 错误
- [ ] 浏览器能访问 `http://localhost:3000`
- [ ] 首页能正常加载
- [ ] 登录/注册链接能正常导航
- [ ] 浏览器控制台没有错误

---

## 📞 如果仍需帮助

1. 收集完整的错误日志：
   ```bash
   npm run dev 2>&1 | tee dev-error.log
   ```

2. 检查系统资源：
   ```bash
   # 查看打开的文件数
   lsof | wc -l
   
   # 查看系统限制
   sysctl kern.maxfiles
   sysctl kern.maxfilesperproc
   ```

3. 尝试在新的终端窗口中启动服务器

4. 如果问题持续，尝试重启计算机

