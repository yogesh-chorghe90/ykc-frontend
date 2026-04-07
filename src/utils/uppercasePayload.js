const DEFAULT_SKIP_KEYS = new Set([
  'email',
  'password',
])

function shouldSkipKey(key) {
  if (!key) return false
  const k = String(key).toLowerCase()
  // Keep login/communication identifiers unchanged.
  if (DEFAULT_SKIP_KEYS.has(k)) return true
  // Common variants.
  if (k.includes('email')) return true
  if (k.includes('password')) return true
  return false
}

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val)
}

/**
 * Recursively uppercases all string values in a payload.
 * Skips keys related to email/password and leaves non-strings untouched.
 * Safe with arrays, nested objects, and File/Blob/FormData-like objects.
 */
export function uppercasePayload(value, parentKey = '') {
  if (value == null) return value

  if (typeof value === 'string') {
    return value.toUpperCase()
  }

  if (Array.isArray(value)) {
    return value.map((v) => uppercasePayload(v, parentKey))
  }

  if (isPlainObject(value)) {
    // Avoid mangling special objects (File, Blob, Date, FormData, etc.)
    const proto = Object.getPrototypeOf(value)
    if (proto && proto !== Object.prototype) return value

    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (shouldSkipKey(k)) {
        out[k] = v
      } else {
        out[k] = uppercasePayload(v, k)
      }
    }
    return out
  }

  return value
}

