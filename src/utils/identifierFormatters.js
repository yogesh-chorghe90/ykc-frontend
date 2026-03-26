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

// IFSC: 11 chars - 4 letters, 0, then 6 alphanumeric (example: HDFC0001234)
export const formatIfscCode = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
}

export const isValidIfscCode = (value) => {
  if (value === undefined || value === null) return false
  const text = String(value).toUpperCase().trim()
  if (!text) return false
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(text)
}

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

