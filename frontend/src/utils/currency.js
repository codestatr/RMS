/**
 * Currency Formatting & Exchange Utilities
 * Default Currency: Kenyan Shillings (KES / KSh)
 * International Currency: United States Dollar (USD) for PayPal & International Cards
 */

export const USD_EXCHANGE_RATE = 130; // 1 USD ≈ 130 KES

/**
 * Format an amount in Kenyan Shillings
 * @param {number} amount 
 * @returns {string} e.g. "KES 5,500"
 */
export const formatKES = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'KES 0';
  return `KES ${Number(amount).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
};

/**
 * Format an amount in USD (converted from KES)
 * @param {number} amountInKES 
 * @returns {string} e.g. "$42.31 USD"
 */
export const formatUSD = (amountInKES) => {
  if (amountInKES === undefined || amountInKES === null || isNaN(amountInKES)) return '$0.00 USD';
  const usd = Number(amountInKES) / USD_EXCHANGE_RATE;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
};

/**
 * Convert KES to USD number
 * @param {number} amountInKES 
 * @returns {number}
 */
export const kesToUsd = (amountInKES) => {
  return Number((Number(amountInKES || 0) / USD_EXCHANGE_RATE).toFixed(2));
};

/**
 * Convert USD to KES number
 * @param {number} amountInUSD 
 * @returns {number}
 */
export const usdToKes = (amountInUSD) => {
  return Math.round(Number(amountInUSD || 0) * USD_EXCHANGE_RATE);
};

/**
 * Smart price display depending on payment method
 * @param {number} amountInKES 
 * @param {string} paymentMethod 
 * @returns {string}
 */
export const formatPaymentAmount = (amountInKES, paymentMethod = 'mpesa') => {
  if (paymentMethod === 'paypal') {
    return `${formatUSD(amountInKES)} (${formatKES(amountInKES)})`;
  }
  return formatKES(amountInKES);
};

