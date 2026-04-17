export interface Token {
  symbol: string;
  price: number;
  marketCap: number; // Circulating MC
  fdv: number; // Fully Diluted Valuation
  volume24h: number;
  fundingRate: number;
  fundingAvailable?: boolean;
  okxPerpAvailable?: boolean;
  okxFundingRate?: number;
  okxFundingAvailable?: boolean;
  okxOiCcy?: number;
  floatRatio: number; // circulatingSupply / totalSupply
  alphaRankChange: number;
  isPerpAvailable: boolean;
  degenScore: number;
  openInterest?: number;
  openInterestHistory?: number[];
  top10HoldersRatio?: number;
  contractAddress?: string;
  chain?: string;
  circulatingSupply: number;
  totalSupply: number;
  decimals?: number;
}

export interface BinanceAlphaToken {
  symbol: string;
  name: string;
  price: string;
  marketCap: string;
  volume24h: string;
  // add other fields from Binance Alpha API
}
