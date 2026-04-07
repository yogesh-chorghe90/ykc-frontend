import { useEffect, useMemo, useState } from 'react'

let cachedIpPromise = null
let cachedIpValue = null

const fetchPublicIp = async () => {
  // Avoid repeated IP fetches (React StrictMode can mount twice in dev)
  if (cachedIpValue) return cachedIpValue
  if (!cachedIpPromise) {
    cachedIpPromise = fetch('https://api.ipify.org?format=json', {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`ipify failed: ${res.status}`)
        const data = await res.json()
        if (!data?.ip) throw new Error('ipify did not return an ip')
        cachedIpValue = data.ip
        return cachedIpValue
      })
      .catch((err) => {
        cachedIpPromise = null
        throw err
      })
  }
  return cachedIpPromise
}

const parseAllowedIps = (raw) => {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const IpAccessGate = ({ children }) => {
  const allowedIps = useMemo(
    () => parseAllowedIps(import.meta.env.VITE_ALLOWED_IPS),
    []
  )

  const [state, setState] = useState({
    status: 'checking', // checking | allowed | denied | error
    publicIp: null,
    message: '',
  })

  useEffect(() => {
    const run = async () => {
      // If not configured, allow all (useful for local dev).
      if (!allowedIps.length) {
        setState({ status: 'allowed', publicIp: null, message: '' })
        return
      }

      try {
        const publicIp = await fetchPublicIp()
        const isAllowed = allowedIps.includes(publicIp)

        setState({
          status: isAllowed ? 'allowed' : 'denied',
          publicIp,
          message: isAllowed
            ? ''
            : 'Access denied from this IP address',
        })
      } catch (err) {
        setState({
          status: 'error',
          publicIp: null,
          message: err?.message || 'Could not verify IP',
        })
      }
    }

    run()
  }, [allowedIps])

  if (state.status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-700 font-semibold">Checking access…</p>
        </div>
      </div>
    )
  }

  if (state.status !== 'allowed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-sm text-gray-600 mb-4">
            {state.message || 'Your IP is not allowed to access this app.'}
          </p>
          <div className="text-xs text-gray-500 mb-4">
            {state.publicIp ? `Your IP: ${state.publicIp}` : 'IP not available.'}
          </div>
          {allowedIps.length ? (
            <div className="text-xs text-gray-500">
              Allowed IPs (from `VITE_ALLOWED_IPS`): {allowedIps.join(', ')}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return children
}

export default IpAccessGate

