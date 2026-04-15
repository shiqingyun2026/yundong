import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Verified, Info } from '@/src/components/icons';
import { MY_GROUP_BUYS } from '@/src/mockData';
import { BottomNav } from '@/src/components/BottomNav';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function MyGroupBuysPage() {
  const [activeTab, setActiveTab] = useState('全部');
  const navigate = useNavigate();

  const tabs = ['全部', '进行中', '已成团', '已失败'];

  const filteredGroupBuys = MY_GROUP_BUYS.filter(gb => {
    if (activeTab === '全部') return true;
    if (activeTab === '进行中') return gb.status === 'ongoing';
    if (activeTab === '已成团') return gb.status === 'completed';
    if (activeTab === '已失败') return gb.status === 'failed';
    return true;
  });

  return (
    <div className="bg-background min-h-screen pb-24">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <MapPin className="text-primary w-6 h-6" />
          <h1 className="font-headline font-bold text-lg text-primary tracking-tight">邻动体适能</h1>
        </div>
      </header>
      
      <div className="bg-surface-container-low h-[4px] w-full" />

      <section className="px-6 pt-8 pb-4">
        <h2 className="font-headline font-black text-3xl text-on-surface mb-6">我的拼团</h2>
        <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative py-2 flex-shrink-0 transition-all"
            >
              <span className={cn(
                "font-headline text-lg",
                activeTab === tab ? "font-bold text-primary" : "font-medium text-on-surface-variant"
              )}>
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full" 
                />
              )}
            </button>
          ))}
        </div>
      </section>

      <main className="px-6 space-y-6">
        {filteredGroupBuys.map((gb) => (
          <motion.div
            key={gb.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "bg-surface-container-lowest rounded-xl p-4 shadow-[0px_12px_32px_rgba(45,47,47,0.06)] relative overflow-hidden",
              gb.status === 'completed' && "border-l-4 border-secondary"
            )}
          >
            <div className="flex gap-4 relative">
              <div className="absolute top-0 right-0 z-10">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                  gb.status === 'ongoing' && "bg-primary-container text-on-primary-container",
                  gb.status === 'completed' && "bg-secondary-container text-on-secondary-container",
                  gb.status === 'failed' && "bg-surface-variant text-on-surface-variant"
                )}>
                  {gb.status === 'ongoing' ? '进行中' : gb.status === 'completed' ? '已成团' : '拼团失败'}
                </span>
              </div>

              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img 
                  src={gb.courseImage} 
                  alt={gb.courseTitle} 
                  className={cn("w-full h-full object-cover", gb.status === 'failed' && "grayscale")}
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-headline font-bold text-on-surface leading-tight text-lg pr-12">
                    {gb.courseTitle}
                  </h3>
                  <p className="text-on-surface-variant text-xs mt-1">
                    {gb.status === 'ongoing' ? `教练: ${gb.coachName} · 剩余 22:15:08` : `开课日期: ${gb.startTime || '2023-11-20'}`}
                  </p>
                </div>

                {gb.status === 'ongoing' && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full border-2 border-surface-container-lowest bg-surface-variant" />
                      <div className="w-6 h-6 rounded-full border-2 border-surface-container-lowest bg-surface-variant" />
                      <div className="w-6 h-6 rounded-full border-2 border-surface-container-lowest flex items-center justify-center bg-primary text-[8px] text-on-primary font-bold">+1</div>
                    </div>
                    <span className="text-[10px] font-bold text-primary">还差{gb.targetCount - gb.currentCount}人成团</span>
                  </div>
                )}

                {gb.status === 'completed' && (
                  <div className="flex items-center mt-3 text-secondary gap-1">
                    <Verified className="w-4 h-4 fill-current" />
                    <span className="text-[10px] font-bold">拼团成功 · 享受优惠价 ¥{gb.price}</span>
                  </div>
                )}

                {gb.status === 'failed' && (
                  <div className="mt-3 flex items-center gap-1 text-error">
                    <Info className="w-4 h-4" />
                    <span className="text-[10px] font-medium">退款已按原路返回 (¥{gb.price}.00)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {gb.status === 'ongoing' ? (
                <>
                  <button 
                    onClick={() => navigate(`/group-buy/${gb.id}`)}
                    className="flex-1 bg-surface-container-low text-on-surface-variant py-3 rounded-lg font-bold text-sm active:scale-95 transition-transform"
                  >
                    查看详情
                  </button>
                  <button className="flex-1 editorial-gradient text-on-primary py-3 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform">
                    邀请好友
                  </button>
                </>
              ) : gb.status === 'completed' ? (
                <>
                  <button className="flex-1 bg-surface-container-low text-on-surface-variant py-3 rounded-lg font-bold text-sm">查看详情</button>
                  <button className="flex-1 bg-secondary text-on-secondary py-3 rounded-lg font-bold text-sm active:scale-95 transition-transform">去评价</button>
                </>
              ) : (
                <button className="w-full bg-surface-container-low text-on-surface-variant py-3 rounded-lg font-bold text-sm">查看退款详情</button>
              )}
            </div>
          </motion.div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
