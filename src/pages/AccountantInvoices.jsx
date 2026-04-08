import { useState, useMemo, useEffect } from 'react'
import { Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, File, Calendar, CheckCircle, ChevronDown, ChevronUp, FileDown, Download, DollarSign, Clock } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import InvoiceForm from '../components/InvoiceForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { canExportData } from '../utils/roleUtils'
import { authService } from '../services/auth.service'
import { downloadInvoicePDF, loadLogoFromPublic } from '../utils/generateInvoicePDF'
import { preloadRobotoFont, getCachedRobotoFont } from '../utils/robotoFont'
import API_BASE_URL from '../config/api'
import { formatInvoiceStatusLabel } from '../utils/formatUtils'

const AccountantInvoices = () => {
  const userRole = authService.getUser()?.role || ''
  const isAdmin = userRole === 'super_admin'
  const isAccountant = userRole === 'accounts_manager'
  const canEditInvoice = isAdmin || isAccountant
  const canDeleteInvoice = isAdmin || isAccountant
  const [invoices, setInvoices] = useState([])
  const [leads, setLeads] = useState([])
  const [franchises, setFranchises] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [fullInvoiceDetails, setFullInvoiceDetails] = useState(null)
  const [companySettings, setCompanySettings] = useState(null)
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false)
  const [detailModalAttachments, setDetailModalAttachments] = useState([])
  const [loadingDetailAttachments, setLoadingDetailAttachments] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, invoice: null })
  const [confirmInvoiceStatus, setConfirmInvoiceStatus] = useState({
    isOpen: false,
    invoice: null,
    currentStatus: '',
    newStatus: '',
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchInvoices()
    fetchLeads()
    fetchFranchises()
    fetchAgents()
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

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await api.invoices.getAll()
      const invoicesData = response.data || response || []
      setInvoices(Array.isArray(invoicesData) ? invoicesData : [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLeads = async () => {
    try {
      const response = await api.leads.getAll()
      const leadsData = response.data || response || []
      setLeads(Array.isArray(leadsData) ? leadsData : [])
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  // Download invoice per lead as PDF
  const handleDownloadInvoice = async (invoice) => {
    try {
      const invoiceId = invoice.id || invoice._id
      if (!invoiceId) {
        toast.error('Error', 'Invoice ID is missing')
        return
      }

      // Get full invoice details with populated fields
      const invoiceDetails = await api.invoices.getById(invoiceId)
      const invoiceData = invoiceDetails.data || invoiceDetails

      // Get company settings
      const companySettingsResponse = await api.companySettings.get()
      const companySettings = companySettingsResponse.data || companySettingsResponse || {}

      // Preload Roboto font if not already cached
      let robotoFontBase64 = getCachedRobotoFont()
      if (!robotoFontBase64) {
        await preloadRobotoFont()
        robotoFontBase64 = getCachedRobotoFont()
      }

      // Load logo from Public folder for PDF header
      const logoData = await loadLogoFromPublic()
      const settingsWithLogo = { ...companySettings, companyLogo: logoData || companySettings.companyLogo }

      // Download as PDF with Roboto font
      downloadInvoicePDF(invoiceData, settingsWithLogo, null, robotoFontBase64)
      toast.success('Success', 'Invoice PDF downloaded successfully')
    } catch (error) {
      console.error('Error downloading invoice:', error)
      toast.error('Error', error.message || 'Failed to download invoice')
    }
  }

  // Calculate statistics
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(i => i.status === 'paid').length
  const totalAmount = invoices.reduce((sum, inv) => {
    return sum + (inv.commissionAmount || inv.netPayable || inv.amount || 0)
  }, 0)
  const paidAmount = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, inv) => {
      return sum + (inv.commissionAmount || inv.netPayable || inv.amount || 0)
    }, 0)

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    if (!invoices || invoices.length === 0) return []

    // If user picked an Associated franchise but didn't pick an invoice type,
    // default to franchise invoices so Agent/Sub-Partner invoices don't appear unexpectedly.
    const effectiveInvoiceTypeFilter = invoiceTypeFilter || (franchiseFilter ? 'franchise' : '')

    return invoices.filter((invoice) => {
      if (!invoice) return false
      if (franchiseFilter) {
        const fid = invoice.franchise?._id || invoice.franchise?.id || invoice.franchise
        if (!fid || (fid !== franchiseFilter && fid.toString() !== franchiseFilter)) return false
      }
      if (agentFilter) {
        const aid = invoice.agent?._id || invoice.agent?.id || invoice.agent
        if (!aid || (aid !== agentFilter && aid.toString() !== agentFilter)) return false
      }
      if (effectiveInvoiceTypeFilter && (invoice.invoiceType || 'agent') !== effectiveInvoiceTypeFilter) return false
      const leadId = invoice.lead?._id || invoice.lead?.id || invoice.lead || invoice.leadId
      const lead = leads.find(l => {
        const lId = l.id || l._id
        return lId === leadId || lId?.toString() === leadId?.toString()
      })
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(searchLower)) ||
        (lead && lead.loanAccountNo && lead.loanAccountNo.toLowerCase().includes(searchLower)) ||
        (invoice.agent?.name && invoice.agent.name.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

      // Date range filtering
      if (dateFromFilter || dateToFilter) {
        const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : null
        if (!invoiceDate) return false

        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter)
          fromDate.setHours(0, 0, 0, 0)
          if (invoiceDate < fromDate) return false
        }

        if (dateToFilter) {
          const toDate = new Date(dateToFilter)
          toDate.setHours(23, 59, 59, 999)
          if (invoiceDate > toDate) return false
        }
      }

      return matchesSearch && matchesStatus
    })
  }, [invoices, searchTerm, statusFilter, franchiseFilter, invoiceTypeFilter, agentFilter, dateFromFilter, dateToFilter, leads])

  const filteredPendingTotal = useMemo(() => {
    return filteredInvoices
      .filter((inv) => inv && inv.status === 'pending')
      .reduce((sum, inv) => sum + getInvoiceLineAmount(inv), 0)
  }, [filteredInvoices])

  const filteredTotalAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + getInvoiceLineAmount(inv), 0)
  }, [filteredInvoices])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== '' || invoiceTypeFilter !== '' || agentFilter !== '' || dateFromFilter !== '' || dateToFilter !== ''
  const clearInvoiceFilters = () => { 
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
    setInvoiceTypeFilter('')
    setAgentFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    if (!sortConfig.key) return filteredInvoices

    return [...filteredInvoices].sort((a, b) => {
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
  }, [filteredInvoices, sortConfig])

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
    setSelectedInvoice(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (invoice) => {
    setSelectedInvoice(invoice)
    setIsEditModalOpen(true)
  }

  const handleView = async (invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailModalOpen(true)
    setLoadingInvoiceDetails(true)
    setDetailModalAttachments([])
    setLoadingDetailAttachments(true)

    try {
      const invoiceId = invoice.id || invoice._id
      if (invoiceId) {
        // Fetch full invoice details
        const invoiceDetails = await api.invoices.getById(invoiceId)
        const invoiceData = invoiceDetails.data || invoiceDetails
        setFullInvoiceDetails(invoiceData)

        // Fetch company settings for GST calculation
        const companySettingsResponse = await api.companySettings.get()
        const settings = companySettingsResponse.data || companySettingsResponse || {}
        setCompanySettings(settings)

        // Fetch invoice attachments
        try {
          const docResponse = await api.documents.list('invoice', invoiceId)
          const documents = docResponse.data || docResponse || []
          setDetailModalAttachments(Array.isArray(documents) ? documents : [])
        } catch (docErr) {
          console.error('Error fetching invoice attachments:', docErr)
          setDetailModalAttachments([])
        }
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error)
      toast.error('Error', 'Failed to load invoice details')
    } finally {
      setLoadingInvoiceDetails(false)
      setLoadingDetailAttachments(false)
    }
  }

  const handleSave = async (formData) => {
    try {
      if (!formData.lead) {
        toast.error('Error', 'Customer is required')
        return
      }
      if (!formData.agent) {
        toast.error('Error', 'Partner is required')
        return
      }
      if (!formData.franchise) {
        toast.error('Error', 'Franchise is required')
        return
      }
      if (!formData.invoiceNumber) {
        toast.error('Error', 'Invoice number is required')
        return
      }
      if (!formData.commissionAmount || formData.commissionAmount <= 0) {
        toast.error('Error', 'Commission amount must be greater than 0')
        return
      }
      if (formData.netPayable === undefined || formData.netPayable === null) {
        toast.error('Error', 'Net payable amount is required')
        return
      }
      const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'escalated', 'gst_paid', 'paid', 'regular_paid']
      if (!validStatuses.includes(formData.status)) {
        toast.error('Error', `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
        return
      }

      if (selectedInvoice) {
        const invoiceId = selectedInvoice.id || selectedInvoice._id
        if (!invoiceId) {
          toast.error('Error', 'Invoice ID is missing')
          return
        }
        await api.invoices.update(invoiceId, formData)
        await fetchInvoices()
        await fetchLeads()
        setIsEditModalOpen(false)
        toast.success('Success', 'Invoice updated successfully')
      } else {
        await api.invoices.create(formData)
        await fetchInvoices()
        await fetchLeads()
        setIsCreateModalOpen(false)
        toast.success('Success', 'Invoice created successfully')
      }
      setSelectedInvoice(null)
    } catch (error) {
      console.error('Error saving invoice:', error)
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save invoice')
      }
    }
  }

  const handleDeleteClick = (invoice) => {
    setConfirmDelete({ isOpen: true, invoice })
  }

  const handleDeleteConfirm = async () => {
    const invoice = confirmDelete.invoice
    const invoiceId = invoice.id || invoice._id
    if (!invoiceId) {
      toast.error('Error', 'Invoice ID is missing')
      return
    }

    try {
      await api.invoices.delete(invoiceId)
      await fetchInvoices()
      toast.success('Success', `Invoice "${invoice.invoiceNumber || 'this invoice'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, invoice: null })
    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast.error('Error', error.message || 'Failed to delete invoice')
    }
  }

  const requestInvoiceStatusChange = (invoice, newStatus) => {
    const current = invoice.status || 'pending'
    const invoiceId = invoice.id || invoice._id
    if (!invoiceId || newStatus === current) return
    setConfirmInvoiceStatus({ isOpen: true, invoice, currentStatus: current, newStatus })
  }

  const handleInvoiceStatusConfirm = async () => {
    const { invoice, newStatus } = confirmInvoiceStatus
    const invoiceId = invoice?.id || invoice?._id
    if (!invoiceId) {
      setConfirmInvoiceStatus({ isOpen: false, invoice: null, currentStatus: '', newStatus: '' })
      return
    }
    try {
      await api.invoices.update(invoiceId, { status: newStatus })
      toast.success('Success', `Invoice status updated to ${newStatus}`)
      await fetchInvoices()
    } catch (error) {
      console.error('Error updating invoice status:', error)
      toast.error('Error', error.message || 'Failed to update invoice status')
    } finally {
      setConfirmInvoiceStatus({ isOpen: false, invoice: null, currentStatus: '', newStatus: '' })
    }
  }

  const getLeadName = (leadId) => {
    if (!leadId) return 'N/A'
    const lead = leads.find(l => {
      const lId = l.id || l._id
      const compareId = leadId?._id || leadId?.id || leadId
      return lId === compareId || lId?.toString() === compareId?.toString()
    })
    return lead ? (lead.customerName || lead.loanAccountNo || lead.leadId || 'N/A') : 'N/A'
  }

  const getAssociatedForInvoice = (invoice) => {
    if (invoice.franchise) {
      if (typeof invoice.franchise === 'object') {
        return invoice.franchise.name || 'N/A'
      }
      const franchise = franchises.find(f => {
        const fId = f.id || f._id
        return fId === invoice.franchise || fId?.toString() === invoice.franchise?.toString()
      })
      return franchise ? franchise.name : 'N/A'
    }
    return 'N/A'
  }

  const getReceiverForInvoice = (inv) => {
    if (!inv) return null
    if (inv.invoiceType === 'sub_agent') return inv.subAgent
    if (inv.invoiceType === 'franchise') return inv.franchise
    return inv.agent
  }

  const getReceiverBankDetailsForExcel = (inv) => {
    const receiver = getReceiverForInvoice(inv)
    return receiver?.bankDetails || {}
  }

  const getGstAmountForExcel = (inv) => {
    const receiver = getReceiverForInvoice(inv)
    const gst = inv?.gstAmount ?? 0
    const isGST =
      (receiver?.agentType && receiver.agentType === 'GST') ||
      (receiver?.franchiseType && receiver.franchiseType === 'GST')
    return isGST && Number(gst) > 0 ? gst : ''
  }

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'escalated', label: 'Escalated' },
    { value: 'gst_paid', label: 'GST Paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'regular_paid', label: 'Regular Paid' },
    { value: 'overdue', label: 'Overdue' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices Management</h1>
          <p className="text-sm text-gray-600 mt-1">View and manage all invoices</p>
        </div>
        <div className="flex items-center gap-2">
          {canExportData() && (
            <button
              onClick={() => {
                const rows = sortedInvoices.map((inv) => ({
                  'Invoice Number': inv.invoiceNumber || 'N/A',
                  'Loan Account No': getLeadName(inv.lead?._id || inv.lead?.id || inv.lead || inv.leadId) || 'N/A',
                  'Invoice Type': inv.invoiceType || 'N/A',
                  Partner: inv.agent?.name || 'N/A',
                  Associated: getAssociatedForInvoice(inv),
                  'Commission Amount': inv.commissionAmount ?? '',
                  'GST Amount': getGstAmountForExcel(inv),
                  'TDS Amount': inv.tdsAmount ?? '',
                  'Net Payable': inv.netPayable ?? '',
                  Status: inv.status || 'N/A',
                  'Invoice Date': inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : 'N/A',
                  'Receiver Bank A/c Holder': getReceiverBankDetailsForExcel(inv).accountHolderName ?? '',
                  'Receiver Account Number': getReceiverBankDetailsForExcel(inv).accountNumber ?? '',
                  'Receiver IFSC': getReceiverBankDetailsForExcel(inv).ifsc ?? '',
                  'Receiver Branch': getReceiverBankDetailsForExcel(inv).branch ?? '',
                  'Receiver Bank Name': getReceiverBankDetailsForExcel(inv).bankName ?? '',
                }))
                exportToExcel(rows, `invoices_export_${Date.now()}`, 'Invoices')
                toast.success('Export', `Exported ${rows.length} invoices to Excel`)
              }}
              disabled={sortedInvoices.length === 0}
              title="Export currently filtered data to Excel"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-5 h-5" />
              <span>Export to Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">₹{totalAmount.toLocaleString()}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Paid</span>
            <span className="font-bold text-green-600">₹{paidAmount.toLocaleString()}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Pending</span>
            <span className="font-bold text-orange-600">₹{filteredPendingTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
        <StatCard
          title="Total Invoices"
          value={totalInvoices.toString()}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Paid Invoices"
          value={paidInvoices.toString()}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Total Amount"
          value={`₹${totalAmount.toLocaleString()}`}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="Paid Amount"
          value={`₹${paidAmount.toLocaleString()}`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pending total (filtered)"
          value={`₹${filteredPendingTotal.toLocaleString('en-IN')}`}
          icon={Clock}
          color="orange"
        />
      </div>

      {/* Search and Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by invoice number, loan account, agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Filter size={18} />
              Filters
              {filtersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
        {filtersOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
              <select
                value={franchiseFilter}
                onChange={(e) => {
                  const v = e.target.value
                  setFranchiseFilter(v)
                  if (v && !invoiceTypeFilter) setInvoiceTypeFilter('franchise')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
              >
                <option value="">All franchises</option>
                {franchises.map((f) => <option key={f._id || f.id} value={f._id || f.id}>{f.name || 'Unnamed'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice type</label>
              <select value={invoiceTypeFilter} onChange={(e) => setInvoiceTypeFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                <option value="">All types</option>
                <option value="franchise">Franchise</option>
                <option value="agent">Agent</option>
                <option value="sub_agent">Sub Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
              <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                <option value="">All partners</option>
                {agents.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email || 'Unnamed'}</option>)}
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
        )}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <button type="button" onClick={clearInvoiceFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
            <span className="text-sm text-gray-500">
              Showing {filteredInvoices.length} of {invoices.length} invoices
              <span className="mx-2 text-gray-300">|</span>
              <span className="font-semibold text-gray-800">Total amount: ₹{filteredTotalAmount.toLocaleString('en-IN')}</span>
            </span>
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
                  onClick={() => handleSort('invoiceNumber')}
                >
                  <div className="flex items-center gap-2">
                    Invoice #
                    {getSortIcon('invoiceNumber')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('invoiceType')}
                >
                  <div className="flex items-center gap-2">
                    Invoice Type
                    {getSortIcon('invoiceType')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    Amount
                    {getSortIcon('amount')}
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
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    Created
                    {getSortIcon('createdAt')}
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
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => (
                  <tr key={invoice.id || invoice._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {(() => {
                          // First try to get from populated lead object - prioritize customerName
                          if (invoice.lead && typeof invoice.lead === 'object') {
                            return invoice.lead.customerName || invoice.lead.loanAccountNo || invoice.lead.leadId || 'N/A';
                          }
                          // Fallback to lookup in leads array
                          const leadId = invoice.lead?._id || invoice.lead?.id || invoice.lead || invoice.leadId;
                          return getLeadName(leadId);
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          invoice.invoiceType === 'agent' 
                            ? 'bg-blue-100 text-blue-700' 
                            : invoice.invoiceType === 'sub_agent'
                            ? 'bg-green-100 text-green-700'
                            : invoice.invoiceType === 'franchise' && invoice.isReferralFranchise
                            ? 'bg-orange-100 text-orange-700'
                            : invoice.invoiceType === 'franchise'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {invoice.invoiceType === 'agent' 
                            ? 'Partner' 
                            : invoice.invoiceType === 'sub_agent' 
                            ? 'Sub Partner' 
                            : invoice.invoiceType === 'franchise' && invoice.isReferralFranchise
                            ? 'Referral Franchise'
                            : invoice.invoiceType === 'franchise' 
                            ? 'Franchise' 
                            : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{(invoice.commissionAmount || invoice.netPayable || invoice.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.createdAt}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownloadInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {canEditInvoice && (
                          <select
                            value={invoice.status || 'pending'}
                            onChange={(e) => {
                              const newStatus = e.target.value
                              const invoiceId = invoice.id || invoice._id
                              if (!invoiceId) {
                                toast.error('Error', 'Invoice ID is missing')
                                return
                              }
                              requestInvoiceStatusChange(invoice, newStatus)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                            title="Change Status"
                          >
                            <option value="pending">Pending</option>
                            <option value="gst_paid">GST Paid</option>
                            <option value="paid">Paid</option>
                            <option value="regular_paid">Regular Paid</option>
                          </select>
                        )}
                        <button
                          onClick={() => handleView(invoice)}
                          className="text-primary-900 hover:text-primary-800 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEditInvoice && (
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteInvoice && (
                          <button
                            onClick={() => handleDeleteClick(invoice)}
                            className="text-red-600 hover:text-red-900 p-1"
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
        {sortedInvoices.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedInvoices.length}</span> of{' '}
              <span className="font-medium">{sortedInvoices.length}</span> invoices
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Invoice"
      >
        <InvoiceForm leads={leads} onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Edit Invoice"
      >
        <InvoiceForm invoice={selectedInvoice} leads={leads} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedInvoice(null)
          setFullInvoiceDetails(null)
          setCompanySettings(null)
          setDetailModalAttachments([])
        }}
        title="Invoice Details"
        size="lg"
      >
        {loadingInvoiceDetails ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading invoice details...</p>
          </div>
        ) : (fullInvoiceDetails || selectedInvoice) && (() => {
          const invoice = fullInvoiceDetails || selectedInvoice
          const isGST = invoice.agent?.agentType === 'GST' || invoice.franchise?.franchiseType === 'GST'
          const cgstRate = companySettings?.taxConfig?.cgstRate || 9
          const sgstRate = companySettings?.taxConfig?.sgstRate || 9
          const commissionAmount = invoice.commissionAmount || 0
          const tdsAmount = invoice.tdsAmount || 0
          const tdsPercentage = invoice.tdsPercentage || 0
          const netPayable = invoice.netPayable || 0
          
          // Calculate GST if applicable
          let cgstAmount = 0
          let sgstAmount = 0
          let totalGstAmount = 0
          let totalAmountWithGst = 0
          
          if (isGST && commissionAmount > 0) {
            totalGstAmount = (commissionAmount * (cgstRate + sgstRate)) / 100
            cgstAmount = (commissionAmount * cgstRate) / 100
            sgstAmount = (commissionAmount * sgstRate) / 100
            totalAmountWithGst = commissionAmount + totalGstAmount
          }
          
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Invoice Number</label>
                  <p className="mt-1 text-sm font-mono text-gray-900">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Invoice Type</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{invoice.invoiceType || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer Name</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {(() => {
                      if (invoice.lead && typeof invoice.lead === 'object') {
                        return invoice.lead.customerName || invoice.lead.loanAccountNo || invoice.lead.leadId || 'N/A';
                      }
                      return getLeadName(invoice.leadId || invoice.lead);
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Partner</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {invoice.agent?.name || 'N/A'}
                    {invoice.agent?.agentType === 'GST' && (
                      <span className="ml-2 text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">GST</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Franchise</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {invoice.franchise?.name || 'N/A'}
                    {invoice.franchise?.franchiseType === 'GST' && (
                      <span className="ml-2 text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">GST</span>
                    )}
                  </p>
                </div>
                {invoice.subAgent && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sub Partner</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {invoice.subAgent?.name || 'N/A'}
                      {invoice.subAgent?.agentType === 'GST' && (
                        <span className="ml-2 text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">GST</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Financial Details */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Commission Amount</label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      ₹{commissionAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  {isGST && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-500">GST Type</label>
                        <p className="mt-1 text-sm text-gray-900">CGST + SGST</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">CGST ({cgstRate}%)</label>
                        <p className="mt-1 text-sm text-gray-900">
                          ₹{cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">SGST ({sgstRate}%)</label>
                        <p className="mt-1 text-sm text-gray-900">
                          ₹{sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total GST ({(cgstRate + sgstRate)}%)</label>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          ₹{totalGstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Amount (with GST)</label>
                        <p className="mt-1 text-sm font-semibold text-blue-900">
                          ₹{totalAmountWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">TDS ({tdsPercentage}%)</label>
                    <p className="mt-1 text-sm text-gray-900">
                      ₹{tdsAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Net Payable</label>
                    <p className="mt-1 text-sm font-bold text-green-900">
                      ₹{netPayable.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Invoice Date</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created Date</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  {invoice.agent?.gst && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Partner GST No</label>
                      <p className="mt-1 text-sm text-gray-900">{invoice.agent.gst}</p>
                    </div>
                  )}
                  {invoice.franchise?.gst && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Franchise GST No</label>
                      <p className="mt-1 text-sm text-gray-900">{invoice.franchise.gst}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Attachments</h3>
                {loadingDetailAttachments ? (
                  <p className="text-sm text-gray-500">Loading attachments...</p>
                ) : detailModalAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {detailModalAttachments.map((att) => {
                      const docId = att.id || att._id
                      const fileName = att.originalFileName || att.fileName || 'Attachment'
                      const fileSize = att.fileSize ? ` (${(att.fileSize / 1024).toFixed(2)} KB)` : ''
                      const handleViewAttachment = () => {
                        if (!docId) return
                        const base = API_BASE_URL.replace(/\/api$/, '')
                        window.open(`${base}/api/documents/${docId}/download`, '_blank', 'noopener')
                      }
                      return (
                        <div
                          key={docId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <File className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{fileName}{fileSize}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleViewAttachment}
                            className="flex items-center gap-1.5 px-3 py-2 text-primary-700 hover:bg-primary-50 rounded-lg text-sm font-medium transition-colors"
                            title="Open / Download"
                          >
                            <Download className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No attachments</p>
                )}
              </div>

              {canEditInvoice && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false)
                      handleEdit(invoice)
                    }}
                    className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                  >
                    Edit Invoice
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, invoice: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${confirmDelete.invoice?.invoiceNumber || 'this invoice'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmModal
        isOpen={confirmInvoiceStatus.isOpen}
        onClose={() =>
          setConfirmInvoiceStatus({ isOpen: false, invoice: null, currentStatus: '', newStatus: '' })
        }
        onConfirm={handleInvoiceStatusConfirm}
        title="Change invoice status?"
        message={`Are you sure you want to change the status from ${formatInvoiceStatusLabel(confirmInvoiceStatus.currentStatus)} to ${formatInvoiceStatusLabel(confirmInvoiceStatus.newStatus)}?`}
        confirmText="Change status"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  )
}

export default AccountantInvoices

