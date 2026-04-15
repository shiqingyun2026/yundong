import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Heart, Calendar, Baby, MapPin, ChevronRight, ShieldCheck, Verified, Headset, CheckCircle2, Users, History } from '@/src/components/icons';
import { COURSES, COACH } from '@/src/mockData';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = COURSES.find(c => c.id === id);

  if (!course) return <div>Course not found</div>;

  return (
    <div className="bg-background min-h-screen pb-24">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
            <ChevronLeft className="text-primary w-6 h-6" />
          </button>
          <h1 className="font-headline font-bold text-lg text-primary tracking-tight">课程详情</h1>
        </div>
        <div className="flex gap-4">
          <Share2 className="text-primary w-6 h-6" />
          <Heart className="text-primary w-6 h-6" />
        </div>
      </nav>

      {/* Hero */}
      <header className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-high">
        <img
          src={course.image}
          alt={course.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="w-2 h-2 rounded-full bg-white/50" />
          <div className="w-2 h-2 rounded-full bg-white/50" />
        </div>
        <div className="absolute top-6 right-6 bg-error text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
          限时特惠
        </div>
      </header>

      <main className="px-5 -mt-8 relative z-10 space-y-6">
        {/* Pricing Card */}
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

        {/* Group Buy Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-lg font-headline font-bold">正在进行的拼团</h3>
            <span className="text-primary text-xs font-bold">查看全部</span>
          </div>
          {course.currentJoined > 0 ? (
            <div className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm border border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden">
                  <img src="https://picsum.photos/seed/avatar/100/100" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold">豆豆爸</p>
                  <p className="text-[10px] text-on-surface-variant">还差 <span className="text-primary font-bold">{course.groupSize - course.currentJoined}人</span> 满团</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-on-surface-variant font-bold">剩余 23:14:02</p>
                </div>
                <button 
                  onClick={() => navigate(`/confirm-payment/${course.id}`)}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  去凑团
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm border border-surface-container">
              <p className="text-sm text-on-surface-variant">暂无进行中的拼团，立即开团吧</p>
              <button 
                onClick={() => navigate(`/confirm-payment/${course.id}`)}
                className="bg-primary-container text-white px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition-all shadow-md"
              >
                立即开团
              </button>
            </div>
          )}
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

        {/* Details */}
        <section className="space-y-6 pb-12">
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

      {/* Bottom Bar */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-t border-zinc-200/20 px-6 py-4 flex items-center gap-6 shadow-[0px_-12px_32px_rgba(45,47,47,0.06)]">
        <div className="flex flex-col items-center gap-1 active:scale-90 transition-transform cursor-pointer">
          <Headset className="w-6 h-6 text-on-surface-variant" />
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">客服</span>
        </div>
        <button 
          onClick={() => navigate(`/confirm-payment/${course.id}`)}
          className="flex-1 editorial-gradient text-white py-4 rounded-xl font-headline font-bold text-sm shadow-[0_4px_12px_rgba(255,122,44,0.3)] active:scale-95 transition-all"
        >
          立即开团 (¥{course.price})
        </button>
      </footer>
    </div>
  );
}
