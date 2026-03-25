/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  Plus, 
  X, 
  Calendar, 
  MapPin, 
  User, 
  Image as ImageIcon,
  CheckCircle2,
  Bold,
  Italic,
  List,
  ChevronDown
} from 'lucide-react';
import { MOCK_COURSES } from '../constants';
import { cn } from '../lib/utils';

export const CourseEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const course = isEdit ? MOCK_COURSES.find(c => c.id === id) : null;

  const [formData, setFormData] = useState({
    name: course?.name || '少儿体能基础启蒙课 - 夏季班',
    ageRange: course?.ageRange || '4-8岁',
    category: course?.category || '体能启蒙',
    location: course?.location || '朝阳区奥森公园北园训练场',
    groupPrice: course?.groupPrice || 199,
    originalPrice: course?.originalPrice || 299,
    minEnrollment: 3,
    maxCapacity: course?.maxCapacity || 12,
    coachName: course?.coachName || '张力教练',
    coachIntro: course?.coachIntro || '国家一级体能训练师，从事少儿体能教育8年，善于调动孩子积极性。',
  });

  const handleSave = () => {
    // Mock save
    navigate('/courses');
  };

  const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-5 bg-[#FF6321] rounded-full" />
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
        {children}
      </div>
    </div>
  );

  const InputField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="space-y-2">
      <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/courses')}
            className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">返回课程列表</p>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{isEdit ? '编辑课程' : '新增课程'}</h2>
          </div>
        </div>
        {isEdit && (
          <div className="bg-gray-100 px-4 py-2 rounded-xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500">课程ID: {id}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-12">
          <FormSection title="基本信息">
            <InputField label="课程名称" required>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
              />
            </InputField>

            <div className="grid grid-cols-2 gap-6">
              <InputField label="适用年龄" required>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={formData.ageRange}
                    onChange={(e) => setFormData({...formData, ageRange: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                  />
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </InputField>
              <InputField label="课程分类">
                <div className="relative group">
                  <input 
                    type="text" 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                  />
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </InputField>
            </div>

            <InputField label="课程缩略图">
              <div className="flex gap-4">
                <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-gray-100 relative group">
                  <img 
                    src="https://picsum.photos/seed/fitness/300/300" 
                    alt="Thumbnail" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="text-white p-2 hover:scale-110 transition-transform">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <button className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#FF6321] hover:text-[#FF6321] transition-all group">
                  <Upload size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">上传图片</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">建议尺寸 800×600px，大小不超过 2MB</p>
            </InputField>
          </FormSection>

          <FormSection title="价格与人数">
            <div className="grid grid-cols-2 gap-6">
              <InputField label="原价 (元)" required>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                  <input 
                    type="number" 
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({...formData, originalPrice: Number(e.target.value)})}
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                  />
                </div>
              </InputField>
              <InputField label="拼团价 (元)">
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                  <input 
                    type="number" 
                    value={formData.groupPrice}
                    onChange={(e) => setFormData({...formData, groupPrice: Number(e.target.value)})}
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm border-red-200"
                  />
                </div>
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  拼团价不得高于原价
                </p>
              </InputField>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <InputField label="成团人数" required>
                <input 
                  type="number" 
                  value={formData.minEnrollment}
                  onChange={(e) => setFormData({...formData, minEnrollment: Number(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                />
              </InputField>
              <InputField label="最高容纳人数">
                <input 
                  type="number" 
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({...formData, maxCapacity: Number(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                />
              </InputField>
            </div>
          </FormSection>
        </div>

        {/* Right Column */}
        <div className="space-y-12">
          <FormSection title="时间与地点">
            <InputField label="课程日期范围" required>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 group">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    defaultValue="2024-06-01"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                  />
                </div>
                <span className="text-gray-400">至</span>
                <div className="relative flex-1 group">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    defaultValue="2024-08-31"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                  />
                </div>
              </div>
            </InputField>

            <InputField label="上课地点" required>
              <div className="relative group">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
                />
              </div>
            </InputField>
          </FormSection>

          <FormSection title="教练信息">
            <InputField label="主带教练" required>
              <input 
                type="text" 
                value={formData.coachName}
                onChange={(e) => setFormData({...formData, coachName: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm"
              />
            </InputField>

            <InputField label="教练简介">
              <textarea 
                rows={4}
                value={formData.coachIntro}
                onChange={(e) => setFormData({...formData, coachIntro: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#FF6321]/10 focus:border-[#FF6321] transition-all outline-none text-sm resize-none"
              />
            </InputField>

            <InputField label="执教证书 (最多3张)">
              <div className="flex gap-4">
                <button className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#FF6321] hover:text-[#FF6321] transition-all">
                  <Plus size={24} />
                </button>
              </div>
            </InputField>
          </FormSection>
        </div>
      </div>

      {/* Full Width Section */}
      <FormSection title="课程详细介绍">
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center gap-6">
            <button className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"><Bold size={18} /></button>
            <button className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"><Italic size={18} /></button>
            <button className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"><List size={18} /></button>
            <div className="w-px h-4 bg-gray-200" />
            <button className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors"><ImageIcon size={18} /></button>
          </div>
          <textarea 
            rows={10}
            placeholder="请输入详细的课程介绍、教学目标及注意事项..."
            className="w-full px-6 py-4 outline-none text-sm resize-none min-h-[300px]"
          />
        </div>
        <p className="text-[10px] text-gray-400">详细介绍将展示在小程序端课程详情页，建议包含课程亮点、训练内容和家长须知。</p>
      </FormSection>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-8 border-t border-gray-100">
        <button 
          onClick={() => navigate('/courses')}
          className="px-8 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
        >
          取消
        </button>
        <button 
          onClick={handleSave}
          className="px-8 py-3 bg-[#FF6321] hover:bg-[#E8561B] text-white font-bold rounded-xl shadow-lg shadow-[#FF6321]/20 transition-all active:scale-[0.98] flex items-center gap-2"
        >
          <CheckCircle2 size={20} />
          <span>提交保存</span>
        </button>
      </div>
    </div>
  );
};
