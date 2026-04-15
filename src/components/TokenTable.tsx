'use client';

import React from 'react';
import { Token } from '@/types';
import { cn } from '@/lib/utils';
import { useTokenStore } from '@/store/useTokenStore';
import { useLanguageStore, translations } from '@/store/useLanguageStore';

interface TokenTableProps {
  tokens: Token[];
}

const PriceCell = ({ price }: { price: number }) => {
  const [prevPrice, setPrevPrice] = React.useState(price);
  const [flash, setFlash] = React.useState<'green' | 'red' | null>(null);

  React.useEffect(() => {
    if (price > prevPrice) {
      setFlash('green');
      const timer = setTimeout(() => setFlash(null), 1000);
      return () => clearTimeout(timer);
    } else if (price < prevPrice) {
      setFlash('red');
      const timer = setTimeout(() => setFlash(null), 1000);
      return () => clearTimeout(timer);
    }
    setPrevPrice(price);
  }, [price]);

  return (
    <td className={cn(
      "px-6 py-4 whitespace-nowrap font-mono text-sm transition-colors duration-500",
      flash === 'green' && "text-brand-deep font-bold animate-flash-green",
      flash === 'red' && "text-error font-bold animate-flash-red-text"
    )}>
      ${price.toFixed(6)}
    </td>
  );
};

export const TokenTable: React.FC<TokenTableProps> = ({ tokens }) => {
  const setSelectedToken = useTokenStore((state) => state.setSelectedToken);
  const { language } = useLanguageStore();
  const t = translations[language];

  const sortedTokens = [...tokens].sort((a, b) => b.degenScore - a.degenScore);

  const isAlertRow = (token: Token) => {
    return (
      token.marketCap < 50000000 &&
      token.fundingAvailable !== false &&
      token.fundingRate < -0.0001 &&
      token.volume24h / token.marketCap > 0.5
    );
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(4)}%`;
  };

  const formatFunding = (token: Token) => {
    if (token.fundingAvailable === false) return '-';
    return formatPercent(token.fundingRate);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-gray-50/50">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.token}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.contract}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.top10Ratio}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.price}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.mc}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.fdv}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.vmc}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.funding}</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">{t.raveScore}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedTokens.map((token) => {
            const alert = isAlertRow(token);
            const vmcRatio = token.volume24h / token.marketCap;
            const contractAddress = String(token.contractAddress ?? '').trim();
            const hasContractAddress = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);
            
            return (
              <tr
                key={token.symbol}
                onClick={() => setSelectedToken(token)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-gray-50",
                  alert ? "animate-flash-red-bg" : ""
                )}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-nearblack">{token.symbol}</span>
                    {token.isPerpAvailable && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-light text-brand-deep rounded uppercase font-mono">
                        {t.perp}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500">
                  {hasContractAddress ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500">
                  {typeof token.top10HoldersRatio === 'number' ? `${(token.top10HoldersRatio * 100).toFixed(1)}%` : '-'}
                </td>
                <PriceCell price={token.price} />
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                  {formatCurrency(token.marketCap)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                  {formatCurrency(token.fdv)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                  <span className={cn(vmcRatio > 0.5 ? "text-brand-deep font-bold" : "text-gray-600")}>
                    {vmcRatio.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                  <span className={cn(token.fundingAvailable !== false && token.fundingRate < -0.0001 ? "text-error font-bold" : "text-gray-600")}>
                    {formatFunding(token)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          token.degenScore >= 80 ? "bg-brand" : "bg-amber-warn"
                        )}
                        style={{ width: `${token.degenScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold font-mono">{token.degenScore}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
