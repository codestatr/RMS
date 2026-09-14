const DEMO_ACCOUNT_TOKENS = new Set(['cashier@rms.com', 'admin@rms.com']);

export function isDemoAccount(email, password) {
  if (!email || !password) return false;
  const normalizedEmail = String(email).trim().toLowerCase();
  return DEMO_ACCOUNT_TOKENS.has(normalizedEmail) && ['Cashier123!', 'Admin123!'].includes(String(password));
}

export function shouldUseOfflineFallback(error, email, password) {
  if (!isDemoAccount(email, password)) {
    return false;
  }

  if (!error) {
    return false;
  }

  const status = Number(error?.response?.status ?? 0);
  const message = String(error?.message || '').toLowerCase();
  const isNetworkFailure =
    error?.code === 'ERR_NETWORK' ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('connection refused');

  return isNetworkFailure || status === 0 || status >= 500;
}