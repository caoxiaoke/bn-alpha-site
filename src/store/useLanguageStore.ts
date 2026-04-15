import { create } from 'zustand';

export type Language = 'zh' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'zh',
  setLanguage: (language) => set({ language }),
}));

export const translations = {
  zh: {
    title: '币安 Alpha 雷达',
    description: '实时监控币安 Alpha 生态中的高潜力、低市值代币。通过“妖币得分”算法自动筛选下一个爆发机会。',
    scanning: '正在扫描...',
    liveMonitoring: '实时监控中',
    lastUpdate: '最后更新',
    alertStatus: '预警状态',
    activeAlerts: '个活动项目',
    alertDesc: '检测到高潜力“妖币”机会',
    marketFilter: '流通市值筛选',
    marketDesc: '针对低市值爆发潜力进行优化',
    avgFunding: '平均费率',
    fundingDesc: '检测到全局空头挤压压力',
    initializing: '正在初始化神经雷达...',
    engine: 'CEX 引擎',
    alphaAccess: 'Alpha 直连访问',
    copyright: '币安 Alpha 智能中心',
    // Table
    token: '代币',
    price: '价格',
    mc: '流通市值',
    fdv: '总市值 (FDV)',
    circSupply: '流通量',
    totalSupply: '总总量',
    vmc: '成交/市值比',
    funding: '费率',
    raveScore: '妖币得分',
    perp: '合约',
    // Sidebar
    holdingTrend: '持仓量 (趋势)',
    holdingMock: 'OI 图表 (呈上升趋势)',
    top10Ratio: '前 10 持仓比例',
    holdingLevel: '持仓比例',
    highControl: '检测到高度控盘 (符合 Alpha 标准)',
    tradeBinance: '去币安交易',
    viewDex: '查看 DexScreener',
  },
  en: {
    title: 'Binance Alpha Radar',
    description: 'Real-time monitoring for high-potential, low-cap tokens in the Binance Alpha ecosystem. Algorithmically ranked by "Degen Score".',
    scanning: 'Scanning...',
    liveMonitoring: 'Live Monitoring',
    lastUpdate: 'Last Update',
    alertStatus: 'Alert Status',
    activeAlerts: 'Active',
    alertDesc: 'Critical Degen opportunities detected',
    marketFilter: 'MarketCap Filter',
    marketDesc: 'Optimized for low-cap explosive potential',
    avgFunding: 'Avg. Funding',
    fundingDesc: 'Global short-squeeze pressure detected',
    initializing: 'Initializing Neural Radar...',
    engine: 'CEX Engine',
    alphaAccess: 'Alpha Direct Access',
    copyright: 'Binance Alpha Intelligence Hub',
    // Table
    token: 'Token',
    price: 'Price',
    mc: 'Circ. MC',
    fdv: 'FDV',
    circSupply: 'Circ. Supply',
    totalSupply: 'Total Supply',
    vmc: 'V/MC',
    funding: 'Funding',
    raveScore: 'Rave Score',
    perp: 'Perp',
    // Sidebar
    holdingTrend: 'Open Interest (Trend)',
    holdingMock: 'OI Chart Mockup (Ascending Trend)',
    top10Ratio: 'Top 10 Holders Ratio',
    holdingLevel: 'Holding Ratio',
    highControl: 'High control level detected (Alpha criteria)',
    tradeBinance: 'Trade on Binance',
    viewDex: 'View on DexScreener',
  }
};
