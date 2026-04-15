import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Flame, Star, CheckCircle2 } from '@/src/components/icons';
import { COURSES } from '@/src/mockData';
import { BottomNav } from '@/src/components/BottomNav';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState('全部课程');
  const navigate = useNavigate();

  const filters = ['全部课程', '最近开课', '价格最低'];

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full bg-background shadow-none">
        <div className="flex items-center gap-2">
          <MapPin className="text-primary w-6 h-6" />
          <div className="flex flex-col">
            <span className="font-headline font-bold text-lg text-primary">邻动体适能</span>
            <span className="text-[10px] text-on-surface-variant font-medium">深圳 南山区 阳光花园</span>
          </div>
        </div>
      </header>
      
      <div className="bg-surface-container-low h-[4px] w-full" />

      <main className="px-6 py-8 space-y-10">
        {/* Filter Tabs */}
        <section className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-5 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all",
                activeFilter === filter
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container-high text-on-surface font-medium"
              )}
            >
              {filter}
            </button>
          ))}
        </section>

        {/* Course List */}
        <section className="grid grid-cols-1 gap-8">
          {COURSES.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col shadow-[0px_8px_24px_rgba(45,47,47,0.04)] hover:shadow-[0px_12px_32px_rgba(45,47,47,0.08)] transition-all duration-300"
            >
              <Link to={`/course/${course.id}`} className="block group">
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  {course.tags.includes('即将成团') && (
                    <div className="absolute top-4 left-4 bg-error text-white px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg">
                      <Flame className="w-3 h-3 fill-current" />
                      即将成团
                    </div>
                  )}
                  {course.isExpert && (
                    <div className="absolute top-4 left-4 bg-tertiary text-on-tertiary-fixed px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg">
                      <Star className="w-3 h-3 fill-current" />
                      名师指导
                    </div>
                  )}
                  {course.distance && (
                    <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-primary">
                      {course.distance}
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-headline font-bold text-xl text-on-surface leading-tight group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <span className="text-secondary font-bold text-xs flex items-center gap-1 whitespace-nowrap bg-secondary/5 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                      已拼 {course.currentJoined}人
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{course.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{course.location}</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Action Footer - Separated from Link for better interaction */}
              <div className="px-6 pb-6 mt-auto">
                <div className="pt-4 flex items-center justify-between border-t border-surface-container/60">
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider line-through mb-0.5 opacity-50">
                      原价 ¥{course.originalPrice}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-primary font-bold text-sm">¥</span>
                      <span className="text-primary font-black text-3xl tracking-tighter">
                        {course.price}
                      </span>
                      <span className="text-primary-dim text-[10px] font-bold ml-1 px-1.5 py-0.5 bg-primary-container/10 rounded-sm">
                        拼团价
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/course/${course.id}`)}
                    className="editorial-gradient text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer"
                  >
                    立即加入
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
