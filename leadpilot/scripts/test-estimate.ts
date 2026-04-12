/**
 * 预估评估系统测试脚本
 * 
 * 使用方法：
 * 1. 确保数据库已更新（npx prisma db push）
 * 2. 启动开发服务器（npm run dev）
 * 3. 在浏览器控制台运行此脚本
 */

// 测试场景 1：余额充足
async function testSufficientBalance() {
  console.log('🧪 测试场景 1：余额充足')
  
  const response = await fetch('/api/campaigns/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetCount: 100,
      enableDeepAnalysis: false
    })
  })
  
  const data = await response.json()
  console.log('预估结果：', data)
  console.log('余额充足：', data.estimate?.isSufficient)
  console.log('总消耗：', data.estimate?.totalTokensRequired)
  console.log('当前余额：', data.estimate?.currentBalance?.total)
}

// 测试场景 2：余额不足
async function testInsufficientBalance() {
  console.log('🧪 测试场景 2：余额不足（大量目标）')
  
  const response = await fetch('/api/campaigns/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetCount: 10000,
      enableDeepAnalysis: true
    })
  })
  
  const data = await response.json()
  console.log('预估结果：', data)
  console.log('余额充足：', data.estimate?.isSufficient)
  console.log('缺口：', data.estimate?.shortfall)
  console.log('缺口百分比：', data.estimate?.shortfallPercentage + '%')
}

// 测试场景 3：深度分析 vs 快速模式
async function testAnalysisModes() {
  console.log('🧪 测试场景 3：对比深度分析和快速模式')
  
  // 快速模式
  const quickResponse = await fetch('/api/campaigns/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetCount: 1000,
      enableDeepAnalysis: false
    })
  })
  const quickData = await quickResponse.json()
  
  // 深度分析模式
  const deepResponse = await fetch('/api/campaigns/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetCount: 1000,
      enableDeepAnalysis: true
    })
  })
  const deepData = await deepResponse.json()
  
  console.log('快速模式 Token 消耗：', quickData.estimate?.totalTokensRequired)
  console.log('深度分析 Token 消耗：', deepData.estimate?.totalTokensRequired)
  console.log('差异：', (deepData.estimate?.totalTokensRequired - quickData.estimate?.totalTokensRequired))
}

// 运行所有测试
async function runAllTests() {
  await testSufficientBalance()
  console.log('\n---\n')
  await testInsufficientBalance()
  console.log('\n---\n')
  await testAnalysisModes()
}

// 导出测试函数
if (typeof window !== 'undefined') {
  (window as any).testEstimate = {
    sufficientBalance: testSufficientBalance,
    insufficientBalance: testInsufficientBalance,
    analysisModes: testAnalysisModes,
    runAll: runAllTests
  }
  
  console.log('✅ 测试函数已加载，使用方法：')
  console.log('  window.testEstimate.sufficientBalance()')
  console.log('  window.testEstimate.insufficientBalance()')
  console.log('  window.testEstimate.analysisModes()')
  console.log('  window.testEstimate.runAll()')
}
