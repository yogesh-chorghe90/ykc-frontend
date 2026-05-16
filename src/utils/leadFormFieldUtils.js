/**
 * Helpers for dynamic lead form fields (builder + agent lead form).
 */

/** Map custom field keys to top-level lead payload properties */
export const LEAD_FIELD_KEY_TO_PAYLOAD = {
  asm_email: 'asmEmail',
  asmemail: 'asmEmail',
  asm_mobile: 'asmMobile',
  asmmobile: 'asmMobile',
  asm_contact: 'asmMobile',
  asm_name: 'asmName',
  asmname: 'asmName',
  sm_bm_email: 'smBmEmail',
  smbm_email: 'smBmEmail',
  smbmemail: 'smBmEmail',
  sm_bm_mobile: 'smBmMobile',
  smbmmobile: 'smBmMobile',
  sm_bm_name: 'smBmName',
  smbm_name: 'smBmName',
  smbmname: 'smBmName',
};

export function suggestFieldKeyFromLabel(label) {
  if (!label?.trim()) return '';
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function enrichFieldsWithCatalog(fields = [], catalog = []) {
  const byKey = new Map((catalog || []).map((d) => [d.key, d]));
  return (fields || []).map((f) => {
    const def = byKey.get(f.key);
    return {
      ...f,
      label: def?.label || f.label || f.key,
      type: f.type || def?.type || 'text',
      required: f.required ?? def?.required ?? false,
      isSearchable: f.isSearchable ?? def?.isSearchable ?? false,
      options: f.options ?? def?.options ?? [],
    };
  });
}

/** Apply agent formValues entries that map to standard lead columns */
export function applyFormValuesToLeadPayload(payload, formValues = {}) {
  if (!formValues || typeof formValues !== 'object') return payload;
  Object.entries(formValues).forEach(([key, raw]) => {
    if (raw === undefined || raw === null || raw === '') return;
    const norm = String(key).trim().toLowerCase();
    const payloadKey = LEAD_FIELD_KEY_TO_PAYLOAD[norm];
    if (payloadKey) {
      payload[payloadKey] = typeof raw === 'string' ? raw.trim() : raw;
    }
  });
  return payload;
}

export function isReservedGenericKey(key) {
  const k = String(key || '').toLowerCase();
  return k === 'email' || k === 'mobile';
}

const SPECIFIC_EMAIL_KEYS = new Set([
  'asm_email', 'asmemail', 'sm_bm_email', 'smbm_email', 'smbmemail', 'applicantemail', 'applicant_email',
]);
const SPECIFIC_MOBILE_KEYS = new Set([
  'asm_mobile', 'asmmobile', 'asm_contact', 'sm_bm_mobile', 'smbm_mobile', 'smbmmobile',
  'applicantmobile', 'applicant_mobile',
]);

/** Hide generic email/mobile when more specific contact fields are on the form */
export function filterRedundantGenericContactFields(fields = []) {
  const list = fields || [];
  const hasSpecificEmail = list.some((f) => SPECIFIC_EMAIL_KEYS.has(String(f.key || '').toLowerCase()));
  const hasSpecificMobile = list.some((f) => SPECIFIC_MOBILE_KEYS.has(String(f.key || '').toLowerCase()));
  return list.filter((f) => {
    const k = String(f.key || '').toLowerCase();
    if (hasSpecificEmail && k === 'email') return false;
    if (hasSpecificMobile && k === 'mobile') return false;
    return true;
  });
}
