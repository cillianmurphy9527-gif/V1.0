/**
 * 优惠券服务 - 基于面额的动态有效期策略
 * 
 * 策略说明：
 * - ¥50 优惠券（体验版）：90天有效期 - 长线留存钩子
 * - ¥150 优惠券（专业版）：30天有效期 - 常规逼单
 * - ¥300 优惠券（企业版）：14天有效期 - 极速收割
 */

interface CouponGenerationParams {
  userId: string // 邀请人ID
  referredUserId: string // 被邀请人ID
  referredUserPhone: string // 被邀请人手机号（用于描述）
  purchasedPlan: 'STARTER' | 'PRO' | 'MAX' // 被邀请人购买的套餐
  orderId: string // 订单ID
}

export class CouponService {
  /**
   * 根据购买套餐动态计算优惠券面额和有效期
   */
  private static calculateCouponDetails(plan: string): {
    amount: number
    validDays: number
    planName: string
  } {
    switch (plan) {
      case 'STARTER':
        return {
          amount: 50,
          validDays: 90, // 长线留存钩子
          planName: '体验版'
        }
      case 'PRO':
        return {
          amount: 150,
          validDays: 30, // 常规逼单
          planName: '专业版'
        }
      case 'MAX':
        return {
          amount: 300,
          validDays: 14, // 极速收割
          planName: '企业版'
        }
      default:
        throw new Error(`未知套餐类型: ${plan}`)
    }
  }

  /**
   * 为邀请人生成并发放优惠券
   * 
   * @param params 优惠券生成参数
   * @returns 生成的优惠券ID
   */
  static async generateReferralCoupon(
    params: CouponGenerationParams
  ): Promise<string> {
    const { userId, referredUserPhone, purchasedPlan, orderId } = params

    // 动态计算优惠券详情
    const { amount, validDays, planName } = this.calculateCouponDetails(purchasedPlan)

    // 计算有效期时间戳
    const now = new Date()
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000)

    // 生成来源描述（手机号掩码）
    const maskedPhone = referredUserPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    const sourceDescription = `邀请用户${maskedPhone}购买${planName}奖励`

    // TODO: 实际生产环境中，这里应该调用 Prisma 创建 Coupon 记录
    // const coupon = await prisma.coupon.create({
    //   data: {
    //     userId,
    //     discountAmount: amount,
    //     isUsed: false,
    //     sourceDescription,
    //     validUntil,
    //     createdAt: now
    //   }
    // })

    console.log(`[CouponService] 为用户 ${userId} 生成优惠券:`, {
      amount: `¥${amount}`,
      validDays: `${validDays}天`,
      validUntil: validUntil.toISOString(),
      sourceDescription
    })

    // Mock 返回优惠券ID
    return `COUPON_${Date.now()}`
  }

  /**
   * 计算优惠券剩余天数
   */
  static calculateRemainingDays(validUntil: Date): number {
    const now = new Date()
    const diff = validUntil.getTime() - now.getTime()
    return Math.ceil(diff / (24 * 60 * 60 * 1000))
  }

  /**
   * 判断优惠券是否即将过期（不足3天）
   */
  static isExpiringSoon(validUntil: Date): boolean {
    return this.calculateRemainingDays(validUntil) <= 3
  }

  /**
   * 判断优惠券是否已过期
   */
  static isExpired(validUntil: Date): boolean {
    return new Date() > validUntil
  }
}

export const couponService = new CouponService()
