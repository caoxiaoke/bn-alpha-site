import axios from 'axios';
import { Token } from '@/types';

// Use local Next.js proxy to avoid CORS issues
const PROXY_BASE = '/api/proxy';

export const fetchAlphaTokens = async (): Promise<Token[]> => {
  try {
    const alphaRes = await axios.get(`${PROXY_BASE}?target=alpha`);
    const alphaData = alphaRes.data?.data || [];
    
    const fundingRes = await axios.get(`${PROXY_BASE}?target=funding`);
    const fundingData = fundingRes.data || [];
    const fundingMap = new Map<string, number>(
      fundingData.map((f: any) => [String(f.symbol), parseFloat(String(f.lastFundingRate))])
    );

    const chainKey = (item: any) =>
      String(item?.chainName ?? item?.network ?? item?.chain ?? '').toLowerCase();

    const isBscChain = (item: any) => {
      const c = chainKey(item);
      return c.includes('bsc') || c.includes('bnb');
    };

    const getTokenName = (item: any) => String(item?.tokenName ?? item?.symbol ?? '').trim();

    const parseNumber = (val: unknown) => {
      const n = typeof val === 'number' ? val : parseFloat(String(val));
      return Number.isFinite(n) ? n : 0;
    };

    const mapWithConcurrency = async <T, R>(
      items: T[],
      limit: number,
      mapper: (item: T) => Promise<R>
    ) => {
      const results: R[] = [];
      let index = 0;
      const workers = Array.from({ length: Math.max(1, limit) }, async () => {
        while (index < items.length) {
          const current = items[index];
          index += 1;
          results.push(await mapper(current));
        }
      });
      await Promise.all(workers);
      return results;
    };

    const candidates = alphaData.filter((item: any) => isBscChain(item) && getTokenName(item));

    const tokens = await mapWithConcurrency<any, Token | null>(candidates, 8, async (item) => {
      const tokenName = getTokenName(item);
      const futuresSymbol = `${tokenName}USDT`;

      const isPerpAvailable = fundingMap.has(futuresSymbol);
      if (!isPerpAvailable) return null;

      const fundingRate = Number(fundingMap.get(futuresSymbol)) || 0;

      const alphaTickerRes = await axios.get(
        `${PROXY_BASE}?target=alphaTicker&symbol=${encodeURIComponent(tokenName)}`
      );
      const alphaTicker = alphaTickerRes.data?.data ?? alphaTickerRes.data ?? {};

      const price =
        parseNumber(alphaTicker.price) ||
        parseNumber(alphaTicker.lastPrice) ||
        parseNumber(item.price) ||
        parseNumber(item.lastPrice);

      const volume24h =
        parseNumber(alphaTicker.volume24h) ||
        parseNumber(alphaTicker.quoteVolume) ||
        parseNumber(alphaTicker.volume) ||
        parseNumber(item.volume24h) ||
        parseNumber(item.quoteVolume);

      const circulatingSupply =
        parseNumber(alphaTicker.circulatingSupply) || parseNumber(item.circulatingSupply);
      const totalSupply = parseNumber(alphaTicker.totalSupply) || parseNumber(item.totalSupply) || circulatingSupply;

      const apiMarketCap =
        parseNumber(alphaTicker.marketCap) || parseNumber(item.marketCap);
      const apiFDV = parseNumber(alphaTicker.fdv) || parseNumber(item.fdv);

      const marketCap =
        apiMarketCap > 0 ? apiMarketCap : circulatingSupply > 0 && price > 0 ? circulatingSupply * price : 0;
      const fdv =
        apiFDV > 0 ? apiFDV : totalSupply > 0 && price > 0 ? totalSupply * price : marketCap;

      const tokenData: Partial<Token> = {
        symbol: tokenName,
        price,
        marketCap,
        fdv,
        volume24h,
        fundingRate,
        circulatingSupply,
        totalSupply,
        floatRatio: totalSupply > 0 ? circulatingSupply / totalSupply : 0,
        alphaRankChange: parseNumber(item.rankChange24h),
        isPerpAvailable,
        top10HoldersRatio: parseNumber(item.top10Percentage) || 0.65,
        contractAddress: String(item.tokenAddress ?? '').trim(),
        chain: 'BSC',
      };

      const score = calculateDegenScore(tokenData);

      const token: Token = {
        ...(tokenData as Token),
        degenScore: score,
      };

      if (!(token.marketCap > 10000000 && token.marketCap < 80000000)) return null;
      return token;
    });

    const filtered = tokens.filter((t): t is Token => Boolean(t));

    return filtered;
  } catch (error) {
    console.error('Error fetching real data through proxy:', error);
    return mockTokens.filter(t => t.marketCap > 10000000 && t.marketCap < 80000000 && t.isPerpAvailable);
  }
};

export const fetchTokenOI = async (symbol: string) => {
  try {
    const usdtSymbol = `${symbol}USDT`;
    const res = await axios.get(`${PROXY_BASE}?target=oi&symbol=${usdtSymbol}`);
    return parseFloat(res.data.openInterest);
  } catch (error) {
    console.error(`Error fetching OI for ${symbol} via proxy:`, error);
    return 0;
  }
};

export const fetchOIHistory = async (symbol: string): Promise<number[]> => {
  try {
    const usdtSymbol = `${symbol}USDT`;
    const res = await axios.get(`${PROXY_BASE}?target=oiHist&symbol=${usdtSymbol}`);
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
