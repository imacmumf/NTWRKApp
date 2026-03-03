/**
 * Normalize a phone number to a consistent digits-only format.
 *
 * Strips all non-digit characters, then:
 * - 10 digits → prepend "1" (US default)
 * - 11 digits starting with "1" → keep as-is
 * - Other lengths → keep digits as-is (international)
 *
 * Examples:
 *   "+1 (555) 123-4567"  →  "15551234567"
 *   "555-123-4567"       →  "15551234567"
 *   "15551234567"         →  "15551234567"
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, '');

  // US numbers: if 10 digits, prepend country code "1"
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  return digits;
}
