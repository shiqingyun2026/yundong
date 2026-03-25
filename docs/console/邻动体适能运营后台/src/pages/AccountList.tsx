/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  X,
  User,
  Lock,
  ChevronDown,
  ShieldCheck,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { MOCK_ACCOUNTS } from '../constants';
import { UserRole, Account } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const AccountList: React.FC = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN: return "bg-orange-50 text-orange-600 border-orange-200";
      case UserRole.ADMIN: return "bg-blue-50 text-blue-600 border-blue-200";
      default: return "bg-gray-50 text-gray-500 border-gray-200";
    }
  };

  const EditAccountModal = ({ account, onClose }: { account: Account | null; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">{account ? '编辑账号' : '新增账号'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">用户名<span className="text-red-500 ml-1">*</span></label>
            <div className="relative group">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
              <input 
                type="text" 
                defaultValue={account?.username || ''}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                placeholder="请输入用户名"
              />
            </div>
            <p className="text-[10px] text-gray-400">用户名创建后不可修改</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">密码</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
              <input 
                type="password" 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                placeholder="留空则保留原密码"
              />
            </div>
          </div>

          <div className="space-y-2 text-red-500">
            <label className="text-sm font-bold text-gray-700">确认密码</label>
            <div className="relative group">
              <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" />
              <input 
                type="password" 
                defaultValue="123"
                className="w-full pl-11 pr-4 py-3 bg-red-50 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none text-sm"
              />
            </div>
            <p className="text-[10px] flex items-center gap-1">
              <X size={10} />
              两次输入的密码不一致
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">角色<span className="text-red-500 ml-1">*</span></label>
            <div className="relative group">
              <select className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm appearance-none">
                <option>{UserRole.SUPER_ADMIN}</option>
                <option>{UserRole.ADMIN}</option>
                <option>{UserRole.COACH}</option>
                <option>{UserRole.SALES}</option>
              </select>
              <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-8 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
            取消
          </button>
          <button onClick={onClose} className="px-8 py-2.5 bg-[#FF6321] hover:bg-[#E8561B] text-white font-bold rounded-xl shadow-lg shadow-[#FF6321]/20 transition-all">
            确定
          </button>
        </div>
      </motion.div>
    </div>
  );

  const DeleteConfirmationModal = ({ account, onClose }: { account: Account; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
      >
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">确认删除账号？</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          您正在删除账号 <span className="font-bold text-gray-900">{account.username}</span> (ID: {account.id})。<br />
          删除后该账号将无法登录系统，此操作<span className="text-red-500 font-bold">不可撤销</span>。
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
            取消
          </button>
          <button onClick={onClose} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all">
            确认删除
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">账号列表</h2>
          <p className="text-sm text-gray-500 mt-1">管理系统员工账号及其操作权限。</p>
        </div>
        <button 
          onClick={() => {
            setSelectedAccount(null);
            setShowEditModal(true);
          }}
          className="bg-[#FF6321] hover:bg-[#E8561B] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#FF6321]/20 transition-all active:scale-[0.98]"
        >
          <Plus size={20} />
          <span>新增账号</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-end">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">搜索用户名或 ID...</label>
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
            <input 
              type="text" 
              placeholder="搜索用户名或 ID..." 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
            />
          </div>
        </div>
        <button className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-8 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
          搜索
        </button>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-8 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
          重置
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">用户名</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">角色权限</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">最后登录时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_ACCOUNTS.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5 text-sm font-medium text-gray-500">{account.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={`https://picsum.photos/seed/${account.username}/100/100`} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-sm font-bold text-gray-900">{account.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                      getRoleBadge(account.role)
                    )}>
                      {account.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-500">{account.lastLogin}</td>
                  <td className="px-6 py-5 text-sm text-gray-500">{account.createdAt}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => {
                          setSelectedAccount(account);
                          setShowEditModal(true);
                        }}
                        className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-[#FF6321] transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setAccountToDelete(account);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">显示 1 到 5 条，共 <span className="font-bold text-gray-900">24</span> 条记录</p>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors disabled:opacity-50" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#FF6321] text-white font-bold text-sm shadow-md shadow-[#FF6321]/20">1</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">2</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">3</button>
            <span className="text-gray-400 px-1">...</span>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">5</button>
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEditModal && (
          <EditAccountModal account={selectedAccount} onClose={() => setShowEditModal(false)} />
        )}
        {showDeleteModal && accountToDelete && (
          <DeleteConfirmationModal account={accountToDelete} onClose={() => setShowDeleteModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
