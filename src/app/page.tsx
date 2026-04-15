'use client';

import React, { useEffect, useState } from 'react';
import { TokenTable } from '@/components/TokenTable';
import { TokenSidebar } from '@/components/TokenSidebar';
import { fetchAlphaTokens } from '@/lib/api';
import { useTokenStore } from '@/store/useTokenStore';
import { useLanguageStore, translations } from '@/store/useLanguageStore';
import { Activity, ShieldAlert, BarChart3, TrendingUp, RefreshCw, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const { tokens, setTokens, isLoading, setLoading, error, setError } = useTokenStore();
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language];
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const activeAlertsCount = tokens.filter((token) => {
    if (token.fundingAvailable === false) return false;
    return (
      token.marketCap < 50000000 &&
      token.fundingRate < -0.0001 &&
      token.volume24h / token.marketCap > 0.5 &&
      token.floatRatio < 0.3
    );
  }).length;

  const avgFundingRate = (() => {
    const vals = tokens
      .filter((t) => t.fundingAvailable !== false && Number.isFinite(t.fundingRate))
      .map((t) => t.fundingRate);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  const formatPercent = (val: number) => `${(val * 100).toFixed(4)}%`;

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      setError(null);
      const data = await fetchAlphaTokens();
      setTokens(data);
    } catch (error) {
      setTokens([]);
      setError(String((error as any)?.message ?? error ?? 'UNKNOWN_ERROR'));
    } finally {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    setLoading(true);
    fetchData();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-white text-nearblack selection:bg-brand selection:text-nearblack relative overflow-hidden">
      {/* Background Gradient Effect (Mintlify style) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] hero-gradient pointer-events-none -z-10" />
      
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 space-y-6 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-nearblack rounded-xl">
                <Activity className="w-6 h-6 text-brand" />
              </div>
              <h1 className="text-4xl font-bold tracking-tightest text-nearblack">
                {language === 'zh' ? (
                  <>Binance <span className="text-brand">Alpha</span> 雷达</>
                ) : (
                  <>Binance <span className="text-brand">Alpha</span> Radar</>
                )}
              </h1>
            </div>
            <p className="text-gray-500 max-w-2xl text-lg leading-relaxed">
              {t.description}
            </p>
          </div>
          
          <div className="flex flex-col items-end space-y-4">
            <button 
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-border bg-white hover:bg-gray-50 transition-colors text-xs font-bold font-mono text-gray-600"
            >
              <Languages className="w-4 h-4" />
              <span>{language === 'zh' ? 'English' : '中文'}</span>
            </button>
            <div className="flex items-center space-x-4 bg-gray-50 p-1.5 rounded-full border border-border">
              <div className={cn(
                "flex items-center space-x-2 px-4 py-1.5 rounded-full transition-all duration-500",
                isRefreshing ? "bg-brand/10" : "bg-transparent"
              )}>
                <RefreshCw className={cn("w-4 h-4 text-brand", isRefreshing && "animate-spin")} />
                <span className="text-xs font-bold font-mono text-brand-deep uppercase">
                  {isRefreshing ? t.scanning : t.liveMonitoring}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono pr-4 uppercase">
                {t.lastUpdate}: {mounted ? lastUpdated.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
          </div>
        </header>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm hover:border-brand/30 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <ShieldAlert className="w-6 h-6 text-error opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">{t.alertStatus}</span>
            </div>
            <p className="text-3xl font-bold text-nearblack mb-1">{activeAlertsCount} {t.activeAlerts}</p>
            <p className="text-sm text-gray-500">{t.alertDesc}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm hover:border-brand/30 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-6 h-6 text-brand opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">{t.marketFilter}</span>
            </div>
            <p className="text-3xl font-bold text-nearblack mb-1">$10M - $80M</p>
            <p className="text-sm text-gray-500">{t.marketDesc}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm hover:border-brand/30 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-6 h-6 text-softblue opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">{t.avgFunding}</span>
            </div>
            <p className="text-3xl font-bold text-nearblack mb-1">{avgFundingRate === null ? '--' : formatPercent(avgFundingRate)}</p>
            <p className="text-sm text-gray-500">{t.fundingDesc}</p>
          </div>
        </div>

        {/* Main Content: Table */}
        {error && (
          <div className="mb-6 rounded-2xl border border-border bg-gray-50 px-6 py-4">
            <div className="text-sm font-bold text-nearblack">{t.alertStatus}</div>
            <div className="mt-1 text-xs font-mono text-gray-500 break-all">
              {error === 'PERP_CHECK_UNAVAILABLE' ? t.perpCheckUnavailable : error}
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="w-full h-[400px] flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-border">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
              <p className="text-sm font-mono text-gray-400 animate-pulse">{t.initializing}</p>
            </div>
          </div>
        ) : (
          <TokenTable tokens={tokens} />
        )}

        {/* Footer info */}
        <footer className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 text-gray-400 text-xs font-mono uppercase tracking-widest">
          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span>{t.engine} v2.0.0</span>
            </span>
            <span>{t.alphaAccess}</span>
          </div>
          <p>© 2026 {t.copyright}</p>
        </footer>
      </div>

      {/* Sidebar Detail Overlay */}
      <TokenSidebar />
    </main>
  );
}
