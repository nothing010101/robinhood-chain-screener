// Server-only client for the ape.store internal API.
// ape.store's own API has no auth, but we still centralize every call here so
// the screener has one place to cache, rate-limit, and evolve endpoints from.

const APESTORE_BASE = "https://ape.store";
export const ROBINHOOD_CHAIN_ID = 4663;

export interface ApeStoreTokenListItem {
  id: number;
  chain: number;
  protocol: number;
  creator: string;
  createDate: string;
  deployDate: string;
  kingDate: string | null;
  launchDate: string | null;
  address: string;
  name: string;
  symbol: string;
  description: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  logo: string | null;
  isDead: boolean;
  priceAfter: string;
  chatCount: number;
  price1H: string | null;
  price24H: string | null;
  isKing: boolean;
  marketCap: number;
  hasMap: boolean;
  dexPaid: boolean;
  isStreaming: boolean;
  streamViewers: number;
  volumeStat: {
    id: number;
    mCap: number;
    transactions: number;
    volume: number;
    volumeUSD: number;
  } | null;
}

export interface ApeStoreTokenListResponse {
  items: ApeStoreTokenListItem[];
  pageCount: number;
}

export interface ApeStoreTokenDetailResponse {
  token: ApeStoreTokenListItem & {
    router: number;
    hidden: boolean;
    pairAddress: string | null;
    referrer: string | null;
    poolKey: string | null;
    tweetID: string | null;
    price: number;
    lastBump: string | null;
    holders: number;
  };
  currentPrice: number;
  marketCap: number;
  virtualLiquidity: number;
  kingProgress: number;
  apeProgress: number;
  dexPaid: boolean;
  stream: boolean;
  streamViewers: number;
}

export interface ApeStoreTrade {
  id: number;
  tokenID: number;
  to: string;
  timeStamp: string;
  transactionHash: string;
  tokenIn: string;
  nativeIn: string;
  tokenOut: string;
  nativeOut: string;
  priceBefore: string;
  priceAfter: string;
  tokenChange: number;
  nativeVolume: number;
  key: number;
  nativePrice: number;
  bump: boolean;
}

async function apeFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(`${APESTORE_BASE}${path}`, {
    headers: { "User-Agent": "robinhood-screener/1.0" },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ape.store request failed (${res.status}): ${path} :: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// filter=0 is the "active/live" bucket on ape.store — the only one that
// returns populated data for a freshly-launched chain like Robinhood Chain.
export const APESTORE_LIVE_FILTER = 0;

export function fetchTokenList(params: {
  page: number;
  search?: string;
  chain?: number;
}): Promise<ApeStoreTokenListResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    sort: "0",
    order: "0",
    filter: String(APESTORE_LIVE_FILTER),
    search: params.search ?? "",
    chain: String(params.chain ?? ROBINHOOD_CHAIN_ID),
  });
  return apeFetch(`/api/tokens?${search.toString()}`, 15);
}

export function fetchTokenDetail(chain: number, address: string): Promise<ApeStoreTokenDetailResponse> {
  return apeFetch(`/api/token/${chain}/${address}`, 15);
}

export function fetchTokenTrades(chain: number, address: string): Promise<ApeStoreTrade[]> {
  return apeFetch(`/api/token/${chain}/${address}/trades`, 15);
}
