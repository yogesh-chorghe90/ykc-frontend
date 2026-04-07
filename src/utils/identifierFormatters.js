// Shared formatting helpers for PAN/Aadhaar/Mobile/Account numbers
// These are used across multiple forms and detail views.

export const formatMobileNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.replace(/\D/g, '').slice(0, 10)
}

export const formatPanNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  // Keep uppercase alphanumeric, max 10
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

export const formatAadhaarNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.replace(/\D/g, '').slice(0, 12)
}

export const formatBankAccountNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.replace(/\D/g, '').slice(0, 20)
}

// IFSC: 11 chars — 4 bank letters, digit 0 (zero, not letter O), then 6 alphanumeric branch chars.
// Examples: HDFC0001234 (digits) or BARB0KHARAD (letters in branch part).
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

// IFSC: 11 chars - 4 letters, 0, then 6 alphanumeric (example: HDFC0001234)
export const formatIfscCode = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
}

export const isValidIfscCode = (value) => {
  if (value === undefined || value === null) return false
  const text = String(value).toUpperCase().trim()
  if (!text) return false
  return IFSC_REGEX.test(text)
}

/**
 * For inline validation while typing: empty / partial (<11 chars) is OK;
 * once 11 chars are present, must match full IFSC format.
 */
export const isIfscValidOrIncomplete = (value) => {
  if (value === undefined || value === null) return true
  const text = String(value).toUpperCase().trim()
  if (!text) return true
  if (text.length < 11) return true
  return IFSC_REGEX.test(text)
}

export const IFSC_FORMAT_HINT =
  'IFSC must be 11 characters: 4 letters, digit 0 (zero), then 6 letters or digits (e.g. HDFC0001234 or BARB0KHARAD)'

// GSTIN: 15 chars (e.g. 27ABCDE1234F1Z5)
export const formatGstNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
}

export const isValidGstNumber = (value) => {
  if (value === undefined || value === null) return false
  const text = String(value).toUpperCase().trim()
  if (!text) return false
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(text)
}

// Loan Account No formatting:
// - Alphanumeric + uppercase
// - Max 18 chars
// - If partially typed (< 9 but > 0), return '' so UI can avoid showing invalid value
export const formatLoanAccountNo = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18)
  if (cleaned.length > 0 && cleaned.length < 9) return ''
  return cleaned
}

