import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Plus, ChevronDown, ChevronUp, FileDown, Download, FileText } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import PayoutForm from '../components/PayoutForm'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { canExportData } from '../utils/roleUtils'
import { authService } from '../services/auth.service'
import { formatInCrores, formatPayoutStatusLabel } from '../utils/formatUtils'

const Payouts = () => {
  const userRole = authService.getUser()?.role || ''
  const isAdmin = userRole === 'super_admin'
  const isAccountant = userRole === 'accounts_manager'
  const canCreate = isAdmin || isAccountant
  const canEdit = isAdmin || isAccountant
  const canDelete = isAdmin || isAccountant

  const [payouts, setPayouts] = useState([])
  const [leads, setLeads] = useState([])
  const [franchises, setFranchises] = useState([])
  const [agents, setAgents] = useState([])
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedPayout, setSelectedPayout] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, payout: null })
  const [confirmPayoutStatus, setConfirmPayoutStatus] = useState({
    isOpen: false,
    payout: null,
    newStatus: '',
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const getAgentId = (agent) => String(agent?._id || agent?.id || agent || '')
  const getFranchiseId = (franchise) => String(franchise?._id || franchise?.id || franchise || '')
  const getLeadId = (payout) => String(payout?.lead?._id || payout?.lead?.id || payout?.leadId || payout?.lead || '')

  const getLeadForPayout = (payout) => {
    const leadObj = payout?.lead && typeof payout.lead === 'object' ? payout.lead : null
    if (leadObj) return leadObj
    const id = getLeadId(payout)
    if (!id) return null
    return leads.find((l) => String(l._id || l.id) === id) || null
  }

  const getLeadNameForPayout = (payout) => {
    const lead = getLeadForPayout(payout)
    if (!lead) return 'N/A'
    const fv =
      lead?.formValues && typeof lead.formValues === 'object' && !Array.isArray(lead.formValues)
        ? lead.formValues
        : {}
    return (
      lead.customerName ||
      fv.customerName ||
      fv.leadName ||
      fv.name ||
      fv.applicant_name ||
      lead.leadName ||
      lead.loanAccountNo ||
      lead.loanAccountNumber ||
      'N/A'
    )
  }

  const getMappedAgentIdFromLead = (lead) => {
    if (!lead) return ''
    return String(lead?.agent?._id || lead?.agent?.id || lead?.agentId || lead?.agent || '')
  }

  const getMappedAssociatedFromLead = (lead) => {
    if (!lead) return { model: '', id: '' }

    if (lead.associatedModel) {
      const id = String(lead?.associated?._id || lead?.associated?.id || lead?.associated || '')
      return { model: lead.associatedModel, id }
    }

    const agentObj = lead.agent && typeof lead.agent === 'object' ? lead.agent : null
    if (agentObj?.managedByModel && agentObj?.managedBy) {
      const id = String(agentObj.managedBy?._id || agentObj.managedBy?.id || agentObj.managedBy || '')
      return { model: agentObj.managedByModel, id }
    }

    return { model: '', id: '' }
  }

  const getAgentDisplay = (payout) => {
    const lead = getLeadForPayout(payout)
    const agentObjFromLead = lead?.agent && typeof lead.agent === 'object' ? lead.agent : null
    if (agentObjFromLead?.name) return agentObjFromLead.name

    // If a lead exists but doesn't have a mapped agent, show N/A (don't fall back to payout.agent)
    if (lead) {
      const leadAgentId = getMappedAgentIdFromLead(lead)
      if (!leadAgentId) return 'N/A'
      const foundLeadAgent = agents.find((a) => String(a._id || a.id) === String(leadAgentId))
      return foundLeadAgent?.name || foundLeadAgent?.email || 'N/A'
    }

    const payoutAgentObj = payout?.agent && typeof payout.agent === 'object' ? payout.agent : null
    if (payoutAgentObj?.name) return payoutAgentObj.name

    const id = getAgentId(payout?.agent)
    const found = agents.find((a) => String(a._id || a.id) === id)
    return found?.name || found?.email || (id ? id.slice(0, 8) + '...' : 'N/A')
  }

  const getAssociatedDisplay = (payout) => {
    const lead = getLeadForPayout(payout)
    const assoc = getMappedAssociatedFromLead(lead)

    // If a lead exists but has no association mapping, show N/A (don't fall back)
    if (lead && (!assoc?.model || !assoc?.id)) {
      return 'N/A'
    }

    if (assoc.model === 'Franchise') {
      const frObj = lead?.associated && typeof lead.associated === 'object' ? lead.associated : null
      if (frObj?.name) return frObj.name
      const found = franchises.find((f) => String(f._id || f.id) === String(assoc.id))
      return found?.name || (assoc.id ? assoc.id.slice(0, 8) + '...' : 'N/A')
    }

    if (assoc.model === 'RelationshipManager' || assoc.model === 'relationship_manager') {
      const rmObj = lead?.associated && typeof lead.associated === 'object' ? lead.associated : null
      if (rmObj?.name) return rmObj.name
      const found = relationshipManagers.find((r) => String(r._id || r.id) === String(assoc.id))
      return found?.name || (assoc.id ? assoc.id.slice(0, 8) + '...' : 'N/A')
    }

    // fallback: payout's franchise field (legacy)
    return getFranchiseDisplay(payout)
  }

  const getFranchiseDisplay = (payout) => {
    const frObj = payout?.franchise && typeof payout.franchise === 'object' ? payout.franchise : null
    if (frObj?.name) return frObj.name
    const id = getFranchiseId(payout?.franchise)
    const found = franchises.find((f) => String(f._id || f.id) === id)
    return found?.name || (id ? id.slice(0, 8) + '...' : 'N/A')
  }

  const formatDateTime = (d) => {
    if (!d) return 'N/A'
    try {
      return new Date(d).toLocaleString()
    } catch (_) {
      return 'N/A'
    }
  }

  useEffect(() => {
    fetchPayouts()
    fetchLeads()
    fetchFranchises()
    fetchAgents()
    fetchRelationshipManagers()
  }, [])

  const fetchFranchises = async () => {
    try {
      const res = await api.franchises.getAll()
      const data = res?.data || res || []
      setFranchises(Array.isArray(data) ? data : [])
    } catch (_) { setFranchises([]) }
  }

  const fetchAgents = async () => {
    try {
      const res = await api.agents.getAll()
      const data = res?.data || res || []
      setAgents(Array.isArray(data) ? data : [])
    } catch (_) { setAgents([]) }
  }

  const fetchRelationshipManagers = async () => {
    try {
      const res = await api.relationshipManagers.getAll({ limit: 500 })
      const data = res?.data || res || []
      setRelationshipManagers(Array.isArray(data) ? data : [])
    } catch (_) { setRelationshipManagers([]) }
  }

  const fetchPayouts = async () => {
    try {
      setLoading(true)
      const response = await api.payouts.getAll()
      const payoutsData = response.data || response || []
      setPayouts(Array.isArray(payoutsData) ? payoutsData : [])
    } catch (error) {
      console.error('Error fetching payouts:', error)
      toast.error('Error', 'Failed to fetch payouts')
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLeads = async () => {
    try {
      const res = await api.leads.getAll()
      const data = res?.data || res || []
      setLeads(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  const handleCreate = () => {
    setSelectedPayout(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (payout) => {
    setSelectedPayout(payout)
    setIsEditModalOpen(true)
  }

  const handleView = (payout) => {
    setSelectedPayout(payout)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (payload) => {
    try {
      if (selectedPayout) {
        await api.payouts.update(selectedPayout._id || selectedPayout.id, payload)
        toast.success('Success', 'Payout updated successfully')
      } else {
        await api.payouts.create(payload)
        toast.success('Success', 'Payout created successfully')
      }
      await fetchPayouts()
      setIsCreateModalOpen(false)
      setIsEditModalOpen(false)
      setSelectedPayout(null)
    } catch (error) {
      console.error('Error saving payout:', error)
      const serverMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.msg ||
        null
      toast.error('Error', serverMsg || error.message || 'Failed to save payout')
    }
  }

  const handleDeleteClick = (payout) => {
    setConfirmDelete({ isOpen: true, payout })
  }

  const handleDeleteConfirm = async () => {
    const payout = confirmDelete.payout
    const payoutId = payout.id || payout._id
    if (!payoutId) {
      toast.error('Error', 'Payout ID is missing')
      return
    }

    try {
      await api.payouts.delete(payoutId)
      await fetchPayouts()
      toast.success('Success', `Payout "${payout.payoutNumber || 'this payout'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, payout: null })
    } catch (error) {
      console.error('Error deleting payout:', error)
      toast.error('Error', error.message || 'Failed to delete payout')
    }
  }

  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  const handleStatusChange = (payout, newStatus) => {
    const id = payout._id || payout.id
    if (!id) return
    const current = payout.status || 'pending'
    if (newStatus === current) return
    setConfirmPayoutStatus({ isOpen: true, payout, newStatus })
  }

  const handlePayoutStatusConfirm = async () => {
    const { payout, newStatus } = confirmPayoutStatus
    const id = payout?._id || payout?.id
    if (!id) {
      setConfirmPayoutStatus({ isOpen: false, payout: null, newStatus: '' })
      return
    }
    try {
      setUpdatingStatusId(id)
      await api.payouts.update(id, { status: newStatus })
      await fetchPayouts()
      toast.success('Success', 'Payout status updated')
    } catch (error) {
      console.error('Error updating payout status:', error)
      toast.error('Error', error.message || 'Failed to update status')
    } finally {
      setUpdatingStatusId(null)
      setConfirmPayoutStatus({ isOpen: false, payout: null, newStatus: '' })
    }
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  // Filter and sort payouts
  const filteredPayouts = useMemo(() => {
    let filtered = [...payouts]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.payoutNumber?.toLowerCase().includes(term) ||
          getLeadNameForPayout(p).toLowerCase().includes(term) ||
          getAgentDisplay(p).toLowerCase().includes(term) ||
          getAssociatedDisplay(p).toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    if (franchiseFilter) {
      filtered = filtered.filter((p) => {
        const lead = getLeadForPayout(p)
        const assoc = getMappedAssociatedFromLead(lead)
        const assocFranchiseId =
          assoc.model === 'Franchise' ? assoc.id : (p.franchise?._id || p.franchise?.id || p.franchise)
        return String(assocFranchiseId || '') === String(franchiseFilter || '')
      })
    }

    if (agentFilter) {
      filtered = filtered.filter((p) => {
        const lead = getLeadForPayout(p)
        const leadAgentId = getMappedAgentIdFromLead(lead)
        const payoutAgentId = p.agent?._id || p.agent?.id || p.agent
        return String(leadAgentId || payoutAgentId || '') === String(agentFilter || '')
      })
    }

    if (dateFromFilter) {
      filtered = filtered.filter((p) => {
        const date = new Date(p.createdAt)
        return date >= new Date(dateFromFilter)
      })
    }

    if (dateToFilter) {
      filtered = filtered.filter((p) => {
        const date = new Date(p.createdAt)
        const toDate = new Date(dateToFilter)
        toDate.setHours(23, 59, 59, 999)
        return date <= toDate
      })
    }

    // Sort
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key]
        let bVal = b[sortConfig.key]

        if (sortConfig.key === 'lead') {
          aVal = getLeadNameForPayout(a) || ''
          bVal = getLeadNameForPayout(b) || ''
        } else if (sortConfig.key === 'agent') {
          aVal = getAgentDisplay(a) || ''
          bVal = getAgentDisplay(b) || ''
        } else if (sortConfig.key === 'associated') {
          aVal = getAssociatedDisplay(a) || ''
          bVal = getAssociatedDisplay(b) || ''
        } else if (sortConfig.key === 'totalAmount' || sortConfig.key === 'netPayable') {
          aVal = a[sortConfig.key] || 0
          bVal = b[sortConfig.key] || 0
        }

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [payouts, leads, searchTerm, statusFilter, franchiseFilter, agentFilter, dateFromFilter, dateToFilter, sortConfig, agents, franchises, relationshipManagers])

  // Calculate statistics
  const totalPayouts = payouts.length
  const completedStatuses = ['complete', 'payment_received']
  const paidPayouts = payouts.filter((p) => completedStatuses.includes(p.status)).length
  const totalAmount = payouts.reduce((sum, p) => sum + (p.totalAmount || 0), 0)
  const paidAmount = payouts
    .filter((p) => completedStatuses.includes(p.status))
    .reduce((sum, p) => sum + (p.netPayable || 0), 0)
  const pendingAmount = totalAmount - paidAmount

  const payoutStatusDropdownOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'gst_pending', label: 'GST Pending' },
    { value: 'gst_received', label: 'GST received' },
    { value: 'payment_received', label: 'Payment received' },
    { value: 'payment_pending', label: 'Payment Pending' },
    { value: 'recovery_pending', label: 'Recovery Pending' },
    { value: 'recovery_received', label: 'Recovery Received' },
    { value: 'complete', label: 'Complete' },
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    ...payoutStatusDropdownOptions,
  ]

  const hasActiveFilters =
    statusFilter !== 'all' || franchiseFilter || agentFilter || dateFromFilter || dateToFilter

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage bank payments to company</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {canExportData(userRole) && (
            <button
              onClick={() => {
                const rows = filteredPayouts.map((p) => ({
                  payoutNumber: p.payoutNumber || 'N/A',
                  lead: getLeadNameForPayout(p),
                  partner: getAgentDisplay(p),
                  associated: getAssociatedDisplay(p),
                  totalAmount: p.totalAmount || 0,
                  netPayable: p.netPayable || 0,
                  status: p.status || 'N/A',
                  createdAt: p.createdAt || '',
                }))
                exportToExcel(rows, 'payouts')
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          {canCreate && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Add Payout</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{formatInCrores(totalAmount)}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Paid</span>
            <span className="font-bold text-green-600">{formatInCrores(paidAmount)}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Pending</span>
            <span className="font-bold text-orange-600">{formatInCrores(pendingAmount)}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payouts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalPayouts}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid Payouts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{paidPayouts}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatInCrores(totalAmount)}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <IndianRupeeIcon className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatInCrores(paidAmount)}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <IndianRupeeIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Payout number, lead, partner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
                <select
                  value={franchiseFilter}
                  onChange={(e) => setFranchiseFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Franchises</option>
                  {franchises.map((f) => (
                    <option key={f._id || f.id} value={f._id || f.id}>
                      {f.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Agents</option>
                  {agents.map((a) => (
                    <option key={a._id || a.id} value={a._id || a.id}>
                      {a.name || a.email || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payouts Table - First on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('payoutNumber')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="hidden sm:inline">Payout Number</span>
                    <span className="sm:hidden">Payout</span>
                    {getSortIcon('payoutNumber')}
                  </div>
                </th>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('lead')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    Lead
                    {getSortIcon('lead')}
                  </div>
                </th>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('agent')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    Partner
                    {getSortIcon('agent')}
                  </div>
                </th>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('associated')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    Associated
                    {getSortIcon('associated')}
                  </div>
                </th>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('totalAmount')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="hidden md:inline">Total Amount</span>
                    <span className="md:hidden">Total</span>
                    {getSortIcon('totalAmount')}
                  </div>
                </th>
                <th
                  className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('netPayable')}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="hidden md:inline">Net Payable</span>
                    <span className="md:hidden">Net</span>
                    {getSortIcon('netPayable')}
                  </div>
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
                  Receipt
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-3 sm:px-6 py-8 text-center text-gray-500 text-sm">
                    No payouts found
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((payout) => (
                  <tr key={payout._id || payout.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{payout.payoutNumber}</div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">{getLeadNameForPayout(payout)}</div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">{getAgentDisplay(payout)}</div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">{getAssociatedDisplay(payout)}</div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {formatInCrores(payout.totalAmount || 0)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {formatInCrores(payout.netPayable || 0)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                      {canEdit ? (
                        <select
                          value={payout.status || 'pending'}
                          onChange={(e) => handleStatusChange(payout, e.target.value)}
                          disabled={updatingStatusId === (payout._id || payout.id)}
                          className="block w-full min-w-[140px] max-w-[180px] px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {payoutStatusDropdownOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={payout.status} />
                      )}
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      {payout.bankPaymentReceipt?.url ? (
                        <a
                          href={payout.bankPaymentReceipt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-900 hover:text-primary-800 flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-xs sm:text-sm">View</span>
                        </a>
                      ) : (
                        <span className="text-xs sm:text-sm text-gray-400">No receipt</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => handleView(payout)}
                          className="text-primary-900 hover:text-primary-800 p-1 sm:p-1.5"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(payout)}
                            className="text-gray-600 hover:text-gray-900 p-1 sm:p-1.5"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(payout)}
                            className="text-red-600 hover:text-red-900 p-1 sm:p-1.5"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Payout"
      >
        <PayoutForm
          onSave={handleSave}
          onClose={() => setIsCreateModalOpen(false)}
          leads={leads}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedPayout(null)
        }}
        title="Edit Payout"
      >
        <PayoutForm
          payout={selectedPayout}
          onSave={handleSave}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedPayout(null)
          }}
          leads={leads}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedPayout(null)
        }}
        title="Payout Details"
        size="md"
      >
        {selectedPayout && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Payout Number</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPayout.payoutNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedPayout.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Partner</label>
                <p className="mt-1 text-sm text-gray-900">{getAgentDisplay(selectedPayout)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedPayout.agent?.email || selectedPayout.agent?.mobile || ''}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Franchise</label>
                <p className="mt-1 text-sm text-gray-900">{getFranchiseDisplay(selectedPayout)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Amount</label>
                <p className="mt-1 text-sm font-bold text-gray-900">{formatInCrores(selectedPayout.totalAmount || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Net Payable</label>
                <p className="mt-1 text-sm font-bold text-gray-900">{formatInCrores(selectedPayout.netPayable || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">TDS Amount</label>
                <p className="mt-1 text-sm text-gray-900">{formatInCrores(selectedPayout.tdsAmount || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="mt-1 text-sm text-gray-900">{formatDateTime(selectedPayout.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Updated</label>
                <p className="mt-1 text-sm text-gray-900">{formatDateTime(selectedPayout.updatedAt)}</p>
              </div>
              {selectedPayout.bankPaymentReceipt?.url && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Bank Payment Receipt</label>
                  <div className="mt-1">
                    <a
                      href={selectedPayout.bankPaymentReceipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-900 hover:text-primary-800 flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">{selectedPayout.bankPaymentReceipt.filename || 'View Receipt'}</span>
                    </a>
                  </div>
                </div>
              )}
              {selectedPayout.bankDetails && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Bank Details (at payout time)</label>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Account Holder:</span> {selectedPayout.bankDetails.accountHolderName || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Account No:</span> {selectedPayout.bankDetails.accountNumber || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">IFSC:</span> {selectedPayout.bankDetails.ifsc || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Bank:</span> {selectedPayout.bankDetails.bankName || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
              {Array.isArray(selectedPayout.invoices) && selectedPayout.invoices.length > 0 && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Invoices</label>
                  <div className="mt-2 space-y-2">
                    {selectedPayout.invoices.map((inv, idx) => {
                      const obj = inv && typeof inv === 'object' ? inv : null
                      const key = obj?._id || obj?.id || inv || idx
                      return (
                        <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {obj?.invoiceNumber || obj?._id || obj?.id || String(inv)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {obj?.status ? `Status: ${obj.status}` : ''}{obj?.invoiceType ? ` • Type: ${obj.invoiceType}` : ''}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 ml-4 whitespace-nowrap">
                            {formatInCrores(obj?.commissionAmount || obj?.netPayable || obj?.amount || 0)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedPayout.paymentConfirmation && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Payment Confirmation</label>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Transaction ID:</span> {selectedPayout.paymentConfirmation.transactionId || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Method:</span> {selectedPayout.paymentConfirmation.paymentMethod || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Transaction Date:</span> {selectedPayout.paymentConfirmation.transactionDate ? new Date(selectedPayout.paymentConfirmation.transactionDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Confirmed At:</span> {formatDateTime(selectedPayout.paymentConfirmation.confirmedAt)}
                    </div>
                    {selectedPayout.paymentConfirmation.uploadedFile && (
                      <div className="col-span-2 text-sm">
                        <span className="text-gray-500">Uploaded File:</span> {selectedPayout.paymentConfirmation.uploadedFile}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedPayout.bankCsvFile?.path && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Bank CSV File</label>
                  <div className="mt-1">
                    <a
                      href={selectedPayout.bankCsvFile.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-900 hover:text-primary-800 flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">{selectedPayout.bankCsvFile.filename || 'Download CSV'}</span>
                    </a>
                    <div className="text-xs text-gray-500 mt-1">
                      Generated: {formatDateTime(selectedPayout.bankCsvFile.generatedAt)}
                    </div>
                  </div>
                </div>
              )}
              {selectedPayout.remarks && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Remarks</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPayout.remarks}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, payout: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Payout"
        message={`Are you sure you want to delete payout "${confirmDelete.payout?.payoutNumber || 'this payout'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmModal
        isOpen={confirmPayoutStatus.isOpen}
        onClose={() => setConfirmPayoutStatus({ isOpen: false, payout: null, newStatus: '' })}
        onConfirm={handlePayoutStatusConfirm}
        title="Change payout status?"
        message={`Are you sure you want to change the status from ${formatPayoutStatusLabel(confirmPayoutStatus.payout?.status || 'pending')} to ${formatPayoutStatusLabel(confirmPayoutStatus.newStatus)}?`}
        confirmText="Change status"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  )
}

export default Payouts

