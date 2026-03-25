// Shared formatting helpers for PAN/Aadhaar/Mobile/Account numbers
// Keep logic consistent with LeadForm normalization rules.

export const formatMobileNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  return text.replace(/\D/g, '').slice(0, 10)
}

export const formatPanNumber = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
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

export const formatLoanAccountNo = (value) => {
  const text = value === undefined || value === null ? '' : String(value)
  // Keep alphanumeric, uppercase, max 18 (matches LeadForm rule for loanAccountNo)
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18)
  // Minimum length rule (per requirement)
  if (cleaned.length > 0 && cleaned.length < 9) return ''
  return cleaned
}

