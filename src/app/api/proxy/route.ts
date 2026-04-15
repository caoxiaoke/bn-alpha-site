import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  const symbol = searchParams.get('symbol');

  const ALPHA_LIST_URL = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';
  const ALPHA_TICKER_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker';
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`Proxy error for ${target}:`, error.message);
    return NextResponse.json(
      { error: 'Failed to fetch from Binance', details: error.message },
      { status: 500 }
    );
  }
}
