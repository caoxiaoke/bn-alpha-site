import axios from 'axios';
import { Token } from '@/types';

const PROXY_BASE = '/api/proxy';

export const fetchAlphaTokens = async (): Promise<Token[]> => {
  try {
    const parseNumber = (val: unknown) => {
      const n = typeof val === 'number' ? val : parseFloat(String(val));
      return Number.isFinite(n) ? n : 0;
    };

    const alphaRes = await axios.get(`${PROXY_BASE}?target=alpha`);
    const alphaData = alphaRes.data?.data || [];

    let perpSet = new Set<string>();
    try {
      const exRes = await axios.get(`${PROXY_BASE}?target=fapiExchangeInfo`);
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
    } catch {
      perpSet = new Set();
    }

    let fundingMap = new Map<string, number>();
    let fundingOk = false;
    try {
      const fundingRes = await axios.get(`${PROXY_BASE}?target=funding`);
      const fundingData = fundingRes.data || [];
      fundingMap = new Map<string, number>(
        fundingData.map((f: any) => [String(f.symbol), parseFloat(String(f.lastFundingRate))])
      );
      fundingOk = true;
    } catch {
      fundingOk = false;
    }

    const tokens = (alphaData as any[])
      .filter((item) => String(item?.chainName ?? '') === 'BSC' || String(item?.chainId ?? '') === '56')
      .map((item) => {
        const symbol = String(item?.symbol ?? '').trim();
        const futuresSymbol = `${symbol}USDT`.toUpperCase();

        const isPerpAvailable =
          (fundingOk && fundingMap.has(futuresSymbol)) || (perpSet.size > 0 && perpSet.has(futuresSymbol));
        const fundingRate = fundingOk ? Number(fundingMap.get(futuresSymbol)) || 0 : 0;

        const price = parseNumber(item?.price);
        const volume24h = parseNumber(item?.volume24h);
        const marketCap = parseNumber(item?.marketCap);
        const fdv = parseNumber(item?.fdv);
        const totalSupply = parseNumber(item?.totalSupply);
        const circulatingSupply = parseNumber(item?.circulatingSupply);

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
          top10HoldersRatio: undefined,
          contractAddress: String(item?.contractAddress ?? '').trim(),
          chain: 'BSC',
        };

        tokenData.degenScore = calculateDegenScore(tokenData);
        return tokenData;
      })
      .filter((t) => {
        if (!t.symbol) return false;
        if (!(t.marketCap > 0)) return false;
        if (!(t.marketCap > 10000000 && t.marketCap < 80000000)) return false;
        return t.isPerpAvailable;
      });

    return tokens;
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
