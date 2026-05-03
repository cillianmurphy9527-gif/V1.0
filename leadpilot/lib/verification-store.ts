/**
 * 内存验证码存储（生产环境建议替换为 Redis）
 */
const codeStore = new Map<string, { code: string; expiresAt: number; purpose: string }>();

export function getCodeStore() {
  return codeStore;
}