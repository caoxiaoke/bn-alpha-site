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
      const fundingRes = await axios.get(`${PROXY_BASE}?target=funding`);
      if (fundingRes.data?.code === 'RESTRICTED') {
        fundingMap = new Map<string, number>();
        fundingOk = false;
      } else {
        const fundingData = fundingRes.data || [];
        fundingMap = new Map<string, number>(
          fundingData.map((f: any) => [String(f.symbol), parseFloat(String(f.lastFundingRate))])
        );
        fundingOk = true;
      }
    } catch {
      fundingOk = false;
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
        const concentrated = checkConcentration(top10HoldersRatio);

        const tokenData: Token = {
          symbol,
          price,
          marketCap,
          fdv,
          volume24h,
          fundingRate,
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

        tokenData.degenScore = calculateDegenScore(tokenData);
        if (concentrated) {
          tokenData.degenScore = Math.min(100, tokenData.degenScore + 10);
        }
        (tokenData as any)._hasContractAddress = hasContractAddress;
        (tokenData as any)._stockState = stockState;
        return tokenData;
      })
      .filter((t) => {
        if (!t.symbol) return false;
        if (!(t.marketCap > 0)) return false;
        if (!t.isPerpAvailable) return false;
        const hasContractAddress = Boolean((t as any)._hasContractAddress);
        const stockState = Boolean((t as any)._stockState);
        if (!hasContractAddress) return false;
        if (stockState) return false;
        return true;
      });

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

export const calculateDegenScore = (token: Partial<Token>) => {
  let score = 0;
  
  // Volume/MC Ratio (30%)
  if (token.volume24h && token.marketCap && token.volume24h / token.marketCap > 0.5) {
    score += 30;
  }
  
  // Funding Rate (30%)
  if (token.fundingRate && token.fundingRate < -0.0001) { // -0.01%
    score += 30;
  }
  
  // Float Ratio (20%)
  if (token.floatRatio && token.floatRatio < 0.3) {
    score += 20;
  }
  
  // Alpha Momentum (20%) - assume rank change or top 10 rank
  if (token.alphaRankChange && token.alphaRankChange > 0) { // simplified
    score += 20;
  }
  
  return score;
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
