import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { acquireIdempotencyLock, findRecentPendingOrder, releaseIdempotencyLock } from '@/lib/idempotency'
import { getDynamicPricing } from '@/lib/dynamic-pricing' 

const HARDCODED_SEEDS = [
  { id: 'dev-admin-super', phone: '18342297595', email: 'admin@leadpilot.cn', companyName: '系统管理员', role: 'ADMIN', subscriptionTier: 'MAX', tokenBalance: 9999999, features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: true }) },
  { id: 'dev-user-dashboard', phone: '1390504583', email: '1390504583@qq.com', companyName: '测试用户', role: 'USER', subscriptionTier: 'PRO', tokenBalance: 100000, features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: false }) },
]

async function ensureUserExists(userId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  const seed = HARDCODED_SEEDS.find(s => s.id === userId)
  if (!seed) return
  try {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!exists) { await prisma.user.create({ data: { ...seed } }) }
  } catch (e) {
    console.warn('[ensureUserExists] skipped:', (e as any)?.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const userId = token.id as string
    const body = await request.json()
    // 获取传入的购买数量，可能是 qty 或 sets
    const { planId, cycle, qty, domainQty, orderType: bodyOrderType, couponId, sets } = body
    const buyCount = qty || sets || domainQty || 1;

    if (!planId && !domainQty) return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    await ensureUserExists(userId)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    let amount = 0 
    let orderType = bodyOrderType || 'SUBSCRIPTION'
    let planName = ''

    const store = getDynamicPricing()
    let realProduct = null
    
    // 🚀 核心修复：全网深度搜索商品（适配全新的 groups 嵌套结构）
    const targetId = planId || 'domain-addon'; // 如果只有 domainQty 没有 planId，设个兜底
    
    if (store.groups) {
      for (const group of store.groups) {
        const found = group.items?.find((p: any) => p.id === targetId || p.id.includes('domain'));
        if (found) {
          realProduct = found;
          break;
        }
      }
    }

    if (!realProduct) {
      // 如果没找到且是之前硬编码的导出包，做一个宽容的兜底，防止直接报错
      if (planId === 'EXPORT_PACK') {
         realProduct = { name: '高阶数据导出包', price: 99, allowTiers: true, tierPrices: [{min:10, price:75},{min:5, price:80},{min:2, price:94}] };
      } else {
         return NextResponse.json({ error: `无效的商品: ${planId}` }, { status: 400 })
      }
    }

    planName = realProduct.name
    let basePrice = Number(realProduct.price)

    // 🚀 核心：如果该商品开启了专属阶梯定价！
    if (realProduct.allowTiers && realProduct.tierPrices && realProduct.tierPrices.length > 0) {
      // 降序排列，找到符合条件的最大的 min
      const sortedTiers = [...realProduct.tierPrices].sort((a, b) => b.min - a.min);
      const matchingTier = sortedTiers.find(t => buyCount >= t.min);
      if (matchingTier) {
         basePrice = Number(matchingTier.price); // 应用阶梯优惠价！
      }
      amount = buyCount * basePrice;
      orderType = 'ADDON';
      planName = `${realProduct.name} x${buyCount}`;
    } 
    // 常规套餐的周期折扣
    else if (cycle === 'monthly' || cycle === 'quarterly' || cycle === 'yearly') {
      const months = cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 1
      const disc = cycle === 'quarterly' ? 0.85 : cycle === 'yearly' ? 0.70 : 1
      amount = Math.round(basePrice * months * disc)
    } 
    // 纯按数量乘
    else {
      amount = buyCount * basePrice;
      if (buyCount > 1) planName = `${realProduct.name} x${buyCount}`;
    }

    let couponDiscount = 0
    let validatedCoupon: any = null
    if (couponId) {
      const coupon = await prisma.coupon.findFirst({ where: { id: couponId, userId, isUsed: false, validUntil: { gt: new Date() } } })
      if (!coupon) return NextResponse.json({ error: '优惠券无效' }, { status: 400 })
      couponDiscount = coupon.discountAmount
      validatedCoupon = { id: coupon.id }
    }

    const idemKey = `idem:order:${userId}:${orderType}:${planName}:${amount}`
    const recent = await findRecentPendingOrder({ userId, amount, orderType, plan: planName, withinSeconds: 5 })
    if (recent) return NextResponse.json({ error: '重复下单拦截', code: 'IDEMPOTENT_CONFLICT' }, { status: 409 })

    const lock = await acquireIdempotencyLock({ key: idemKey, ttlMs: 5000 })
    if (!lock.ok) return NextResponse.json({ error: '请勿连续点击' }, { status: 409 })
    
    try {
      const finalAmountAfterCoupon = Math.max(0, amount - couponDiscount)
      const newOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: { userId, plan: planName, amount: finalAmountAfterCoupon, status: 'PENDING', orderType, tradeNo: `ORDER-${Date.now()}` },
        })
        if (validatedCoupon) await tx.coupon.update({ where: { id: validatedCoupon.id }, data: { isUsed: true, usedAt: new Date(), usedOrderId: order.id } })
        return order
      })
      return NextResponse.json({ success: true, orderId: newOrder.id, amount: finalAmountAfterCoupon, message: '订单创建成功' })
    } finally {
      if (lock.ok) await releaseIdempotencyLock(idemKey)
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}