// Centralized country -> phone dial-code mapping for the three markets
// this CMS currently supports. Single source of truth for the player
// form's Country dropdown (client), server-side validation/normalization
// (players/actions.ts), and any future feature that needs a player's/
// parent's number in full international format — do not duplicate this
// mapping elsewhere.
export const SUPPORTED_COUNTRIES = [
  { name: "India", dialCode: "+91", mobileRegex: /^[6-9]\d{9}$/, example: "9900123417" },
  { name: "Nepal", dialCode: "+977", mobileRegex: /^9\d{9}$/, example: "9812345678" },
  { name: "United Arab Emirates", dialCode: "+971", mobileRegex: /^5\d{8}$/, example: "501234567" },
] as const;

export type CountryName = (typeof SUPPORTED_COUNTRIES)[number]["name"];

function findCountry(name: string) {
  return SUPPORTED_COUNTRIES.find((c) => c.name === name);
}

// Recognizes "this value is already fully international" without
// validating it against any specific country's numbering plan — existing
// player records may have a number saved before this feature existed (or
// belonging to a country outside the 3 supported here), and editing
// unrelated fields on that player must not be blocked by it.
const E164_SHAPE = /^\+[1-9]\d{7,14}$/;

export type PhoneNormalizeResult = { ok: true; value: string } | { ok: false; error: string };

// Combines a selected country with a raw contact-number input into one
// full international number, the same way for every caller. Already-
// international input (leading '+') passes through unchanged rather than
// being re-prefixed — this is what lets an existing player's already-
// normalized (or pre-existing/foreign) number round-trip through an edit
// without corrupting it into something like "+91+919900123417". A local
// number is validated against the selected country's mobile pattern before
// being prefixed with its dial code; never written back to the database by
// this function itself — callers decide that.
export function normalizeContactNumber(countryName: string, rawInput: string): PhoneNormalizeResult {
  const trimmed = rawInput.trim();

  if (trimmed.startsWith("+")) {
    return E164_SHAPE.test(trimmed) ? { ok: true, value: trimmed } : { ok: false, error: "Enter a valid phone number." };
  }

  const country = findCountry(countryName);
  if (!country) {
    return { ok: false, error: "Select a valid country before entering a contact number." };
  }

  const digitsOnly = trimmed.replace(/[\s\-().]/g, "");
  if (!country.mobileRegex.test(digitsOnly)) {
    return { ok: false, error: `Enter a valid ${country.name} mobile number (e.g. ${country.example}).` };
  }

  return { ok: true, value: `${country.dialCode}${digitsOnly}` };
}
