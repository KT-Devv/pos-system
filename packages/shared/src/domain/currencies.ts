export interface CurrencyInfo {
  /** ISO 4217 code. */
  code: string;
  name: string;
}

export interface CountryInfo {
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  name: string;
  /** The currency the country normally uses, preselected during onboarding. */
  currency: string;
}

/**
 * Currencies a shop can trade in. Only 0- and 2-decimal currencies are listed because amounts are
 * stored as numeric(12,2); 3-decimal currencies (KWD, BHD, OMR, JOD, TND, LYD, IQD) are left out.
 */
export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: "AED", name: "UAE dirham" },
  { code: "AUD", name: "Australian dollar" },
  { code: "BDT", name: "Bangladeshi taka" },
  { code: "BRL", name: "Brazilian real" },
  { code: "BWP", name: "Botswana pula" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "CHF", name: "Swiss franc" },
  { code: "CNY", name: "Chinese yuan" },
  { code: "DZD", name: "Algerian dinar" },
  { code: "EGP", name: "Egyptian pound" },
  { code: "ETB", name: "Ethiopian birr" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "GHS", name: "Ghanaian cedi" },
  { code: "GMD", name: "Gambian dalasi" },
  { code: "GNF", name: "Guinean franc" },
  { code: "HKD", name: "Hong Kong dollar" },
  { code: "IDR", name: "Indonesian rupiah" },
  { code: "INR", name: "Indian rupee" },
  { code: "JPY", name: "Japanese yen" },
  { code: "KES", name: "Kenyan shilling" },
  { code: "KRW", name: "South Korean won" },
  { code: "LKR", name: "Sri Lankan rupee" },
  { code: "LRD", name: "Liberian dollar" },
  { code: "MAD", name: "Moroccan dirham" },
  { code: "MGA", name: "Malagasy ariary" },
  { code: "MUR", name: "Mauritian rupee" },
  { code: "MWK", name: "Malawian kwacha" },
  { code: "MXN", name: "Mexican peso" },
  { code: "MYR", name: "Malaysian ringgit" },
  { code: "MZN", name: "Mozambican metical" },
  { code: "NAD", name: "Namibian dollar" },
  { code: "NGN", name: "Nigerian naira" },
  { code: "NPR", name: "Nepalese rupee" },
  { code: "NZD", name: "New Zealand dollar" },
  { code: "PHP", name: "Philippine peso" },
  { code: "PKR", name: "Pakistani rupee" },
  { code: "RWF", name: "Rwandan franc" },
  { code: "SAR", name: "Saudi riyal" },
  { code: "SEK", name: "Swedish krona" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "SLE", name: "Sierra Leonean leone" },
  { code: "THB", name: "Thai baht" },
  { code: "TRY", name: "Turkish lira" },
  { code: "TZS", name: "Tanzanian shilling" },
  { code: "UGX", name: "Ugandan shilling" },
  { code: "USD", name: "US dollar" },
  { code: "VND", name: "Vietnamese dong" },
  { code: "XAF", name: "Central African CFA franc" },
  { code: "XOF", name: "West African CFA franc" },
  { code: "ZAR", name: "South African rand" },
  { code: "ZMW", name: "Zambian kwacha" },
];

export const COUNTRIES: readonly CountryInfo[] = [
  { code: "DZ", name: "Algeria", currency: "DZD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "BJ", name: "Benin", currency: "XOF" },
  { code: "BW", name: "Botswana", currency: "BWP" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "BF", name: "Burkina Faso", currency: "XOF" },
  { code: "CM", name: "Cameroon", currency: "XAF" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "ET", name: "Ethiopia", currency: "ETB" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "GM", name: "Gambia", currency: "GMD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "GN", name: "Guinea", currency: "GNF" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "LR", name: "Liberia", currency: "LRD" },
  { code: "MG", name: "Madagascar", currency: "MGA" },
  { code: "MW", name: "Malawi", currency: "MWK" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "ML", name: "Mali", currency: "XOF" },
  { code: "MU", name: "Mauritius", currency: "MUR" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "MA", name: "Morocco", currency: "MAD" },
  { code: "MZ", name: "Mozambique", currency: "MZN" },
  { code: "NA", name: "Namibia", currency: "NAD" },
  { code: "NP", name: "Nepal", currency: "NPR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "NE", name: "Niger", currency: "XOF" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "PH", name: "Philippines", currency: "PHP" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "RW", name: "Rwanda", currency: "RWF" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "SN", name: "Senegal", currency: "XOF" },
  { code: "SL", name: "Sierra Leone", currency: "SLE" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "KR", name: "South Korea", currency: "KRW" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "LK", name: "Sri Lanka", currency: "LKR" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "TG", name: "Togo", currency: "XOF" },
  { code: "TR", name: "Türkiye", currency: "TRY" },
  { code: "UG", name: "Uganda", currency: "UGX" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "VN", name: "Vietnam", currency: "VND" },
  { code: "ZM", name: "Zambia", currency: "ZMW" },
];

const currencyCodes = new Set(CURRENCIES.map((currency) => currency.code));

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && currencyCodes.has(code);
}

/** The usual currency for a country code, or undefined when the country isn't listed. */
export function currencyForCountry(code: string | null | undefined): string | undefined {
  return COUNTRIES.find((country) => country.code === code)?.currency;
}

export function currencyName(code: string): string {
  return CURRENCIES.find((currency) => currency.code === code)?.name ?? code;
}
