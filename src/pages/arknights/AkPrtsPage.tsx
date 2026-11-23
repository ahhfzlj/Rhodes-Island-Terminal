import React, { useState } from 'react';
import {
  BookOpen,
  Calculator,
  Compass,
  ExternalLink,
  Layers,
  Search,
  Shield,
  Skull,
  Sparkles,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

interface PrtsPortalCard {
  title: string;
  subtitle: string;
  url: string;
  tag: string;
  icon: React.FC<{ className?: string }>;
}

const PRTS_PORTALS: PrtsPortalCard[] = [
  {
    title: '干员一览',
    subtitle: '全干员属性、技能倍率、天赋与立绘档案',
    url: 'https://prts.wiki/w/%E5%B9%B2%E5%91%98%E4%B8%80%E8%A7%88',
    tag: 'OPERATOR',
    icon: Users,
  },
  {
    title: '公开招募计算器',
    subtitle: '词条组合计算、资深/高资保底标签检索',
    url: 'https://prts.wiki/w/%E5%85%AC%E5%BC%80%E6%8B%9B%E5%8B%9F',
    tag: 'RECRUIT',
    icon: Calculator,
  },
  {
    title: '活动一览',
    subtitle: 'SideStory、故事集、危机合约与复刻排期',
    url: 'https://prts.wiki/w/%E6%B4%BB%E5%8A%A8%E4%B8%80%E8%A7%88',
    tag: 'EVENTS',
    icon: Sparkles,
  },
  {
    title: '集成战略专题',
    subtitle: '水月、萨米、萨卡兹肉鸽藏品与结局路线',
    url: 'https://prts.wiki/w/%E9%9B%86%E6%88%90%E6%88%98%E7%95%A5',
    tag: 'ROGUELIKE',
    icon: Compass,
  },
  {
    title: '卫戍协议专题',
    subtitle: '盟约羁绊、干员装备、波次机制与攻略索引',
    url: 'https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE',
    tag: 'GARRISON',
    icon: Shield,
  },
  {
    title: '干员模组一览',
    subtitle: '模组升级效果、任务条件与素材消耗统计',
    url: 'https://prts.wiki/w/%E5%B9%B2%E5%91%98%E6%A8%A1%E7%BB%84%E4%B8%80%E8%A7%88',
    tag: 'MODULE',
    icon: Layers,
  },
  {
    title: '敌人图鉴',
    subtitle: '首领机制、抗性数值、移速与重量档案',
    url: 'https://prts.wiki/w/%E6%95%8C%E4%BA%BA%E4%B8%80%E8%A7%88',
    tag: 'ENEMY',
    icon: Skull,
  },
  {
    title: '剧情与关卡索引',
    subtitle: '主线章节关卡掉落、敌方波次与剧情回溯',
    url: 'https://prts.wiki/w/%E5%85%B3%E5%8D%A1%E4%B8%80%E8%A7%88',
    tag: 'STORY',
    icon: BookOpen,
  },
];

export const AkPrtsPage: React.FC = () => {
  const { openPrts } = useApp();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    const targetUrl = q
      ? `https://prts.wiki/index.php?search=${encodeURIComponent(q)}`
      : 'https://prts.wiki';
    openPrts(targetUrl, q ? `PRTS 搜索：${q}` : 'PRTS.WIKI');
  };

  return (
    <div className="space-y-5">
      {/* Hero Launch Card */}
      <section className="bg-[#13171D] border border-[#22BBFF]/50 overflow-hidden ak-chamfer ak-reticle">
        <div className="h-2 w-full ak-hazard border-b border-[#293240]" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono-tech text-[11px] tracking-widest text-[#22BBFF]">
                IN-APP BROWSER // PRTS.WIKI
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#ECF0F5] mt-1">
                PRTS Wiki 应用内直连终端
              </h1>
              <p className="text-xs sm:text-sm text-[#B4C0D0] mt-1">
                直接在 App 内嵌窗口打开 prts.wiki，无需跳转外部浏览器即可检索干员、关卡与公招计算器。
              </p>
            </div>

            <button
              type="button"
              onClick={() => openPrts('https://prts.wiki', 'PRTS.WIKI 首页')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black bg-[#22BBFF] hover:bg-[#4CC7FF] text-[#07131A] shrink-0 transition-colors cursor-pointer ak-chamfer-sm"
            >
              <span>应用内打开 PRTS</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Direct PRTS Search Box */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#22BBFF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入干员名、关卡代号、道具或模组名称在应用内检索..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-[#0A0C0F] border border-[#293240] focus:border-[#22BBFF] outline-none text-[#ECF0F5]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-[#1A2029] hover:bg-[#242D3B] border border-[#394659] text-[#ECF0F5] cursor-pointer"
            >
              <span>PRTS 检索</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#22BBFF]" />
            </button>
          </form>

          {/* Quick Search Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#7D899B] font-mono-tech mr-1">HOT //</span>
            {['维什戴尔', '逻各斯', '卫戍协议', '萨卡兹的无终奇语', '寻访模拟'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  openPrts(
                    `https://prts.wiki/index.php?search=${encodeURIComponent(tag)}`,
                    `PRTS：${tag}`
                  )
                }
                className="px-2.5 py-1 bg-[#0A0C0F] hover:bg-[#1A2029] border border-[#293240] hover:border-[#22BBFF]/60 text-[#B4C0D0] hover:text-[#22BBFF] transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Categorized Quick Portals */}
      <section className="space-y-3">
        <div className="text-xs font-mono-tech text-[#7D899B]">
          QUICK PORTALS // 应用内专题直达通道
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRTS_PORTALS.map((portal) => {
            const Icon = portal.icon;
            return (
              <button
                key={portal.title}
                type="button"
                onClick={() => openPrts(portal.url, `PRTS · ${portal.title}`)}
                className="text-left bg-[#13171D] hover:bg-[#181E27] border border-[#293240] hover:border-[#22BBFF]/70 p-4 flex flex-col justify-between gap-3 transition-all group cursor-pointer ak-chamfer-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-tech text-[10px] px-1.5 py-0.5 bg-[#1A2029] border border-[#293240] text-[#22BBFF]">
                      {portal.tag}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#7D899B] group-hover:text-[#22BBFF] transition-colors" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#FF9A2E] shrink-0" />
                    <h3 className="text-sm font-bold text-[#ECF0F5] group-hover:text-[#22BBFF] transition-colors">
                      {portal.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#7D899B] mt-1.5 leading-relaxed">
                    {portal.subtitle}
                  </p>
                </div>
                <div className="text-[11px] font-mono-tech text-[#7D899B] group-hover:text-[#ECF0F5]">
                  应用内打开 →
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
