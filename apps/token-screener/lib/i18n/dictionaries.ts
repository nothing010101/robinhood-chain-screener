export type Locale = "en" | "id";

export const dictionaries = {
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
  },
} as const;

export type Dictionary = typeof dictionaries.en;
