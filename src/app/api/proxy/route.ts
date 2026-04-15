import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const limit = searchParams.get('limit');

  const ALPHA_LIST_URL = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';
  const ALPHA_TICKER_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker';
  const ALPHA_KLINES_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines';
  const FAPI_EXCHANGE_INFO_URL = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
  const FUNDING_INFO_URL = 'https://fapi.binance.com/fapi/v1/fundingInfo';
  const TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';
  const OI_URL = 'https://fapi.binance.com/fapi/v1/openInterest';
  const OI_HIST_URL = 'https://fapi.binance.com/fapi/v1/openInterestHist';

  try {
    let url = '';
    switch (target) {
      case 'alpha':
        url = ALPHA_LIST_URL;
        break;
      case 'alphaTicker':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        url = `${ALPHA_TICKER_URL}?symbol=${encodeURIComponent(symbol)}`;
        break;
      case 'alphaKlines': {
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        const params = new URLSearchParams();
        params.set('symbol', symbol);
        if (interval) params.set('interval', interval);
        if (startTime) params.set('startTime', startTime);
        if (endTime) params.set('endTime', endTime);
        if (limit) params.set('limit', limit);
        url = `${ALPHA_KLINES_URL}?${params.toString()}`;
        break;
      }
      case 'fapiExchangeInfo':
        url = FAPI_EXCHANGE_INFO_URL;
        break;
      case 'funding':
        url = FUNDING_INFO_URL;
        break;
      case 'ticker':
        url = TICKER_URL;
        break;
      case 'oi':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        url = `${OI_URL}?symbol=${encodeURIComponent(symbol)}`;
        break;
      case 'oiHist':
        if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
        url = `${OI_HIST_URL}?symbol=${encodeURIComponent(symbol)}&period=5m&limit=12`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://www.binance.com/',
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
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
