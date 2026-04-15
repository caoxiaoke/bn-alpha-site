import axios from 'axios';
import { Token } from '@/types';

const PROXY_BASE = '/api/proxy';

type HolderLike = {
  address?: string;
  walletAddress?: string;
  ownerAddress?: string;
  label?: string;
  tag?: string;
  balance?: number | string;
  amount?: number | string;
  quantity?: number | string;
};

const EXCLUDED_HOLDER_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]);

const isExcludedHolder = (holder: HolderLike) => {
  const addr = String(
    holder.address ?? holder.walletAddress ?? holder.ownerAddress ?? ''
  ).toLowerCase();
  const label = String(holder.label ?? holder.tag ?? '').toLowerCase();
  if (EXCLUDED_HOLDER_ADDRESSES.has(addr)) return true;
  if (label.includes('binance') || label.includes('exchange') || label.includes('cex')) return true;
  return false;
};

const parseNumber = (val: unknown) => {
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : 0;
};

const computeTop10Ratio = (item: any, totalSupply: number): number | undefined => {
  const holderArrays = [item?.holders, item?.holderList, item?.topHolders].filter(Array.isArray);
  for (const arr of holderArrays) {
    const holders = (arr as HolderLike[])
      .filter((h) => !isExcludedHolder(h))
      .map((h) => parseNumber(h.balance ?? h.amount ?? h.quantity))
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    if (!holders.length || totalSupply <= 0) continue;
    const top10Total = holders.slice(0, 10).reduce((acc, v) => acc + v, 0);
    return top10Total / totalSupply;
  }

  const top10Raw =
    item?.top10Percentage ??
    item?.top10HolderRatio ??
    item?.top10HoldRatio ??
    item?.top10HoldersRatio ??
    item?.top10HolderPercent ??
    item?.top10Percent;
  const n = parseNumber(top10Raw);
  if (n > 1) return n / 100;
  if (n > 0) return n;
  return undefined;
};

const checkConcentration = (ratio?: number) => (typeof ratio === 'number' ? ratio > 0.6 : false);

const huntNextRave = (
  tokens: Token[],
  options?: {
    requirePerp?: boolean;
    requireNegativeFunding?: boolean;
  }
) => {
  const requirePerp = options?.requirePerp ?? true;
  const requireNegativeFunding = options?.requireNegativeFunding ?? true;
  return tokens.filter((token) => {
    return (
      token.marketCap > 10000000 &&
      token.marketCap < 80000000 &&
      (requirePerp ? token.isPerpAvailable === true : true) &&
      token.floatRatio < 0.3 &&
      token.volume24h / token.marketCap > 0.5 &&
      (requireNegativeFunding ? token.fundingRate < 0 : true)
    );
  });
};

export const fetchAlphaTokens = async (): Promise<Token[]> => {
  try {
    const alphaRes = await axios.get(`${PROXY_BASE}?target=alpha`);
    const alphaData = alphaRes.data?.data || [];

    let perpSet = new Set<string>();
    let perpOk = false;
    try {
      const exRes = await axios.get(`${PROXY_BASE}?target=fapiExchangeInfo`);
      if (exRes.data?.code === 'RESTRICTED') {
        perpSet = new Set();
        perpOk = false;
      } else {
      const symbols = exRes.data?.symbols ?? [];
      perpSet = new Set(
        symbols
          .filter(
            (s: any) =>
              String(s?.contractType ?? '') === 'PERPETUAL' &&
              String(s?.quoteAsset ?? '') === 'USDT' &&
              String(s?.status ?? '') === 'TRADING'
          )
          .map((s: any) => String(s.symbol))
      );
      perpOk = true;
      }
    } catch {
      perpSet = new Set();
      perpOk = false;
    }

    let fundingMap = new Map<string, number>();
    let fundingOk = false;
    try {
      const premiumRes = await axios.get(`${PROXY_BASE}?target=premiumIndex`);
      if (premiumRes.data?.code === 'RESTRICTED') {
        fundingOk = false;
      } else {
        const premiumData = Array.isArray(premiumRes.data) ? premiumRes.data : premiumRes.data?.data ?? premiumRes.data;
        if (Array.isArray(premiumData)) {
          fundingMap = new Map<string, number>(
            premiumData
              .filter((p: any) => p?.symbol)
              .map((p: any) => [String(p.symbol), parseFloat(String(p.lastFundingRate))])
          );
          fundingOk = fundingMap.size > 0;
        }
      }
    } catch {
      fundingOk = false;
    }

    if (!fundingOk) {
      try {
        const fundingRes = await axios.get(`${PROXY_BASE}?target=funding`);
        if (fundingRes.data?.code === 'RESTRICTED') {
          fundingOk = false;
        } else {
          const fundingData = fundingRes.data || [];
          fundingMap = new Map<string, number>(
            fundingData.map((f: any) => [String(f.symbol), parseFloat(String(f.lastFundingRate))])
          );
          fundingOk = fundingMap.size > 0;
        }
      } catch {
        fundingOk = false;
      }
    }

    const tokens = (alphaData as any[])
      .filter((item) => String(item?.chainName ?? '') === 'BSC' || String(item?.chainId ?? '') === '56')
      .map((item) => {
        const symbol = String(item?.symbol ?? '').trim();
        const futuresSymbol = `${symbol}USDT`.toUpperCase();

        const isPerpAvailable =
          (fundingOk && fundingMap.has(futuresSymbol)) ||
          (perpSet.size > 0 && perpSet.has(futuresSymbol));
        const fundingRate = fundingOk ? Number(fundingMap.get(futuresSymbol)) || 0 : 0;

        const price = parseNumber(item?.price);
        const volume24h = parseNumber(item?.volume24h);
        const marketCap = parseNumber(item?.marketCap);
        const fdv = parseNumber(item?.fdv);
        const totalSupply = parseNumber(item?.totalSupply);
        const circulatingSupply = parseNumber(item?.circulatingSupply);
        const contractAddress = String(item?.contractAddress ?? '').trim();
        const hasContractAddress = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);
        const stockState = Boolean(item?.stockState);
        const top10HoldersRatio = computeTop10Ratio(item, totalSupply);

        const tokenData: Token = {
          symbol,
          price,
          marketCap,
          fdv,
          volume24h,
          fundingRate,
          fundingAvailable: fundingOk,
          circulatingSupply,
          totalSupply,
          floatRatio: totalSupply > 0 ? circulatingSupply / totalSupply : 0,
          alphaRankChange: 0,
          isPerpAvailable,
          degenScore: 0,
          top10HoldersRatio,
          contractAddress,
          chain: 'BSC',
        };

        (tokenData as any)._hasContractAddress = hasContractAddress;
        (tokenData as any)._stockState = stockState;
        return tokenData;
      })
      .filter((t) => {
        if (!t.symbol) return false;
        if (!(t.marketCap > 0)) return false;
        if (fundingOk || perpOk) {
          if (!t.isPerpAvailable) return false;
        }
        const hasContractAddress = Boolean((t as any)._hasContractAddress);
        const stockState = Boolean((t as any)._stockState);
        if (!hasContractAddress) return false;
        if (stockState) return false;
        return true;
      });

    const top10Map = await fetchTop10Ratios(tokens.map((t) => t.symbol));
    for (const token of tokens) {
      const ratio = top10Map[token.symbol.toUpperCase()];
      if (typeof ratio === 'number') token.top10HoldersRatio = ratio;
      token.degenScore = calculateDegenScore(token);
    }

    const strict = huntNextRave(tokens, {
      requirePerp: fundingOk || perpOk,
      requireNegativeFunding: fundingOk,
    });

    if (strict.length > 0) return strict;

    const fallback = tokens.filter((t) => t.marketCap > 10000000 && t.marketCap < 80000000);
    return fallback;
  } catch (error) {
    console.error('Error fetching real data through proxy:', error);
    return mockTokens.filter(t => t.marketCap > 10000000 && t.marketCap < 80000000 && t.isPerpAvailable);
  }
};

export const fetchTokenOI = async (symbol: string) => {
  try {
    const usdtSymbol = `${symbol}USDT`;
    const res = await axios.get(`${PROXY_BASE}?target=oi&symbol=${usdtSymbol}`);
    if (res.data?.code === 'RESTRICTED') return null;
    return parseFloat(res.data.openInterest);
  } catch (error) {
    console.error(`Error fetching OI for ${symbol} via proxy:`, error);
    return null;
  }
};

export const fetchOIHistory = async (symbol: string): Promise<number[]> => {
  try {
    const usdtSymbol = `${symbol}USDT`;
    const res = await axios.get(`${PROXY_BASE}?target=oiHist&symbol=${usdtSymbol}`);
    if (res.data?.code === 'RESTRICTED') return [];
    return res.data.map((h: any) => parseFloat(h.sumOpenInterest));
  } catch (error) {
    console.error(`Error fetching OI history for ${symbol} via proxy:`, error);
    return [];
  }
};

export const fetchTop10Ratios = async (symbols: string[]): Promise<Record<string, number>> => {
  try {
    const uniq = Array.from(
      new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))
    );
    if (!uniq.length) return {};
    const out: Record<string, number> = {};

    const chunkSize = 25;
    for (let i = 0; i < uniq.length; i += chunkSize) {
      const chunk = uniq.slice(i, i + chunkSize);
      const res = await axios.get(
        `${PROXY_BASE}?target=top10&symbols=${encodeURIComponent(chunk.join(','))}`
      );
      if (res.data?.code === 'RESTRICTED') return {};
      if (res.data?.code === 'UNAVAILABLE') continue;
      const data = res.data?.data ?? {};
      if (!data || typeof data !== 'object') continue;
      for (const [k, v] of Object.entries(data)) {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (!Number.isFinite(n)) continue;
        out[String(k).toUpperCase()] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
};

export const calculateDegenScore = (token: Partial<Token>) => {
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
  const lerpScore = (val: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    if (!Number.isFinite(val)) return outMin;
    if (inMin === inMax) return outMax;
    const t = clamp((val - inMin) / (inMax - inMin), 0, 1);
    return outMin + (outMax - outMin) * t;
  };

  const marketCap = Number(token.marketCap) || 0;
  const volume24h = Number(token.volume24h) || 0;
  const floatRatio = Number(token.floatRatio) || 0;
  const fundingRate = Number(token.fundingRate) || 0;
  const fundingAvailable = token.fundingAvailable !== false;
  const top10 = typeof token.top10HoldersRatio === 'number' ? token.top10HoldersRatio : undefined;

  const vmc = marketCap > 0 ? volume24h / marketCap : 0;

  const scoreVmc = lerpScore(vmc, 0.1, 1.0, 0, 30);

  const scoreFloat = (() => {
    if (!(floatRatio > 0)) return 0;
    return clamp(lerpScore(floatRatio, 0.3, 0.05, 0, 25), 0, 25);
  })();

  const scoreFunding = (() => {
    if (!fundingAvailable) return 8;
    if (!(fundingRate < 0)) return 0;
    return clamp(lerpScore(fundingRate, -0.0005, -0.00005, 25, 0), 0, 25);
  })();

  const scoreTop10 = (() => {
    if (typeof top10 !== 'number') return 5;
    return clamp(lerpScore(top10, 0.4, 0.8, 0, 20), 0, 20);
  })();

  const scoreMarketCap = (() => {
    if (!(marketCap > 0)) return 0;
    if (marketCap < 10000000 || marketCap > 80000000) return 0;
    if (marketCap <= 20000000) return lerpScore(marketCap, 10000000, 20000000, 0, 5);
    if (marketCap <= 50000000) return 5;
    return lerpScore(marketCap, 50000000, 80000000, 5, 0);
  })();

  const scorePerp = token.isPerpAvailable ? 5 : 0;

  const raw = scoreVmc + scoreFloat + scoreFunding + scoreTop10 + scoreMarketCap + scorePerp;
  return Math.round(clamp(raw, 0, 100));
};

// Mock data as fallback
export const mockTokens: Token[] = [
  {
    symbol: 'INFINIT',
    price: 0.0012,
    marketCap: 25000000,
    fdv: 100000000,
    volume24h: 15000000,
    fundingRate: -0.00015,
    floatRatio: 0.25,
    alphaRankChange: 5,
    isPerpAvailable: true,
    degenScore: 100,
    chain: 'BSC',
    circulatingSupply: 20833333333,
    totalSupply: 83333333333,
  },
  {
    symbol: 'GENIUS',
    price: 0.045,
    marketCap: 45000000,
    fdv: 300000000,
    volume24h: 30000000,
    fundingRate: -0.0002,
    floatRatio: 0.15,
    alphaRankChange: 2,
    isPerpAvailable: true,
    degenScore: 100,
    chain: 'BSC',
    circulatingSupply: 1000000000,
    totalSupply: 6666666666,
  },
  {
    symbol: 'ALPHA',
    price: 0.12,
    marketCap: 60000000,
    fdv: 120000000,
    volume24h: 10000000,
    fundingRate: 0.0001,
    floatRatio: 0.5,
    alphaRankChange: 0,
    isPerpAvailable: true,
    degenScore: 0,
    chain: 'BSC',
    circulatingSupply: 500000000,
    totalSupply: 1000000000,
  },
  {
    symbol: 'RAVE',
    price: 1.5,
    marketCap: 35000000,
    fdv: 140000000,
    volume24h: 20000000,
    fundingRate: -0.00012,
    floatRatio: 0.25,
    alphaRankChange: 8,
    isPerpAvailable: true,
    degenScore: 100,
    chain: 'BSC',
    circulatingSupply: 23333333,
    totalSupply: 93333333,
  }
];
