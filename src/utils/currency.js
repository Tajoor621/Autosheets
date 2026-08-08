import { EXCHANGE_RATES, CURRENCIES } from '../data/mockData';

export function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const inUSD = amount / EXCHANGE_RATES[fromCurrency];
  return inUSD * EXCHANGE_RATES[toCurrency];
}

export function formatCurrency(amount, currencyCode = 'USD') {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency.symbol}${formatted}`;
}

export function getCurrencySymbol(code) {
  const c = CURRENCIES.find((x) => x.code === code);
  return c ? c.symbol : '$';
}
