'use client';

import React, { useEffect, useState } from 'react';
import { Token } from '@/types';
import { useTokenStore } from '@/store/useTokenStore';
import { fetchOIHistory, fetchTokenOI } from '@/lib/api';
import { X, ExternalLink, Activity, BarChart3, Users, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguageStore, translations } from '@/store/useLanguageStore';

export const TokenSidebar: React.FC = () => {
  const { selectedToken, setSelectedToken } = useTokenStore();
  const { language } = useLanguageStore();
  const t = translations[language];
  const [oi, setOi] = useState<number | null>(null);
  const [oiHistory, setOiHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (selectedToken) {
      setLoading(true);
      Promise.all([
        fetchTokenOI(selectedToken.symbol),
        fetchOIHistory(selectedToken.symbol)
      ]).then(([currentOi, history]) => {
        setOi(currentOi);
        setOiHistory(history);
        setLoading(false);
      });
    } else {
      setOi(null);
      setOiHistory([]);
    }
  }, [selectedToken]);

  if (!selectedToken || !mounted) return null;

  const futuresSymbol = `${selectedToken.symbol}USDT`.toUpperCase();
  const contractAddress = String(selectedToken.contractAddress ?? '').trim();
  const hasContractAddress = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const maxOi = Math.max(...oiHistory, 1);
  const minOi = Math.min(...oiHistory, 0);
  const range = maxOi - minOi;

  const formatNumber = (val: number) => {
    if (val >= 1000000000) return `${(val / 1000000000).toFixed(2)}B`;
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toLocaleString();
  };

  const shortAddress = hasContractAddress
    ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
    : '-';

  const onCopyAddress = async () => {
    if (!hasContractAddress) return;
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-white border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <h2 className="text-3xl font-bold text-nearblack tracking-tightest">{selectedToken.symbol}</h2>
          <span className="px-2 py-1 text-xs font-bold bg-brand-light text-brand-deep rounded-full uppercase font-mono">
            Alpha
          </span>
        </div>
        <button
          onClick={() => setSelectedToken(null)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.price}</p>
          <p className="text-xl font-bold font-mono text-nearblack">${selectedToken.price.toFixed(6)}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.mc}</p>
          <p className="text-xl font-bold font-mono text-nearblack">{formatCurrency(selectedToken.marketCap)}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.fdv}</p>
          <p className="text-xl font-bold font-mono text-nearblack">{formatCurrency(selectedToken.fdv)}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.perp}</p>
          <p className="text-xl font-bold font-mono text-nearblack">{selectedToken.isPerpAvailable ? 'YES' : 'NO'}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.circSupply}</p>
          <p className="text-xl font-bold font-mono text-nearblack">{formatNumber(selectedToken.circulatingSupply)}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.totalSupply}</p>
          <p className="text-xl font-bold font-mono text-nearblack">{formatNumber(selectedToken.totalSupply)}</p>
        </div>
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-border/50 col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 font-mono">{t.contract}</p>
              <p className="text-lg font-bold font-mono text-nearblack truncate">{shortAddress}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCopyAddress}
                disabled={!hasContractAddress}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-white text-nearblack text-xs font-bold font-mono transition-colors",
                  hasContractAddress ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"
                )}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
              <a
                href={hasContractAddress ? `https://bscscan.com/token/${contractAddress}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-white text-nearblack text-xs font-bold font-mono transition-colors",
                  hasContractAddress ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"
                )}
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t.viewBscscan}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-nearblack">{t.holdingTrend}</h3>
            </div>
            {oi !== null && (
              <span className="text-sm font-bold font-mono text-brand-deep">
                {formatCurrency(oi)}
              </span>
            )}
          </div>
          <div className="h-[180px] bg-gray-50 rounded-2xl border border-border flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            {loading ? (
              <div className="animate-pulse text-gray-300 font-mono text-xs">Loading OI Data...</div>
            ) : oiHistory.length > 0 ? (
              <svg className="w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={`M ${oiHistory.map((val, i) => `${(i / (oiHistory.length - 1)) * 100} ${100 - ((val - minOi) / range) * 80 - 10}`).join(' L ')}`}
                  fill="none"
                  stroke="#18E299"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <p className="text-gray-400 font-mono text-xs">{t.dataUnavailable}</p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-brand" />
            <h3 className="text-lg font-bold text-nearblack">{t.top10Ratio}</h3>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-600">{t.holdingLevel}</span>
              <span className="text-lg font-bold font-mono">
                {typeof selectedToken.top10HoldersRatio === 'number'
                  ? `${((selectedToken.top10HoldersRatio * 100) > 0 && (selectedToken.top10HoldersRatio * 100) < 1) ? '<1' : (selectedToken.top10HoldersRatio * 100).toFixed(0)}%`
                  : '-'}
              </span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-brand h-full rounded-full transition-all duration-1000" 
                style={{ width: `${typeof selectedToken.top10HoldersRatio === 'number' ? selectedToken.top10HoldersRatio * 100 : 0}%` }}
              ></div>
            </div>
            <p className="mt-3 text-xs text-gray-400 font-mono italic">
              * {t.highControl}
            </p>
          </div>
        </section>

        <section className="pt-4 space-y-3">
          <a
            href={`https://www.binance.com/zh-CN/futures/${encodeURIComponent(futuresSymbol)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-4 bg-nearblack text-white rounded-2xl font-bold hover:bg-nearblack/90 transition-all group"
          >
            <span className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>{t.tradeBinance}</span>
            </span>
            <ExternalLink className="w-5 h-5 opacity-50 group-hover:opacity-100" />
          </a>
          <a
            href={hasContractAddress ? `https://dexscreener.com/bsc/${contractAddress}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-between w-full p-4 border border-border text-nearblack rounded-2xl font-bold transition-all group",
              hasContractAddress ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"
            )}
          >
            <span className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              <span>{t.viewDex}</span>
            </span>
            <ExternalLink className="w-5 h-5 opacity-50 group-hover:opacity-100" />
          </a>
        </section>
      </div>
    </div>
  );
};
