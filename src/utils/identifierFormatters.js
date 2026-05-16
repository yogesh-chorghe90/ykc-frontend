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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const MOBILE_REGEX = /^[6-9]\d{9}$/

export const isValidEmail = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return false
  return EMAIL_REGEX.test(text)
}

export const isValidMobileNumber = (value) => {
  const text = String(value ?? '').replace(/\D/g, '')
  if (!text) return false
  return MOBILE_REGEX.test(text)
}

export const isValidPanNumber = (value) => {
  const text = String(value ?? '').toUpperCase().trim()
  if (!text) return false
  return PAN_REGEX.test(text)
}

export const isValidAadhaarNumber = (value) => {
  const text = String(value ?? '').replace(/\D/g, '')
  if (!text) return false
  return /^\d{12}$/.test(text)
}

export const isValidLoanAccountNo = (value) => {
  const text = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!text) return false
  return text.length >= 9 && text.length <= 18
}

/** Inline validation while typing; empty value is allowed. */
export const validateMobileNumber = (rawValue, normalizedValue) => {
  const raw = String(rawValue ?? '')
  const normalized = String(normalizedValue ?? '').replace(/\D/g, '')
  if (!normalized) return ''
  if (/\D/.test(raw)) return 'Only numbers are allowed'
  if (raw.replace(/\D/g, '').length > 10) return 'Maximum 10 digits allowed'
  if (normalized.length < 10) return 'Enter a 10-digit mobile number'
  if (!MOBILE_REGEX.test(normalized)) return 'Enter a valid 10-digit mobile number starting with 6–9'
  return ''
}

export const validateEmail = (rawValue, normalizedValue) => {
  const normalized = String(normalizedValue ?? '').trim()
  if (!normalized) return ''
  if (!EMAIL_REGEX.test(normalized)) return 'Enter a valid email address'
  return ''
}

export const validatePanNumber = (rawValue, normalizedValue) => {
  const raw = String(rawValue ?? '')
  const normalized = String(normalizedValue ?? '').toUpperCase()
  if (!normalized) return ''
  if (/[^a-zA-Z0-9]/.test(raw)) return 'Only letters and numbers are allowed'
  if (raw.replace(/[^a-zA-Z0-9]/g, '').length > 10) return 'PAN cannot exceed 10 characters'
  if (normalized.length < 10) return 'PAN must be 10 characters (e.g. ABCDE1234F)'
  if (!PAN_REGEX.test(normalized)) return 'Invalid PAN format (e.g. ABCDE1234F)'
  return ''
}

export const validateAadhaarNumber = (rawValue, normalizedValue) => {
  const raw = String(rawValue ?? '')
  const normalized = String(normalizedValue ?? '').replace(/\D/g, '')
  if (!normalized) return ''
  if (/\D/.test(raw)) return 'Only numbers are allowed'
  if (raw.replace(/\D/g, '').length > 12) return 'Aadhaar cannot exceed 12 digits'
  if (normalized.length < 12) return 'Aadhaar must be 12 digits'
  return ''
}

export const validateLoanAccountNo = (rawValue, normalizedValue) => {
  const raw = String(rawValue ?? '')
  const normalized = String(normalizedValue ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!normalized) return ''
  if (/[^a-zA-Z0-9]/i.test(raw)) return 'Only letters and numbers are allowed'
  if (raw.replace(/[^a-zA-Z0-9]/gi, '').length > 18) return 'Loan Account No cannot exceed 18 characters'
  if (normalized.length < 9) return 'Loan Account No must be at least 9 characters'
  return ''
}

