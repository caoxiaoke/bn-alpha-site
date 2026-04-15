import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const top10Cache = new Map<string, { value: number; ts: number }>();
const TOP10_CACHE_TTL_MS = 60_000;

const getCache = new Map<string, { payload: any; ts: number; ttlMs: number }>();

async function fetchWithFallback(urls: string[], ttlMs: number) {
  let lastError: any = null;
  for (const url of urls) {
    try {
      if (ttlMs > 0) {
        const cached = getCache.get(url);
        if (cached && Date.now() - cached.ts < cached.ttlMs) {
          return { response: { data: cached.payload }, url };
        }
      }
      const response = await axios.get(url, {
        timeout: 12000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json,text/plain,*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Referer: 'https://www.binance.com/',
        },
      });
      if (ttlMs > 0) {
        getCache.set(url, { payload: response.data, ts: Date.now(), ttlMs });
      }
      return { response, url };
    } catch (error: any) {
      lastError = error;
      continue;
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  const symbol = searchParams.get('symbol');
  const symbols = searchParams.get('symbols');
  const chainId = searchParams.get('chainId') ?? '56';
  const interval = searchParams.get('interval');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const limit = searchParams.get('limit');

  const ALPHA_LIST_URL = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';
  const ALPHA_TICKER_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker';
  const ALPHA_KLINES_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines';
  const FAPI_EXCHANGE_INFO_URLS = ['https://fapi.binance.com/fapi/v1/exchangeInfo'];
  const FUNDING_INFO_URLS = ['https://fapi.binance.com/fapi/v1/fundingInfo'];
  const PREMIUM_INDEX_URLS = ['https://fapi.binance.com/fapi/v1/premiumIndex'];
  const TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';
  const OI_URL = 'https://fapi.binance.com/fapi/v1/openInterest';
  const OI_HIST_URLS = [
    'https://fapi.binance.com/futures/data/openInterestHist',
    'https://fapi.binance.com/fapi/v1/openInterestHist',
  ];
  const TOKEN_PULSE_RANK_URL =
    'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/rank/list/ai';

  try {
    let urls: string[] = [];
    let ttlMs = 0;
    switch (target) {
      case 'alpha':
        urls = [ALPHA_LIST_URL];
        ttlMs = 15_000;
        break;
      case 'alphaTicker':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        urls = [`${ALPHA_TICKER_URL}?symbol=${encodeURIComponent(symbol)}`];
        break;
      case 'alphaKlines': {
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        const params = new URLSearchParams();
        params.set('symbol', symbol);
        if (interval) params.set('interval', interval);
        if (startTime) params.set('startTime', startTime);
        if (endTime) params.set('endTime', endTime);
        if (limit) params.set('limit', limit);
        urls = [`${ALPHA_KLINES_URL}?${params.toString()}`];
        break;
      }
      case 'fapiExchangeInfo':
        urls = FAPI_EXCHANGE_INFO_URLS;
        ttlMs = 10 * 60_000;
        break;
      case 'funding':
        urls = FUNDING_INFO_URLS;
        ttlMs = 60_000;
        break;
      case 'premiumIndex':
        urls = PREMIUM_INDEX_URLS;
        ttlMs = 10_000;
        break;
      case 'ticker':
        urls = [TICKER_URL];
        ttlMs = 10_000;
        break;
      case 'oi':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        try {
          const resp = await axios.get(`${OI_URL}?symbol=${encodeURIComponent(symbol)}`, {
            timeout: 12000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json,text/plain,*/*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              Referer: 'https://www.binance.com/',
            },
          });
          return NextResponse.json({ ...resp.data, _sourceUrl: OI_URL });
        } catch (error: any) {
          const upstreamStatus = error?.response?.status ?? null;
          if (upstreamStatus === 451) {
            return NextResponse.json(
              {
                code: 'RESTRICTED',
                message: 'UPSTREAM_RESTRICTED',
                data: null,
                _sourceUrl: String(error?.config?.url ?? OI_URL),
              },
              { status: 200 }
            );
          }
          const fallbackUrl = `${OI_HIST_URLS[0]}?symbol=${encodeURIComponent(symbol)}&period=5m&limit=1`;
          const fallback = await axios.get(fallbackUrl, {
            timeout: 12000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json,text/plain,*/*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              Referer: 'https://www.binance.com/',
            },
          });
          const arr = Array.isArray(fallback.data) ? fallback.data : [];
          const first = arr[0];
          return NextResponse.json({
            openInterest: String(first?.sumOpenInterest ?? ''),
            _sourceUrl: fallbackUrl,
          });
        }
      case 'oiHist':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        urls = OI_HIST_URLS.map(
          (base) => `${base}?symbol=${encodeURIComponent(symbol)}&period=5m&limit=12`
        );
        ttlMs = 15_000;
        break;
      case 'top10': {
        if (!symbols) return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
        const requestedSymbols = symbols
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 100);
        const chunks: string[][] = [];
        for (let i = 0; i < requestedSymbols.length; i += 5) {
          chunks.push(requestedSymbols.slice(i, i + 5));
        }

        const results: Record<string, number> = {};
        const rankTypes = [10, 20, 30];

        const now = Date.now();
        for (const sym of requestedSymbols) {
          const key = sym.toUpperCase();
          const cached = top10Cache.get(key);
          if (cached && now - cached.ts < TOP10_CACHE_TTL_MS) {
            results[key] = cached.value;
          }
        }

        try {
          for (const chunk of chunks) {
            const missing = new Set(
              chunk
                .map((s) => s.toUpperCase())
                .filter((s) => !(s in results))
            );
            for (const rankType of rankTypes) {
              if (missing.size === 0) break;
              const resp = await axios.post(
                TOKEN_PULSE_RANK_URL,
                {
                  chainId,
                  rankType,
                  limit: 200,
                  keywords: Array.from(missing),
                },
                {
                  timeout: 12000,
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'application/json,text/plain,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    Referer: 'https://web3.binance.com/',
                    'Content-Type': 'application/json',
                  },
                }
              );

              const payload = resp.data;
              const list =
                payload?.data?.list ??
                payload?.data?.data?.list ??
                payload?.data?.data ??
                payload?.data ??
                [];
              const arr = Array.isArray(list) ? list : [];
              for (const item of arr) {
                const sym = String(item?.symbol ?? item?.tokenSymbol ?? item?.baseTokenSymbol ?? '').toUpperCase();
                if (!sym || !missing.has(sym)) continue;
                const raw =
                  item?.holdersTop10Percent ??
                  item?.holdersTop10Percentage ??
                  item?.holdersTop10 ??
                  item?.holdersTop10Ratio ??
                  item?.holdersTop10HoldPercent;
                const n = Number.parseFloat(String(raw));
                if (!Number.isFinite(n)) continue;
                let ratio = n > 1 ? n / 100 : n;
                if (ratio > 0 && ratio < 0.001) {
                  ratio = ratio * 10000;
                }
                ratio = Math.min(1, Math.max(0, ratio));
                results[sym] = ratio;
                top10Cache.set(sym, { value: ratio, ts: now });
                missing.delete(sym);
              }
            }
          }
        } catch (error: any) {
          const upstreamStatus = error?.response?.status ?? null;
          if (upstreamStatus === 451) {
            return NextResponse.json(
              {
                code: 'RESTRICTED',
                message: 'UPSTREAM_RESTRICTED',
                data: {},
                _sourceUrl: TOKEN_PULSE_RANK_URL,
              },
              { status: 200 }
            );
          }
          return NextResponse.json(
            {
              code: 'UNAVAILABLE',
              message: 'TOP10_FETCH_FAILED',
              data: {},
              _sourceUrl: TOKEN_PULSE_RANK_URL,
            },
            { status: 200 }
          );
        }

        return NextResponse.json({
          code: '000000',
          message: null,
          data: results,
          _sourceUrl: TOKEN_PULSE_RANK_URL,
        });
      }
      default:
        return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    const { response, url } = await fetchWithFallback(urls, ttlMs);
    const payload = response.data;
    if (Array.isArray(payload)) {
      return NextResponse.json({
        code: '000000',
        message: null,
        data: payload,
        _sourceUrl: url,
      });
    }
    if (payload && typeof payload === 'object') {
      return NextResponse.json({ ...payload, _sourceUrl: url });
    }
    return NextResponse.json({ data: payload, _sourceUrl: url });
  } catch (error: any) {
    const upstreamStatus = error?.response?.status ?? null;
    if (
      (target === 'oi' ||
        target === 'oiHist' ||
        target === 'fapiExchangeInfo' ||
        target === 'funding' ||
        target === 'premiumIndex') &&
      upstreamStatus === 451
    ) {
      return NextResponse.json(
        {
          code: 'RESTRICTED',
          message: 'UPSTREAM_RESTRICTED',
          data:
            target === 'oi'
              ? null
              : target === 'fapiExchangeInfo'
                ? { symbols: [] }
                : [],
          _sourceUrl: String(error?.config?.url ?? ''),
        },
        { status: 200 }
      );
    }
    const details = {
      message: String(error?.message ?? ''),
      code: String(error?.code ?? ''),
      status: error?.response?.status ?? null,
      url: String(error?.config?.url ?? ''),
    };
    console.error(`Proxy error for ${target}:`, details);
    return NextResponse.json(
      { error: 'Failed to fetch from Binance', details },
      { status: 500 }
    );
  }
}
