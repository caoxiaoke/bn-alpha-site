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
  const contractAddress = searchParams.get('contractAddress');
  const instId = searchParams.get('instId');
  const instIds = searchParams.get('instIds');
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
  const BSCSCAN_API_URL = 'https://api.bscscan.com/api';
  const OKX_TICKERS_URL = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP';
  const OKX_INSTRUMENTS_URL = 'https://www.okx.com/api/v5/public/instruments?instType=SWAP';
  const OKX_FUNDING_URL = 'https://www.okx.com/api/v5/public/funding-rate';
  const OKX_OI_URL = 'https://www.okx.com/api/v5/public/open-interest';

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

        const pickTop10Ratio = (item: any) => {
          const raw =
            item?.holdersTop10Percent ??
            item?.holdersTop10Percentage ??
            item?.holdersTop10 ??
            item?.holdersTop10Ratio ??
            item?.holdersTop10HoldPercent;
          const n = Number.parseFloat(String(raw));
          if (!Number.isFinite(n) || n <= 0) return undefined;

          const candidates: number[] = [];
          if (n <= 1) {
            candidates.push(n);
            candidates.push(n / 100);
            candidates.push(n / 10000);
            candidates.push(n * 100);
            candidates.push(n * 10000);
          } else {
            if (n <= 100) candidates.push(n / 100);
            if (n <= 10000) candidates.push(n / 10000);
          }

          const normalized = candidates
            .map((r) => Math.min(1, Math.max(0, r)))
            .filter((r) => r > 0);
          if (!normalized.length) return undefined;

          const pickBest = (min: number) =>
            normalized
              .filter((r) => r >= min)
              .sort((a, b) => b - a)[0];

          return pickBest(0.05) ?? pickBest(0.01) ?? normalized.sort((a, b) => b - a)[0];
        };

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
                const ratio = pickTop10Ratio(item);
                if (typeof ratio !== 'number') continue;
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
      case 'holdersTop10': {
        if (!contractAddress) return NextResponse.json({ error: 'Missing contractAddress' }, { status: 400 });
        const apiKey = process.env.BSCSCAN_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { code: 'UNAVAILABLE', message: 'BSCSCAN_API_KEY_MISSING', data: null, _sourceUrl: BSCSCAN_API_URL },
            { status: 200 }
          );
        }

        const ca = contractAddress.trim();
        const holdersUrl =
          `${BSCSCAN_API_URL}?module=token&action=tokenholderlist&contractaddress=${encodeURIComponent(ca)}` +
          `&page=1&offset=10&apikey=${encodeURIComponent(apiKey)}`;
        const supplyUrl =
          `${BSCSCAN_API_URL}?module=stats&action=tokensupply&contractaddress=${encodeURIComponent(ca)}` +
          `&apikey=${encodeURIComponent(apiKey)}`;
        const sourceUrl =
          `${BSCSCAN_API_URL}?module=token&action=tokenholderlist&contractaddress=${encodeURIComponent(ca)}` +
          `&page=1&offset=10`;

        const [holdersRes, supplyRes] = await Promise.all([
          axios.get(holdersUrl, { timeout: 12000 }),
          axios.get(supplyUrl, { timeout: 12000 }),
        ]);

        const holdersPayload = holdersRes.data;
        const supplyPayload = supplyRes.data;

        const status = String(holdersPayload?.status ?? '');
        const msg = String(holdersPayload?.message ?? '').toLowerCase();
        if (status !== '1' || msg.includes('pro') || msg.includes('invalid api key') || msg.includes('not') || msg.includes('limit')) {
          return NextResponse.json(
            { code: 'PRO_REQUIRED', message: holdersPayload?.message ?? 'PRO_REQUIRED', data: null, _sourceUrl: sourceUrl },
            { status: 200 }
          );
        }

        const list = Array.isArray(holdersPayload?.result) ? holdersPayload.result : [];
        const holders = list
          .map((h: any) => ({
            address: String(h?.TokenHolderAddress ?? h?.address ?? h?.holderAddress ?? ''),
            balanceRaw: String(h?.TokenHolderQuantity ?? h?.balance ?? h?.quantity ?? ''),
          }))
          .filter((h: any) => h.address && h.balanceRaw);

        const toBigInt = (v: string) => {
          try {
            if (!/^\d+$/.test(v)) return null;
            return BigInt(v);
          } catch {
            return null;
          }
        };

        const top10Total = holders
          .map((h: any) => toBigInt(h.balanceRaw))
          .filter((x: any) => typeof x === 'bigint')
          .reduce((acc: bigint, x: bigint) => acc + x, BigInt(0));

        const supplyRaw = String(supplyPayload?.result ?? '');
        const supplyBig = toBigInt(supplyRaw);
        const top10Ratio = (() => {
          if (!supplyBig || supplyBig <= BigInt(0)) return undefined;
          const scaled = (top10Total * BigInt(1_000_000)) / supplyBig;
          const n = Number(scaled) / 1_000_000;
          return Number.isFinite(n) ? n : undefined;
        })();

        return NextResponse.json(
          {
            code: '000000',
            message: null,
            data: {
              top10TotalRaw: top10Total.toString(),
              totalSupplyRaw: supplyBig ? supplyBig.toString() : undefined,
              top10Ratio: typeof top10Ratio === 'number' && Number.isFinite(top10Ratio) ? top10Ratio : undefined,
              holders,
            },
            _sourceUrl: sourceUrl,
          },
          { status: 200 }
        );
      }
      case 'okxTickers': {
        urls = [OKX_TICKERS_URL];
        ttlMs = 10_000;
        break;
      }
      case 'okxInstruments': {
        urls = [OKX_INSTRUMENTS_URL];
        ttlMs = 10 * 60_000;
        break;
      }
      case 'okxFunding': {
        if (!instId) return NextResponse.json({ error: 'Missing instId' }, { status: 400 });
        urls = [`${OKX_FUNDING_URL}?instId=${encodeURIComponent(instId)}`];
        ttlMs = 10_000;
        break;
      }
      case 'okxOpenInterest': {
        if (!instId) return NextResponse.json({ error: 'Missing instId' }, { status: 400 });
        urls = [`${OKX_OI_URL}?instType=SWAP&instId=${encodeURIComponent(instId)}`];
        ttlMs = 10_000;
        break;
      }
      case 'okxFundingBatch': {
        if (!instIds) return NextResponse.json({ error: 'Missing instIds' }, { status: 400 });
        const ids = instIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25);
        const out: Record<string, number> = {};
        await Promise.all(
          ids.map(async (id) => {
            const url = `${OKX_FUNDING_URL}?instId=${encodeURIComponent(id)}`;
            try {
              const { response } = await fetchWithFallback([url], 10_000);
              const data = response.data;
              const arr = Array.isArray(data?.data) ? data.data : [];
              const first = arr[0];
              const rate = Number.parseFloat(String(first?.fundingRate));
              if (Number.isFinite(rate)) out[id] = rate;
            } catch {
              return;
            }
          })
        );
        return NextResponse.json({
          code: '000000',
          message: null,
          data: out,
          _sourceUrl: OKX_FUNDING_URL,
        });
      }
      case 'okxOpenInterestBatch': {
        if (!instIds) return NextResponse.json({ error: 'Missing instIds' }, { status: 400 });
        const ids = instIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25);
        const out: Record<string, { oiCcy?: number; oi?: number }> = {};
        await Promise.all(
          ids.map(async (id) => {
            const url = `${OKX_OI_URL}?instType=SWAP&instId=${encodeURIComponent(id)}`;
            try {
              const { response } = await fetchWithFallback([url], 10_000);
              const data = response.data;
              const arr = Array.isArray(data?.data) ? data.data : [];
              const first = arr[0];
              const oiCcy = Number.parseFloat(String(first?.oiCcy));
              const oi = Number.parseFloat(String(first?.oi));
              const v: any = {};
              if (Number.isFinite(oiCcy)) v.oiCcy = oiCcy;
              if (Number.isFinite(oi)) v.oi = oi;
              if (Object.keys(v).length) out[id] = v;
            } catch {
              return;
            }
          })
        );
        return NextResponse.json({
          code: '000000',
          message: null,
          data: out,
          _sourceUrl: OKX_OI_URL,
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
