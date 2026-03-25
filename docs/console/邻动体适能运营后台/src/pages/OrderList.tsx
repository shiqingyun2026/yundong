/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  Eye, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import { MOCK_ORDERS } from '../constants';
import { OrderStatus, Order } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const OrderList: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PAID: return "bg-green-50 text-green-600 border-green-200";
      case OrderStatus.REFUNDED: return "bg-red-50 text-red-600 border-red-200";
      case OrderStatus.REFUNDING: return "bg-orange-50 text-orange-600 border-orange-200";
      default: return "bg-gray-50 text-gray-500 border-gray-200";
    }
  };

  const OrderDetailModal = ({ order, onClose }: { order: Order; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">订单详情</h3>
            <span className="text-sm text-gray-400 font-mono">#{order.id}</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
              getStatusColor(order.status)
            )}>
              {order.status}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-700 font-medium">点击切换状态演示不同变体效果：</p>
              <button className="text-xs text-blue-500 hover:underline mt-1 font-bold">查看已退款标注</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6321] rounded-full" />
                <h4 className="text-sm font-bold text-gray-900">用户信息</h4>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <img 
                  src={`https://picsum.photos/seed/${order.userNickname}/100/100`} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-sm font-bold text-gray-900">{order.userNickname}</p>
                  <p className="text-xs text-gray-500">普通会员</p>
                </div>
              </div>
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">联系手机</span>
                  <span className="text-gray-900 font-bold">{order.phone}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">注册来源</span>
                  <span className="text-gray-900 font-bold">{order.source}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6321] rounded-full" />
                <h4 className="text-sm font-bold text-gray-900">课程/拼团</h4>
              </div>
              <div className="space-y-3 px-1">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">课程名称</p>
                  <p className="text-sm font-bold text-gray-900 leading-snug">{order.courseName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">上课地点</p>
                  <p className="text-xs text-gray-600">朝阳区奥体中心馆 2楼3号场</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">拼团进度</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                    <div className="w-3/5 h-full bg-[#FF6321]" />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-gray-400">当前: 3人</span>
                    <span className="text-gray-400">目标: 5人</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6321] rounded-full" />
                <h4 className="text-sm font-bold text-gray-900">订单信息</h4>
              </div>
              <div className="space-y-3 px-1">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">支付金额</p>
                  <p className="text-lg font-bold text-[#FF6321]">¥{order.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">支付方式</p>
                  <p className="text-sm font-bold text-gray-900">{order.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">下单时间</p>
                  <p className="text-sm font-bold text-gray-900">{order.orderTime}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-500 mt-0.5" />
            <div>
              <p className="text-xs text-orange-800 font-bold mb-1">管理备注</p>
              <p className="text-xs text-orange-700 leading-relaxed">该用户为首次参与拼团课程，建议在开课前24小时通过短信进行课程提醒。如遇课程调整，请务必先与教练确认场馆占用情况。</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
            关闭
          </button>
          {order.status === OrderStatus.PAID && (
            <button 
              onClick={() => {
                setOrderToRefund(order);
                setShowRefundModal(true);
              }}
              className="px-6 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl font-bold hover:bg-red-50 transition-all"
            >
              手动退款
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );

  const RefundModal = ({ order, onClose }: { order: Order; onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
      >
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">确认手动退款？</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          您正在对订单 <span className="font-bold text-gray-900">{order.id}</span> 执行退款操作。<br />
          此操作会将款项原路返回至用户支付账户，<br />
          且<span className="text-red-500 font-bold">不可撤销</span>。
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-8 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">退款金额:</span>
            <span className="text-red-500 font-bold">¥{order.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">退款原因:</span>
            <span className="text-gray-900 font-bold">客户协商退款</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
            再想想
          </button>
          <button onClick={onClose} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all">
            确认退款
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">订单列表</h2>
          <p className="text-sm text-gray-500 mt-1">管理系统内的所有客户课程购买订单。</p>
        </div>
        <button className="bg-white border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all active:scale-[0.98]">
          <Download size={20} />
          <span>导出数据</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">订单编号</label>
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
            <input 
              type="text" 
              placeholder="输入订单号搜索" 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">用户昵称</label>
          <input 
            type="text" 
            placeholder="输入昵称" 
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">手机号码</label>
          <input 
            type="text" 
            placeholder="输入手机号" 
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex-1 bg-[#1E293B] hover:bg-[#0F172A] text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
            查询
          </button>
          <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
            重置
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">订单号</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">用户昵称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">手机号码</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">课程名称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">支付金额</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">下单时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5 text-sm font-medium text-gray-500">{order.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={`https://picsum.photos/seed/${order.userNickname}/100/100`} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-sm font-bold text-gray-900">{order.userNickname}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-600">{order.phone}</td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{order.courseName}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-gray-900">¥{order.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                      getStatusColor(order.status)
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-500">{order.orderTime}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="text-[#FF6321] hover:text-[#E8561B] text-sm font-bold flex items-center gap-1 transition-colors"
                      >
                        <Eye size={14} />
                        详情
                      </button>
                      <div className="w-px h-3 bg-gray-200" />
                      <button 
                        onClick={() => {
                          setOrderToRefund(order);
                          setShowRefundModal(true);
                        }}
                        className="text-gray-400 hover:text-red-500 text-sm font-bold flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw size={14} />
                        退款
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
          <p className="text-sm text-gray-500">显示第 1 到 5 条，共 <span className="font-bold text-gray-900">42</span> 条记录</p>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors disabled:opacity-50" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#FF6321] text-white font-bold text-sm shadow-md shadow-[#FF6321]/20">1</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">2</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">3</button>
            <span className="text-gray-400 px-1">...</span>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">9</button>
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        )}
        {showRefundModal && orderToRefund && (
          <RefundModal order={orderToRefund} onClose={() => setShowRefundModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
