import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Verified, Users, History, Share2, Plus, Calendar, Baby, MapPin, ChevronRight, ShieldCheck, CheckCircle2 } from '@/src/components/icons';
import { MY_GROUP_BUYS, COURSES, COACH } from '@/src/mockData';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export default function GroupBuyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const groupBuy = MY_GROUP_BUYS.find(gb => gb.id === id);
  const course = COURSES.find(c => c.id === groupBuy?.courseId);
  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 59, s: 59 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!groupBuy || !course) return <div>Group buy or course not found</div>;

  const missingCount = groupBuy.targetCount - groupBuy.currentCount;

  return (
    <div className="bg-background min-h-screen pb-32">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="text-primary w-6 h-6" />
          </button>
          <span className="font-headline font-bold text-lg text-primary tracking-tight">拼团详情</span>
        </div>
      </header>

      {/* Hero Image */}
      <section className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-high">
        <img
          src={course.image}
          alt={course.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-6 right-6 bg-error text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
          正在拼团
        </div>
      </section>

      <main className="px-6 py-8 space-y-8 -mt-12 relative z-10">
        {/* Status Header */}
        <section className="relative bg-surface-container-lowest/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
          <div className="inline-block bg-primary-container text-on-primary-container px-4 py-1 rounded-full text-xs font-bold font-label uppercase tracking-wider mb-3">
            Ongoing Status
          </div>
          <h1 className="font-headline font-black text-4xl text-on-surface leading-tight tracking-tight">
            进行中<br />
            <span className="text-primary">还差 {missingCount} 人</span>成团
          </h1>
          <div className="absolute -top-4 -right-2 opacity-10">
            <Users className="w-32 h-32" />
          </div>
        </section>

        {/* Course Summary Card */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_12px_32px_rgba(45,47,47,0.06)]">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-primary font-headline font-extrabold text-3xl">¥{course.price}</span>
            <span className="text-on-surface-variant line-through text-sm">¥{course.originalPrice}</span>
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <span className="bg-primary-container/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md">
                {course.groupSize}人满团
              </span>
              <span className="text-secondary font-bold text-[10px] flex items-center gap-1 whitespace-nowrap bg-secondary/5 px-2 py-1 rounded-md">
                <CheckCircle2 className="w-3 h-3 fill-current" />
                已拼 {course.currentJoined}人
              </span>
            </div>
          </div>
          <h2 className="text-2xl font-headline font-bold mb-4 leading-tight">{course.title}</h2>
          
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-surface-container">
            <div className="flex items-center gap-3">
              <Calendar className="text-primary w-5 h-5" />
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">上课时间</p>
                <p className="text-sm font-semibold">{course.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Baby className="text-primary w-5 h-5" />
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">适用年龄</p>
                <p className="text-sm font-semibold">{course.ageRange}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pt-4 border-t border-surface-container">
            <MapPin className="text-primary w-5 h-5" />
            <div className="flex-1">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">上课地点</p>
              <p className="text-sm font-semibold">{course.location}</p>
            </div>
            <ChevronRight className="text-on-surface-variant w-5 h-5" />
          </div>
        </section>

        {/* Progress & Countdown */}
        <section className="bg-surface-container-low rounded-xl p-6 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-on-surface-variant text-sm font-medium">距离结束还剩</p>
            <div className="flex justify-center items-center gap-2">
              <div className="bg-on-surface text-surface-container-lowest font-headline font-bold text-xl px-3 py-2 rounded-lg">
                {String(timeLeft.h).padStart(2, '0')}
              </div>
              <span className="font-bold text-on-surface">:</span>
              <div className="bg-on-surface text-surface-container-lowest font-headline font-bold text-xl px-3 py-2 rounded-lg">
                {String(timeLeft.m).padStart(2, '0')}
              </div>
              <span className="font-bold text-on-surface">:</span>
              <div className="bg-on-surface text-surface-container-lowest font-headline font-bold text-xl px-3 py-2 rounded-lg">
                {String(timeLeft.s).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Avatars */}
          <div className="flex justify-center items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-primary overflow-hidden ring-4 ring-primary-container/20">
                <img src={groupBuy.leaderAvatar} alt="Leader" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                团长
              </div>
            </div>
            {Array.from({ length: missingCount }).map((_, i) => (
              <div key={i} className="w-16 h-16 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center bg-surface-container-high">
                <Plus className="text-outline w-6 h-6" />
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold font-label text-on-surface-variant">
              <span>已参团 {groupBuy.currentCount} 人</span>
              <span>{groupBuy.targetCount} 人成团</span>
            </div>
            <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(groupBuy.currentCount / groupBuy.targetCount) * 100}%` }}
                className="h-full editorial-gradient rounded-full" 
              />
            </div>
          </div>
        </section>

        {/* Rules */}
        <section className="space-y-4">
          <h3 className="font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            拼团规则
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl">
              <Users className="text-primary w-6 h-6 mb-2" />
              <p className="text-sm font-bold text-on-surface">多人成团</p>
              <p className="text-xs text-on-surface-variant mt-1">达到人数自动成团，享受优惠价格</p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl">
              <History className="text-secondary w-6 h-6 mb-2" />
              <p className="text-sm font-bold text-on-surface">超时退款</p>
              <p className="text-xs text-on-surface-variant mt-1">若拼团失败，资金将原路返回</p>
            </div>
          </div>
        </section>

        {/* Coach Section */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16" />
          <h3 className="text-lg font-headline font-bold mb-5 flex items-center gap-2">
            授课教练
            <Verified className="text-secondary w-4 h-4 fill-current" />
          </h3>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface-container shadow-md">
              <img src={COACH.avatar} alt={COACH.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold">{COACH.name}</h4>
              <p className="text-sm text-secondary font-bold mb-1">{COACH.title}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{COACH.bio}</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {COACH.certificates.map((cert, i) => (
              <div key={i} className="flex-shrink-0 w-24 aspect-[3/2] bg-surface-container-low rounded-lg p-1 border border-outline-variant/20">
                <img src={cert} className="w-full h-full object-cover rounded" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </section>

        {/* Insurance */}
        <section className="bg-secondary-container rounded-xl p-5 flex items-center gap-4">
          <div className="bg-white/40 p-2 rounded-full">
            <ShieldCheck className="text-on-secondary-container w-6 h-6 fill-current" />
          </div>
          <div>
            <h4 className="font-bold text-on-secondary-container">保险说明</h4>
            <p className="text-xs text-on-secondary-container opacity-90">本课程赠送运动意外险，全方位保障孩子安全。</p>
          </div>
        </section>

        {/* Course Details (Introduction & Modules) */}
        <section className="space-y-6 pb-12 border-t border-surface-container pt-8">
          <h3 className="text-xl font-headline font-bold px-1 border-l-4 border-primary">课程详情</h3>
          <div className="space-y-6 text-on-surface-variant leading-loose">
            <p className="text-sm">{course.description}</p>
            {course.modules.map(module => (
              <div key={module.id} className="rounded-2xl overflow-hidden shadow-sm">
                <img src={module.image} alt={module.title} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                <div className="p-4 bg-surface-container-lowest">
                  <p className="text-xs font-bold text-on-surface">{module.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md px-6 pb-10 pt-4 flex flex-col gap-4 shadow-[0px_-12px_32px_rgba(45,47,47,0.06)] border-t border-zinc-200/15">
        <button className="w-full editorial-gradient text-on-primary font-headline font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-lg shadow-primary/20">
          <Share2 className="w-5 h-5 fill-current" />
          <span>邀请好友参团</span>
        </button>
      </footer>
    </div>
  );
}
