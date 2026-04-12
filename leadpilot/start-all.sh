#!/bin/bash

# 一键启动脚本 - 启动所有必要的服务

echo "🚀 启动 LeadPilot 发信系统..."
echo ""

# 检查 Redis 是否运行
echo "📡 检查 Redis 服务..."
if ! redis-cli ping > /dev/null 2>&1; then
  echo "⚠️  Redis 未运行，正在启动..."
  redis-server --daemonize yes
  sleep 2
  if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis 启动成功"
  else
    echo "❌ Redis 启动失败，请手动启动: redis-server"
    exit 1
  fi
else
  echo "✅ Redis 已运行"
fi

echo ""
echo "📦 更新数据库..."
npx prisma db push

echo ""
echo "🔧 生成 Prisma Client..."
npx prisma generate

echo ""
echo "🎯 启动服务..."
echo ""

# 使用 trap 捕获退出信号，优雅关闭所有进程
trap 'echo ""; echo "📴 正在关闭所有服务..."; kill 0' SIGINT SIGTERM

# 启动 Worker（后台）
echo "🤖 启动 Email Worker..."
npm run worker > logs/worker.log 2>&1 &
WORKER_PID=$!
echo "   Worker PID: $WORKER_PID"

# 等待 Worker 启动
sleep 2

# 启动 Next.js 开发服务器
echo "🌐 启动 Next.js 开发服务器..."
npm run dev &
DEV_PID=$!
echo "   Dev Server PID: $DEV_PID"

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📊 访问地址："
echo "   - 主应用: http://localhost:3000"
echo "   - 发信流水大屏: http://localhost:3000/dashboard/campaigns/logs"
echo "   - Prisma Studio: npx prisma studio"
echo ""
echo "📝 日志文件："
echo "   - Worker 日志: logs/worker.log"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待所有后台进程
wait
