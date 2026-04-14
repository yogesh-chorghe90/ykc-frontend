/**
 * Use CSS for bulk uppercase presentation (see index.css: form labels, table tbody td).
 * This helper is only for rare one-off display strings if needed.
 */
export function displayUppercase(value) {
  if (value == null || value === '') return value
  return String(value).toUpperCase()
}
