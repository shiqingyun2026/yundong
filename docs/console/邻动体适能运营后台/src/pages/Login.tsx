/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, User, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock login
    navigate('/courses');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#FF6321] p-3 rounded-2xl shadow-lg shadow-[#FF6321]/20 mb-4">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">运营后台登录</h1>
          <p className="text-sm text-gray-500 mt-1">Lindong Fitness Operations Backend</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#FF6321] transition-colors">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all outline-none text-gray-900 placeholder:text-gray-400"
                placeholder="请输入您的账号"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">密码</label>
              <button type="button" className="text-xs text-[#FF6321] hover:underline">忘记密码?</button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#FF6321] transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all outline-none text-gray-900 placeholder:text-gray-400"
                placeholder="请输入您的密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#FF6321] hover:bg-[#E8561B] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#FF6321]/20 transition-all active:scale-[0.98]"
          >
            立即登录
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">© 2026 邻动体适能 · 运营后台系统</p>
          <div className="flex justify-center gap-4 mt-2">
            <button className="text-[10px] text-gray-400 hover:text-gray-600">隐私政策</button>
            <button className="text-[10px] text-gray-400 hover:text-gray-600">使用条款</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
