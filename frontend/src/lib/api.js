// ══════════════════════════════════════════════════════════════
// api.js — All calls to your backend server
// ══════════════════════════════════════════════════════════════

// Production API URL — empty string for web (same-origin), full URL for native app
const BASE = window.Capacitor?.isNativePlatform?.()
  ? "https://wallet.bit21.app"   // production domain
  : "";

// ══════════════════════════════════════════════════════════════
// CLIENT-SIDE CACHE — reduces redundant API calls
// ══════════════════════════════════════════════════════════════
const apiCache = new Map();

const CACHE_TTL = {
  balance: 15 * 1000,       // 15 seconds
  transactions: 30 * 1000,  // 30 seconds
  utxos: 30 * 1000,         // 30 seconds
  fees: 60 * 1000,          // 60 seconds
  price: 30 * 1000,         // 30 seconds
  priceHistory: 5 * 60 * 1000, // 5 minutes
  mempoolStats: 60 * 1000,  // 60 seconds
  fearGreed: 5 * 60 * 1000, // 5 minutes
  marketData: 60 * 1000,    // 60 seconds
};

function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }
  return null;
}

function setCache(key, data, ttlMs) {
  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Clear cache for a specific address (call after sending BTC)
export function clearAddressCache(address) {
  for (const key of apiCache.keys()) {
    if (key.includes(address)) apiCache.delete(key);
  }
}

// Force-clear all cache (for manual refresh)
export function clearAllCache() {
  apiCache.clear();
}

// Helper: append network param for testnet
function nq(testnet) {
  return testnet ? "?network=testnet" : "";
}
function nqa(testnet) {
  return testnet ? "&network=testnet" : "";
}

// ── Wallet Data ──

export async function getBalance(address, testnet = false, skipCache = false) {
  const cacheKey = `balance_${address}_${testnet}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/wallet/balance/${address}${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch balance");
  const data = await res.json();
  const confirmed = data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum;
  const unconfirmed = data.mempool_stats?.funded_txo_sum - data.mempool_stats?.spent_txo_sum;
  const result = {
    confirmed: confirmed / 1e8,
    unconfirmed: unconfirmed / 1e8,
    total: (confirmed + unconfirmed) / 1e8,
    totalSats: confirmed + unconfirmed,
  };
  setCache(cacheKey, result, CACHE_TTL.balance);
  return result;
}

export async function getTransactions(address, testnet = false, skipCache = false) {
  const cacheKey = `txs_${address}_${testnet}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/wallet/txs/${address}${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.transactions);
  return data;
}

export async function getUTXOs(address, testnet = false, skipCache = false) {
  const cacheKey = `utxos_${address}_${testnet}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/wallet/utxos/${address}${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch UTXOs");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.utxos);
  return data;
}

export async function getFees(testnet = false, skipCache = false) {
  const cacheKey = `fees_${testnet}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/wallet/fees${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch fees");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.fees);
  return data;
}

export async function broadcastTx(txHex, testnet = false) {
  const res = await fetch(`${BASE}/api/wallet/broadcast${nq(testnet)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHex }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Broadcast failed");
  }
  return res.json();
}

// ── Price Data ──

export async function getPrice(skipCache = false, currency = "usd") {
  const cacheKey = `price_${currency}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/price?currency=${currency}`);
  if (!res.ok) throw new Error("Failed to fetch price");
  const data = await res.json();
  const result = {
    fiat: data.bitcoin?.[currency] ?? 0,
    change24h: data.bitcoin?.[`${currency}_24h_change`] ?? 0,
    currency,
  };
  setCache(cacheKey, result, CACHE_TTL.price);
  return result;
}

export async function getPriceHistory(days = 90, skipCache = false, currency = "usd") {
  const cacheKey = `priceHistory_${days}_${currency}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/price/history?days=${days}&currency=${currency}`);
  if (!res.ok) throw new Error("Failed to fetch price history");
  const data = await res.json();
  const result = (data.prices || []).map(([ts, price]) => ({ timestamp: ts, price }));
  setCache(cacheKey, result, CACHE_TTL.priceHistory);
  return result;
}

// ── Whale Alerts ──

export async function getWhaleAlerts(threshold = 100000000, testnet = false) {
  const res = await fetch(`${BASE}/api/whale-alerts?threshold=${threshold}${nqa(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch whale alerts");
  return res.json();
}

// ── Block Height ──

export async function getBlockHeight(testnet = false) {
  const res = await fetch(`${BASE}/api/block-height${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch block height");
  const data = await res.json();
  return data.height;
}

// ── Raw TX Hex (for P2SH spending) ──

export async function getRawTxHex(txid, testnet = false) {
  const res = await fetch(`${BASE}/api/tx/${txid}/hex${nq(testnet)}`);
  if (!res.ok) throw new Error("Failed to fetch transaction data");
  const data = await res.json();
  return data.hex;
}

// ── Difficulty Adjustment ──

export async function getDifficultyAdjustment(skipCache = false) {
  const cacheKey = "diffAdj";
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/difficulty-adjustment`);
  if (!res.ok) throw new Error("Failed to fetch difficulty adjustment");
  const data = await res.json();
  setCache(cacheKey, data, 120000);
  return data;
}

// ── Recent Blocks ──

export async function getRecentBlocks(skipCache = false) {
  const cacheKey = "recentBlocks";
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/recent-blocks`);
  if (!res.ok) throw new Error("Failed to fetch recent blocks");
  const data = await res.json();
  setCache(cacheKey, data, 30000);
  return data;
}

// ── Mining Pools ──

export async function getMiningPools(period = "1w", skipCache = false) {
  const cacheKey = `miningPools_${period}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/mining-pools?period=${period}`);
  if (!res.ok) throw new Error("Failed to fetch mining pools");
  const data = await res.json();
  setCache(cacheKey, data, 300000);
  return data;
}

// ── Mempool Stats (Network Health) ──

export async function getMempoolStats(skipCache = false) {
  const cacheKey = "mempoolStats";
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/mempool-stats`);
  if (!res.ok) throw new Error("Failed to fetch mempool stats");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.mempoolStats);
  return data;
}

// ── Fear & Greed Index ──

export async function getFearGreedIndex(skipCache = false) {
  const cacheKey = "fearGreed";
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/fear-greed`);
  if (!res.ok) throw new Error("Failed to fetch Fear & Greed index");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.fearGreed);
  return data;
}

// ── Market Data ──

export async function getMarketData(skipCache = false) {
  const cacheKey = "marketData";
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${BASE}/api/market-data`);
  if (!res.ok) throw new Error("Failed to fetch market data");
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTL.marketData);
  return data;
}

// ── Feature Flags ──

export async function getFeatures() {
  try {
    const res = await fetch(`${BASE}/api/features`);
    if (!res.ok) return { vaultEnabled: true }; // Default if error
    return await res.json();
  } catch {
    return { vaultEnabled: true }; // Default if network error
  }
}

