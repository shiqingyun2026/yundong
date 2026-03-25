/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Calendar, 
  MapPin, 
  Edit3, 
  ArrowDownCircle, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { MOCK_COURSES } from '../constants';
import { CourseStatus } from '../types';
import { cn } from '../lib/utils';

export const CourseList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusColor = (status: CourseStatus) => {
    switch (status) {
      case CourseStatus.ONGOING: return "bg-green-50 text-green-600 border-green-200";
      case CourseStatus.NOT_STARTED: return "bg-blue-50 text-blue-600 border-blue-200";
      case CourseStatus.FINISHED: return "bg-gray-50 text-gray-500 border-gray-200";
      case CourseStatus.UNLISTED: return "bg-red-50 text-red-600 border-red-200";
      default: return "bg-gray-50 text-gray-500 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">课程列表</h2>
          <p className="text-sm text-gray-500 mt-1">管理并维护校区开展的所有体能课程及团购信息。</p>
        </div>
        <button 
          onClick={() => navigate('/courses/new')}
          className="bg-[#FF6321] hover:bg-[#E8561B] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#FF6321]/20 transition-all active:scale-[0.98]"
        >
          <Plus size={20} />
          <span>新增课程</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">课程名称</label>
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
            <input 
              type="text" 
              placeholder="输入课程名称搜索" 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-64">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">上课时间范围</label>
          <div className="relative group">
            <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6321] transition-colors" />
            <input 
              type="text" 
              placeholder="开始日期 - 结束日期" 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
            />
          </div>
        </div>
        <button className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
          搜索
        </button>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98]">
          重置
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">课程ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">课程名称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">上课时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">上课地点</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">拼团价</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">原价</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">成团人数</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_COURSES.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5 text-sm font-medium text-gray-500">{course.id}</td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{course.name}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      <span>{course.startTime}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="line-clamp-1">{course.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-[#FF6321]">¥{course.groupPrice}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-gray-400 line-through">¥{course.originalPrice}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-bold text-gray-900">{course.currentEnrollment}</span>
                      <span className="text-gray-400">/{course.maxCapacity}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                      getStatusColor(course.status)
                    )}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => navigate(`/courses/edit/${course.id}`)}
                        className="text-[#FF6321] hover:text-[#E8561B] text-sm font-bold transition-colors"
                      >
                        编辑
                      </button>
                      <div className="w-px h-3 bg-gray-200" />
                      <button className="text-red-500 hover:text-red-600 text-sm font-bold transition-colors">
                        下架
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
          <p className="text-sm text-gray-500">共 <span className="font-bold text-gray-900">5</span> 条数据，当前第 1 页</p>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors disabled:opacity-50" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#FF6321] text-white font-bold text-sm shadow-md shadow-[#FF6321]/20">1</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">2</button>
            <button className="w-8 h-8 rounded-lg text-gray-600 font-bold text-sm hover:bg-white transition-colors">3</button>
            <span className="text-gray-400 px-1">...</span>
            <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-white transition-colors">
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-gray-500">跳转</span>
              <input type="text" className="w-10 h-8 border border-gray-200 rounded-lg text-center text-sm outline-none focus:border-[#FF6321]" defaultValue="1" />
              <span className="text-sm text-gray-500">页</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
