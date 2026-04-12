// @ts-ignore - 脚本用 node --experimental-strip-types 直接执行时，ESM 需要显式扩展名
import { prisma } from '../lib/prisma.ts'

const PRESERVE_SUPER_ADMIN_PHONE = '18342297595'

function isApplyMode() {
  return process.argv.includes('--apply') || process.env.PREPARE_PRODUCTION_APPLY === 'true'
}

async function main() {
  const apply = isApplyMode()
  console.log(`\n[prepare-production] mode=${apply ? 'APPLY(会真实删除数据)' : 'DRY-RUN(只统计不删除)'}\n`)

  const superAdmin = await prisma.user.findUnique({
    where: { phone: PRESERVE_SUPER_ADMIN_PHONE },
    select: { id: true, phone: true, email: true, role: true },
  })

  if (!superAdmin?.id) {
    throw new Error(
      `[prepare-production] 找不到 SUPER_ADMIN 手机号 ${PRESERVE_SUPER_ADMIN_PHONE} 对应的用户。请先确保该账号存在，再执行清洗。`
    )
  }

  const preserveUserIds = [superAdmin.id]
  console.log(`[prepare-production] 保留用户：${superAdmin.phone} (${superAdmin.email || '—'}) role=${superAdmin.role}\n`)

  // 目标：一键清空开发/压测阶段的脏数据，但保留 SUPER_ADMIN + SystemSettings 等元数据
  // 策略：删除所有非保留用户的“业务数据”，不动 SystemSettings/AgentConfig/FinancialMetrics 等全局元数据表
  const targets = [
    { name: 'SendingLog', run: () => prisma.sendingLog.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'TokenTransaction', run: () => prisma.tokenTransaction.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'Order', run: () => prisma.order.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'Notification', run: () => prisma.notification.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    {
      name: 'SystemNotification',
      run: () => prisma.systemNotification.deleteMany({ where: { userId: { notIn: preserveUserIds } } }),
    },
    { name: 'BroadcastMessage', run: () => prisma.broadcastMessage.deleteMany({ where: { adminId: { notIn: preserveUserIds } } }) },
    { name: 'EmailThread', run: () => prisma.emailThread.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'Ticket', run: () => prisma.ticket.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'Domain', run: () => prisma.domain.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'DeviceFingerprint', run: () => prisma.deviceFingerprint.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'IpRegistrationLog', run: () => prisma.ipRegistrationLog.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    // Campaign/Lead/AgentSession 有外键级联，但仍显式删除更清晰
    { name: 'Lead', run: () => prisma.lead.deleteMany({ where: { campaign: { userId: { notIn: preserveUserIds } } } }) },
    { name: 'AgentSession', run: () => prisma.agentSession.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'Campaign', run: () => prisma.campaign.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    { name: 'KnowledgeBase', run: () => prisma.knowledgeBase.deleteMany({ where: { userId: { notIn: preserveUserIds } } }) },
    // 验证码/风控日志属于“开发痕迹”，统一清空
    { name: 'VerificationCode', run: () => prisma.verificationCode.deleteMany({}) },
    { name: 'UnsubscribeList', run: () => prisma.unsubscribeList.deleteMany({}) },
    { name: 'IpBlacklist', run: () => prisma.ipBlacklist.deleteMany({}) },
  ] as const

  const results: { name: string; count: number }[] = []

  for (const t of targets) {
    if (!apply) {
      // DRY-RUN：用 count 预估删除量
      // deleteMany 在 Prisma 里也会返回 count，但 DRY-RUN 不应改动数据
      const count = await (async () => {
        switch (t.name) {
          case 'SendingLog':
            return prisma.sendingLog.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'TokenTransaction':
            return prisma.tokenTransaction.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Order':
            return prisma.order.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Notification':
            return prisma.notification.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'SystemNotification':
            return prisma.systemNotification.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'BroadcastMessage':
            return prisma.broadcastMessage.count({ where: { adminId: { notIn: preserveUserIds } } })
          case 'EmailThread':
            return prisma.emailThread.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Ticket':
            return prisma.ticket.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Domain':
            return prisma.domain.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'DeviceFingerprint':
            return prisma.deviceFingerprint.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'IpRegistrationLog':
            return prisma.ipRegistrationLog.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Lead':
            return prisma.lead.count({ where: { campaign: { userId: { notIn: preserveUserIds } } } })
          case 'AgentSession':
            return prisma.agentSession.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'Campaign':
            return prisma.campaign.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'KnowledgeBase':
            return prisma.knowledgeBase.count({ where: { userId: { notIn: preserveUserIds } } })
          case 'VerificationCode':
            return prisma.verificationCode.count()
          case 'UnsubscribeList':
            return prisma.unsubscribeList.count()
          case 'IpBlacklist':
            return prisma.ipBlacklist.count()
          default:
            return 0
        }
      })()
      results.push({ name: t.name, count })
    } else {
      const r = await t.run()
      results.push({ name: t.name, count: (r as any)?.count ?? 0 })
    }
  }

  const total = results.reduce((sum, r) => sum + r.count, 0)
  console.log('[prepare-production] 清理项统计：')
  for (const r of results) console.log(`- ${r.name}: ${r.count}`)
  console.log(`\n[prepare-production] 合计：${total}\n`)

  if (apply) {
    // 最后一步：清理非保留用户账号（避免遗留测试账号）
    const delUsers = await prisma.user.deleteMany({ where: { id: { notIn: preserveUserIds } } })
    console.log(`[prepare-production] User: ${delUsers.count}`)
  } else {
    const c = await prisma.user.count({ where: { id: { notIn: preserveUserIds } } })
    console.log(`[prepare-production] User(将删除): ${c}`)
  }

  console.log('\n[prepare-production] 完成。\n')
}

main()
  .catch((e) => {
    console.error('[prepare-production] FAILED:', e?.message || e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })

