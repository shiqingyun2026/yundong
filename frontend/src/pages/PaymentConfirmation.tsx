import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Verified, Calendar, MapPin, ShoppingCart, Group, Users, History } from '@/src/components/icons';
import { COURSES } from '@/src/mockData';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function PaymentConfirmationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = COURSES.find(c => c.id === id);

  if (!course) return <div>Course not found</div>;

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="text-on-background w-6 h-6" />
          </button>
          <h1 className="font-headline font-bold text-lg text-primary tracking-tight">支付确认</h1>
        </div>
      </header>

      <div className="bg-surface-container-low h-[4px] w-full" />

      <main className="flex-grow px-6 py-8 max-w-2xl mx-auto w-full">
        {/* Summary Display */}
        <section className="mb-10 text-center">
          <p className="font-label text-on-surface-variant font-medium uppercase tracking-widest text-[12px] mb-2">待支付总额</p>
          <h2 className="font-headline text-5xl font-black text-on-surface tracking-tighter">
            <span className="text-2xl align-top mr-1 font-bold">¥</span>{course.price}.00
          </h2>
        </section>

        {/* Order Card */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_12px_32px_rgba(45,47,47,0.06)] mb-8 overflow-hidden relative">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container opacity-10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface leading-tight">{course.title}</h3>
                <p className="text-secondary font-bold text-sm mt-1 flex items-center gap-1">
                  <Verified className="w-4 h-4 fill-current" />
                  专业教练指导
                </p>
              </div>
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img src={course.image} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>

            {/* Group Buy Status */}
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Group className="text-primary w-4 h-4 fill-current" />
                <p className="text-sm font-bold text-primary">拼团中 · 还差 {course.groupSize - course.currentJoined} 人成团</p>
              </div>
              <p className="text-[12px] text-on-surface-variant font-medium">拼团截止时间：2023-10-27 20:00</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-surface-container">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                  <Calendar className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">上课时间</p>
                  <p className="font-semibold text-on-surface">{course.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                  <MapPin className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">课程地点</p>
                  <p className="font-semibold text-on-surface">{course.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <section className="space-y-4 mb-8">
          <h3 className="font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            拼团规则
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
              <Users className="text-primary w-6 h-6 mb-2" />
              <p className="text-sm font-bold text-on-surface">多人成团</p>
              <p className="text-xs text-on-surface-variant mt-1">达到人数自动成团，享受优惠价格</p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
              <History className="text-secondary w-6 h-6 mb-2" />
              <p className="text-sm font-bold text-on-surface">超时退款</p>
              <p className="text-xs text-on-surface-variant mt-1">若拼团失败，资金将原路返回</p>
            </div>
          </div>
        </section>

        {/* Terms */}
        <p className="text-center text-xs text-on-surface-variant mt-8 px-8 leading-relaxed">
          点击立即支付即表示您已阅读并同意 <span className="text-primary font-medium">《邻动体适能服务协议》</span> 与 <span className="text-primary font-medium">《退改须知》</span>
        </p>
      </main>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-white/80 backdrop-blur-md shadow-[0px_-12px_32px_rgba(45,47,47,0.06)] z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-6">
          <div className="hidden sm:block">
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-tight">合计付款</p>
            <p className="font-headline text-2xl font-black text-primary">¥{course.price}.00</p>
          </div>
          <button 
            onClick={() => navigate('/my-group-buys')}
            className="flex-grow py-4 px-8 rounded-lg editorial-gradient text-white font-headline font-bold text-lg shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            立即支付 ¥{course.price}.00
          </button>
        </div>
      </div>
      
      <div className="h-28" />
    </div>
  );
}
