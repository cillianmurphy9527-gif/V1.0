'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 没有任何弱智的前端阻拦，直接把您输入的东西砸向后端的鉴权中心！
      const res = await signIn('credentials', {
        email: loginId.includes('@') ? loginId : undefined,
        phone: !loginId.includes('@') ? loginId : undefined,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('账号或密码错误，或者您没有超级管理员权限');
      } else {
        // 登录成功，直接重定向到真正的总指挥部！
        router.push('/admin');
      }
    } catch (err) {
      setError('系统发生未知错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl p-8">
        
        {/* Logo 与 标题区域 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Admin 后台</h1>
          <p className="text-sm text-gray-400 mt-2">超级管理员专属登录入口</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">账号 (邮箱或手机号)</label>
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full bg-[#1F2937] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              placeholder="admin@leadpilot.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1F2937] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center text-red-500 text-sm">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98]"
          >
            {loading ? '正在验证身份...' : '进入 Admin 后台'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <svg className="w-4 h-4 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-gray-400">此页面仅供授权管理人员访问，所有操作将被记录。</span>
        </div>

      </div>
    </div>
  );
}