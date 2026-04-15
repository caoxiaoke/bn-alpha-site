import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

async function fetchWithFallback(urls: string[]) {
  let lastError: any = null;
  for (const url of urls) {
    try {
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
  const OI_URLS = ['https://fapi.binance.com/fapi/v1/openInterest'];
  const OI_HIST_URLS = ['https://fapi.binance.com/fapi/v1/openInterestHist'];
  const TOKEN_PULSE_RANK_URL =
    'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/rank/list/ai';

  try {
    let urls: string[] = [];
    switch (target) {
      case 'alpha':
        urls = [ALPHA_LIST_URL];
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
        break;
      case 'funding':
        urls = FUNDING_INFO_URLS;
        break;
      case 'premiumIndex':
        urls = PREMIUM_INDEX_URLS;
        break;
      case 'ticker':
        urls = [TICKER_URL];
        break;
      case 'oi':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        urls = OI_URLS.map((base) => `${base}?symbol=${encodeURIComponent(symbol)}`);
        break;
      case 'oiHist':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        urls = OI_HIST_URLS.map(
          (base) => `${base}?symbol=${encodeURIComponent(symbol)}&period=5m&limit=12`
        );
        break;
      case 'top10': {
        if (!symbols) return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
        const requestedSymbols = symbols
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25);
        const chunks: string[][] = [];
        for (let i = 0; i < requestedSymbols.length; i += 5) {
          chunks.push(requestedSymbols.slice(i, i + 5));
        }

        const results: Record<string, number> = {};
        const rankTypes = [10, 20, 30];

        try {
          for (const chunk of chunks) {
            const missing = new Set(chunk.map((s) => s.toUpperCase()));
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
                const ratio = n > 1 ? n / 100 : n;
                results[sym] = ratio;
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

    const { response, url } = await fetchWithFallback(urls);
    return NextResponse.json({ ...response.data, _sourceUrl: url });
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
