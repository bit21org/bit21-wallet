// ══════════════════════════════════════════════════════════════
// errors.js — User-friendly error message mapping
// ══════════════════════════════════════════════════════════════
// Maps technical errors to friendly messages for users.
// Never expose API names, technical details, or internal errors.
// ══════════════════════════════════════════════════════════════

/**
 * Convert a technical error to a user-friendly message
 * @param {Error|string} error - The error object or message
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyError(error) {
  if (!error) return "Something went wrong. Please try again.";

  const msg = (typeof error === 'string' ? error : error.message || String(error)).toLowerCase();

  // Network & Connection Errors
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return "Couldn't connect. Check your internet and try again.";
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborterror')) {
    return "Taking too long. Pull to refresh.";
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
    return "Please wait a moment and try again.";
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('server error')) {
    return "Something went wrong. Please try again.";
  }
  if (msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('err_network')) {
    return "Couldn't connect. Check your internet and try again.";
  }

  // Wallet & Seed Errors
  if ((msg.includes('invalid') || msg.includes('bad')) && (msg.includes('phrase') || msg.includes('mnemonic') || msg.includes('seed'))) {
    return "That doesn't look right. Check your recovery phrase and try again.";
  }
  if ((msg.includes('invalid') || msg.includes('bad')) && (msg.includes('key') || msg.includes('wif'))) {
    return "Invalid private key. Please check and try again.";
  }
  if (msg.includes('does not match') || msg.includes('mismatch')) {
    return "This recovery phrase doesn't match your wallet.";
  }
  if (msg.includes('pubkey') || msg.includes('ispoint') || msg.includes('uint8array')) {
    return "Couldn't import wallet. Please try again.";
  }

  // Address Errors
  if ((msg.includes('invalid') || msg.includes('bad')) && msg.includes('address')) {
    return "Invalid Bitcoin address.";
  }

  // Transaction Errors
  if (msg.includes('broadcast') || msg.includes('send failed')) {
    return "Couldn't send transaction. Please try again.";
  }
  if (msg.includes('insufficient') || msg.includes('not enough')) {
    return "Not enough Bitcoin for this transaction.";
  }
  if (msg.includes('dust') || msg.includes('too small') || msg.includes('546')) {
    return "Amount is too small to send.";
  }
  if (msg.includes('no utxo') || msg.includes('no unspent') || msg.includes('no coins') || msg.includes('no confirmed')) {
    return "No Bitcoin available to spend.";
  }
  if (msg.includes('already in block') || msg.includes('already in the') || msg.includes('already known')) {
    return "Transaction already submitted.";
  }
  if (msg.includes('double spend') || msg.includes('already spent') || msg.includes('missingorspent') || msg.includes('missing-inputs')) {
    return "These funds have already been spent.";
  }
  if (msg.includes('fee too low') || msg.includes('min relay') || msg.includes('fee not met')) {
    return "Fee is too low. Please increase it.";
  }
  if (msg.includes('rpc error') || msg.includes('sendrawtransaction')) {
    return "Transaction rejected by the network. Please try again.";
  }
  if (msg.includes('script-verify') || msg.includes('scriptsig') || msg.includes('op_equalverify') || msg.includes('non-mandatory')) {
    return "Transaction signing failed. Please try again.";
  }
  if (msg.includes('txn-mempool-conflict') || msg.includes('mempool conflict')) {
    return "A conflicting transaction exists. Please wait and try again.";
  }

  // RBF Errors
  if (msg.includes('rbf') || msg.includes('not replaceable')) {
    return "This transaction can't be sped up.";
  }

  // Wallet/Address Type Errors
  if (msg.includes('address type') || msg.includes('not available') || msg.includes('not supported')) {
    return "This address format is not supported for your wallet.";
  }

  // Storage Errors
  if (msg.includes('quota') || msg.includes('storage')) {
    return "Device storage is full. Please free up space.";
  }

  // Crypto Library Errors
  if (msg.includes('expected buffer') || msg.includes('expected property') || msg.includes('invalid network')) {
    return "Wallet error. Please try importing your wallet again.";
  }

  // Vault Errors
  if (msg.includes('vault') && msg.includes('locked')) {
    return "This vault is still locked. Please wait for the unlock date.";
  }
  if (msg.includes('vault') && msg.includes('balance')) {
    return "Not enough Bitcoin in this vault.";
  }

  // Sync Errors
  if (msg.includes('sync failed') || msg.includes('sync error')) {
    return "Couldn't connect. Please try again.";
  }

  // Signing Errors
  if (msg.includes('signing key') || msg.includes('no key') || msg.includes('derive')) {
    return "Couldn't sign transaction. Please re-import your wallet.";
  }

  // Biometric Errors
  if (msg.includes('biometric') || msg.includes('fingerprint') || msg.includes('face id')) {
    return "Authentication failed. Please try again.";
  }

  // Generic fallback
  return "Something went wrong. Please try again.";
}

/**
 * Log error details for debugging (dev mode only)
 * @param {string} context - Where the error occurred
 * @param {Error} error - The original error
 */
export function logError(context, error) {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
}
