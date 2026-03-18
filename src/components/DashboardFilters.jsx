import { useState, useEffect } from 'react'
import { Filter, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import api from '../services/api'

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

const LEAD_STATUSES = [
  { value: '', label: 'All' },
  { value: 'logged', label: 'Logged' },
  { value: 'sanctioned', label: 'Sanctioned' },
  { value: 'partial_disbursed', label: 'Partial Disbursed' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'active', label: 'Active' },
]

const INVOICE_STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'paid', label: 'Paid' },
]

const PAYOUT_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'recovery', label: 'Recovery' },
]

function toYMD(d) {
  if (!d) return ''
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getPresetRange(presetId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  switch (presetId) {
    case 'today':
      return { dateFrom: toYMD(today), dateTo: toYMD(today) }
    case 'last7': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { dateFrom: toYMD(start), dateTo: toYMD(today) }
    }
    case 'last30': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { dateFrom: toYMD(start), dateTo: toYMD(today) }
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { dateFrom: toYMD(start), dateTo: toYMD(today) }
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { dateFrom: toYMD(start), dateTo: toYMD(last) }
    }
    default:
      return {}
  }
}

export default function DashboardFilters({ filters = {}, onApply, onReset, role }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(() => ({ ...filters }))
  const [datePreset, setDatePreset] = useState('')
  const [franchises, setFranchises] = useState([])
  const [agents, setAgents] = useState([])
  const [banks, setBanks] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // Relationship managers should not see franchise list (server disallows it)
  const showFranchise = role === 'super_admin' || role === 'regional_manager' || role === 'accounts_manager'
  const showAgent = showFranchise || role === 'franchise'
  const showBank = true

  useEffect(() => {
    setLocal((prev) => ({ ...prev, ...filters }))
  }, [filters])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingOptions(true)
      try {
        if (showFranchise) {
          const res = await api.franchises.getAll({ limit: 500 })
          setFranchises(Array.isArray(res?.data) ? res.data : res?.franchises || [])
        }
        if (showAgent) {
          const res = await api.agents.getAll({ limit: 500 })
          setAgents(Array.isArray(res?.data) ? res.data : res?.agents || [])
        }
        const bankRes = await api.banks.getAll({ limit: 500 })
        setBanks(Array.isArray(bankRes?.data) ? bankRes.data : bankRes?.banks || [])
      } catch (_) {
        setFranchises([])
        setAgents([])
        setBanks([])
      } finally {
        setLoadingOptions(false)
      }
    }
    load()
  }, [open, showFranchise, showAgent])

  const handlePreset = (presetId) => {
    setDatePreset(presetId)
    if (presetId === 'custom') {
      setLocal((prev) => ({ ...prev, dateFrom: '', dateTo: '' }))
      return
    }
    const range = getPresetRange(presetId)
    setLocal((prev) => ({ ...prev, ...range }))
  }

  const handleChange = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value || undefined }))
    if (key === 'dateFrom' || key === 'dateTo') setDatePreset('custom')
  }

  const handleApply = () => {
    const out = { ...local }
    if (!out.dateFrom) delete out.dateFrom
    if (!out.dateTo) delete out.dateTo
    if (!out.franchiseId) delete out.franchiseId
    if (!out.agentId) delete out.agentId
    if (!out.bankId) delete out.bankId
    if (!out.codeUse) delete out.codeUse
    if (!out.leadStatus) delete out.leadStatus
    if (!out.invoiceStatus) delete out.invoiceStatus
    if (!out.payoutStatus) delete out.payoutStatus
    if (!out.limit) delete out.limit
    onApply(out)
  }

  const handleReset = () => {
    setDatePreset('')
    setLocal({})
    onReset()
  }

  const hasActiveFilters = Object.keys(filters).some(
    (k) => filters[k] !== undefined && filters[k] !== null && filters[k] !== ''
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-gray-900">
          <Filter className="w-5 h-5 text-gray-500" />
          Dashboard filters
          {hasActiveFilters && (
            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date range</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${datePreset === p.id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={local.dateFrom || ''}
                  onChange={(e) => handleChange('dateFrom', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={local.dateTo || ''}
                onChange={(e) => handleChange('dateTo', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {showFranchise && (
              <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                <select
                  value={local.franchiseId || ''}
                  onChange={(e) => handleChange('franchiseId', e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                  disabled={loadingOptions}
                >
              <option value="">All franchises</option>
                  {franchises.map((f) => (
                    <option key={f._id || f.id} value={f._id || f.id}>
                      {f.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showAgent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
                <select
                  value={local.agentId || ''}
                  onChange={(e) => handleChange('agentId', e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                  disabled={loadingOptions}
                >
                  <option value="">All partners</option>
                  {agents.map((a) => (
                    <option key={a._id || a.id} value={a._id || a.id}>
                      {a.name || a.email || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showBank && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <select
                  value={local.bankId || ''}
                  onChange={(e) => handleChange('bankId', e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                  disabled={loadingOptions}
                >
                  <option value="">All banks</option>
                  {banks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DSA Code</label>
              <input
                type="text"
                placeholder="Filter by DSA code..."
                value={local.codeUse || ''}
                onChange={(e) => handleChange('codeUse', e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer status</label>
              <select
                value={local.leadStatus || ''}
                onChange={(e) => handleChange('leadStatus', e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
              >
                {LEAD_STATUSES.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice status</label>
              <select
                value={local.invoiceStatus || ''}
                onChange={(e) => handleChange('invoiceStatus', e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
              >
                {INVOICE_STATUSES.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payout status</label>
              <select
                value={local.payoutStatus || ''}
                onChange={(e) => handleChange('payoutStatus', e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
              >
                {PAYOUT_STATUSES.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">List size (recent items)</label>
              <select
                value={local.limit || ''}
                onChange={(e) => handleChange('limit', e.target.value ? Number(e.target.value) : '')}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white w-24"
              >
                <option value="">10</option>
                <option value="5">5</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
