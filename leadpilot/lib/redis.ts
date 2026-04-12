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
