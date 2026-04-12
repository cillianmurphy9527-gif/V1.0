import bcrypt from 'bcryptjs'

/** 与注册、登录共用，避免多处 rounds / 实现不一致 */
const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/** plain 为明文，hash 为库中存 bcrypt 串（bcrypt.compare 参数顺序不可颠倒） */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (plain == null || hash == null || hash === '') return false
  return bcrypt.compare(plain, hash)
}
