import Redis from 'ioredis'

let redisSingleton: Redis | null = null

/**
 * 应用内共享的 ioredis 客户端（懒加载单例）。
 * 未配置 REDIS_URL / REDIS_HOST 时返回 null。
 */
export function getRedis(): Redis | null {
  if (redisSingleton) return redisSingleton
  const url = process.env.REDIS_URL
  const host = process.env.REDIS_HOST
  const port = process.env.REDIS_PORT
  try {
    if (url) {
      redisSingleton = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false })
      return redisSingleton
    }
    if (host || port) {
      redisSingleton = new Redis({
        host: host || 'localhost',
        port: Number(port || 6379),
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
      })
      return redisSingleton
    }
  } catch {
    return null
  }
  return null
}
// ─── 全局分布式互斥锁 (防 API 瞬间被刷爆) ───

/**
 * 尝试获取一把全局锁 (一客买单，万客免单机制)
 * @param key 锁的名称 (如: lock:search:US:Logistics)
 * @param ttlSeconds 锁的最长存活时间，防止死锁 (默认 30 秒)
 * @returns 是否成功获取到锁
 */
export async function acquireLock(key: string, ttlSeconds: number = 30): Promise<boolean> {
  const client = getRedis();
  // 降级保护：如果 Redis 没启动或连不上，直接放行，保证系统不瘫痪
  if (!client) return true; 

  try {
    // setnx: 如果不存在则设置成功返回 1，如果已存在则返回 0
    const result = await client.setnx(key, 'LOCKED');
    if (result === 1) {
      await client.expire(key, ttlSeconds);
      return true; // 抢到锁了！可以去调扣费 API 了
    }
    return false; // 没抢到锁，别人正在搜，等白嫖吧
  } catch (error) {
    console.error(`[Redis 锁] 获取失败 ${key}:`, error);
    return true; // 发生异常也强行放行，业务第一
  }
}

/**
 * 释放全局锁
 */
export async function releaseLock(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.error(`[Redis 锁] 释放失败 ${key}:`, error);
  }
}

/**
 * 延迟等待函数 (用于没抢到锁的人，在原地挂起等待)
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));