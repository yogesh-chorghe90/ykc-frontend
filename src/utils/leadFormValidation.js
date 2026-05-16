import {
  formatAadhaarNumber,
  formatLoanAccountNo,
  formatMobileNumber,
  formatPanNumber,
  validateAadhaarNumber,
  validateEmail,
  validateLoanAccountNo,
  validateMobileNumber,
  validatePanNumber,
} from './identifierFormatters';

const MOBILE_KEY_RE = /(^|_)(mobile|phone|contact|tel)(_|$)/i;
const EMAIL_KEY_RE = /(^|_)(email)(_|$)/i;
const PAN_KEY_RE = /pan/i;
const AADHAAR_KEY_RE = /aadhaar/i;
const LOAN_ACCOUNT_KEY_RE = /(loanaccount|loan_account|account_no|loan_acc|lan)/i;

const STANDARD_FIELD_KINDS = {
  applicantMobile: 'mobile',
  smBmMobile: 'mobile',
  asmMobile: 'mobile',
  mobile: 'mobile',
  applicantEmail: 'email',
  smBmEmail: 'email',
  asmEmail: 'email',
  email: 'email',
  panNumber: 'pan',
  aadhaarNumber: 'aadhaar',
  loanAccountNo: 'loanAccount',
  loanAmount: 'number',
};

/** Resolve validation rule from field definition or key name. */
export function getFieldValidationKind(field = {}) {
  const key = String(field.key || '').toLowerCase();
  const type = String(field.type || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();

  if (STANDARD_FIELD_KINDS[key]) return STANDARD_FIELD_KINDS[key];
  if (type === 'tel' || MOBILE_KEY_RE.test(key) || (label.includes('mobile') && !label.includes('email'))) {
    return 'mobile';
  }
  if (type === 'email' || EMAIL_KEY_RE.test(key) || label.includes('email')) return 'email';
  if (type === 'number' || key === 'loanamount' || key === 'loan_amount' || key === 'amount') return 'number';
  if (type === 'date') return 'date';
  if (PAN_KEY_RE.test(key) || label.includes('pan')) return 'pan';
  if (AADHAAR_KEY_RE.test(key) || label.includes('aadhaar')) return 'aadhaar';
  if (LOAN_ACCOUNT_KEY_RE.test(key) || label.includes('loan account')) return 'loanAccount';
  return null;
}

export function getStandardFieldKind(key) {
  return STANDARD_FIELD_KINDS[key] || getFieldValidationKind({ key });
}

export function formatByFieldKind(kind, value) {
  if (value === undefined || value === null) return value;
  switch (kind) {
    case 'mobile':
      return formatMobileNumber(value);
    case 'pan':
      return formatPanNumber(value);
    case 'aadhaar':
      return formatAadhaarNumber(value);
    case 'loanAccount':
      return formatLoanAccountNo(value);
    case 'email':
      return String(value).trim();
    case 'number': {
      const text = String(value).replace(/[^\d.]/g, '');
      return text;
    }
    default:
      return value;
  }
}

export function validateByFieldKind(kind, rawValue, normalizedValue) {
  switch (kind) {
    case 'mobile':
      return validateMobileNumber(rawValue, normalizedValue);
    case 'email':
      return validateEmail(rawValue, normalizedValue);
    case 'pan':
      return validatePanNumber(rawValue, normalizedValue);
    case 'aadhaar':
      return validateAadhaarNumber(rawValue, normalizedValue);
    case 'loanAccount':
      return validateLoanAccountNo(rawValue, normalizedValue);
    case 'number': {
      const text = String(normalizedValue ?? '').trim();
      if (!text) return '';
      const num = parseFloat(text);
      if (Number.isNaN(num) || num < 0) return 'Enter a valid positive number';
      return '';
    }
    case 'date': {
      const text = String(normalizedValue ?? '').trim();
      if (!text) return '';
      if (Number.isNaN(Date.parse(text))) return 'Enter a valid date';
      return '';
    }
    default:
      return '';
  }
}

export function validateField(field, rawValue) {
  const kind = getFieldValidationKind(field);
  if (!kind) return { kind: null, normalized: rawValue, error: '' };
  const normalized = formatByFieldKind(kind, rawValue);
  const error = validateByFieldKind(kind, rawValue, normalized);
  return { kind, normalized, error };
}

const STANDARD_KEYS_TO_VALIDATE = [
  'applicantMobile', 'smBmMobile', 'asmMobile',
  'applicantEmail', 'smBmEmail', 'asmEmail',
  'panNumber', 'aadhaarNumber', 'loanAccountNo', 'loanAmount',
];

/** Collect validation errors for standard lead fields and dynamic form values. */
export function collectLeadFormValidationErrors({ standard = {}, formValues = {}, fields = [] }) {
  const errors = {};

  STANDARD_KEYS_TO_VALIDATE.forEach((key) => {
    const kind = getStandardFieldKind(key);
    if (!kind) return;
    const raw = standard[key];
    if (raw === undefined || raw === null || raw === '') return;
    const normalized = formatByFieldKind(kind, raw);
    const error = validateByFieldKind(kind, raw, normalized);
    if (error) errors[key] = error;
  });

  (fields || []).forEach((field) => {
    const key = field.key;
    if (!key) return;
    const raw = formValues[key] ?? standard[key];
    if (raw === undefined || raw === null || raw === '') return;
    const { error } = validateField(field, raw);
    if (error) errors[key] = error;
  });

  return errors;
}
