/* Country dial codes for the checkout phone field's country picker. US first
 * (the default selection); the rest roughly by market. No flag emoji (emoji is
 * never used as UI here), so options read as "United States (+1)". `country`
 * (the ISO code) is what the form stores; dialFor() maps it to the prefix at
 * submit time, so countries that share a dial code (US and Canada) stay
 * distinct in the dropdown. */
export type DialCode = { iso: string; name: string; dial: string };

export const dialCodes: DialCode[] = [
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "AR", name: "Argentina", dial: "+54" },
  { iso: "AT", name: "Austria", dial: "+43" },
  { iso: "BD", name: "Bangladesh", dial: "+880" },
  { iso: "BE", name: "Belgium", dial: "+32" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "BG", name: "Bulgaria", dial: "+359" },
  { iso: "CL", name: "Chile", dial: "+56" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "CO", name: "Colombia", dial: "+57" },
  { iso: "HR", name: "Croatia", dial: "+385" },
  { iso: "CZ", name: "Czechia", dial: "+420" },
  { iso: "DK", name: "Denmark", dial: "+45" },
  { iso: "EG", name: "Egypt", dial: "+20" },
  { iso: "EE", name: "Estonia", dial: "+372" },
  { iso: "FI", name: "Finland", dial: "+358" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "GR", name: "Greece", dial: "+30" },
  { iso: "HK", name: "Hong Kong", dial: "+852" },
  { iso: "HU", name: "Hungary", dial: "+36" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "ID", name: "Indonesia", dial: "+62" },
  { iso: "IL", name: "Israel", dial: "+972" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "KE", name: "Kenya", dial: "+254" },
  { iso: "MY", name: "Malaysia", dial: "+60" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "NG", name: "Nigeria", dial: "+234" },
  { iso: "NO", name: "Norway", dial: "+47" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "PH", name: "Philippines", dial: "+63" },
  { iso: "PL", name: "Poland", dial: "+48" },
  { iso: "PT", name: "Portugal", dial: "+351" },
  { iso: "RO", name: "Romania", dial: "+40" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "KR", name: "South Korea", dial: "+82" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "SE", name: "Sweden", dial: "+46" },
  { iso: "CH", name: "Switzerland", dial: "+41" },
  { iso: "TH", name: "Thailand", dial: "+66" },
  { iso: "TR", name: "Turkey", dial: "+90" },
  { iso: "UA", name: "Ukraine", dial: "+380" },
  { iso: "VN", name: "Vietnam", dial: "+84" },
];

const DIAL_BY_ISO: Record<string, string> = Object.fromEntries(
  dialCodes.map((c) => [c.iso, c.dial]),
);

/** the +dial prefix for an ISO country code (falls back to US +1) */
export function dialFor(iso: string): string {
  return DIAL_BY_ISO[iso] ?? "+1";
}

/** build an E.164-ish number from a country and a locally typed number */
export function toE164(iso: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  return digits ? `${dialFor(iso)}${digits}` : "";
}
