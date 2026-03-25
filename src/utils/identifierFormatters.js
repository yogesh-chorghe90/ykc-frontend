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

