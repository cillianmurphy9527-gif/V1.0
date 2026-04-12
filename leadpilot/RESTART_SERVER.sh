#!/bin/bash

# LeadPilot 开发服务器重启脚本
# 用于解决 "EMFILE: too many open files" 错误

echo "🔧 LeadPilot 开发服务器修复脚本"
echo "================================"

# 1. 增加文件描述符限制
echo "📝 增加文件描述符限制..."
ulimit -n 4096
echo "✅ 文件描述符限制已设置为 4096"

# 2. 清理 Next.js 缓存
echo ""
echo "🧹 清理 Next.js 缓存..."
rm -rf .next
echo "✅ .next 目录已清理"

# 3. 清理 node_modules 中的缓存
echo ""
echo "🧹 清理 node_modules 缓存..."
rm -rf node_modules/.cache
echo "✅ node_modules 缓存已清理"

# 4. 重新安装依赖（可选）
# echo ""
# echo "📦 重新安装依赖..."
# npm install
# echo "✅ 依赖已安装"

# 5. 启动开发服务器
echo ""
echo "🚀 启动开发服务器..."
echo "================================"
npm run dev
