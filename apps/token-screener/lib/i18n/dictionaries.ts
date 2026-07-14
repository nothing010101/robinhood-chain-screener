export type Locale = "en" | "id";

export interface Dictionary {
  brand: string;
  tagline: string;
  searchPlaceholder: string;
  columns: {
    token: string;
    price: string;
    marketCap: string;
    volume: string;
    holders: string;
    created: string;
  };
  sort: {
    marketCap: string;
    volume: string;
    name: string;
    newest: string;
  };
  order: { desc: string; asc: string };
  empty: string;
  loading: string;
  error: string;
  liveBadge: string;
  holdersUnavailable: string;
  resultCount: string;
  footerNote: string;
  detail: {
    back: string;
    liquidity: string;
    kingProgress: string;
    apeProgress: string;
    dexPaid: string;
    dexPaidYes: string;
    dexPaidNo: string;
    tradesTitle: string;
    tradesEmpty: string;
    tradesLoading: string;
    columns: {
      wallet: string;
      side: string;
      amount: string;
      price: string;
      time: string;
      txn: string;
    };
    side: { buy: string; sell: string };
    notFound: string;
    holdersNote: string;
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    brand: "Robinhood Chain Screener",
    tagline: "Live token board for ape.store on Robinhood Chain",
    searchPlaceholder: "Search name or symbol\u2026",
    columns: {
      token: "Token",
      price: "Price",
      marketCap: "Market cap",
      volume: "Volume",
      holders: "Holders",
      created: "Created",
    },
    sort: {
      marketCap: "Market cap",
      volume: "Volume",
      name: "Name (A\u2013Z)",
      newest: "Newest",
    },
    order: { desc: "High to low", asc: "Low to high" },
    empty: "No tokens match your search.",
    loading: "Loading tokens\u2026",
    error: "Couldn't reach ape.store. Retrying shortly.",
    liveBadge: "Live",
    holdersUnavailable: "N/A",
    resultCount: "{count} tokens on Robinhood Chain",
    footerNote: "Data sourced live from ape.store. Not financial advice.",
    detail: {
      back: "Back to screener",
      liquidity: "Virtual liquidity",
      kingProgress: "King progress",
      apeProgress: "Ape progress",
      dexPaid: "DEX paid",
      dexPaidYes: "Paid",
      dexPaidNo: "Not paid",
      tradesTitle: "Recent trades",
      tradesEmpty: "No trades yet.",
      tradesLoading: "Loading trades\u2026",
      columns: {
        wallet: "Wallet",
        side: "Side",
        amount: "Amount",
        price: "Price",
        time: "Time",
        txn: "Tx",
      },
      side: { buy: "Buy", sell: "Sell" },
      notFound: "Token not found.",
      holdersNote: "Holder count isn't available yet for this chain.",
    },
  },
  id: {
    brand: "Screener Robinhood Chain",
    tagline: "Papan token live untuk ape.store di Robinhood Chain",
    searchPlaceholder: "Cari nama atau simbol\u2026",
    columns: {
      token: "Token",
      price: "Harga",
      marketCap: "Market cap",
      volume: "Volume",
      holders: "Holder",
      created: "Dibuat",
    },
    sort: {
      marketCap: "Market cap",
      volume: "Volume",
      name: "Nama (A\u2013Z)",
      newest: "Terbaru",
    },
    order: { desc: "Tinggi ke rendah", asc: "Rendah ke tinggi" },
    empty: "Tidak ada token yang cocok dengan pencarianmu.",
    loading: "Memuat token\u2026",
    error: "Tidak bisa terhubung ke ape.store. Mencoba lagi sebentar.",
    liveBadge: "Live",
    holdersUnavailable: "N/A",
    resultCount: "{count} token di Robinhood Chain",
    footerNote: "Data diambil langsung dari ape.store. Bukan saran finansial.",
    detail: {
      back: "Kembali ke screener",
      liquidity: "Virtual liquidity",
      kingProgress: "Progress king",
      apeProgress: "Progress ape",
      dexPaid: "DEX paid",
      dexPaidYes: "Sudah bayar",
      dexPaidNo: "Belum bayar",
      tradesTitle: "Transaksi terbaru",
      tradesEmpty: "Belum ada transaksi.",
      tradesLoading: "Memuat transaksi\u2026",
      columns: {
        wallet: "Wallet",
        side: "Sisi",
        amount: "Jumlah",
        price: "Harga",
        time: "Waktu",
        txn: "Tx",
      },
      side: { buy: "Beli", sell: "Jual" },
      notFound: "Token tidak ditemukan.",
      holdersNote: "Jumlah holder belum tersedia untuk chain ini.",
    },
  },
};
