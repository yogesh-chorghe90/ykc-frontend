import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, Users, ChevronDown, ChevronUp, UserCheck } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import AgentForm from '../components/AgentForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'

const Agents = () => {
  const [agents, setAgents] = useState([])
  const [franchises, setFranchises] = useState([])
  const [leads, setLeads] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const userRole = authService.getUser()?.role
  const hideAssociated = userRole === 'relationship_manager' || userRole === 'franchise'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [selectedAgentDocuments, setSelectedAgentDocuments] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, agent: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchAgents()
    // Don't request franchises for relationship managers (they are not allowed to view franchises)
    const role = authService.getUser()?.role
    if (role !== 'relationship_manager') {
      fetchFranchises()
    }
    fetchLeads()
    fetchInvoices()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const response = await api.agents.getAll()
      const agentsData = response.data || response || []
      console.log('🔍 DEBUG: Fetched agents count:', Array.isArray(agentsData) ? agentsData.length : 'unknown')
      if (Array.isArray(agentsData) && agentsData.length > 0) {
        console.log('🔍 DEBUG: Sample agent:', agentsData[0])
      }
      setAgents(Array.isArray(agentsData) ? agentsData : [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll()
      const franchisesData = response.data || response || []
      console.log('🔍 DEBUG: Fetched franchises count:', Array.isArray(franchisesData) ? franchisesData.length : 'unknown')
      if (Array.isArray(franchisesData) && franchisesData.length > 0) {
        console.log('🔍 DEBUG: Sample franchise:', franchisesData[0])
      }
      setFranchises(Array.isArray(franchisesData) ? franchisesData : [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    }
  }

  const fetchLeads = async () => {
    try {
      // Fetch all leads with a high limit to get accurate statistics
      const response = await api.leads.getAll({ limit: 10000, page: 1 })
      let leadsData = []
      if (Array.isArray(response)) {
        leadsData = response
      } else if (response && Array.isArray(response.data)) {
        leadsData = response.data
      }
      console.log('🔍 DEBUG: Fetched leads:', leadsData.length)
      console.log('🔍 DEBUG: Sample lead with agent:', leadsData[0] ? {
        leadId: leadsData[0].id || leadsData[0]._id,
        agent: leadsData[0].agent,
        agentId: leadsData[0].agentId
      } : 'No leads')
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await api.invoices.getAll()
      let invoicesData = []
      if (Array.isArray(response)) {
        invoicesData = response
      } else if (response && Array.isArray(response.data)) {
        invoicesData = response.data
      }
      setInvoices(invoicesData)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    }
  }

  // Calculate lead statistics for each agent
  const getAgentLeadStats = (agentId) => {
    if (!agentId) {
      console.log('⚠️ getAgentLeadStats: No agentId provided')
      return { total: 0, active: 0, completed: 0, commission: 0, totalAmount: 0 }
    }

    console.log('🔍 DEBUG: getAgentLeadStats called for agentId:', agentId)
    console.log('🔍 DEBUG: Total leads available:', leads?.length || 0)
    console.log('🔍 DEBUG: Total invoices available:', invoices?.length || 0)

    // Calculate leads statistics
    const agentLeads = leads && leads.length > 0 ? leads.filter(lead => {
      const leadAgentId = lead.agent?._id || lead.agent?.id || lead.agent || lead.agentId
      const matches = leadAgentId === agentId || leadAgentId?.toString() === agentId?.toString()

      // Debug first few leads
      if (leads.indexOf(lead) < 3) {
        console.log('🔍 DEBUG: Lead agent check:', {
          leadId: lead.id || lead._id,
          leadAgentId,
          agentId,
          matches,
          leadAgentType: typeof leadAgentId,
          agentIdType: typeof agentId
        })
      }

      return matches
    }) : []

    console.log('🔍 DEBUG: Agent leads found:', agentLeads.length)

    const total = agentLeads.length
    // Active leads are all leads that are not completed or rejected
    const active = agentLeads.filter(lead => {
      const status = lead.status
      return status && status !== 'completed' && status !== 'rejected'
    }).length
    const completed = agentLeads.filter(lead => lead.status === 'completed').length

    // Calculate commission from invoices (more accurate)
    const agentInvoices = invoices && invoices.length > 0 ? invoices.filter(invoice => {
      const invoiceAgentId = invoice.agent?._id || invoice.agent?.id || invoice.agent || invoice.agentId
      return invoiceAgentId === agentId || invoiceAgentId?.toString() === agentId?.toString()
    }) : []

    console.log('🔍 DEBUG: Agent invoices found:', agentInvoices.length)

    const commission = agentInvoices.reduce((sum, invoice) => {
      return sum + (invoice.commissionAmount || invoice.netPayable || invoice.amount || 0)
    }, 0)

    // Calculate total amount from all leads
    const totalAmount = agentLeads.reduce((sum, lead) => {
      return sum + (lead.loanAmount || 0)
    }, 0)

    console.log('🔍 DEBUG: Final stats:', { total, active, completed, commission, totalAmount })

    return { total, active, completed, commission, totalAmount }
  }

  // Calculate statistics
  const totalAgents = agents.length
  const activeAgents = agents.filter(a => a.status === 'active').length
  const totalCommission = agents.reduce((sum, agent) => {
    const stats = getAgentLeadStats(agent.id || agent._id)
    return sum + stats.commission
  }, 0)
  const totalLeads = leads.length
  const totalLeadsCount = totalLeads
  const avgCommission = totalAgents > 0 ? Math.round(totalCommission / totalAgents) : 0

  // Filter and search agents
  const filteredAgents = useMemo(() => {
    if (!agents || agents.length === 0) return []

    return agents.filter((agent) => {
      if (!agent) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (agent.name && agent.name.toLowerCase().includes(searchLower)) ||
        (agent.email && agent.email.toLowerCase().includes(searchLower)) ||
        (agent.mobile && agent.mobile.toString().includes(searchTerm)) ||
        (agent.phone && agent.phone.toString().includes(searchTerm))
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
      const agentFranchiseId = agent.managedByModel === 'Franchise'
        ? (agent.managedBy?._id || agent.managedBy?.id || agent.managedBy)
        : (agent.franchise?._id || agent.franchise?.id || agent.franchise)
      const matchesFranchise = !franchiseFilter || (agentFranchiseId && (agentFranchiseId === franchiseFilter || agentFranchiseId.toString() === franchiseFilter))
      return matchesSearch && matchesStatus && matchesFranchise
    })
  }, [agents, searchTerm, statusFilter, franchiseFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== ''
  const clearAllFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
  }

  // Sort agents
  const sortedAgents = useMemo(() => {
    if (!sortConfig.key) return filteredAgents

    return [...filteredAgents].sort((a, b) => {
      if (!a || !b) return 0

      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

      // Handle calculated fields that need stats
      const calculatedFields = ['totalLeads', 'activeLeads', 'completedLoans', 'commission', 'totalAmount']
      if (calculatedFields.includes(sortConfig.key)) {
        const aStats = getAgentLeadStats(a.id || a._id)
        const bStats = getAgentLeadStats(b.id || b._id)
        
        if (sortConfig.key === 'totalLeads') {
          aValue = aStats.total
          bValue = bStats.total
        } else if (sortConfig.key === 'activeLeads') {
          aValue = aStats.active
          bValue = bStats.active
        } else if (sortConfig.key === 'completedLoans') {
          aValue = aStats.completed
          bValue = bStats.completed
        } else if (sortConfig.key === 'commission') {
          aValue = aStats.commission
          bValue = bStats.commission
        } else if (sortConfig.key === 'totalAmount') {
          aValue = aStats.totalAmount
          bValue = bStats.totalAmount
        }
      }

      // Handle null/undefined values
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [filteredAgents, sortConfig, leads, invoices])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  const handleCreate = () => {
    setSelectedAgent(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (agent) => {
    setSelectedAgent(agent)
    setIsEditModalOpen(true)
  }

  const handleView = (agent) => {
    setSelectedAgent(agent)
    setIsDetailModalOpen(true)
  }

  // Fetch documents for selected agent when detail modal opens
  useEffect(() => {
    const fetchAgentDocuments = async () => {
      if (!selectedAgent || !isDetailModalOpen) return
      const agentId = selectedAgent._id || selectedAgent.id
      if (!agentId) {
        setSelectedAgentDocuments([])
        return
      }
      try {
        const resp = await api.documents.list('user', agentId)
        // Controller returns { success, data, pagination }
        const docs = (resp && resp.data) || resp || []
        setSelectedAgentDocuments(Array.isArray(docs) ? docs : [])
      } catch (err) {
        console.error('Error fetching agent documents:', err)
        setSelectedAgentDocuments([])
      }
    }

    fetchAgentDocuments()
  }, [selectedAgent, isDetailModalOpen])

  const handleSave = async (formData, files = {}) => {
    setIsSaving(true)
    try {
      if (selectedAgent) {
        // Update existing agent
        const agentId = selectedAgent.id || selectedAgent._id
        if (!agentId) {
          toast.error('Error', 'Partner ID is missing')
          return
        }
        // Map frontend fields to backend fields
        const updateData = {
          name: formData.name,
          email: formData.email,
          mobile: formData.phone || formData.mobile,
          franchise: formData.franchise,
          status: formData.status,
          agentType: formData.agentType || 'normal',
          kyc: formData.kyc || undefined,
          bankDetails: formData.bankDetails || undefined,
        }
        await api.agents.update(agentId, updateData)
        await fetchAgents()
        await fetchLeads() // Refresh leads to update statistics
        await fetchInvoices() // Refresh invoices to update commission
        setIsEditModalOpen(false)
        toast.success('Success', 'Partner updated successfully')
      } else {
        const { phone, ...rest } = formData

        if (!phone || !phone.trim()) {
          toast.error('Error', 'Phone number is required')
          return
        }

        const agentData = {
          name: rest.name,
          email: rest.email,
          mobile: phone.trim(),
          password: rest.password || 'Agent@123',
          role: 'agent',
          status: rest.status || 'active',
          agentType: rest.agentType || 'normal',
          // New unified API expects managedBy + managedByModel for agents.
          // Fall back to legacy `franchise` if provided.
          managedBy: rest.managedBy || rest.franchise || '',
          managedByModel: rest.managedByModel || (rest.franchise ? 'Franchise' : 'Franchise'),
          kyc: rest.kyc || undefined,
          bankDetails: rest.bankDetails || undefined,
        }

        console.log('🔍 DEBUG: Creating agent with data:', JSON.stringify(agentData, null, 2))

        const response = await api.agents.create(agentData)
        const created = response.data || response
        await fetchAgents()
        await fetchLeads() // Refresh leads to update statistics
        await fetchInvoices() // Refresh invoices to update commission
        // After creating agent, upload pending files (if any)
        const agentId = created._id || created.id || created.data?._id
        try {
          // pendingFiles: { docType: { file, label } }
          const pendingFiles = files.pendingFiles || {}
          for (const [docType, fileObj] of Object.entries(pendingFiles)) {
            const file = fileObj?.file
            const label = fileObj?.label
            if (file) {
              const fd = new FormData()
              fd.append('file', file)
              fd.append('entityType', 'user')
              fd.append('entityId', agentId)
              fd.append('documentType', docType)
              if (label) fd.append('label', label)
              await api.documents.upload(fd)
            }
          }
          // additionalDocuments array (each item may have file and label)
          const additional = files.additionalDocuments || []
          for (const ad of additional) {
            const file = ad?.file
            const label = ad?.label
            if (file) {
              const fd = new FormData()
              fd.append('file', file)
              fd.append('entityType', 'user')
              fd.append('entityId', agentId)
              fd.append('documentType', 'additional')
              if (label) fd.append('label', label)
              await api.documents.upload(fd)
            }
          }
        } catch (err) {
          console.error('Error uploading pending files for new agent:', err)
        }

        setIsCreateModalOpen(false)
        toast.success('Success', 'Partner created successfully')
      }
      setSelectedAgent(null)
    } catch (error) {
      console.error('Error saving agent:', error)
      toast.error('Error', error.message || 'Failed to save agent')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (agent) => {
    setConfirmDelete({ isOpen: true, agent })
  }

  const handleDeleteConfirm = async () => {
    const agent = confirmDelete.agent
    const agentId = agent.id || agent._id
    if (!agentId) {
      toast.error('Error', 'Partner ID is missing')
      return
    }

    try {
      await api.agents.delete(agentId)
      await fetchAgents()
      toast.success('Success', `Partner "${agent.name || 'this partner'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, agent: null })
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast.error('Error', error.message || 'Failed to delete agent')
    }
  }

  const getFranchiseName = (franchiseId) => {
    if (!franchiseId) return 'N/A'
    const franchise = franchises.find((f) => (f.id || f._id) === franchiseId || (f.id || f._id)?.toString() === franchiseId?.toString())
    return franchise ? (franchise.name || 'N/A') : 'N/A'
  }

  // Return the associated name for an agent (either Franchise or Relationship Manager)
  const getAssociatedName = (agent) => {
    if (!agent) return 'N/A'
    // If agent has managedBy populated
    if (agent.managedByModel === 'RelationshipManager') {
      return agent.managedBy?.name || 'N/A'
    }
    if (agent.managedByModel === 'Franchise') {
      return agent.managedBy?.name || getFranchiseName(agent.franchise || (agent.managedBy?._id || agent.managedBy?.id)) || 'N/A'
    }

    // Fallbacks when managedByModel is missing or unspecified:
    // 1. If managedBy is populated (object), prefer its name
    if (agent.managedBy && typeof agent.managedBy === 'object' && agent.managedBy.name) {
      return agent.managedBy.name
    }
    // 2. If franchise field exists, prefer franchise name
    if (agent.franchise && (agent.franchise.name || agent.franchise._id || agent.franchise.id)) {
      return agent.franchise?.name || getFranchiseName(agent.franchise)
    }
    // 3. If managedBy is an ID string, try resolving via franchises list
    const managedById = agent.managedBy?._id || agent.managedBy?.id || agent.managedBy
    if (managedById) {
      const resolved = getFranchiseName(managedById)
      if (resolved && resolved !== 'N/A') return resolved
    }

    // Legacy fallback
    return 'N/A'
  }

  const getAgentLeads = (agentId) => {
    if (!agentId || !leads || leads.length === 0) return []
    return leads.filter(lead => {
      const leadAgentId = lead.agent?._id || lead.agent?.id || lead.agent || lead.agentId
      return leadAgentId === agentId || leadAgentId?.toString() === agentId?.toString()
    })
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage agent profiles and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Partner</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{totalAgents}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeAgents}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Leads</span>
            <span className="font-bold text-orange-600">{totalLeadsCount}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Partners"
          value={totalAgents}
          icon={UserCheck}
          color="blue"
        />
        <StatCard
          title="Active Partners"
          value={activeAgents}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Total Leads"
          value={totalLeadsCount}
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Avg. Commission"
          value={`₹${avgCommission.toLocaleString()}`}
          icon={IndianRupeeIcon}
          color="green"
        />
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
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, email, or phone..."
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
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {!hideAssociated && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                  <select
                    value={franchiseFilter}
                    onChange={(e) => setFranchiseFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
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
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  Clear all filters
                </button>
                <span className="text-sm text-gray-500">
                  Showing {filteredAgents.length} of {agents.length} partners
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                {!hideAssociated && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Associated
                  </th>
                )}
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalLeads')}
                >
                  <div className="flex items-center gap-2">
                    Total Leads
                    {getSortIcon('totalLeads')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('activeLeads')}
                >
                  <div className="flex items-center gap-2">
                    Active Leads
                    {getSortIcon('activeLeads')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('completedLoans')}
                >
                  <div className="flex items-center gap-2">
                    Completed
                    {getSortIcon('completedLoans')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('commission')}
                >
                  <div className="flex items-center gap-2">
                    Commission
                    {getSortIcon('commission')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalAmount')}
                >
                  <div className="flex items-center gap-2">
                    Total Amount
                    {getSortIcon('totalAmount')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('status')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={hideAssociated ? "9" : "10"} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedAgents.length === 0 ? (
                <tr>
                  <td colSpan={hideAssociated ? "9" : "10"} className="px-6 py-8 text-center text-gray-500">
                    No agents found
                  </td>
                </tr>
              ) : (
                sortedAgents.map((agent, index) => {
                  const agentId = agent.id || agent._id
                  const leadStats = getAgentLeadStats(agentId)
                  const franchiseId = agent.managedByModel === 'Franchise'
                    ? (agent.managedBy?._id || agent.managedBy?.id || agent.managedBy)
                    : (agent.franchise?._id || agent.franchise?.id || agent.franchise || agent.franchiseId)

                  return (
                    <tr key={agentId || `agent-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{agent.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{agent.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{agent.mobile || agent.phone || 'N/A'}</div>
                      </td>
                      {!hideAssociated && (
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {getAssociatedName(agent) || 'N/A'}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{leadStats.total}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-900">{leadStats.active}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">{leadStats.completed}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{leadStats.commission.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{leadStats.totalAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(agent)}
                            className="text-primary-900 hover:text-primary-800 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(agent)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(agent)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedAgents.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedAgents.length}</span> of{' '}
              <span className="font-medium">{sortedAgents.length}</span> partners
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Partner"
      >
        <AgentForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} isSaving={isSaving} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedAgent(null)
        }}
        title="Edit Partner"
      >
        <AgentForm agent={selectedAgent} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} isSaving={isSaving} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedAgent(null)
        }}
        title="Partner Details"
        size="md"
      >
        {selectedAgent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.phone || selectedAgent.mobile || 'N/A'}</p>
              </div>
              {!hideAssociated && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Associated</label>
                  <p className="mt-1 text-sm text-gray-900">{getAssociatedName(selectedAgent) || 'N/A'}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedAgent.status} />
                </div>
              </div>
            </div>

            {/* Mapped RM / Franchise */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {selectedAgent.managedByModel === 'RelationshipManager' ? 'Mapped Relationship Manager' : 'Mapped Franchise'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    {selectedAgent.managedByModel === 'RelationshipManager' ? 'RM Name' : 'Franchise Name'}
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-medium">{selectedAgent.managedBy?.name || getAssociatedName(selectedAgent) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedAgent.managedByModel === 'RelationshipManager' ? 'Relationship Manager' : selectedAgent.managedByModel === 'Franchise' ? 'Franchise' : 'N/A'}
                  </p>
                </div>
                {selectedAgent.managedBy?.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {selectedAgent.managedByModel === 'RelationshipManager' ? 'RM Email' : 'Franchise Email'}
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgent.managedBy.email}</p>
                  </div>
                )}
                {selectedAgent.managedBy?.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {selectedAgent.managedByModel === 'RelationshipManager' ? 'RM Phone' : 'Franchise Phone'}
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgent.managedBy.phone}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Partner Type</label>
                  <p className="mt-1 text-sm text-gray-900">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selectedAgent.agentType === 'GST' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                      {selectedAgent.agentType === 'GST' ? 'GST' : 'Normal'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Commission %</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.commissionPercentage ?? 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.createdAt ? new Date(selectedAgent.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Login</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.lastLoginAt ? new Date(selectedAgent.lastLoginAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* KYC details */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">KYC</h4>
              <div className={`grid grid-cols-1 gap-4 ${selectedAgent.agentType === 'GST' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div>
                  <label className="text-sm font-medium text-gray-500">PAN</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.kyc?.pan || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Aadhaar</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.kyc?.aadhaar || 'N/A'}</p>
                </div>
                {selectedAgent.agentType === 'GST' && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">GST</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAgent.kyc?.gst || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bank details */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Bank Account Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Holder</label>
                  <p className="mt-1 text-sm text-gray-900 font-medium">{selectedAgent.bankDetails?.accountHolderName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Number</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono tracking-wide">{selectedAgent.bankDetails?.accountNumber || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Bank Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.bankDetails?.bankName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Branch</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAgent.bankDetails?.branch || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IFSC Code</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono uppercase">{selectedAgent.bankDetails?.ifsc || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h4>
              {(() => {
                const agentId = selectedAgent.id || selectedAgent._id
                console.log('🔍 DEBUG: Calculating stats for agent:', {
                  agentId,
                  agentName: selectedAgent.name,
                  leadsCount: leads?.length || 0,
                  invoicesCount: invoices?.length || 0
                })
                const stats = getAgentLeadStats(agentId)
                console.log('🔍 DEBUG: Calculated stats:', stats)
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Leads</p>
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                      <p className="text-xs text-gray-400 mt-1">From {leads?.length || 0} total leads</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Active Leads</p>
                      <p className="text-lg font-bold text-primary-900">{stats.active}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Completed Loans</p>
                      <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Commission</p>
                      <p className="text-lg font-bold text-gray-900">₹{stats.commission.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-1">From {invoices?.length || 0} total invoices</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedAgent)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Partner
              </button>
            </div>

            {/* Documents preview */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Documents</h4>
              {(selectedAgentDocuments || []).length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded for this agent.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(selectedAgentDocuments || []).map((doc) => {
                    const src = doc.url || `/api/documents/${doc._id}/download`
                    const isImage = doc.mimeType && doc.mimeType.startsWith && doc.mimeType.startsWith('image')
                    return (
                      <div key={doc._id || doc.id} className="border rounded-md p-2 text-center">
                        <div className="text-xs font-medium text-gray-700 mb-1">{doc.documentType || doc.description || (doc.originalFileName || 'Document')}</div>
                        {isImage ? (
                          // eslint-disable-next-line jsx-a11y/img-redundant-alt
                          <img
                            src={src}
                            alt={doc.originalFileName || 'image'}
                            className="mx-auto max-h-28 object-contain cursor-pointer"
                            onClick={() => window.open(src, '_blank')}
                          />
                        ) : (
                          <div className="text-sm text-gray-600">
                            <a href={src} target="_blank" rel="noreferrer" className="underline text-primary-700">{doc.originalFileName || 'View document'}</a>
                          </div>
                        )}
                        {(doc.verificationStatus && doc.verificationStatus !== 'pending') ? (
                          <div
                            className={`mt-2 text-xs font-semibold ${doc.verificationStatus === 'verified'
                              ? 'text-green-600'
                              : doc.verificationStatus === 'rejected'
                                ? 'text-red-600'
                                : 'text-gray-500'
                              }`}
                          >
                            {doc.verificationStatus === 'verified' ? 'Verified' : doc.verificationStatus === 'rejected' ? 'Rejected' : doc.verificationStatus}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, agent: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Partner"
        message={`Are you sure you want to delete agent "${confirmDelete.agent?.name || 'this agent'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Agents
