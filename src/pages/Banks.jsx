import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Building2, TrendingUp, FileText, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import BankForm from '../components/BankForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const Banks = () => {
  const [banks, setBanks] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedBank, setSelectedBank] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, bank: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchBanks()
    fetchLeads()
  }, [])

  const fetchBanks = async () => {
    try {
      setLoading(true)
      const response = await api.banks.getAll()
      const banksData = response.data || response || []
      setBanks(Array.isArray(banksData) ? banksData : [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      setBanks([])
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

  // Calculate statistics
  const totalBanks = banks.length
  const activeBanks = banks.filter(b => b.status === 'active').length
  const totalLoans = leads.length
  // Active loans are those that are not completed or rejected
  const activeLoans = leads.filter(l => ['logged', 'sanctioned', 'partial_disbursed', 'disbursed'].includes(l.status)).length

  // Get bank loan statistics
  const getBankLoanStats = (bankId) => {
    if (!bankId || !leads || leads.length === 0) {
      return { total: 0, active: 0, completed: 0 }
    }

    const bankLeads = leads.filter(lead => {
      const leadBankId = lead.bank?._id || lead.bank?.id || lead.bank || lead.bankId
      return leadBankId === bankId || leadBankId?.toString() === bankId?.toString()
    })

    return {
      total: bankLeads.length,
      // Active loans are those that are not completed or rejected
      active: bankLeads.filter(l => ['logged', 'sanctioned', 'partial_disbursed', 'disbursed'].includes(l.status)).length,
      completed: bankLeads.filter(l => l.status === 'completed').length,
    }
  }

  // Filter and search banks
  const filteredBanks = useMemo(() => {
    if (!banks || banks.length === 0) return []

    return banks.filter((bank) => {
      if (!bank) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (bank.name && bank.name.toLowerCase().includes(searchLower)) ||
        (bank.code && bank.code.toLowerCase().includes(searchLower)) ||
        (bank.contactPerson && bank.contactPerson.toLowerCase().includes(searchLower)) ||
        (bank.email && bank.email.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || bank.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [banks, searchTerm, statusFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all'
  const clearBankFilters = () => { setSearchTerm(''); setStatusFilter('all') }

  // Sort banks
  const sortedBanks = useMemo(() => {
    if (!sortConfig.key) return filteredBanks

    return [...filteredBanks].sort((a, b) => {
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
  }, [filteredBanks, sortConfig])

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
    setSelectedBank(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (bank) => {
    setSelectedBank(bank)
    setIsEditModalOpen(true)
  }

  const handleView = (bank) => {
    setSelectedBank(bank)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f11153c6-25cf-4c9c-a0b4-730f202e186d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Banks.jsx:150', message: 'Form data received in handleSave', data: formData, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
      // #endregion

      if (selectedBank) {
        const bankId = selectedBank.id || selectedBank._id
        if (!bankId) {
          toast.error('Error', 'Bank ID is missing')
          return
        }
        await api.banks.update(bankId, formData)
        await fetchBanks()
        await fetchLeads() // Refresh leads to update statistics
        setIsEditModalOpen(false)
        toast.success('Success', 'Bank updated successfully')
      } else {
        // #region agent log
        console.log('🔍 DEBUG: Form data before API call:', JSON.stringify(formData, null, 2));
        console.log('🔍 DEBUG: Checking required fields:', {
          name: formData.name,
          type: formData.type,
          contactEmail: formData.contactEmail,
          contactMobile: formData.contactMobile,
          contactPerson: formData.contactPerson,
          status: formData.status
        });
        fetch('http://127.0.0.1:7242/ingest/f11153c6-25cf-4c9c-a0b4-730f202e186d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Banks.jsx:163', message: 'Creating bank with data', data: formData, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        // Ensure all required fields are present and not empty
        // Form validation should have caught empty fields, but double-check here
        if (!formData.name?.trim() || !formData.type || !formData.contactEmail?.trim()) {
          console.error('❌ DEBUG: Missing required fields after validation:', {
            name: formData.name,
            type: formData.type,
            contactEmail: formData.contactEmail
          });
          toast.error('Error', 'Please fill all required fields');
          return;
        }

        const bankData = {
          name: formData.name.trim(),
          type: formData.type,
          contactEmail: formData.contactEmail.trim(),
          status: formData.status || 'active',
        };

        // Add optional fields only if they have values
        if (formData.contactMobile?.trim()) {
          bankData.contactMobile = formData.contactMobile.trim();
        }
        if (formData.contactPerson?.trim()) {
          bankData.contactPerson = formData.contactPerson.trim();
        }

        // Add custom fields if they exist
        if (formData.customFields && Object.keys(formData.customFields).length > 0) {
          bankData.customFields = formData.customFields;
        }

        console.log('🔍 DEBUG: Final bank data to send:', JSON.stringify(bankData, null, 2));
        console.log('🔍 DEBUG: Required fields check:', {
          hasName: !!bankData.name,
          hasType: !!bankData.type,
          hasContactEmail: !!bankData.contactEmail
        });

        const response = await api.banks.create(bankData)
        // #region agent log
        console.log('✅ DEBUG: API response received:', JSON.stringify(response, null, 2));
        fetch('http://127.0.0.1:7242/ingest/f11153c6-25cf-4c9c-a0b4-730f202e186d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Banks.jsx:214', message: 'API response received', data: response, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        if (response.success || response.data) {
          await fetchBanks()
          await fetchLeads() // Refresh leads to update statistics
          setIsCreateModalOpen(false)
          toast.success('Success', 'Bank created successfully and saved to database')
        } else {
          throw new Error('Invalid response from server')
        }
      }
      setSelectedBank(null)
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f11153c6-25cf-4c9c-a0b4-730f202e186d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Banks.jsx:170', message: 'Error saving bank', data: { error: error.message, formData }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
      // #endregion
      console.error('Error saving bank:', error)
      toast.error('Error', error.message || 'Failed to save bank')
    }
  }

  const handleDeleteClick = (bank) => {
    setConfirmDelete({ isOpen: true, bank })
  }

  const handleDeleteConfirm = async () => {
    const bank = confirmDelete.bank
    const bankId = bank.id || bank._id
    if (!bankId) {
      toast.error('Error', 'Bank ID is missing')
      return
    }

    try {
      await api.banks.delete(bankId)
      await fetchBanks()
      toast.success('Success', `Bank "${bank.name || 'this bank'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, bank: null })
    } catch (error) {
      console.error('Error deleting bank:', error)
      toast.error('Error', error.message || 'Failed to delete bank')
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
          <h1 className="text-2xl font-bold text-gray-900">Banks Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage bank partnerships</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedBanks.map((bank) => {
                const stats = getBankLoanStats(bank.id || bank._id)
                return {
                  Name: bank.name || 'N/A',
                  Code: bank.code || 'N/A',
                  'Contact Person': bank.contactPerson || 'N/A',
                  Email: bank.contactEmail || bank.email || 'N/A',
                  'Contact Mobile': bank.contactMobile || 'N/A',
                  Type: bank.type || 'N/A',
                  'Total Loans': stats.total,
                  'Active Loans': stats.active,
                  Completed: stats.completed,
                  Status: bank.status || 'N/A',
                }
              })
              exportToExcel(rows, `banks_export_${Date.now()}`, 'Banks')
              toast.success('Export', `Exported ${rows.length} banks to Excel`)
            }}
            disabled={sortedBanks.length === 0}
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
            <span>Create Bank</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Banks</span>
            <span className="font-bold text-gray-900">{totalBanks}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeBanks}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Loans</span>
            <span className="font-bold text-orange-600">{totalLoans}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Banks"
          value={totalBanks}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active Banks"
          value={activeBanks}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Total Loans"
          value={totalLoans}
          icon={FileText}
          color="orange"
        />
        <StatCard
          title="Active Loans"
          value={activeLoans}
          icon={FileText}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Name, code, contact, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearBankFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
                <span className="text-sm text-gray-500">Showing {filteredBanks.length} of {banks.length} banks</span>
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
                    Bank Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    {getSortIcon('type')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Person
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Info
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalLoans')}
                >
                  <div className="flex items-center gap-2">
                    Total Loans
                    {getSortIcon('totalLoans')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('activeLoans')}
                >
                  <div className="flex items-center gap-2">
                    Active Loans
                    {getSortIcon('activeLoans')}
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
              ) : sortedBanks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No banks found
                  </td>
                </tr>
              ) : (
                sortedBanks.map((bank) => {
                  const bankId = bank.id || bank._id
                  const loanStats = getBankLoanStats(bankId)

                  return (
                    <tr key={bankId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{bank.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">{bank.type || bank.code || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{bank.contactPerson || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{bank.contactEmail || bank.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{bank.contactMobile || bank.mobile || bank.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{loanStats.total}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-900">{loanStats.active}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={bank.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(bank)}
                            className="text-primary-900 hover:text-primary-900 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(bank)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(bank)}
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
        {sortedBanks.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedBanks.length}</span> of{' '}
              <span className="font-medium">{sortedBanks.length}</span> banks
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Bank"
      >
        <BankForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedBank(null)
        }}
        title="Edit Bank"
      >
        <BankForm bank={selectedBank} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedBank(null)
        }}
        title="Bank Details"
        size="md"
      >
        {selectedBank && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Bank Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBank.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Bank Code</label>
                <p className="mt-1 text-sm font-mono text-gray-900">{selectedBank.code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Contact Person</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBank.contactPerson}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedBank.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Contact Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBank.contactEmail || selectedBank.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Contact Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBank.contactMobile || selectedBank.phone}</p>
              </div>
            </div>

            {/* Custom Fields */}
            {selectedBank.customFields && Object.keys(selectedBank.customFields).length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Custom Fields</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedBank.customFields).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-500">{key}</label>
                      <p className="mt-1 text-sm text-gray-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loan Statistics */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Loan Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Loans</p>
                  <p className="text-lg font-bold text-gray-900">{selectedBank.totalLoans}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Active Loans</p>
                  <p className="text-lg font-bold text-primary-900">{selectedBank.activeLoans}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedBank)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Bank
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, bank: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Bank"
        message={`Are you sure you want to delete bank "${confirmDelete.bank?.name || 'this bank'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Banks
