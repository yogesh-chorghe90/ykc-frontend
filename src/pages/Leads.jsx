import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Copy, Settings2, History, X, FileDown, CheckCircle, FileText, Paperclip, ExternalLink } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import LeadForm from '../components/LeadForm'
import ConfirmModal from '../components/ConfirmModal'
import DisbursementEmailModal from '../components/DisbursementEmailModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { canExportData } from '../utils/roleUtils'
import AccountantLeads from './AccountantLeads'
import { formatInCrores } from '../utils/formatUtils'
import { formatMobileNumber } from '../utils/identifierFormatters'
import { humanizeDocumentType, mergeLeadDocumentsFromApiAndEmbedded } from '../utils/leadDocuments'

const Leads = () => {
  const userRole = authService.getUser()?.role || 'super_admin'
  const isAgent = userRole === 'agent'
  const isAccountant = userRole === 'accounts_manager'
  const canViewHistory = ['super_admin', 'relationship_manager', 'franchise', 'agent'].includes(userRole)
  const canEdit = !isAgent
  const canCreate = true // Agents can create leads
  const canSendDisbursementEmail = userRole !== 'agent' // All roles except agent can send

  // Render AccountantLeads for accountants
  if (isAccountant) {
    return <AccountantLeads />
  }

  const [leads, setLeads] = useState([])
  const [agents, setAgents] = useState([])
  const [subAgents, setSubAgents] = useState([])
  const [banks, setBanks] = useState([])
  const [staff, setStaff] = useState([])
  const [bankManagers, setBankManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [dsaCodeFilter, setDsaCodeFilter] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')
  const [advancePaymentFilter, setAdvancePaymentFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailAttachments, setDetailAttachments] = useState([])
  const [loadingDetailAttachments, setLoadingDetailAttachments] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [leadHistory, setLeadHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryItems, setExpandedHistoryItems] = useState(new Set())
  const [selectedLead, setSelectedLead] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, lead: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [expandedFields, setExpandedFields] = useState({})
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [isDisbursementEmailModalOpen, setIsDisbursementEmailModalOpen] = useState(false)
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null)
  const [editingCommission, setEditingCommission] = useState({ leadId: null, field: null })
  const [commissionEditValues, setCommissionEditValues] = useState({ percentage: '', amount: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)


  // Column configuration with all available fields
  const [columnConfig, setColumnConfig] = useState(() => {
    const saved = localStorage.getItem('leadsColumnConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Remove leadType, contact, caseNumber, verificationStatus and sanctionedAmount columns if they exist in saved config
        const filtered = parsed.filter(col => col.key !== 'leadType' && col.key !== 'contact' && col.key !== 'caseNumber' && col.key !== 'verificationStatus' && col.key !== 'sanctionedAmount')
        
        // Remove ALL commission-related columns to prevent duplicates
        const commissionKeys = [
          'commissionPercentage', 'commissionAmount',
          'agentCommissionPercentage', 'agentCommissionAmount',
          'subAgentCommissionPercentage', 'subAgentCommissionAmount',
          'referralFranchiseCommissionPercentage', 'referralFranchiseCommissionAmount'
        ]
        let updated = filtered.filter(col => !commissionKeys.includes(col.key))
        
        // Always add the new commission columns after remainingAmount (only once)
        const remainingIndex = updated.findIndex(col => col.key === 'remainingAmount')
        if (remainingIndex !== -1) {
          const newCommissionColumns = [
            { key: 'agentCommissionPercentage', label: 'Partner Comm %', visible: true, sortable: true },
            { key: 'agentCommissionAmount', label: 'Partner Comm AMT', visible: true, sortable: true },
            { key: 'subAgentCommissionPercentage', label: 'Sub Partner Comm %', visible: true, sortable: true },
            { key: 'subAgentCommissionAmount', label: 'Sub Partner Comm AMT', visible: true, sortable: true },
            { key: 'commissionPercentage', label: 'Associated Comm %', visible: true, sortable: true },
            { key: 'commissionAmount', label: 'Associated Comm AMT', visible: true, sortable: true },
            { key: 'referralFranchiseCommissionPercentage', label: 'Refer Associated Comm %', visible: true, sortable: true },
            { key: 'referralFranchiseCommissionAmount', label: 'Refer Associated Comm AMT', visible: true, sortable: true },
          ]
          updated.splice(remainingIndex + 1, 0, ...newCommissionColumns)
        }
        
        // Update codeUse label to 'DSA Code' if it exists
        updated = updated.map(col => {
          // Normalize legacy 'franchise' column to 'associated'
          if (col.key === 'franchise') {
            return { ...col, key: 'associated', label: 'Associated' }
          }
          // If label mentions Franchise, rename to Associated (but not for commission columns)
          if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise') && !col.key.includes('Commission')) {
            return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
          }
          if (col.key === 'codeUse') {
            return { ...col, label: 'DSA Code' }
          }
          return col
        })
        
        // Check if subAgent column exists in saved config, if not add it after agent
        const hasSubAgent = updated.some(col => col.key === 'subAgent')
        if (!hasSubAgent) {
          const agentIndex = updated.findIndex(col => col.key === 'agent')
          if (agentIndex !== -1) {
            updated.splice(agentIndex + 1, 0, { key: 'subAgent', label: 'Sub Partner', visible: true, sortable: false })
          } else {
            // If agent not found, add subAgent after status
            const statusIndex = updated.findIndex(col => col.key === 'status')
            if (statusIndex !== -1) {
              updated.splice(statusIndex + 1, 0, { key: 'subAgent', label: 'Sub Partner', visible: true, sortable: false })
            } else {
              // Fallback: add at the end before actions
              const actionsIndex = updated.findIndex(col => col.key === 'actions')
              if (actionsIndex !== -1) {
                updated.splice(actionsIndex, 0, { key: 'subAgent', label: 'Sub Partner', visible: true, sortable: false })
              } else {
                updated.push({ key: 'subAgent', label: 'Sub Partner', visible: true, sortable: false })
              }
            }
          }
        }

        // Ensure Advance Payment column exists in saved config
        const hasAdvancePayment = updated.some(col => col.key === 'advancePayment')
        if (!hasAdvancePayment) {
          const loanAccountNoIndex = updated.findIndex(col => col.key === 'loanAccountNo')
          if (loanAccountNoIndex !== -1) {
            updated.splice(loanAccountNoIndex + 1, 0, { key: 'advancePayment', label: 'Advance Payment', visible: true, sortable: true })
          } else {
            const actionsIndex = updated.findIndex(col => col.key === 'actions')
            if (actionsIndex !== -1) {
              updated.splice(actionsIndex, 0, { key: 'advancePayment', label: 'Advance Payment', visible: true, sortable: true })
            } else {
              updated.push({ key: 'advancePayment', label: 'Advance Payment', visible: true, sortable: true })
            }
          }
        }
        
        // Remove any duplicate columns based on key (keep first occurrence)
        const seenKeys = new Set()
        const deduplicated = updated.filter(col => {
          if (seenKeys.has(col.key)) {
            return false
          }
          seenKeys.add(col.key)
          return true
        })
        
        return deduplicated
      } catch (e) {
        console.error('Error parsing saved column config:', e)
      }
    }
    return [
      { key: 'customerName', label: 'Customer Name', visible: true, sortable: true },
      { key: 'loanType', label: 'Loan Type', visible: true, sortable: true },
      { key: 'loanAmount', label: 'Loan Amount', visible: true, sortable: true },
      { key: 'disbursedAmount', label: 'Disbursed Amount', visible: true, sortable: true },
      { key: 'remainingAmount', label: 'Remaining', visible: true, sortable: true },
      { key: 'agentCommissionPercentage', label: 'Partner Comm %', visible: true, sortable: true },
      { key: 'agentCommissionAmount', label: 'Partner Comm AMT', visible: true, sortable: true },
      { key: 'subAgentCommissionPercentage', label: 'Sub Partner Comm %', visible: true, sortable: true },
      { key: 'subAgentCommissionAmount', label: 'Sub Partner Comm AMT', visible: true, sortable: true },
      { key: 'commissionPercentage', label: 'Associated Comm %', visible: true, sortable: true },
      { key: 'commissionAmount', label: 'Associated Comm AMT', visible: true, sortable: true },
      { key: 'referralFranchiseCommissionPercentage', label: 'Refer Associated Comm %', visible: true, sortable: true },
      { key: 'referralFranchiseCommissionAmount', label: 'Refer Associated Comm AMT', visible: true, sortable: true },
      { key: 'status', label: 'Status', visible: true, sortable: true },
      { key: 'agent', label: 'Partner', visible: true, sortable: false },
      { key: 'subAgent', label: 'Sub Partner', visible: true, sortable: false },
      { key: 'associated', label: 'Associated', visible: true, sortable: false },
      { key: 'referralFranchise', label: 'Referral Associated', visible: true, sortable: false },
      { key: 'bank', label: 'Bank Name', visible: true, sortable: false },
      { key: 'smBm', label: 'SM/BM', visible: true, sortable: false },
      { key: 'asm', label: 'ASM', visible: true, sortable: false },
      { key: 'branch', label: 'Branch', visible: true, sortable: true },
      { key: 'loanAccountNo', label: 'Loan Account No', visible: true, sortable: true },
      { key: 'advancePayment', label: 'Advance Payment', visible: true, sortable: true },
      { key: 'disbursementDate', label: 'Disbursement Date', visible: true, sortable: true },
      { key: 'sanctionedDate', label: 'Sanctioned Date', visible: true, sortable: true },
      { key: 'codeUse', label: 'DSA Code', visible: true, sortable: true },
      { key: 'remarks', label: 'Remarks', visible: false, sortable: false },
      { key: 'createdAt', label: 'Date', visible: true, sortable: true },
      { key: 'actions', label: 'Actions', visible: true, sortable: false },
    ]
  })

  useEffect(() => {
    // Filter out leadType, contact, caseNumber, and verificationStatus columns before saving
    const filteredConfig = columnConfig.filter(col => col.key !== 'leadType' && col.key !== 'contact' && col.key !== 'caseNumber' && col.key !== 'verificationStatus')
    // Normalize any legacy 'franchise' keys and labels, and ensure codeUse label is 'DSA Code'
    const normalized = filteredConfig.map(col => {
      if (col.key === 'franchise') {
        return { ...col, key: 'associated', label: 'Associated' }
      }
      if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise')) {
        return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
      }
      if (col.key === 'codeUse') {
        return { ...col, label: 'DSA Code' }
      }
      return col
    })
    localStorage.setItem('leadsColumnConfig', JSON.stringify(normalized))
  }, [columnConfig])

  useEffect(() => {
    fetchLeads()
    if (!isAgent) {
      fetchAgents()
    }
    // Fetch subAgents for hierarchy users to enable lookup
    if (!isAgent) {
      fetchSubAgents()
    }
    fetchBanks()
    fetchBankManagers()
    fetchStaff()
    // Relationship managers are not allowed to view franchises — don't request franchises for them
    if (userRole !== 'relationship_manager') {
      fetchFranchises()
    }
  }, [isAgent, userRole])

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      const isClickInsideOverlay = target.closest('.absolute.z-50') || target.closest('[data-expandable]')
      if (!isClickInsideOverlay) {
        setExpandedFields({})
      }
      const isClickInsideColumnSettings = target.closest('[data-column-settings]')
      if (!isClickInsideColumnSettings && !target.closest('button[data-column-settings-button]')) {
        setShowColumnSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expandedFields, showColumnSettings])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await api.leads.getAll({ limit: 1000 })
      console.log('🔍 DEBUG: Leads API response:', response)

      // Handle different response structures
      let leadsData = []
      if (Array.isArray(response)) {
        leadsData = response
      } else if (response && Array.isArray(response.data)) {
        leadsData = response.data
      } else if (response && response.data && Array.isArray(response.data)) {
        leadsData = response.data
      } else {
        console.warn('⚠️ Unexpected response structure:', response)
        leadsData = []
      }

      console.log('🔍 DEBUG: Parsed leads data:', leadsData.length, 'leads')
      if (leadsData.length > 0) {
        const sampleLead = leadsData[0]
        const agentIdValue = sampleLead.agentId || (sampleLead.agent && (sampleLead.agent._id || sampleLead.agent.id)) || sampleLead.agent
        const bankIdValue = sampleLead.bankId || (sampleLead.bank && (sampleLead.bank._id || sampleLead.bank.id)) || sampleLead.bank
        
        console.log('🔍 DEBUG: Sample lead data:', {
          leadId: sampleLead.id || sampleLead._id,
          agent: sampleLead.agent,
          agentId: agentIdValue,
          agentType: typeof sampleLead.agent,
          agentName: sampleLead.agent?.name || sampleLead.agentName,
          agentFoundInArray: agentIdValue ? agents.find(a => String(a.id || a._id) === String(agentIdValue))?.name : null,
          subAgent: sampleLead.subAgent,
          subAgentName: sampleLead.subAgentName,
          subAgentType: typeof sampleLead.subAgent,
          subAgentId: sampleLead.subAgent?._id || sampleLead.subAgent?.id || sampleLead.subAgent,
          bank: sampleLead.bank,
          bankId: bankIdValue,
          bankType: typeof sampleLead.bank,
          bankName: sampleLead.bank?.name || sampleLead.bankName,
          bankFoundInArray: bankIdValue ? banks.find(b => String(b.id || b._id) === String(bankIdValue))?.name : null,
          banksArrayLength: banks.length,
          agentsArrayLength: agents.length
        })

        // Commission-focused debug to verify what frontend receives from backend
        const commissionSnapshot = leadsData.slice(0, 10).map((l) => ({
          leadId: l.id || l._id,
          customerName: l.customerName || l.leadName || 'N/A',
          status: l.status,
          commissionPercentage: l.commissionPercentage,
          commissionAmount: l.commissionAmount,
          agentCommissionPercentage: l.agentCommissionPercentage,
          agentCommissionAmount: l.agentCommissionAmount,
          subAgentCommissionPercentage: l.subAgentCommissionPercentage,
          subAgentCommissionAmount: l.subAgentCommissionAmount,
        }))
        console.log('🔍 DEBUG: Leads commission snapshot (from GET /leads):', commissionSnapshot)
      }
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await api.agents.getAll()
      const agentsData = response.data || response || []
      setAgents(Array.isArray(agentsData) ? agentsData : [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setAgents([])
    }
  }

  const fetchSubAgents = async () => {
    try {
      // For hierarchy users, subAgents might be in the agents list (they're agents with parentAgent)
      // The subAgents API might only work for agents, so we'll rely on backend population
      // But we can try to get them from agents if needed
      // For now, we'll rely on the backend populating subAgent in the leads response
      setSubAgents([])
    } catch (error) {
      console.log('SubAgents fetch not needed, using populated data:', error.message)
      setSubAgents([])
    }
  }

  const fetchBanks = async () => {
    try {
      const response = await api.banks.getAll()
      const banksData = response.data || response || []
      setBanks(Array.isArray(banksData) ? banksData : [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      setBanks([])
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await api.staff.getAll()
      const staffData = response.data || response || []
      setStaff(Array.isArray(staffData) ? staffData : [])
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
    }
  }

  const fetchBankManagers = async () => {
    try {
      const response = await api.bankManagers.getAll({ limit: 1000 })
      const bmData = response.data || response || []
      setBankManagers(Array.isArray(bmData) ? bmData : [])
    } catch (error) {
      console.error('Error fetching bank managers:', error)
      setBankManagers([])
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll()
      const franchisesData = response.data || response || []
      setFranchises(Array.isArray(franchisesData) ? franchisesData : [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    }
  }

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    if (!leads || leads.length === 0) return []

    const searchLower = (searchTerm || '').trim().toLowerCase()
    const hasSearch = searchLower.length > 0

    return leads.filter((lead) => {
      if (!lead) return false

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      if (!matchesStatus) return false

      if (franchiseFilter) {
        const fid = lead.associated?._id || lead.associated?.id || lead.associated
        if (!fid || (fid !== franchiseFilter && fid.toString() !== franchiseFilter)) return false
      }
      if (agentFilter) {
        const aid = lead.agent?._id || lead.agent?.id || lead.agent
        if (!aid || (aid !== agentFilter && aid.toString() !== agentFilter)) return false
      }
      if (bankFilter) {
        const bid = lead.bank?._id || lead.bank?.id || lead.bank
        if (!bid || (bid !== bankFilter && bid.toString() !== bankFilter)) return false
      }
      if (dsaCodeFilter.trim()) {
        const code = (lead.dsaCode ?? lead.codeUse ?? '').toString().toLowerCase()
        if (!code.includes(dsaCodeFilter.trim().toLowerCase())) return false
      }
      if (loanTypeFilter && loanTypeFilter !== 'all') {
        const leadType = (lead.loanType ?? '').toString().replace(/_/g, ' ').toLowerCase()
        if (!leadType.includes(loanTypeFilter.trim().toLowerCase())) return false
      }

      // Advance Payment filter
      if (advancePaymentFilter !== '') {
        const isAdvancePayment = advancePaymentFilter === 'yes'
        if (lead.advancePayment !== isAdvancePayment) return false
      }

      // Date range filtering
      if (dateFromFilter || dateToFilter) {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null
        if (!leadDate) return false

        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter)
          fromDate.setHours(0, 0, 0, 0)
          if (leadDate < fromDate) return false
        }

        if (dateToFilter) {
          const toDate = new Date(dateToFilter)
          toDate.setHours(23, 59, 59, 999)
          if (leadDate > toDate) return false
        }
      }

      if (!hasSearch) return true

      const applicantEmail = lead.applicantEmail || lead.email || ''
      const applicantMobile = (lead.applicantMobile || lead.phone || lead.mobile || '').toString()
      const customerName = lead.customerName || ''
      const caseNumber = lead.caseNumber || ''
      const loanAccountNo = (lead.loanAccountNo || '').toString()

      return (
        applicantEmail.toLowerCase().includes(searchLower) ||
        applicantMobile.includes(searchTerm.trim()) ||
        customerName.toLowerCase().includes(searchLower) ||
        caseNumber.toLowerCase().includes(searchLower) ||
        loanAccountNo.toLowerCase().includes(searchLower)
      )
    })
  }, [leads, searchTerm, statusFilter, franchiseFilter, agentFilter, bankFilter, dsaCodeFilter, loanTypeFilter, advancePaymentFilter, dateFromFilter, dateToFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== '' || agentFilter !== '' || bankFilter !== '' || dsaCodeFilter.trim() !== '' || (loanTypeFilter && loanTypeFilter !== 'all') || advancePaymentFilter !== '' || dateFromFilter !== '' || dateToFilter !== ''
  
  // Calculate total loan amount from filtered leads
  const totalFilteredLoanAmount = useMemo(() => {
    return filteredLeads.reduce((sum, lead) => {
      const loanAmount = lead.loanAmount || lead.amount || 0
      return sum + (typeof loanAmount === 'number' ? loanAmount : parseFloat(loanAmount) || 0)
    }, 0)
  }, [filteredLeads])

  const clearLeadsFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
    setAgentFilter('')
    setBankFilter('')
    setDsaCodeFilter('')
    setLoanTypeFilter('all')
    setAdvancePaymentFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!sortConfig.key) return filteredLeads

    return [...filteredLeads].sort((a, b) => {
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
  }, [filteredLeads, sortConfig])

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
    setSelectedLead(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (lead) => {
    setSelectedLead(lead)
    setIsEditModalOpen(true)
  }

  const handleView = async (lead) => {
    setSelectedLead(lead)
    setIsDetailModalOpen(true)
    setDetailAttachments([])
    const leadId = lead?.id || lead?._id
    if (leadId) {
      try {
        setLoadingDetailAttachments(true)
        const res = await api.documents.list('lead', leadId, { limit: 200 })
        const docs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setDetailAttachments(mergeLeadDocumentsFromApiAndEmbedded(docs, lead?.documents))
      } catch (_) {
        setDetailAttachments(mergeLeadDocumentsFromApiAndEmbedded([], lead?.documents))
      } finally {
        setLoadingDetailAttachments(false)
      }
    } else if (lead?.documents?.length) {
      setDetailAttachments(mergeLeadDocumentsFromApiAndEmbedded([], lead.documents))
    }
  }

  const handleViewHistory = async (lead) => {
    setSelectedLead(lead)
    setIsHistoryModalOpen(true)
    setHistoryLoading(true)
    setExpandedHistoryItems(new Set())
    try {
      const response = await api.leads.getHistory(lead.id || lead._id)
      const historyData = response.data || response || []
      setLeadHistory(Array.isArray(historyData) ? historyData : [])
    } catch (error) {
      console.error('Error fetching lead history:', error)
      toast.error('Error', 'Failed to load customer history')
      setLeadHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDisbursementEmail = (lead) => {
    setSelectedLeadForEmail(lead)
    setIsDisbursementEmailModalOpen(true)
  }

  const toggleHistoryItem = (index) => {
    setExpandedHistoryItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const isHistoryItemExpanded = (index) => {
    return expandedHistoryItems.has(index)
  }

  const formatFieldName = (field) => {
    const fieldMap = {
      'agent': 'Agent',
      'associated': 'Associated',
      'bank': 'Bank',
      'smBm': 'SM/BM',
      'applicantMobile': 'Mobile',
      'applicantEmail': 'Email',
      'loanType': 'Loan Type',
      'loanAmount': 'Loan Amount',
      'disbursedAmount': 'Disbursed Amount',
      'status': 'Status',
      'disbursementDate': 'Disbursement Date',
      'sanctionedDate': 'Sanctioned Date',
      'customerName': 'Customer Name',
      'loanAccountNo': 'Loan Account No',
      'branch': 'Branch',
      'codeUse': 'DSA Code',
      'asmName': 'ASM Name',
      'asmEmail': 'ASM Email',
      'asmMobile': 'ASM Mobile',
      'smBmEmail': 'SM/BM Email',
      'smBmMobile': 'SM/BM Mobile',
      'remarks': 'Remarks',
      'commissionPercentage': 'Commission Percentage',
      'commissionBasis': 'Commission Basis',
    }
    return fieldMap[field] || field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  const formatFieldValue = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return new Date(value).toLocaleString()
    }

    // Handle ObjectId references - try to resolve to names
    if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId, try to resolve it
      if (fieldName === 'agent') {
        const agent = agents.find(a => (a._id || a.id) === value)
        return agent ? agent.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'bank') {
        const bank = banks.find(b => (b._id || b.id) === value)
        return bank ? bank.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'associated') {
        const franchise = franchises.find(f => (f._id || f.id) === value)
        return franchise ? franchise.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'smBm') {
        const staffMember = staff.find(s => (s._id || s.id) === value)
        return staffMember ? staffMember.name : value.substring(0, 8) + '...'
      }
      return value.substring(0, 8) + '...'
    }

    // Handle object values (shouldn't happen, but just in case)
    if (typeof value === 'object') {
      if (value.name) return value.name
      if (value._id || value.id) {
        // Try to resolve
        if (fieldName === 'agent') {
          const agent = agents.find(a => (a._id || a.id) === (value._id || value.id))
          return agent ? agent.name : 'Unknown'
        }
        if (fieldName === 'bank') {
          const bank = banks.find(b => (b._id || b.id) === (value._id || value.id))
          return bank ? bank.name : 'Unknown'
        }
        if (fieldName === 'smBm') {
          const staffMember = staff.find(s => (s._id || s.id) === (value._id || value.id))
          return staffMember ? staffMember.name : 'Unknown'
        }
        return 'Unknown'
      }
      return '[Object]'
    }

    return String(value)
  }

  const handleSave = async (formData) => {
    // Prevent double submission
    if (isSubmitting) {
      toast.error('Error', 'Please wait, customer creation is already in progress')
      return
    }

    setIsSubmitting(true)
    try {
      const isNewLead = formData.leadType === 'new_lead';

      // Validate required fields (only fields with red asterisk)
      // Bank not required for new_lead type
      if (!isNewLead && !formData.bankId) {
        toast.error('Error', 'Bank is required')
        return
      }
      // If this is the legacy (predefined) payload (no bank-specific form), require loanType and loanAmount.
      // Skip for new_lead - no bank-specific fields required.
      if (!isNewLead && !formData.leadForm) {
        if (!formData.loanType) {
          toast.error('Error', 'Loan type is required')
          return
        }
        if (!formData.loanAmount || formData.loanAmount <= 0) {
          toast.error('Error', 'Loan amount must be greater than 0')
          return
        }
      }

      const toOptionalNumber = (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? undefined : parsed
      }

      // Map form data to backend API format
      const leadData = {
        leadType: formData.leadType || 'bank',
        caseNumber: formData.caseNumber?.trim() || undefined,
        applicantMobile: formData.applicantMobile?.trim() || undefined,
        applicantEmail: formData.applicantEmail?.trim() || undefined,
        loanType: formData.loanType,
        loanAmount: toOptionalNumber(formData.loanAmount),
        // Only send status when user has it in the form payload.
        // Backend Lead schema has default 'logged' for creates, so omit on updates to avoid accidental overwrite.
        status: formData.status,
        agent: formData.agentId || formData.agent || undefined,
        // Support both shapes: payload may include `associated` (from LeadForm) or `associatedId`
        associated: formData.associated || formData.associatedId || formData.franchiseId || undefined,
        associatedModel: formData.associatedModel || (formData.franchiseId ? 'Franchise' : undefined),
        bank: formData.bankId || formData.bank || undefined,
        // Include subAgent if provided
        subAgent: formData.subAgent || undefined,
        subAgentCommissionPercentage: toOptionalNumber(formData.subAgentCommissionPercentage),
        subAgentCommissionAmount: toOptionalNumber(formData.subAgentCommissionAmount),
        agentCommissionPercentage: toOptionalNumber(formData.agentCommissionPercentage),
        agentCommissionAmount: toOptionalNumber(formData.agentCommissionAmount),
        // Include referral franchise if provided
        referralFranchise: formData.referralFranchise || undefined,
        referralFranchiseCommissionPercentage: toOptionalNumber(formData.referralFranchiseCommissionPercentage),
        referralFranchiseCommissionAmount: toOptionalNumber(formData.referralFranchiseCommissionAmount),
        leadForm: formData.leadForm || undefined,
        formValues: formData.formValues || undefined,
        documents: formData.documents || undefined,
        customerName: formData.customerName?.trim() || undefined,
        sanctionedDate: formData.sanctionedDate || undefined,
        disbursedAmount: toOptionalNumber(formData.disbursedAmount),
        disbursementDate: formData.disbursementDate || undefined,
        disbursementType: formData.disbursementType || undefined,
        loanAccountNo: formData.loanAccountNo?.trim() || undefined,
        // Send commission fields whenever provided; backend enforces role permissions.
        commissionBasis: formData.commissionBasis || undefined,
        commissionPercentage: toOptionalNumber(formData.commissionPercentage),
        commissionAmount: toOptionalNumber(formData.commissionAmount),
        smBm: formData.smBmId || undefined,
        smBmName: formData.smBmName?.trim() || undefined,
        smBmEmail: formData.smBmEmail?.trim() || undefined,
        smBmMobile: formData.smBmMobile?.trim() || undefined,
        asmName: formData.asmName?.trim() || undefined,
        asmEmail: formData.asmEmail?.trim() || undefined,
        asmMobile: formData.asmMobile?.trim() || undefined,
        dsaCode: formData.dsaCode?.trim() || formData.codeUse?.trim() || undefined,
        branch: formData.branch?.trim() || undefined,
        remarks: formData.remarks?.trim() || undefined,
      }

      // Auto-assign the agent for newly created leads to the current user
      // (only when creating, not when updating an existing lead)
      const currentUser = authService.getUser()
      if (!selectedLead) {
        leadData.agent = leadData.agent || currentUser?._id || currentUser?.id || currentUser?.userId || undefined
      }

      console.log('🔍 DEBUG: Form data received:', formData)
      console.log('🔍 DEBUG: Agent ID from form:', formData.agentId)
      console.log('🔍 DEBUG: SubAgent from form:', formData.subAgent)
      console.log('🔍 DEBUG: Creating/updating lead with data:', JSON.stringify(leadData, null, 2))

      if (selectedLead) {
        // Update existing lead
        const leadId = selectedLead.id || selectedLead._id
        if (!leadId) {
          toast.error('Error', 'Customer ID is missing')
          return
        }
        const response = await api.leads.update(leadId, leadData)
        console.log('🔍 DEBUG: Update response:', response)
        console.log('🔍 DEBUG: Updated lead agent data:', response?.data?.agent || response?.agent)

        // Refresh leads list to get updated data with populated agent
        await fetchLeads()

        // Wait a bit to ensure state updates
        setTimeout(() => {
          console.log('🔍 DEBUG: Leads after refresh:', leads.length)
        }, 500)

        // Also refresh agents list in case it's needed for display
        await fetchAgents()

        // Refresh staff list in case a new SM/BM was created
        await fetchStaff()

        setIsEditModalOpen(false)
        toast.success('Success', 'Customer updated successfully')
      } else {
        // Create new lead
        const createResponse = await api.leads.create(leadData)
        console.log('🔍 DEBUG: Create response:', createResponse)
        console.log('🔍 DEBUG: Created lead agent data:', createResponse?.data?.agent || createResponse?.agent)

        await fetchLeads()

        // Refresh staff list in case a new SM/BM was created
        await fetchStaff()

        setIsCreateModalOpen(false)
        toast.success('Success', 'Customer created successfully')
      }
      setSelectedLead(null)
    } catch (error) {
      console.error('Error saving lead:', error)
      // Only show toast if API error handler hasn't already shown it
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save customer')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusUpdate = async (leadId, newStatus) => {
    if (!leadId) {
      console.error('Customer ID is missing')
      toast.error('Error', 'Customer ID is missing')
      return
    }
    try {
      await api.leads.updateStatus(leadId, newStatus)
      await fetchLeads()
      toast.success('Success', 'Customer status updated successfully')
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Error', error.message || 'Failed to update customer status')
    }
  }

  const handleDeleteClick = (lead) => {
    setConfirmDelete({ isOpen: true, lead })
  }

  const handleDeleteConfirm = async () => {
    const lead = confirmDelete.lead
    const leadId = lead.id || lead._id
    if (!leadId) {
      toast.error('Error', 'Customer ID is missing')
      return
    }

    try {
      await api.leads.delete(leadId)
      await fetchLeads()
      toast.success('Success', `Customer "${lead.caseNumber || 'this customer'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, lead: null })
    } catch (error) {
      console.error('Error deleting lead:', error)
      toast.error('Error', error.message || 'Failed to delete customer')
    }
  }

  const handleCommissionEdit = (lead, field) => {
    const leadId = lead.id || lead._id
    const currentPercentage = lead.commissionPercentage || lead.agentCommissionPercentage || 0
    const currentAmount = lead.commissionAmount || lead.agentCommissionAmount || 0
    
    setEditingCommission({ leadId, field })
    setCommissionEditValues({ 
      percentage: typeof currentPercentage === 'number' ? currentPercentage.toString() : (currentPercentage || '0'), 
      amount: typeof currentAmount === 'number' ? currentAmount.toString() : (currentAmount || '0')
    })
  }

  const handleCommissionSave = async (lead) => {
    const leadId = lead.id || lead._id
    if (!leadId) {
      toast.error('Error', 'Customer ID is missing')
      return
    }

    try {
      const updateData = {}
      const isFranchiseLead = lead.associatedModel === 'Franchise'
      const hasPercentage = commissionEditValues.percentage !== '' && commissionEditValues.percentage !== null && commissionEditValues.percentage !== undefined
      const hasAmount = commissionEditValues.amount !== '' && commissionEditValues.amount !== null && commissionEditValues.amount !== undefined
      
      if (isFranchiseLead) {
        // For franchise-created leads, update agent commission fields
        if (hasPercentage) {
          updateData.agentCommissionPercentage = parseFloat(commissionEditValues.percentage)
        }
        if (hasAmount) {
          updateData.agentCommissionAmount = parseFloat(commissionEditValues.amount)
        }
      } else {
        // For regular leads, update commission fields
        if (hasPercentage) {
          updateData.commissionPercentage = parseFloat(commissionEditValues.percentage)
        }
        if (hasAmount) {
          updateData.commissionAmount = parseFloat(commissionEditValues.amount)
        }
      }

      await api.leads.update(leadId, updateData)
      await fetchLeads()
      toast.success('Success', 'Commission updated successfully')
      setEditingCommission({ leadId: null, field: null })
      setCommissionEditValues({ percentage: '', amount: '' })
    } catch (error) {
      console.error('Error updating commission:', error)
      toast.error('Error', error.message || 'Failed to update commission')
    }
  }

  const handleCommissionCancel = () => {
    setEditingCommission({ leadId: null, field: null })
    setCommissionEditValues({ percentage: '', amount: '' })
  }

  const getAgentName = (agentIdOrObject) => {
    if (!agentIdOrObject) return 'N/A'

    // If it's already an object with name property
    if (typeof agentIdOrObject === 'object' && agentIdOrObject.name) {
      return agentIdOrObject.name
    }

    // Convert to string ID for comparison to handle ObjectId vs string mismatches
    const agentIdStr = String(agentIdOrObject?._id || agentIdOrObject?.id || agentIdOrObject)
    
    // Try to find in agents array (most reliable source)
    const foundAgent = agents.find((a) => {
      const aId = String(a.id || a._id)
      return aId === agentIdStr
    })
    if (foundAgent?.name) return foundAgent.name

    // For agents, try to get name from populated lead data
    if (isAgent && leads.length > 0) {
      const lead = leads.find(l => {
        const lAgentId = l.agent?._id || l.agent?.id || l.agentId || l.agent
        return String(lAgentId) === agentIdStr
      })
      if (lead?.agent?.name) return lead.agent.name
    }

    // Final fallback - try direct ID match (for edge cases)
    const agent = agents.find((a) => {
      const aId = String(a.id || a._id)
      return aId === agentIdStr || a.id === agentIdOrObject || a._id === agentIdOrObject
    })
    return agent ? (agent.name || 'N/A') : 'N/A'
  }

  const getSubAgentName = (subAgentIdOrObject) => {
    if (!subAgentIdOrObject) return 'N/A'
    
    // If it's already an object with name, return it
    if (typeof subAgentIdOrObject === 'object' && subAgentIdOrObject.name) {
      return subAgentIdOrObject.name
    }
    
    // Convert to string for comparison
    const subAgentIdStr = String(
      typeof subAgentIdOrObject === 'object' 
        ? (subAgentIdOrObject._id || subAgentIdOrObject.id)
        : subAgentIdOrObject
    )
    
    // Try to find in subAgents array
    const subAgent = subAgents.find((sa) => {
      const saId = String(sa.id || sa._id)
      return saId === subAgentIdStr
    })
    if (subAgent?.name) return subAgent.name
    
    // Try to find in agents array (subAgents might be in agents list)
    const agent = agents.find((a) => {
      const aId = String(a.id || a._id)
      return aId === subAgentIdStr
    })
    if (agent?.name) return agent.name
    
    return 'N/A'
  }

  const getBankName = (bankId) => {
    if (!bankId) return 'N/A'
    const bank = banks.find((b) => b.id === bankId || b._id === bankId)
    return bank ? (bank.name || 'N/A') : 'N/A'
  }

  const getFranchiseName = (franchiseIdOrObject) => {
    if (!franchiseIdOrObject) return 'N/A'

    if (typeof franchiseIdOrObject === 'object' && franchiseIdOrObject.name) {
      return franchiseIdOrObject.name
    }

    if (typeof franchiseIdOrObject === 'object') {
      const id = franchiseIdOrObject._id || franchiseIdOrObject.id
      if (id) {
        const franchise = franchises.find((f) => f.id === id || f._id === id)
        return franchise ? (franchise.name || 'N/A') : 'N/A'
      }
    }

    const franchise = franchises.find((f) => f.id === franchiseIdOrObject || f._id === franchiseIdOrObject)
    return franchise ? (franchise.name || 'N/A') : 'N/A'
  }

  // Determine the associated name for a lead (RelationshipManager via agent OR franchise)
  const getAssociatedName = (lead) => {
    if (!lead) return 'N/A'
    // Prefer populated associated object
    if (lead.associated && typeof lead.associated === 'object' && lead.associated.name) {
      return lead.associated.name
    }
    // If agent is populated, prefer the agent's manager
    if (lead.agent && typeof lead.agent === 'object') {
      const agent = lead.agent
      if (agent.managedByModel === 'RelationshipManager') {
        return agent.managedBy?.name || 'N/A'
      }
      if (agent.managedByModel === 'Franchise') {
        return agent.managedBy?.name || 'N/A'
      }
    }

    // If agent is just an ID, try to resolve from agents list
    const agentId = lead.agentId || (lead.agent && (lead.agent._id || lead.agent.id)) || lead.agent
    if (agentId) {
      const agentObj = agents.find(a => (a._id || a.id) === agentId || (a._id || a.id)?.toString() === agentId?.toString())
      if (agentObj) {
        if (agentObj.managedByModel === 'RelationshipManager') return agentObj.managedBy?.name || 'N/A'
        if (agentObj.managedByModel === 'Franchise') return agentObj.managedBy?.name || 'N/A'
      }
    }

    // Fallback to populated associated name or N/A
    return lead.associated?.name || 'N/A'
  }

  const getStaffName = (staffIdOrObject) => {
    if (!staffIdOrObject) return 'N/A'

    if (typeof staffIdOrObject === 'object' && staffIdOrObject.name) {
      return staffIdOrObject.name
    }

    if (typeof staffIdOrObject === 'object') {
      const id = staffIdOrObject._id || staffIdOrObject.id
      if (id) {
        const staffMember = staff.find((s) => s.id === id || s._id === id)
        if (staffMember) return staffMember.name || 'N/A'
        const bm = bankManagers.find((b) => b.id === id || b._id === id)
        if (bm) return bm.name || 'N/A'
        return 'N/A'
      }
    }

    const staffMember = staff.find((s) => s.id === staffIdOrObject || s._id === staffIdOrObject)
    if (staffMember) return staffMember.name || 'N/A'
    const bm = bankManagers.find((b) => b.id === staffIdOrObject || b._id === staffIdOrObject)
    if (bm) return bm.name || 'N/A'
    return 'N/A'
  }

  const toggleExpand = (leadId, field) => {
    const key = `${leadId}-${field}`
    setExpandedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isExpanded = (leadId, field) => {
    const key = `${leadId}-${field}`
    return expandedFields[key] || false
  }

  const copyToClipboard = async (text, label) => {
    if (!text || text === 'N/A') return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied', `${label} copied to clipboard`)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Error', 'Failed to copy to clipboard')
    }
  }

  const moveColumn = (index, direction) => {
    const newConfig = [...columnConfig]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newConfig.length) return
    const [removed] = newConfig.splice(index, 1)
    newConfig.splice(newIndex, 0, removed)
    setColumnConfig(newConfig)
  }

  const toggleColumnVisibility = (key) => {
    setColumnConfig(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ))
  }

  const visibleColumns = columnConfig.filter(col => {
    if (!col.visible) return false

    const key = (col.key || '').toString().toLowerCase()
    const label = (col.label || '').toString().toLowerCase()

    // Hide Associated column for Relationship Managers and Franchise users
    if ((userRole === 'relationship_manager' || userRole === 'franchise') && (key === 'associated' || key === 'franchise' || label.includes('associated') || label.includes('franchise'))) {
      return false
    }

    // Agents have a more restrictive view: hide franchise/associated/agent/sanctioned info
    // But allow subAgent to be visible for agents
    if (isAgent) {
      if (
        (key === 'associated' ||
        key === 'franchise' ||
        key === 'agent' ||
        key === 'sanctionedamount' ||
        label.includes('franchise') ||
        label.includes('associated') ||
        (label.includes('agent') && key !== 'subagent') ||
        label.includes('sanction')) && key !== 'subagent'
      ) {
        return false
      }
    }

    return true
  })

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'logged', label: 'Logged' },
    { value: 'sanctioned', label: 'Sanctioned' },
    { value: 'partial_disbursed', label: 'Partial Disbursed' },
    { value: 'disbursed', label: 'Disbursed' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden min-h-0 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 flex-shrink-0 gap-3 md:gap-0">
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customers Management</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Manage and track all loan customers</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-2">
          {canExportData() && (
            <button
              onClick={() => {
                const rows = sortedLeads.map((lead) => {
                  const partnerBank = lead.agent?.bankDetails || {};
                  const base = {
                  'Customer Name': lead.customerName || 'N/A',
                  'Loan Type': lead.loanType?.replace(/_/g, ' ') || 'N/A',
                  'Loan Amount': lead.loanAmount || lead.amount || '',
                  'Disbursed Amount': lead.disbursedAmount ?? '',
                  Status: lead.status || 'N/A',
                  Bank: lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A',
                  'SM/BM': lead.smBm?.name || getStaffName(lead.smBmId || lead.smBm) || 'N/A',
                  ASM: lead.asmName || 'N/A',
                  Branch: lead.branch || 'N/A',
                  'Loan Account No': lead.loanAccountNo || 'N/A',
                  'Disbursement Date': lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A',
                  'Sanctioned Date': lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A',
                  'DSA Code': lead.dsaCode || lead.codeUse || 'N/A',
                  'Partner Account Holder Name': partnerBank.accountHolderName || 'N/A',
                  'Partner IFSC No': partnerBank.ifsc || 'N/A',
                  'Partner Branch': partnerBank.branch || 'N/A',
                  'Partner Bank Name': partnerBank.bankName || 'N/A',
                  Remarks: lead.remarks || 'N/A',
                  Created: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'N/A',
                }
                // Do not include Associated column for Relationship Managers or Franchise users
                if (!isAgent && userRole !== 'relationship_manager' && userRole !== 'franchise') {
                  base.Associated = getAssociatedName(lead)
                }
                if (!isAgent) {
                  base.Agent = lead.agent?.name || getAgentName(lead.agentId || lead.agent) || 'N/A'
                }
                return base
              })
              exportToExcel(rows, `customers_export_${Date.now()}`, 'Customers')
              toast.success('Export', `Exported ${rows.length} customers to Excel`)
            }}
            disabled={sortedLeads.length === 0}
            title="Export currently filtered data to Excel"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
          )}
          <div className="relative">
            <button
              data-column-settings-button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Settings2 className="w-4 h-4" />
              <span>Columns</span>
            </button>
            {showColumnSettings && (
              <div data-column-settings className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 min-w-[350px] max-h-[600px] overflow-y-auto">
                <div className="mb-3 font-semibold text-gray-900">Column Settings</div>
                <div className="text-xs text-gray-500 mb-3">Use arrows to reorder, checkbox to toggle visibility</div>
                <div className="space-y-1 mb-4">
                  {columnConfig
                    .filter(col => {
                      // Hide associated/franchise column from column settings for Relationship Managers and Franchise users
                      if ((userRole === 'relationship_manager' || userRole === 'franchise')) {
                        const k = (col.key || '').toString().toLowerCase()
                        const lbl = (col.label || '').toString().toLowerCase()
                        if (k === 'associated' || k === 'franchise' || lbl.includes('associated') || lbl.includes('franchise')) {
                          return false
                        }
                      }
                      return true
                    })
                    .map((col, index) => (
                      <div key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveColumn(index, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveColumn(index, 'down')}
                            disabled={index === columnConfig.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumnVisibility(col.key)}
                          className="w-4 h-4 text-primary-900 rounded"
                        />
                        <span className="flex-1 text-sm text-gray-700">{col.label}</span>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
          {canCreate && (
            <button
              onClick={handleCreate}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span>Create Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3 md:mb-6 flex-shrink-0">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900 text-sm md:text-base">
            <Filter className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-gray-500" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, email, phone, account..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzY2NjY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_12px_center] bg-no-repeat"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!isAgent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                    <select
                      value={franchiseFilter}
                      onChange={(e) => setFranchiseFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      <option value="">All Associated</option>
                      {franchises.map((f) => (
                        <option key={f._id || f.id} value={f._id || f.id}>{f.name || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      <option value="">All agents</option>
                      {agents.map((a) => (
                        <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <select
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All banks</option>
                  {banks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>{b.name || 'Unnamed'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DSA Code</label>
                <input
                  type="text"
                  placeholder="Filter by DSA code..."
                  value={dsaCodeFilter}
                  onChange={(e) => setDsaCodeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                <select
                  value={loanTypeFilter}
                  onChange={(e) => setLoanTypeFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="personal">Personal</option>
                  <option value="home">Home</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment</label>
                <select
                  value={advancePaymentFilter}
                  onChange={(e) => setAdvancePaymentFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
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
                  min={dateFromFilter || undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {hasActiveFilters && (
                <>
                  <button type="button" onClick={clearLeadsFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                    Clear all filters
                  </button>
                  <span className="text-sm text-gray-500">Showing {filteredLeads.length} of {leads.length} customers</span>
                </>
              )}
              {!hasActiveFilters && (
                <span className="text-sm text-gray-500">Total {leads.length} customers</span>
              )}
              {totalFilteredLoanAmount > 0 && (
                <span className="text-sm font-semibold text-gray-700">
                  • Total Loan Amount: {formatInCrores(totalFilteredLoanAmount)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:flex flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${col.key === 'actions' ? 'text-right' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className={`flex items-center gap-2 ${col.key === 'actions' ? 'justify-end' : ''}`}>
                      {col.label}
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedLeads.length === 0 ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => {
                  const renderCell = (col) => {
                    switch (col.key) {
                      case 'caseNumber':
                        return <div className="text-sm font-medium text-gray-900">{lead.caseNumber || 'N/A'}</div>
                      case 'customerName':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'customer')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.customerName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'customer') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'customer') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.customerName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.customerName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.applicantEmail || lead.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantEmail || lead.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{formatMobileNumber(lead.applicantMobile || lead.phone || lead.mobile) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantMobile || lead.phone || lead.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'loanType':
                        return <div className="text-sm text-gray-900">{lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</div>
                      case 'loanAmount':
                        return <div className="text-sm font-medium text-gray-900">₹{(lead.loanAmount || lead.amount || 0).toLocaleString()}</div>
                      // 'sanctionedAmount' column removed
                      case 'disbursedAmount':
                        return <div className="text-sm font-medium text-gray-900">₹{(lead.disbursedAmount || 0).toLocaleString()}</div>
                      case 'remainingAmount': {
                        const loanAmount = lead.loanAmount || lead.amount || 0;
                        const disbursed = lead.disbursedAmount || 0;
                        const remaining = Math.max(0, loanAmount - disbursed);
                        return <div className="text-sm font-medium text-gray-900">₹{remaining.toLocaleString()}</div>
                      }
                      case 'agentCommissionPercentage':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              // agentCommissionPercentage is schema-defaulted to 0 on many leads.
                              // Use logical fallback so regular commissionPercentage is shown when agent value is 0.
                              const commission = lead.agentCommissionPercentage || lead.commissionPercentage || 0
                              return typeof commission === 'number'
                                ? commission.toFixed(2) + '%'
                                : parseFloat(commission || 0).toFixed(2) + '%';
                            })()}
                          </div>
                        )
                      case 'agentCommissionAmount':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              // agentCommissionAmount is schema-defaulted to 0 on many leads.
                              // Use logical fallback so regular commissionAmount is shown when agent value is 0.
                              const storedAmount = lead.agentCommissionAmount || lead.commissionAmount || 0
                              return `₹${Number(storedAmount || 0).toLocaleString()}`
                            })()}
                          </div>
                        )
                      case 'subAgentCommissionPercentage':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const commission = lead.subAgentCommissionPercentage || 0;
                              return typeof commission === 'number' ? commission.toFixed(2) + '%' : parseFloat(commission || 0).toFixed(2) + '%';
                            })()}
                          </div>
                        )
                      case 'subAgentCommissionAmount':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const storedAmount = lead.subAgentCommissionAmount ?? 0
                              return `₹${Number(storedAmount || 0).toLocaleString()}`
                            })()}
                          </div>
                        )
                      case 'commissionPercentage':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const commission = lead.commissionPercentage || 0;
                              return typeof commission === 'number' ? commission.toFixed(2) + '%' : parseFloat(commission || 0).toFixed(2) + '%';
                            })()}
                          </div>
                        )
                      case 'commissionAmount':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const storedAmount = lead.commissionAmount ?? 0
                              return `₹${Number(storedAmount || 0).toLocaleString()}`
                            })()}
                          </div>
                        )
                      case 'referralFranchiseCommissionPercentage':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const commission = lead.referralFranchiseCommissionPercentage || 0;
                              return typeof commission === 'number' ? commission.toFixed(2) + '%' : parseFloat(commission || 0).toFixed(2) + '%';
                            })()}
                          </div>
                        )
                      case 'referralFranchiseCommissionAmount':
                        return (
                          <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const storedAmount = lead.referralFranchiseCommissionAmount ?? 0
                              return `₹${Number(storedAmount || 0).toLocaleString()}`
                            })()}
                          </div>
                        )
                      case 'status':
                        return <StatusBadge status={lead.status || 'logged'} />
                      case 'agent': {
                        const agentName = (() => {
                          // First check agentName field (stored directly on lead - most reliable)
                          if (lead.agentName) {
                            return lead.agentName;
                          }
                          
                          // Then check if agent is populated as an object with name (from backend populate)
                          if (lead.agent && typeof lead.agent === 'object') {
                            if (lead.agent.name) {
                              return lead.agent.name;
                            }
                          }
                          
                          // Try to get agent ID and look it up in agents array
                          const agentId = lead.agentId || (lead.agent && (lead.agent._id || lead.agent.id)) || lead.agent;
                          if (agentId) {
                            const name = getAgentName(agentId);
                            if (name && name !== 'N/A') {
                              return name;
                            }
                          }
                          
                          // Final fallback
                          return 'N/A';
                        })()
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'agent')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {agentName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'agent') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'agent') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{agentName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(agentName !== 'N/A' ? agentName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.agent?.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.agent?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{formatMobileNumber(lead.agent?.mobile) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.agent?.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'subAgent': {
                        const subAgentName = (() => {
                          // First check subAgentName field (stored directly on lead - most reliable)
                          if (lead.subAgentName) {
                            return lead.subAgentName;
                          }
                          
                          // Then check if subAgent is populated as an object with name (from backend populate)
                          if (lead.subAgent) {
                            // Handle populated object
                            if (typeof lead.subAgent === 'object' && lead.subAgent !== null) {
                              if (lead.subAgent.name) {
                                return lead.subAgent.name;
                              }
                              // If it has _id or id but no name, try lookup
                              if (lead.subAgent._id || lead.subAgent.id) {
                                const name = getSubAgentName(lead.subAgent);
                                if (name !== 'N/A') {
                                  return name;
                                }
                              }
                            }
                            
                            // Handle ObjectId string
                            if (typeof lead.subAgent === 'string') {
                              const name = getSubAgentName(lead.subAgent);
                              if (name !== 'N/A') {
                                return name;
                              }
                            }
                          }
                          
                          // Final fallback
                          return 'N/A';
                        })()
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'subAgent')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {subAgentName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'subAgent') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'subAgent') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{subAgentName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(subAgentName !== 'N/A' ? subAgentName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.subAgent?.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.subAgent?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.subAgent?.mobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.subAgent?.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'associated': {
                        const associatedName = getAssociatedName(lead)
                        const associatedObj = lead.associated
                        const associatedEmail = associatedObj?.email || (lead.agent?.managedBy?.email) || 'N/A'
                        const associatedMobile = associatedObj?.mobile || (lead.agent?.managedBy?.mobile) || 'N/A'
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'associated')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {associatedName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'associated') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'associated') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{associatedName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedName !== 'N/A' ? associatedName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{associatedEmail}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedEmail !== 'N/A' ? associatedEmail : '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{associatedMobile}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedMobile !== 'N/A' ? associatedMobile : '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'referralFranchise': {
                        const referralFranchiseName = (() => {
                          // Check if referralFranchise is populated as an object
                          if (lead.referralFranchise && typeof lead.referralFranchise === 'object' && lead.referralFranchise.name) {
                            return lead.referralFranchise.name;
                          }
                          // If referralFranchise is an ID, try to find it in franchises array
                          const referralFranchiseId = lead.referralFranchise?._id || lead.referralFranchise?.id || lead.referralFranchise;
                          if (referralFranchiseId) {
                            const franchiseName = getFranchiseName(referralFranchiseId);
                            return franchiseName !== 'N/A' ? franchiseName : '-';
                          }
                          return '-';
                        })()
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'referralFranchise')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {referralFranchiseName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'referralFranchise') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'referralFranchise') && referralFranchiseName !== '-' && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{referralFranchiseName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(referralFranchiseName !== '-' ? referralFranchiseName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.referralFranchise?.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.referralFranchise?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.referralFranchise?.mobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.referralFranchise?.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'bank': {
                        const bankName = (() => {
                          // 1. Denormalized bankName stored directly on lead (most reliable)
                          if (lead.bankName) return lead.bankName;
                          // 2. Populated bank object from backend
                          if (lead.bank && typeof lead.bank === 'object' && lead.bank.name) {
                            return lead.bank.name;
                          }
                          // 3. Look up in local banks array by ID
                          const bankId = typeof lead.bank === 'string' ? lead.bank : (lead.bank?._id || lead.bank?.id);
                          if (bankId) {
                            const found = banks.find(b => String(b.id || b._id) === String(bankId));
                            if (found?.name) return found.name;
                          }
                          return 'N/A';
                        })()
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'bank')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {bankName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'bank') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'bank') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{bankName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(bankName !== 'N/A' ? bankName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.bank?.contactEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.contactMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'smBm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'smbm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {(() => {
                                  if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                    return lead.smBm.name
                                  }
                                  const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                  return getStaffName(smBmId)
                                })()}
                              </span>
                              {isExpanded(lead.id || lead._id, 'smbm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'smbm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">
                                        {(() => {
                                          if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                            return lead.smBm.name
                                          }
                                          const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                          return getStaffName(smBmId)
                                        })()}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const name = (() => {
                                            if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                              return lead.smBm.name
                                            }
                                            const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                            return getStaffName(smBmId)
                                          })()
                                          copyToClipboard(name, 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.smBmEmail || (lead.smBm?.email) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmEmail || lead.smBm?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.smBmMobile || (lead.smBm?.mobile) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmMobile || lead.smBm?.mobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'asm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'asm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.asmName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'asm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'asm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900 email-lowercase" data-email="true">{lead.asmEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'branch':
                        return <div className="text-sm text-gray-900">{lead.branch || 'N/A'}</div>
                      case 'loanAccountNo':
                        return <div className="text-sm text-gray-900">{lead.loanAccountNo || 'N/A'}</div>
                      case 'advancePayment':
                        return <div className="text-sm text-gray-900">{lead.advancePayment ? 'Yes' : 'No'}</div>
                      case 'disbursementDate':
                        return <div className="text-sm text-gray-900">{lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A'}</div>
                      case 'sanctionedDate':
                        return <div className="text-sm text-gray-900">{lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A'}</div>
                      case 'codeUse':
                      case 'dsaCode':
                        return <div className="text-sm text-gray-900">{lead.dsaCode || lead.codeUse || 'N/A'}</div>
                      case 'remarks':
                        return <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.remarks || 'N/A'}>{lead.remarks || 'N/A'}</div>
                      case 'createdAt':
                        return <div className="text-sm text-gray-900">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</div>
                      case 'actions':
                        return (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleView(lead)}
                              className="text-primary-900 hover:text-primary-800 p-1"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canViewHistory && (
                              <button
                                onClick={() => handleViewHistory(lead)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="View History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            )}
                            {canSendDisbursementEmail && ['partial_disbursed', 'disbursed', 'completed'].includes(lead.status) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDisbursementEmail(lead)
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Disbursement Confirmation"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {isAgent && (lead.status === 'logged') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStatusUpdate(lead.id || lead._id, 'disbursed')
                                }}
                                className="text-xs bg-primary-900 text-white px-3 py-1 rounded hover:bg-primary-800 transition-colors"
                                title="Mark as Disbursed"
                              >
                                Mark Disbursed
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(lead)}
                                  className="text-gray-600 hover:text-gray-900 p-1"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(lead)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <select
                                  value={lead.status || 'logged'}
                                  onChange={(e) => handleStatusUpdate(lead.id || lead._id, e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="logged">Logged</option>
                                  <option value="sanctioned">Sanctioned</option>
                                  <option value="partial_disbursed">Partial Disbursed</option>
                                  <option value="disbursed">Disbursed</option>
                                  <option value="completed">Completed</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </>
                            )}
                          </div>
                        )
                      default:
                        return <div className="text-sm text-gray-900">N/A</div>
                    }
                  }

                  return (
                    <tr key={lead.id || lead._id} className="hover:bg-gray-50 border-b border-gray-200">
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-6 py-4 whitespace-nowrap ${col.key === 'actions' ? 'text-right' : ''}`}
                        >
                          {renderCell(col)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedLeads.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedLeads.length}</span> of{' '}
              <span className="font-medium">{sortedLeads.length}</span> customers
            </p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 mb-4">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No customers found</p>
          </div>
        ) : (
          sortedLeads.map((lead) => {
            const getFieldValue = (col) => {
              switch (col.key) {
                case 'customerName':
                  return lead.customerName || 'N/A'
                case 'loanType':
                  return lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'
                case 'loanAmount':
                  return `₹${(lead.loanAmount || lead.amount || 0).toLocaleString()}`
                case 'disbursedAmount':
                  return `₹${(lead.disbursedAmount || 0).toLocaleString()}`
                case 'status':
                  return lead.status || 'logged'
                case 'bank':
                  return lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A'
                case 'loanAccountNo':
                  return lead.loanAccountNo || 'N/A'
                case 'advancePayment':
                  return lead.advancePayment ? 'Yes' : 'No'
                default:
                  return 'N/A'
              }
            }

            const primaryColumns = visibleColumns.filter(col => 
              ['customerName', 'loanType', 'loanAmount', 'status'].includes(col.key)
            )
            const secondaryColumns = visibleColumns.filter(col => 
              !['customerName', 'loanType', 'loanAmount', 'status', 'actions'].includes(col.key) && col.visible
            ).slice(0, 4) // Limit to 4 secondary fields for mobile

            return (
              <div
                key={lead.id || lead._id}
                onClick={() => {
                  setSelectedLead(lead)
                  setIsDetailModalOpen(true)
                }}
                className="bg-white rounded-lg border border-gray-200 p-4 min-h-[48px] active:bg-gray-50 transition-colors"
              >
                {/* Primary Info */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {lead.customerName || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge status={lead.status || 'logged'} />
                    </div>
                  </div>
                </div>

                {/* Secondary Info */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {secondaryColumns.map((col) => {
                    const value = getFieldValue(col)
                    if (value === 'N/A' || !value) return null
                    return (
                      <div key={col.key} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">{col.label}:</span>
                        <span className="text-xs font-semibold text-gray-900 text-right flex-1 ml-2">
                          {col.key === 'loanAmount' || col.key === 'disbursedAmount' ? value : String(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                {visibleColumns.some(col => col.key === 'actions') && (
                  <div className="pt-3 border-t border-gray-100 mt-3 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                            setIsEditModalOpen(true)
                          }}
                          className="text-gray-600 hover:text-gray-900 p-2"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(lead)
                          }}
                          className="text-red-600 hover:text-red-900 p-2"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                            setIsDetailModalOpen(true)
                          }}
                          className="text-primary-600 hover:text-primary-900 p-2"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setIsSubmitting(false); }}
        title="Create New Customer"
      >
        <LeadForm onSave={handleSave} onClose={() => { setIsCreateModalOpen(false); setIsSubmitting(false); }} isSubmitting={isSubmitting} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedLead(null)
          setIsSubmitting(false)
        }}
        title="Edit Customer"
      >
        <LeadForm lead={selectedLead} onSave={handleSave} onClose={() => { setIsEditModalOpen(false); setIsSubmitting(false); }} isSubmitting={isSubmitting} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLead(null)
        }}
        title="Customer Details"
        size="md"
      >
        {selectedLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantEmail || selectedLead.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantMobile || selectedLead.phone || selectedLead.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Type</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.loanType || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Amount</label>
                <p className="mt-1 text-sm text-gray-900">₹{(selectedLead.loanAmount || selectedLead.amount || 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedLead.status || 'logged'} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Partner</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    if (selectedLead.agentName) return selectedLead.agentName;
                    // Check if agent is populated object
                    if (selectedLead.agent && typeof selectedLead.agent === 'object' && selectedLead.agent.name) {
                      return selectedLead.agent.name
                    }
                    // Check agentId or agent ID
                    const agentId = selectedLead.agentId || (selectedLead.agent && (selectedLead.agent._id || selectedLead.agent.id)) || selectedLead.agent
                    return getAgentName(agentId)
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Sub Partner</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    // First check subAgentName field (stored directly on lead - most reliable)
                    if (selectedLead.subAgentName) {
                      return selectedLead.subAgentName;
                    }
                    
                    // Then check if subAgent is populated as an object with name (from backend populate)
                    if (selectedLead.subAgent) {
                      // Handle populated object
                      if (typeof selectedLead.subAgent === 'object' && selectedLead.subAgent !== null) {
                        if (selectedLead.subAgent.name) {
                          return selectedLead.subAgent.name;
                        }
                        // If it has _id or id but no name, try lookup
                        if (selectedLead.subAgent._id || selectedLead.subAgent.id) {
                          const subAgentName = getSubAgentName(selectedLead.subAgent);
                          if (subAgentName !== 'N/A') {
                            return subAgentName;
                          }
                        }
                      }
                      
                      // Handle ObjectId string
                      if (typeof selectedLead.subAgent === 'string') {
                        const subAgentName = getSubAgentName(selectedLead.subAgent);
                        if (subAgentName !== 'N/A') {
                          return subAgentName;
                        }
                      }
                    }
                    
                    // Final fallback
                    return 'N/A';
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Associated</label>
                <p className="mt-1 text-sm text-gray-900">{getAssociatedName(selectedLead)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Refer Franchise</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    // Check if referralFranchise is populated as an object
                    if (selectedLead.referralFranchise && typeof selectedLead.referralFranchise === 'object' && selectedLead.referralFranchise.name) {
                      return selectedLead.referralFranchise.name;
                    }
                    // If referralFranchise is an ID, try to find it in franchises array
                    const referralFranchiseId = selectedLead.referralFranchise?._id || selectedLead.referralFranchise?.id || selectedLead.referralFranchise;
                    if (referralFranchiseId) {
                      const franchiseName = getFranchiseName(referralFranchiseId);
                      return franchiseName !== 'N/A' ? franchiseName : '-';
                    }
                    return '-';
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Partner Commission %</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    const commission = selectedLead.agentCommissionPercentage || selectedLead.commissionPercentage || 0;
                    return typeof commission === 'number' ? commission.toFixed(2) + '%' : parseFloat(commission || 0).toFixed(2) + '%';
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Partner Commission Amount</label>
                <p className="mt-1 text-sm text-gray-900">
                  ₹{(selectedLead.agentCommissionAmount || selectedLead.commissionAmount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Refer Franchise Commission %</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    const commission = selectedLead.referralFranchiseCommissionPercentage || 0;
                    return typeof commission === 'number' ? commission.toFixed(2) + '%' : parseFloat(commission || 0).toFixed(2) + '%';
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Refer Franchise Commission Amount</label>
                <p className="mt-1 text-sm text-gray-900">
                  ₹{(selectedLead.referralFranchiseCommissionAmount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Bank</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.bank?.name || getBankName(selectedLead.bankId || selectedLead.bank) || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Customer Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.customerName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Disbursement Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.disbursementDate ? new Date(selectedLead.disbursementDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Account No</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.loanAccountNo || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Name</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    if (selectedLead.smBm && typeof selectedLead.smBm === 'object' && selectedLead.smBm.name) {
                      return selectedLead.smBm.name
                    }
                    const smBmId = selectedLead.smBmId || (selectedLead.smBm && (selectedLead.smBm._id || selectedLead.smBm.id)) || selectedLead.smBm
                    return getStaffName(smBmId)
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmEmail || selectedLead.smBm?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmMobile || selectedLead.smBm?.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmEmail || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmMobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">DSA Code</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.dsaCode || selectedLead.codeUse || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Branch</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.branch || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Documents & uploads (KYC, attachments, etc.) */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Documents &amp; files
                  {detailAttachments.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {detailAttachments.length}
                    </span>
                  )}
                </span>
              </div>
              {loadingDetailAttachments ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  Loading documents…
                </div>
              ) : detailAttachments.length > 0 ? (
                <div className="space-y-2">
                  {detailAttachments.map((att, idx) => {
                    const name = att.fileName || att.originalFileName || att.name || 'File'
                    const ext = name.split('.').pop()?.toLowerCase() || ''
                    const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext)
                    const isPdf = ext === 'pdf'
                    const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : null
                    const docId = att.id || att._id
                    const openDoc = () => {
                      if (docId) api.documents.open(docId)
                      else if (att.url) window.open(att.url, '_blank', 'noopener,noreferrer')
                    }
                    return (
                      <div
                        key={docId ? String(docId) : `${att.url || ''}-${idx}`}
                        className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                          isImage ? 'bg-green-500' : isPdf ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {isPdf ? 'PDF' : ext.toUpperCase().slice(0,3) || '📎'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">{humanizeDocumentType(att.documentType)}</p>
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {sizeKB && <p className="text-xs text-gray-500">{sizeKB} KB</p>}
                        </div>
                        <button
                          type="button"
                          onClick={openDoc}
                          disabled={!docId && !att.url}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-1">No documents uploaded for this customer</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 flex gap-2">
              {canViewHistory && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleViewHistory(selectedLead)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <History className="w-4 h-4" />
                  View History
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedLead)
                  }}
                  className="flex-1 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit Lead
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, lead: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${confirmDelete.lead?.caseNumber || 'this customer'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Disbursement Email Modal */}
      <DisbursementEmailModal
        isOpen={isDisbursementEmailModalOpen}
        onClose={() => {
          setIsDisbursementEmailModalOpen(false)
          setSelectedLeadForEmail(null)
        }}
        leadId={selectedLeadForEmail?.id || selectedLeadForEmail?._id}
      />

      {/* History Sidebar */}
      {isHistoryModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-50 z-[10000]"
            onClick={() => {
              setIsHistoryModalOpen(false)
              setSelectedLead(null)
              setLeadHistory([])
              setExpandedHistoryItems(new Set())
            }}
          ></div>

          {/* Sidebar */}
          <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-[450px] bg-white shadow-2xl z-[10001] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                History - {selectedLead?.caseNumber || 'Customer'}
              </h3>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false)
                  setSelectedLead(null)
                  setLeadHistory([])
                  setExpandedHistoryItems(new Set())
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {historyLoading ? (
                <div className="py-8 text-center text-gray-500">Loading history...</div>
              ) : leadHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No history available for this customer.</div>
              ) : (
                <div className="space-y-2">
                  {leadHistory.map((historyItem, index) => {
                    const isExpanded = isHistoryItemExpanded(index)
                    const changeCount = historyItem.changes?.length || 0

                    return (
                      <div
                        key={historyItem._id || historyItem.id || index}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                      >
                        {/* Collapsed Header - Always Visible */}
                        <div
                          className="p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleHistoryItem(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-900 capitalize">
                                  {historyItem.action?.replace(/_/g, ' ')}
                                </span>
                                {changeCount > 0 && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                    {changeCount} {changeCount === 1 ? 'change' : 'changes'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {historyItem.changedBy && (
                                  <span>
                                    by <span className="font-medium">{historyItem.changedBy.name || historyItem.changedBy.email || 'Unknown'}</span>
                                  </span>
                                )}
                                <span className="text-gray-400">
                                  {historyItem.createdAt
                                    ? new Date(historyItem.createdAt).toLocaleString()
                                    : historyItem.created_at
                                      ? new Date(historyItem.created_at).toLocaleString()
                                      : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'transform rotate-180' : ''
                                }`}
                            />
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-2 pb-2 border-t border-gray-100">
                            {historyItem.changes && historyItem.changes.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {historyItem.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="bg-gray-50 rounded p-2 border border-gray-100">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">
                                      {formatFieldName(change.field)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-red-600 line-through flex-1 truncate">
                                        {formatFieldValue(change.oldValue, change.field)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600 font-semibold flex-1 truncate">
                                        {formatFieldValue(change.newValue, change.field)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic text-center py-2">
                                {historyItem.action === 'created' ? 'Customer was created' : 'No field changes recorded'}
                              </div>
                            )}

                            {historyItem.remarks && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                                  <span className="font-semibold text-gray-700">Remarks: </span>
                                  {historyItem.remarks}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Leads
