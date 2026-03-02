import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Store, Users, TrendingUp, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import FranchiseForm from '../components/FranchiseForm'
import AgentForm from '../components/AgentForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const Franchises = () => {
  const [franchises, setFranchises] = useState([])
  const [leads, setLeads] = useState([])
  const [agents, setAgents] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedFranchise, setSelectedFranchise] = useState(null)
  const [franchiseDocs, setFranchiseDocs] = useState([])
  const [loadingFranchiseDocs, setLoadingFranchiseDocs] = useState(false)
  const [isSavingFranchise, setIsSavingFranchise] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, franchise: null })
  const [isCreateAgentModalOpen, setIsCreateAgentModalOpen] = useState(false)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)

  useEffect(() => {
    fetchFranchises()
    fetchLeads()
    fetchAgents()
    fetchInvoices()
  }, [])

  const fetchFranchises = async () => {
    try {
      setLoading(true)
      const response = await api.franchises.getAll()
      const franchisesData = response.data || response || []
      const validFranchises = Array.isArray(franchisesData) ? franchisesData : []
      setFranchises(validFranchises)
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    } finally {
      setLoading(false)
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
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  const fetchAgents = async () => {
    try {
      // Fetch all agents with a high limit to get accurate statistics
      const response = await api.agents.getAll({ limit: 10000, page: 1 })
      const agentsData = response.data || response || []
      setAgents(Array.isArray(agentsData) ? agentsData : [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setAgents([])
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

  const fetchFranchiseDocuments = async (franchiseId) => {
    if (!franchiseId) {
      setFranchiseDocs([])
      return
    }
    try {
      setLoadingFranchiseDocs(true)
      const response = await api.documents.list('franchise', franchiseId, { limit: 100 })
      const docs = response.data || response || []
      setFranchiseDocs(Array.isArray(docs) ? docs : [])
    } catch (error) {
      console.error('Error fetching franchise documents:', error)
      setFranchiseDocs([])
    } finally {
      setLoadingFranchiseDocs(false)
    }
  }

  // Get franchise statistics
  const getFranchiseStats = (franchiseId) => {
    if (!franchiseId) {
      return { agents: 0, leads: 0, revenue: 0 }
    }

    const franchiseIdStr = franchiseId?.toString()

    // Filter agents: agents are associated with franchises via managedBy and managedByModel
    const franchiseAgents = agents.filter(agent => {
      // Exclude sub-agents (those with parentAgent)
      if (agent.parentAgent) return false
      
      // Check if agent is managed by this franchise
      if (agent.managedByModel === 'Franchise') {
        const managedById = agent.managedBy?._id || agent.managedBy?.id || agent.managedBy
        return managedById?.toString() === franchiseIdStr
      }
      
      // Legacy check for direct franchise field
      const agentFranchiseId = agent.franchise?._id || agent.franchise?.id || agent.franchise || agent.franchiseId
      return agentFranchiseId?.toString() === franchiseIdStr
    })

    // Filter leads: leads are associated with franchises via associated and associatedModel
    const franchiseLeads = leads.filter(lead => {
      // Check if lead is associated with this franchise
      if (lead.associatedModel === 'Franchise') {
        const associatedId = lead.associated?._id || lead.associated?.id || lead.associated
        return associatedId?.toString() === franchiseIdStr
      }
      
      // Legacy check for direct franchise field
      const leadFranchiseId = lead.franchise?._id || lead.franchise?.id || lead.franchise || lead.franchiseId
      return leadFranchiseId?.toString() === franchiseIdStr
    })

    // Filter invoices: invoices have a direct franchise field
    const franchiseInvoices = invoices.filter(invoice => {
      const invoiceFranchiseId = invoice.franchise?._id || invoice.franchise?.id || invoice.franchise || invoice.franchiseId
      return invoiceFranchiseId?.toString() === franchiseIdStr
    })

    const revenue = franchiseInvoices.reduce((sum, inv) => {
      return sum + (inv.commissionAmount || inv.netPayable || inv.amount || 0)
    }, 0)

    return {
      agents: franchiseAgents.length,
      leads: franchiseLeads.length,
      revenue: revenue
    }
  }

  // Calculate statistics
  const totalFranchises = franchises.length
  const activeFranchises = franchises.filter(f => f.status === 'active').length
  const allFranchiseStats = franchises.map(f => getFranchiseStats(f.id || f._id))
  const totalRevenue = allFranchiseStats.reduce((sum, stats) => sum + stats.revenue, 0)
  const totalAgentsCount = allFranchiseStats.reduce((sum, stats) => sum + stats.agents, 0)

  // Get franchise statistics (if needed, can be fetched from API)
  // const getFranchiseStats = async (franchiseId) => {
  //   try {
  //     const performance = await api.franchises.getPerformance(franchiseId)
  //     return performance
  //   } catch (error) {
  //     console.error('Error fetching franchise stats:', error)
  //     return { agents: 0, leads: 0, activeLeads: 0 }
  //   }
  // }

  const cityOptions = useMemo(() => {
    const cities = [...new Set(franchises.map(f => f.address?.city).filter(Boolean))].sort()
    return [{ value: '', label: 'All Cities' }, ...cities.map(c => ({ value: c, label: c }))]
  }, [franchises])

  const stateOptions = useMemo(() => {
    const states = [...new Set(franchises.map(f => f.address?.state).filter(Boolean))].sort()
    return [{ value: '', label: 'All States' }, ...states.map(s => ({ value: s, label: s }))]
  }, [franchises])

  // Filter and search franchises
  const filteredFranchises = useMemo(() => {
    if (!franchises || franchises.length === 0) return []

    return franchises.filter((franchise) => {
      if (!franchise) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (franchise.name && franchise.name.toLowerCase().includes(searchLower)) ||
        (franchise.address?.city && franchise.address.city.toLowerCase().includes(searchLower)) ||
        (franchise.address?.state && franchise.address.state.toLowerCase().includes(searchLower)) ||
        (franchise.ownerName && franchise.ownerName.toLowerCase().includes(searchLower)) ||
        (franchise.email && franchise.email.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || franchise.status === statusFilter
      const matchesCity = !cityFilter || (franchise.address?.city || '') === cityFilter
      const matchesState = !stateFilter || (franchise.address?.state || '') === stateFilter
      return matchesSearch && matchesStatus && matchesCity && matchesState
    })
  }, [franchises, searchTerm, statusFilter, cityFilter, stateFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || cityFilter !== '' || stateFilter !== ''
  const clearFranchiseFilters = () => { setSearchTerm(''); setStatusFilter('all'); setCityFilter(''); setStateFilter('') }

  // Sort franchises
  const sortedFranchises = useMemo(() => {
    if (!sortConfig.key) return filteredFranchises

    return [...filteredFranchises].sort((a, b) => {
      if (!a || !b) return 0

      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

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
  }, [filteredFranchises, sortConfig])

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
    setSelectedFranchise(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (franchise) => {
    setSelectedFranchise(franchise)
    setIsEditModalOpen(true)
  }

  const handleView = (franchise) => {
    setSelectedFranchise(franchise)
    setIsDetailModalOpen(true)
  }

  const handleCreateAgentForFranchise = (franchise) => {
    setSelectedFranchise(franchise)
    setIsCreateAgentModalOpen(true)
  }

  const handleCreateAgentSave = async (formData, files = {}) => {
    try {
      setIsCreatingAgent(true)
      const { phone, ...rest } = formData
      const agentData = {
        name: rest.name,
        email: rest.email,
        mobile: phone?.trim() || '',
        password: rest.password || 'Agent@123',
        role: 'agent',
        status: rest.status || 'active',
        agentType: rest.agentType || 'normal',
        managedBy: rest.managedBy || rest.franchise || rest.managedBy || '',
        managedByModel: rest.managedByModel || (rest.franchise ? 'Franchise' : 'Franchise'),
        kyc: rest.kyc || undefined,
        bankDetails: rest.bankDetails || undefined,
      }

      const response = await api.agents.create(agentData)
      const created = response.data || response

      const agentId = created._id || created.id || created.data?._id
      try {
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

      setIsCreateAgentModalOpen(false)
      toast.success('Success', 'Agent created successfully')
      await fetchAgents()
    } catch (error) {
      console.error('Error creating agent:', error)
      toast.error('Error', error.message || 'Failed to create agent')
    } finally {
      setIsCreatingAgent(false)
    }
  }

  useEffect(() => {
    if (isDetailModalOpen && selectedFranchise) {
      const franchiseId = selectedFranchise.id || selectedFranchise._id
      if (franchiseId) fetchFranchiseDocuments(franchiseId)
    } else {
      setFranchiseDocs([])
    }
  }, [isDetailModalOpen, selectedFranchise])

  const handleSave = async (formData, files = {}) => {
    try {
      setIsSavingFranchise(true)
      if (selectedFranchise) {
        // Update existing franchise
        const franchiseId = selectedFranchise.id || selectedFranchise._id
        if (!franchiseId) {
          toast.error('Error', 'Franchise ID is missing')
          return
        }
        const response = await api.franchises.update(franchiseId, formData)
        await fetchFranchises()
        await fetchLeads() // Refresh to update statistics
        await fetchAgents() // Refresh to update statistics
        await fetchInvoices() // Refresh to update statistics
        setIsEditModalOpen(false)
        setSelectedFranchise(null)
        toast.success('Success', 'Franchise updated successfully')
      } else {
        // Create new franchise
        const response = await api.franchises.create(formData)
        const created = response.data || response
        if (response.success || response.data) {
          // After creating, upload pending files (if any)
          const franchiseId = created._id || created.id || created.data?._id
          try {
            const pendingFiles = files.pendingFiles || {}
            for (const [docType, fileObj] of Object.entries(pendingFiles)) {
              const file = fileObj?.file
              const label = fileObj?.label
              if (file) {
                const fd = new FormData()
                fd.append('file', file)
                fd.append('entityType', 'franchise')
                fd.append('entityId', franchiseId)
                fd.append('documentType', docType)
                if (label) fd.append('label', label)
                await api.documents.upload(fd)
              }
            }
            const additional = files.additionalDocuments || []
            for (const ad of additional) {
              const file = ad?.file
              const label = ad?.label
              if (file) {
                const fd = new FormData()
                fd.append('file', file)
                fd.append('entityType', 'franchise')
                fd.append('entityId', franchiseId)
                fd.append('documentType', 'additional')
                if (label) fd.append('label', label)
                await api.documents.upload(fd)
              }
            }
          } catch (err) {
            console.error('Error uploading pending files for new franchise:', err)
          }

          await fetchFranchises()
          await fetchLeads() // Refresh to update statistics
          await fetchAgents() // Refresh to update statistics
          await fetchInvoices() // Refresh to update statistics
          setIsCreateModalOpen(false)
          toast.success('Success', 'Franchise created successfully and saved to database')
        } else {
          throw new Error('Invalid response from server')
        }
      }
    } catch (error) {
      console.error('Error saving franchise:', error)
      // Only show toast if it hasn't been shown already by the API service
      if (!error._toastShown) {
        const errorMessage = error.message || 'Failed to save franchise. Please check your connection and try again.'
        if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('already exists')) {
          toast.error('Email Already Exists', errorMessage)
        } else {
          toast.error('Error', errorMessage)
        }
      }
    } finally {
      setIsSavingFranchise(false)
    }
  }

  const handleDeleteClick = (franchise) => {
    setConfirmDelete({ isOpen: true, franchise })
  }

  const handleDeleteConfirm = async () => {
    const franchise = confirmDelete.franchise
    const franchiseId = franchise.id || franchise._id
    if (!franchiseId) {
      toast.error('Error', 'Franchise ID is missing')
      return
    }

    try {
      await api.franchises.delete(franchiseId)
      await fetchFranchises()
      toast.success('Success', `Franchise "${franchise.name || 'this franchise'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, franchise: null })
    } catch (error) {
      console.error('Error deleting franchise:', error)
      toast.error('Error', error.message || 'Failed to delete franchise')
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Franchises Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage franchise locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedFranchises.map((f) => {
                const stats = getFranchiseStats(f.id || f._id)
                return {
                  Name: f.name || 'N/A',
                  Email: f.email || 'N/A',
                  City: f.address?.city || 'N/A',
                  State: f.address?.state || 'N/A',
                  Agents: stats.agents,
                  Leads: stats.leads,
                  Revenue: stats.revenue,
                  Status: f.status || 'N/A',
                }
              })
              exportToExcel(rows, `franchises_export_${Date.now()}`, 'Franchises')
              toast.success('Export', `Exported ${rows.length} franchises to Excel`)
            }}
            disabled={sortedFranchises.length === 0}
            title="Export currently filtered data to Excel"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Franchise</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{totalFranchises}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeFranchises}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Agents</span>
            <span className="font-bold text-orange-600">{totalAgentsCount}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Franchises"
          value={totalFranchises}
          icon={Store}
          color="blue"
        />
        <StatCard
          title="Active Franchises"
          value={activeFranchises}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Total Agents"
          value={totalAgentsCount}
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${(totalRevenue / 1000).toFixed(0)}K`}
          icon={IndianRupeeIcon}
          color="purple"
        />
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Name, location, owner, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {cityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {stateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearFranchiseFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
                <span className="text-sm text-gray-500">Showing {filteredFranchises.length} of {franchises.length} franchises</span>
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
                    Franchise Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('address.city')}
                >
                  <div className="flex items-center gap-2">
                    Location
                    {getSortIcon('address.city')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalAgents')}
                >
                  <div className="flex items-center gap-2">
                    Agents
                    {getSortIcon('totalAgents')}
                  </div>
                </th>
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
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center gap-2">
                    Revenue
                    {getSortIcon('revenue')}
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
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedFranchises.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No franchises found
                  </td>
                </tr>
              ) : (
                sortedFranchises.map((franchise) => {
                  const franchiseId = franchise.id || franchise._id
                  const stats = getFranchiseStats(franchiseId)

                  return (
                    <tr key={franchiseId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{franchise.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{franchise.address?.city || franchise.location || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{franchise.ownerName || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{stats.agents}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-900">{stats.leads}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{stats.revenue.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={franchise.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(franchise)}
                            className="text-primary-900 hover:text-primary-900 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(franchise)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(franchise)}
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
        {sortedFranchises.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedFranchises.length}</span> of{' '}
              <span className="font-medium">{sortedFranchises.length}</span> franchises
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Franchise"
      >
        <FranchiseForm isSaving={isSavingFranchise} onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedFranchise(null)
        }}
        title="Edit Franchise"
      >
        <FranchiseForm franchise={selectedFranchise} isSaving={isSavingFranchise} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedFranchise(null)
        }}
        title="Franchise Details"
        size="md"
      >
        {selectedFranchise && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Franchise Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.name || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.mobile || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Street</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.address?.street || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.address?.city || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">State</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.address?.state || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Pincode</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.address?.pincode || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedFranchise.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Regional Manager</label>
                <p className="mt-1 text-sm text-gray-900">{selectedFranchise.regionalManager?.name || selectedFranchise.regionalManager || 'N/A'}</p>
              </div>
            </div>

            {/* KYC */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">KYC</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">PAN</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.kyc?.pan || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Aadhaar</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.kyc?.aadhaar || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">GST</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.kyc?.gst || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Bank Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Holder</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.bankDetails?.accountHolderName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Number</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.bankDetails?.accountNumber ? String(selectedFranchise.bankDetails.accountNumber) : 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Bank Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.bankDetails?.bankName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IFSC / Branch</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedFranchise.bankDetails?.ifsc ? `${selectedFranchise.bankDetails.ifsc} ${selectedFranchise.bankDetails.branch ? ` / ${selectedFranchise.bankDetails.branch}` : ''}` : (selectedFranchise.bankDetails?.branch || 'N/A')}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Documents</h4>
              {loadingFranchiseDocs ? (
                <p className="text-sm text-gray-500">Loading documents...</p>
              ) : franchiseDocs.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {franchiseDocs.map((doc) => {
                    const src = doc.url || doc.filePath || doc.fileName
                    const isImage = doc.mimeType && doc.mimeType.startsWith && doc.mimeType.startsWith('image')
                    return (
                      <div key={doc._id || doc.id || doc.fileName} className="w-24">
                        {isImage ? (
                          <a href={src} target="_blank" rel="noreferrer">
                            <img src={src} alt={doc.originalFileName || doc.fileName} className="w-24 h-24 object-cover rounded border" />
                          </a>
                        ) : (
                          <a href={src} target="_blank" rel="noreferrer" className="text-sm text-primary-600 underline">{doc.originalFileName || doc.fileName}</a>
                        )}
                        <p className="text-xs text-gray-500 truncate">{doc.documentType}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Performance Metrics */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h4>
              {(() => {
                const franchiseId = selectedFranchise?.id || selectedFranchise?._id
                const stats = getFranchiseStats(franchiseId)
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Agents</p>
                      <p className="text-lg font-bold text-gray-900">{stats.agents}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Leads</p>
                      <p className="text-lg font-bold text-primary-900">{stats.leads}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500">Total Revenue</p>
                      <p className="text-lg font-bold text-gray-900">
                        ₹{stats.revenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedFranchise)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Franchise
              </button>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleCreateAgentForFranchise(selectedFranchise)
                }}
                className="w-full px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Create Agent
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, franchise: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Franchise"
        message={`Are you sure you want to delete franchise "${confirmDelete.franchise?.name || 'this franchise'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <Modal isOpen={isCreateAgentModalOpen} onClose={() => { setIsCreateAgentModalOpen(false); setSelectedFranchise(null) }} title={`Create Agent${selectedFranchise ? ` for ${selectedFranchise.name}` : ''}`} size="md">
        <AgentForm
          onSave={handleCreateAgentSave}
          onClose={() => { setIsCreateAgentModalOpen(false); setSelectedFranchise(null) }}
          isSaving={isCreatingAgent}
          fixedManagedBy={selectedFranchise ? (selectedFranchise._id || selectedFranchise.id) : null}
          fixedManagedByModel="Franchise"
          hideManagedBySelector={true}
        />
      </Modal>
    </div>
  )
}

export default Franchises
