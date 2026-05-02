/**
 * PlanTemplate 数据初始化脚本
 * 
 * 运行方式：
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-plan-templates.ts
 * 
 * 或者直接复制 SQL 到数据库执行：
 *   psql $DATABASE_URL -f prisma/seed-plan-templates.sql
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化 PlanTemplate 数据...\n');

  // 定义套餐模板数据
  const planTemplates = [
    {
      planCode: 'FREE',
      name: '体验版',
      price: 0,
      leadsLimit: 3,
      emailAccountsLimit: 0,
      dailySendLimit: 0,
      exportQuota: 0,
      features: {
        canUseInbox: false,
        aiScoring: false,
        multiDomain: false,
        multiLanguage: false,
        deepIntentAnalysis: false,
        aiReplySuggestions: false,
        ragUpload: false,
        dataExport: false,
      },
      isActive: true,
    },
    {
      planCode: 'STARTER',
      name: '试运营版',
      price: 399,
      leadsLimit: 300,
      emailAccountsLimit: 1,
      dailySendLimit: 999999,
      exportQuota: 0,
      features: {
        canUseInbox: true,
        aiScoring: true,
        multiDomain: false,
        multiLanguage: false,
        deepIntentAnalysis: false,
        aiReplySuggestions: false,
        ragUpload: true,
        dataExport: false,
      },
      isActive: true,
    },
    {
      planCode: 'PRO',
      name: '增长版',
      price: 999,
      leadsLimit: 1000,
      emailAccountsLimit: 3,
      dailySendLimit: 999999,
      exportQuota: 50,
      features: {
        canUseInbox: true,
        aiScoring: true,
        multiDomain: true,
        multiLanguage: true,
        deepIntentAnalysis: true,
        aiReplySuggestions: true,
        ragUpload: true,
        dataExport: true,
      },
      isActive: true,
    },
    {
      planCode: 'MAX',
      name: '旗舰版',
      price: 3999,
      leadsLimit: 3000,
      emailAccountsLimit: 10,
      dailySendLimit: 999999,
      exportQuota: 200,
      features: {
        canUseInbox: true,
        aiScoring: true,
        multiDomain: true,
        multiLanguage: true,
        deepIntentAnalysis: true,
        aiReplySuggestions: true,
        ragUpload: true,
        dataExport: true,
      },
      isActive: true,
    },
  ];

  // 逐个插入或更新
  for (const template of planTemplates) {
    const existing = await prisma.planTemplate.findUnique({
      where: { planCode: template.planCode },
    });

    if (existing) {
      // 更新现有记录
      const updated = await prisma.planTemplate.update({
        where: { planCode: template.planCode },
        data: {
          name: template.name,
          price: template.price,
          leadsLimit: template.leadsLimit,
          emailAccountsLimit: template.emailAccountsLimit,
          dailySendLimit: template.dailySendLimit,
          exportQuota: template.exportQuota,
          features: template.features,
          isActive: template.isActive,
        },
      });
      console.log(`✅ 更新套餐模板: ${template.planCode} (${template.name})`);
      console.log(`   leadsLimit: ${updated.leadsLimit}, exportQuota: ${updated.exportQuota}`);
    } else {
      // 创建新记录
      const created = await prisma.planTemplate.create({
        data: template,
      });
      console.log(`✅ 创建套餐模板: ${template.planCode} (${template.name})`);
      console.log(`   leadsLimit: ${created.leadsLimit}, exportQuota: ${created.exportQuota}`);
    }
  }

  console.log('\n🎉 PlanTemplate 数据初始化完成！\n');

  // 验证数据
  const allTemplates = await prisma.planTemplate.findMany({
    orderBy: { price: 'asc' },
  });

  console.log('📋 当前套餐模板列表：');
  console.log('─'.repeat(80));
  console.log('| planCode  | name     | price  | leadsLimit | exportQuota |');
  console.log('─'.repeat(80));
  for (const t of allTemplates) {
    console.log(`| ${t.planCode.padEnd(10)} | ${t.name.padEnd(8)} | ${String(t.price).padStart(6)} | ${String(t.leadsLimit).padStart(10)} | ${String(t.exportQuota).padStart(12)} |`);
  }
  console.log('─'.repeat(80));
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
