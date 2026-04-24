// ══════════════════════════════════════════════════════════════
// bitcoin.js — HD Wallet Derivation, TX Building, All Address Types
// ══════════════════════════════════════════════════════════════

import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

bitcoin.initEccLib(ecc);

// ══════════════════════════════════════════════════════════════
// ADDRESS TYPES — All supported BIP standards
// ══════════════════════════════════════════════════════════════

export const ADDRESS_TYPES = {
  LEGACY: {
    id: 'legacy',
    name: 'Legacy (P2PKH)',
    description: 'Original Bitcoin address format, highest compatibility',
    prefix: { mainnet: '1', testnet: 'm/n' },
    bip: 'BIP44',
    path: { mainnet: "m/44'/0'/0'/0/0", testnet: "m/44'/1'/0'/0/0" },
  },
  SEGWIT_COMPAT: {
    id: 'segwit-compat',
    name: 'SegWit Compatible (P2SH-P2WPKH)',
    description: 'Wrapped SegWit, works with older wallets',
    prefix: { mainnet: '3', testnet: '2' },
    bip: 'BIP49',
    path: { mainnet: "m/49'/0'/0'/0/0", testnet: "m/49'/1'/0'/0/0" },
  },
  NATIVE_SEGWIT: {
    id: 'native-segwit',
    name: 'Native SegWit (P2WPKH)',
    description: 'Recommended - Lower fees, modern format',
    prefix: { mainnet: 'bc1q', testnet: 'tb1q' },
    bip: 'BIP84',
    path: { mainnet: "m/84'/0'/0'/0/0", testnet: "m/84'/1'/0'/0/0" },
    recommended: true,
  },
  TAPROOT: {
    id: 'taproot',
    name: 'Taproot (P2TR)',
    description: 'Latest standard, best privacy and efficiency',
    prefix: { mainnet: 'bc1p', testnet: 'tb1p' },
    bip: 'BIP86',
    path: { mainnet: "m/86'/0'/0'/0/0", testnet: "m/86'/1'/0'/0/0" },
  },
};

// ── Network helpers ──
export function getNetwork(testnet = false) {
  return testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
}

// ══════════════════════════════════════════════════════════════
// SEED PHRASE — Generation & Validation
// ══════════════════════════════════════════════════════════════

export function generateSeedPhrase(strength = 128) {
  // 128 bits = 12 words, 256 bits = 24 words
  return bip39.generateMnemonic(strength);
}

export function validateSeedPhrase(mnemonic) {
  if (!mnemonic || typeof mnemonic !== 'string') return false;
  const normalized = mnemonic.trim().toLowerCase();
  const words = normalized.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) return false;
  return bip39.validateMnemonic(normalized);
}

// ══════════════════════════════════════════════════════════════
// INPUT DETECTION — Auto-detect seed vs WIF
// ══════════════════════════════════════════════════════════════

export function detectInputType(input) {
  if (!input || typeof input !== 'string') {
    return { type: 'invalid', error: 'Empty input' };
  }

  const trimmed = input.trim();

  // Check for WIF private key (starts with 5, K, L for mainnet, c for testnet)
  if (/^[5KLc][a-km-zA-HJ-NP-Z1-9]{50,51}$/.test(trimmed)) {
    try {
      ECPair.fromWIF(trimmed, bitcoin.networks.bitcoin);
      return { type: 'wif', network: 'mainnet' };
    } catch {
      try {
        ECPair.fromWIF(trimmed, bitcoin.networks.testnet);
        return { type: 'wif', network: 'testnet' };
      } catch {
        return { type: 'invalid', error: 'Invalid private key format' };
      }
    }
  }

  // Check for seed phrase
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    if (bip39.validateMnemonic(trimmed.toLowerCase())) {
      return { type: 'seed', wordCount: words.length };
    }
    return { type: 'invalid', error: 'Invalid recovery phrase. Check for typos.' };
  }

  return { type: 'invalid', error: 'Enter a 12 or 24 word recovery phrase, or a private key.' };
}

// ══════════════════════════════════════════════════════════════
// ADDRESS DERIVATION — Single Address
// ══════════════════════════════════════════════════════════════

export async function deriveAddress(mnemonic, addressType, testnet = false, index = 0, passphrase = "") {
  const network = getNetwork(testnet);
  const typeConfig = ADDRESS_TYPES[addressType];
  if (!typeConfig) throw new Error(`Unknown address type: ${addressType}`);

  // Replace last segment (address index) with the provided index
  const basePath = testnet ? typeConfig.path.testnet : typeConfig.path.mainnet;
  const path = index === 0 ? basePath : basePath.replace(/\/0$/, `/${index}`);
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  let address, publicKey;

  switch (addressType) {
    case 'LEGACY': {
      // P2PKH - Pay to Public Key Hash
      const payment = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(child.publicKey),
        network,
      });
      address = payment.address;
      publicKey = child.publicKey;
      break;
    }

    case 'SEGWIT_COMPAT': {
      // P2SH-P2WPKH - Wrapped SegWit
      const payment = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network,
        }),
        network,
      });
      address = payment.address;
      publicKey = child.publicKey;
      break;
    }

    case 'NATIVE_SEGWIT': {
      // P2WPKH - Native SegWit
      const payment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network,
      });
      address = payment.address;
      publicKey = child.publicKey;
      break;
    }

    case 'TAPROOT': {
      // P2TR - Taproot
      const internalPubkey = child.publicKey.slice(1, 33); // Remove prefix byte
      const payment = bitcoin.payments.p2tr({
        internalPubkey: Buffer.from(internalPubkey),
        network,
      });
      address = payment.address;
      publicKey = child.publicKey;
      break;
    }

    default:
      throw new Error(`Unsupported address type: ${addressType}`);
  }

  return {
    address,
    publicKey: Buffer.from(publicKey).toString('hex'),
    type: typeConfig.id,
    bip: typeConfig.bip,
    path,
    derivation: 'bip32',
  };
}

// ══════════════════════════════════════════════════════════════
// DERIVE ALL ADDRESSES — For address selection UI
// ══════════════════════════════════════════════════════════════

export async function deriveAllAddresses(mnemonic, testnet = false, passphrase = "") {
  const results = {};
  for (const typeKey of Object.keys(ADDRESS_TYPES)) {
    try {
      results[typeKey] = await deriveAddress(mnemonic, typeKey, testnet, 0, passphrase);
      results[typeKey].config = ADDRESS_TYPES[typeKey];
    } catch (err) {
      results[typeKey] = { error: err.message, config: ADDRESS_TYPES[typeKey] };
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// WIF IMPORT — Private Key Address
// ══════════════════════════════════════════════════════════════

export function importFromWIF(wif, testnet = false) {
  const network = getNetwork(testnet);
  try {
    const keyPair = ECPair.fromWIF(wif, network);

    // WIF always generates P2WPKH (Native SegWit) address
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });

    return {
      address,
      publicKey: keyPair.publicKey.toString('hex'),
      type: 'native-segwit',
      derivation: 'wif',
    };
  } catch {
    throw new Error('Invalid private key format');
  }
}

// ══════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — Legacy SHA256 derivation
// ══════════════════════════════════════════════════════════════

export async function addressFromSeedLegacy(mnemonic, testnet = false) {
  const network = getNetwork(testnet);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const hash = bitcoin.crypto.sha256(Buffer.from(seed));
  const keyPair = ECPair.fromPrivateKey(hash, { network });

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network,
  });

  return {
    address,
    publicKey: keyPair.publicKey.toString('hex'),
    derivation: 'legacy-sha256',
  };
}

// Legacy wrapper for backward compatibility
export async function addressFromSeed(mnemonic, testnet = false, passphrase = "") {
  return deriveAddress(mnemonic, 'NATIVE_SEGWIT', testnet, 0, passphrase);
}

// ══════════════════════════════════════════════════════════════
// KEYPAIR DERIVATION — For Transaction Signing
// ══════════════════════════════════════════════════════════════

async function getKeyPairForType(mnemonic, addressType, testnet = false, index = 0, passphrase = "") {
  const network = getNetwork(testnet);
  const typeConfig = ADDRESS_TYPES[addressType];
  const basePath = testnet ? typeConfig.path.testnet : typeConfig.path.mainnet;
  const path = index === 0 ? basePath : basePath.replace(/\/0$/, `/${index}`);

  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  return ECPair.fromPrivateKey(Buffer.from(child.privateKey), { network });
}

export async function getKeyPairFromSeed(mnemonic, testnet = false, passphrase = "") {
  return getKeyPairForType(mnemonic, 'NATIVE_SEGWIT', testnet, 0, passphrase);
}

export async function getKeyPairFromSeedLegacy(mnemonic, testnet = false) {
  const network = getNetwork(testnet);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const hash = bitcoin.crypto.sha256(Buffer.from(seed));
  return ECPair.fromPrivateKey(hash, { network });
}

// Smart keypair: detects which derivation method matches the address
export async function getKeyPairSmart(mnemonic, expectedAddress, testnet = false, passphrase = "") {
  const network = getNetwork(testnet);

  // Try each address type at index 0 first
  for (const typeKey of Object.keys(ADDRESS_TYPES)) {
    try {
      const derived = await deriveAddress(mnemonic, typeKey, testnet, 0, passphrase);
      if (derived.address === expectedAddress) {
        const keyPair = await getKeyPairForType(mnemonic, typeKey, testnet, 0, passphrase);
        return { keyPair, derivation: typeKey, type: ADDRESS_TYPES[typeKey].id };
      }
    } catch {
      // Skip unsupported types
    }
  }

  // Try HD indices 1-19 for each type (multi-address support)
  for (const typeKey of Object.keys(ADDRESS_TYPES)) {
    for (let idx = 1; idx < 20; idx++) {
      try {
        const derived = await deriveAddress(mnemonic, typeKey, testnet, idx, passphrase);
        if (derived.address === expectedAddress) {
          const keyPair = await getKeyPairForType(mnemonic, typeKey, testnet, idx, passphrase);
          return { keyPair, derivation: typeKey, type: ADDRESS_TYPES[typeKey].id, index: idx };
        }
      } catch { break; }
    }
  }

  // Try legacy SHA256 derivation as final fallback (no passphrase support for legacy)
  const legacyResult = await addressFromSeedLegacy(mnemonic, testnet);
  if (legacyResult.address === expectedAddress) {
    const keyPair = await getKeyPairFromSeedLegacy(mnemonic, testnet);
    return { keyPair, derivation: 'legacy-sha256', type: 'legacy-sha256' };
  }

  throw new Error('This recovery phrase doesn\'t match your wallet.');
}

export function getKeyPairFromWIF(wif, testnet = false) {
  try {
    return ECPair.fromWIF(wif, getNetwork(testnet));
  } catch {
    throw new Error('Invalid private key format');
  }
}

// ══════════════════════════════════════════════════════════════
// ADDRESS VALIDATION
// ══════════════════════════════════════════════════════════════

export function validateAddress(addr, testnet = false) {
  if (!addr || typeof addr !== 'string') return false;
  try {
    bitcoin.address.toOutputScript(addr, getNetwork(testnet));
    return true;
  } catch {
    return false;
  }
}

export function getAddressType(addr) {
  if (!addr) return null;
  if (addr.startsWith('bc1p') || addr.startsWith('tb1p')) return 'taproot';
  if (addr.startsWith('bc1q') || addr.startsWith('tb1q')) return 'native-segwit';
  if (addr.startsWith('3') || addr.startsWith('2')) return 'segwit-compat';
  if (addr.startsWith('1') || addr.startsWith('m') || addr.startsWith('n')) return 'legacy';
  return 'unknown';
}

// Map address type id (e.g. 'native-segwit') to ADDRESS_TYPES key (e.g. 'NATIVE_SEGWIT')
export function addressTypeIdToKey(id) {
  for (const [key, val] of Object.entries(ADDRESS_TYPES)) {
    if (val.id === id) return key;
  }
  return 'NATIVE_SEGWIT';
}

// ══════════════════════════════════════════════════════════════
// TRANSACTION HELPERS
// ══════════════════════════════════════════════════════════════

export function estimateTxSize(inputCount, outputCount) {
  return Math.ceil(inputCount * 68 + outputCount * 31 + 10.5);
}

export function estimateFee(inputCount, outputCount, feeRate) {
  return estimateTxSize(inputCount, outputCount) * feeRate;
}

// ══════════════════════════════════════════════════════════════
// BUILD TRANSACTION
// ══════════════════════════════════════════════════════════════

export function buildTransaction({ utxos, recipientAddress, amountSats, feeRate, keyPair, keyPairs, senderAddress, enableRBF = true, testnet = false }) {
  const network = getNetwork(testnet);
  const psbt = new bitcoin.Psbt({ network });
  const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);
  const senderScript = bitcoin.address.toOutputScript(senderAddress, network);

  let inputTotal = 0;
  const selectedUtxos = [];

  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    inputTotal += utxo.value;
    const fee = estimateFee(selectedUtxos.length, 2, feeRate);
    if (inputTotal >= amountSats + fee) break;
  }

  const fee = estimateFee(selectedUtxos.length, 2, feeRate);

  if (inputTotal < amountSats + fee) {
    const have = (inputTotal / 1e8).toFixed(8);
    const need = ((amountSats + fee) / 1e8).toFixed(8);
    throw new Error(`Insufficient funds. Balance: ${have} BTC, Required: ${need} BTC`);
  }

  for (const utxo of selectedUtxos) {
    // Use the UTXO's source address for the script (multi-address support)
    const utxoAddr = utxo.sourceAddress || senderAddress;
    const script = bitcoin.address.toOutputScript(utxoAddr, network);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script, value: utxo.value },
      sequence: enableRBF ? 0xfffffffd : 0xffffffff,
    });
  }

  psbt.addOutput({ address: recipientAddress, value: amountSats });

  const change = inputTotal - amountSats - fee;
  if (change > 546) {
    psbt.addOutput({ address: senderAddress, value: change });
  }

  for (let i = 0; i < selectedUtxos.length; i++) {
    // Sign with the correct keypair for each UTXO's source address
    const utxoAddr = selectedUtxos[i].sourceAddress;
    const kp = (keyPairs && utxoAddr && keyPairs[utxoAddr]) ? keyPairs[utxoAddr] : keyPair;
    psbt.signInput(i, kp);
  }

  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    txHex: tx.toHex(),
    txid: tx.getId(),
    fee,
    inputTotal,
    change: change > 546 ? change : 0,
    dustBurned: (change > 0 && change <= 546) ? change : 0,
    inputCount: selectedUtxos.length,
    rbfEnabled: enableRBF,
    usedUtxos: selectedUtxos,
  };
}

export function buildRBFTransaction({ utxos, recipientAddress, amountSats, newFeeRate, keyPair, senderAddress, testnet = false }) {
  return buildTransaction({
    utxos, recipientAddress, amountSats,
    feeRate: newFeeRate,
    keyPair, senderAddress,
    enableRBF: true,
    testnet,
  });
}

export function buildTransactionWithUTXOs({ selectedUtxos, recipientAddress, amountSats, feeRate, keyPair, senderAddress, enableRBF = true, testnet = false }) {
  const network = getNetwork(testnet);
  const psbt = new bitcoin.Psbt({ network });
  const senderScript = bitcoin.address.toOutputScript(senderAddress, network);

  let inputTotal = 0;
  for (const utxo of selectedUtxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: senderScript, value: utxo.value },
      sequence: enableRBF ? 0xfffffffd : 0xffffffff,
    });
    inputTotal += utxo.value;
  }

  const fee = estimateFee(selectedUtxos.length, 2, feeRate);

  if (inputTotal < amountSats + fee) {
    const have = (inputTotal / 1e8).toFixed(8);
    const need = ((amountSats + fee) / 1e8).toFixed(8);
    throw new Error(`Selected coins insufficient. Have: ${have} BTC, Need: ${need} BTC`);
  }

  psbt.addOutput({ address: recipientAddress, value: amountSats });

  const change = inputTotal - amountSats - fee;
  if (change > 546) {
    psbt.addOutput({ address: senderAddress, value: change });
  }

  for (let i = 0; i < selectedUtxos.length; i++) {
    psbt.signInput(i, keyPair);
  }

  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return { txHex: tx.toHex(), txid: tx.getId(), fee, inputTotal, change: change > 546 ? change : 0, inputCount: selectedUtxos.length };
}

// ══════════════════════════════════════════════════════════════
// VAULT — CLTV Time-Locked Transactions
// ══════════════════════════════════════════════════════════════

// Vault script — CLTV timelock, spendable only by user after locktime
export function createVaultScript(userPubKey, locktime) {
  if (!locktime || locktime <= 0) throw new Error("Invalid locktime");
  if (!userPubKey || userPubKey.length !== 33) throw new Error("Invalid public key");
  return bitcoin.script.compile([
    bitcoin.script.number.encode(locktime),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    userPubKey,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
}

export function createVaultAddress(userPubKey, locktime, testnet = false) {
  const network = getNetwork(testnet);
  const redeemScript = createVaultScript(userPubKey, locktime);
  const { address } = bitcoin.payments.p2sh({
    redeem: { output: redeemScript, network },
    network,
  });
  return { address, redeemScript: redeemScript.toString('hex'), locktime };
}

export function locktimeFromDays(currentBlockHeight, days) {
  return currentBlockHeight + Math.ceil(days * 144);
}

// Spend from a time-locked vault after locktime has passed
// Supports multiple UTXOs at the vault address
export async function spendFromVault({
  vaultUtxos,          // Array of { txid, vout, value } — all UTXOs at vault address
  redeemScriptHex,     // The stored redeemScript (hex)
  locktime,            // The locktime from vault creation (block height)
  seed,                // User's seed phrase or WIF
  walletAddress,       // User's main wallet address (to derive correct key)
  destinationAddress,  // Where to send the BTC
  feeRate,             // Sat/vB
  fetchRawTx,          // async (txid) => hex string — fetches raw tx for nonWitnessUtxo
  testnet = false
}) {
  if (!vaultUtxos || !vaultUtxos.length) {
    throw new Error("No UTXOs found in vault");
  }

  const network = getNetwork(testnet);
  const psbt = new bitcoin.Psbt({ network });
  const redeemScript = Buffer.from(redeemScriptHex, 'hex');

  // P2SH is non-segwit, needs nonWitnessUtxo (full raw tx)
  let totalInput = 0;
  for (const utxo of vaultUtxos) {
    const inputData = {
      hash: utxo.txid,
      index: utxo.vout,
      sequence: 0xfffffffe, // Enable locktime (must be < 0xffffffff)
      redeemScript: redeemScript,
    };
    if (fetchRawTx) {
      const rawHex = await fetchRawTx(utxo.txid);
      inputData.nonWitnessUtxo = Buffer.from(rawHex, 'hex');
    } else {
      throw new Error("fetchRawTx is required for P2SH vault spending (nonWitnessUtxo needed)");
    }
    psbt.addInput(inputData);
    totalInput += utxo.value;
  }

  // Set locktime on the transaction (CLTV enforcement)
  psbt.setLocktime(locktime);

  // Dynamic fee: ~180 vB per P2SH IF/ELSE input, ~34 vB per output, ~10 vB overhead
  const estimatedVBytes = 10 + (vaultUtxos.length * 180) + 34;
  const fee = Math.ceil(estimatedVBytes * feeRate);
  const outputValue = totalInput - fee;

  if (outputValue <= 546) {
    throw new Error("Vault balance too low to cover transaction fee");
  }

  psbt.addOutput({ address: destinationAddress, value: outputValue });

  // Derive key pair from seed
  const { keyPair } = await getKeyPairSmart(seed, walletAddress, testnet);

  // Sign and finalize every input with the CLTV custom finalizer
  for (let i = 0; i < vaultUtxos.length; i++) {
    psbt.signInput(i, keyPair);
    psbt.finalizeInput(i, (_inputIndex, input) => {
      const sig = input.partialSig[0].signature;
      return { finalScriptSig: bitcoin.script.compile([sig, redeemScript]) };
    });
  }

  const tx = psbt.extractTransaction();

  return {
    txHex: tx.toHex(),
    txid: tx.getId(),
    fee,
    outputValue,
    inputCount: vaultUtxos.length,
    totalInput,
  };
}

// ══════════════════════════════════════════════════════════════
// PIN HASHING
// ══════════════════════════════════════════════════════════════

export function hashPIN(pin) {
  // Salted hash: device-specific salt from localStorage
  let salt = localStorage.getItem("btc_pin_salt");
  if (!salt) {
    salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem("btc_pin_salt", salt);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  // Multiple rounds of SHA256
  let hash = bitcoin.crypto.sha256(Buffer.from(data));
  for (let i = 0; i < 1000; i++) hash = bitcoin.crypto.sha256(hash);
  return hash.toString('hex');
}

// ══════════════════════════════════════════════════════════════
// BIP39 SPELL-CHECK — Help users fix typos
// ══════════════════════════════════════════════════════════════

// Get the BIP39 English wordlist (2048 words)
export function getBIP39Wordlist() {
  return bip39.wordlists.english;
}

// Levenshtein distance - count edits needed to transform a→b
export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}

// Check if a word is valid BIP39
export function isValidBIP39Word(word) {
  return getBIP39Wordlist().includes(word.toLowerCase());
}

// Get suggestions for a misspelled word
export function suggestBIP39Words(typo, maxSuggestions = 3) {
  const word = typo.toLowerCase();
  if (isValidBIP39Word(word)) return { valid: true, suggestions: [] };

  const wordlist = getBIP39Wordlist();
  const scored = wordlist
    .map(w => ({ word: w, distance: levenshteinDistance(word, w) }))
    .filter(s => s.distance <= 3) // Only close matches
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions);

  return {
    valid: false,
    suggestions: scored.map(s => s.word),
  };
}

// Validate all words in a phrase, returning per-word results
export function validatePhraseWords(phrase) {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  return words.map((word, index) => {
    const result = suggestBIP39Words(word);
    return {
      index,
      word,
      valid: result.valid,
      suggestions: result.suggestions,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// LEGACY EXPORTS — For backward compatibility
// ══════════════════════════════════════════════════════════════

export function addressFromPrivateKey(wif, testnet = false) {
  return importFromWIF(wif, testnet);
}

export function getDerivationPath(testnet = false) {
  return testnet ? ADDRESS_TYPES.NATIVE_SEGWIT.path.testnet : ADDRESS_TYPES.NATIVE_SEGWIT.path.mainnet;
}
