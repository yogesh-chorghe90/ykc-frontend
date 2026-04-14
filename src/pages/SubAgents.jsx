import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Eye, Edit, Trash2, UserCheck } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import StatCard from '../components/StatCard'
import {
  formatAadhaarNumber,
  formatBankAccountNumber,
  formatGstNumber,
  formatIfscCode,
  formatMobileNumber,
  formatPanNumber,
  IFSC_FORMAT_HINT,
  isIfscValidOrIncomplete,
  isValidGstNumber,
  isValidIfscCode,
} from '../utils/identifierFormatters'

const SubAgents = () => {
  const [subAgents, setSubAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedSubAgent, setSelectedSubAgent] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, subAgent: null })

  const [userRole, setUserRole] = useState(authService.getUser()?.role)
  const isAgent = userRole === 'agent'
  const isAdmin = userRole === 'super_admin'
  const canAccess = isAgent || isAdmin

  // Refresh user data on mount to ensure role is up-to-date
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const currentUser = await api.auth.getCurrentUser()
        const userData = currentUser?.data || currentUser
        if (userData) {
          authService.setUser(userData)
          setUserRole(userData.role)
        }
      } catch (error) {
        console.error('Error refreshing user data on mount:', error)
      }
    }
    refreshUserData()
  }, [])

  useEffect(() => {
    if (canAccess) {
      fetchSubAgents()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, userRole])

  const fetchSubAgents = async () => {
    try {
      setLoading(true)
      
      const response = await api.subAgents.getAll()
      const subAgentsData = response.data || response || []
      setSubAgents(Array.isArray(subAgentsData) ? subAgentsData : [])
    } catch (error) {
      console.error('Error fetching sub-agents:', error)
      setSubAgents([])
      
      // If error was already shown by apiRequest (has _toastShown flag), don't show again
      if (error._toastShown) {
        // Error toast was already shown by the global apiRequest handler
        // Only log it, don't show another toast
        return
      }
      
      // Only show error if it's a specific sub-agents error (not a general permission error)
      // The global apiRequest already handles 403 errors with proper toast
      if (error.message && !error.message.includes('Insufficient permissions')) {
        toast.error('Error', error.message || 'Failed to fetch sub-agents')
      }
    } finally {
      setLoading(false)
    }
  }

  // Filter and search sub-agents
  const filteredSubAgents = useMemo(() => {
    if (!subAgents || subAgents.length === 0) return []

    return subAgents.filter((subAgent) => {
      if (!subAgent) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (subAgent.name && subAgent.name.toLowerCase().includes(searchLower)) ||
        (subAgent.email && subAgent.email.toLowerCase().includes(searchLower)) ||
        (subAgent.mobile && subAgent.mobile.toString().includes(searchTerm)) ||
        (subAgent.phone && subAgent.phone.toString().includes(searchTerm))
      const matchesStatus = statusFilter === 'all' || subAgent.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [subAgents, searchTerm, statusFilter])

  const handleCreate = () => {
    setSelectedSubAgent(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (subAgent) => {
    setSelectedSubAgent(subAgent)
    setIsEditModalOpen(true)
  }

  const handleView = (subAgent) => {
    setSelectedSubAgent(subAgent)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    try {
      if (selectedSubAgent) {
        // Update existing sub-agent
        const subAgentId = selectedSubAgent.id || selectedSubAgent._id
        if (!subAgentId) {
          toast.error('Error', 'Sub-agent ID is missing')
          return
        }
        const updateData = {
          name: formData.name,
          email: formData.email,
          mobile: formData.phone || formData.mobile,
          status: formData.status,
          kyc: formData.kyc || undefined,
          bankDetails: formData.bankDetails || undefined,
        }
        await api.subAgents.update(subAgentId, updateData)
        await fetchSubAgents()
        setIsEditModalOpen(false)
        toast.success('Success', 'Sub-agent updated successfully')
      } else {
        const { phone, ...rest } = formData

        if (!phone || !phone.trim()) {
          toast.error('Error', 'Phone number is required')
          return
        }

        const subAgentData = {
          name: rest.name,
          email: rest.email,
          mobile: phone.trim(),
          status: rest.status || 'active',
          kyc: rest.kyc || undefined,
          bankDetails: rest.bankDetails || undefined,
        }

        await api.subAgents.create(subAgentData)
        await fetchSubAgents()
        setIsCreateModalOpen(false)
        toast.success('Success', 'Sub-agent created successfully')
      }
      setSelectedSubAgent(null)
    } catch (error) {
      console.error('Error saving sub-agent:', error)
      toast.error('Error', error.message || 'Failed to save sub-agent')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (subAgent) => {
    setConfirmDelete({ isOpen: true, subAgent })
  }

  const handleDeleteConfirm = async () => {
    const subAgent = confirmDelete.subAgent
    const subAgentId = subAgent.id || subAgent._id
    if (!subAgentId) {
      toast.error('Error', 'Sub-agent ID is missing')
      return
    }

    try {
      await api.subAgents.delete(subAgentId)
      await fetchSubAgents()
      toast.success('Success', `Sub-agent "${subAgent.name || 'this sub-agent'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, subAgent: null })
    } catch (error) {
      console.error('Error deleting sub-agent:', error)
      toast.error('Error', error.message || 'Failed to delete sub-agent')
    }
  }

  // Calculate statistics
  const totalSubAgents = subAgents.length
  const activeSubAgents = subAgents.filter(a => a.status === 'active').length

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  if (!canAccess) {
    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">
            Access Denied. Only agents and admins can access this page.
            {userRole && <span className="block mt-2 text-sm">Your current role: {userRole}</span>}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub Partners Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your sub-partner profiles</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors uppercase tracking-wide"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span className="whitespace-nowrap">Create Sub Partner</span>
        </button>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{totalSubAgents}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeSubAgents}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Total Sub Partners"
          value={totalSubAgents}
          icon={UserCheck}
          color="blue"
        />
        <StatCard
          title="Active Sub Partners"
          value={activeSubAgents}
          icon={UserCheck}
          color="green"
        />
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredSubAgents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No sub-partners found
                  </td>
                </tr>
              ) : (
                filteredSubAgents.map((subAgent, index) => {
                  const subAgentId = subAgent.id || subAgent._id

                  return (
                    <tr key={subAgentId || `subagent-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{subAgent.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{subAgent.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{subAgent.mobile || subAgent.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={subAgent.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(subAgent)}
                            className="text-primary-900 hover:text-primary-800 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(subAgent)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(subAgent)}
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
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Sub Partner"
      >
        <SubAgentForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} isSaving={isSaving} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedSubAgent(null)
        }}
        title="Edit Sub Partner"
      >
        <SubAgentForm subAgent={selectedSubAgent} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} isSaving={isSaving} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedSubAgent(null)
        }}
        title="Sub Partner Details"
        size="md"
      >
        {selectedSubAgent && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{formatMobileNumber(selectedSubAgent.phone || selectedSubAgent.mobile) || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedSubAgent.status} />
                </div>
              </div>
            </div>

            {/* KYC Details */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">KYC Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">PAN</label>
                  <p className="mt-1 text-sm text-gray-900">{formatPanNumber(selectedSubAgent.kyc?.pan) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Aadhaar</label>
                  <p className="mt-1 text-sm text-gray-900">{formatAadhaarNumber(selectedSubAgent.kyc?.aadhaar) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">GST</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.kyc?.gst || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Account Holder Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.bankDetails?.accountHolderName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Account Number</label>
                  <p className="mt-1 text-sm text-gray-900">{formatBankAccountNumber(selectedSubAgent.bankDetails?.accountNumber) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Bank Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.bankDetails?.bankName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Branch</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.bankDetails?.branch || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">IFSC</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubAgent.bankDetails?.ifsc || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedSubAgent)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Sub Partner
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, subAgent: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Sub Partner"
        message={`Are you sure you want to delete sub-agent "${confirmDelete.subAgent?.name || 'this sub-agent'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

// Simplified SubAgent Form Component
const SubAgentForm = ({ subAgent, onSave, onClose, isSaving = false }) => {
  const [formData, setFormData] = useState({
    name: subAgent?.name || '',
    email: subAgent?.email || '',
    phone: formatMobileNumber(subAgent?.phone || subAgent?.mobile || ''),
    status: subAgent?.status || 'active',
    // GST / Non-GST type for sub partner (uses same agentType field as main agents)
    agentType: subAgent?.agentType || 'normal',
    kyc: {
      ...(subAgent?.kyc || {}),
      pan: formatPanNumber(subAgent?.kyc?.pan),
      aadhaar: formatAadhaarNumber(subAgent?.kyc?.aadhaar),
      gst: subAgent?.kyc?.gst || '',
    },
    bankDetails: {
      ...(subAgent?.bankDetails || {}),
      accountHolderName: subAgent?.bankDetails?.accountHolderName || '',
      accountNumber: formatBankAccountNumber(subAgent?.bankDetails?.accountNumber),
      bankName: subAgent?.bankDetails?.bankName || '',
      branch: subAgent?.bankDetails?.branch || '',
      ifsc: subAgent?.bankDetails?.ifsc || '',
    },
  })

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    if (name === 'phone' || name === 'mobile') {
      formattedValue = formatMobileNumber(value)
    }
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      if (parent === 'kyc' && child === 'pan') formattedValue = formatPanNumber(value)
      if (parent === 'kyc' && child === 'aadhaar') formattedValue = formatAadhaarNumber(value)
      if (parent === 'kyc' && child === 'gst') formattedValue = formatGstNumber(value)
      if (parent === 'bankDetails' && child === 'accountNumber') formattedValue = formatBankAccountNumber(value)
      if (parent === 'bankDetails' && child === 'ifsc') formattedValue = formatIfscCode(value)
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...(prev[parent] || {}), [child]: formattedValue },
      }))
      if (parent === 'bankDetails' && child === 'ifsc') {
        const msg = formattedValue && !isIfscValidOrIncomplete(formattedValue) ? IFSC_FORMAT_HINT : ''
        setErrors((prev) => ({ ...prev, [name]: msg }))
      } else if (parent === 'kyc' && child === 'gst') {
        const msg = formattedValue && !isValidGstNumber(formattedValue)
          ? 'GST number format is invalid (e.g., 27ABCDE1234F1Z5)'
          : ''
        setErrors((prev) => ({ ...prev, [name]: msg }))
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: formattedValue }))
    }
    if (errors[name] && name !== 'bankDetails.ifsc' && name !== 'kyc.gst') {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    const gst = formData.kyc?.gst?.trim() || ''
    if (gst && !isValidGstNumber(gst)) newErrors['kyc.gst'] = 'GST number format is invalid (e.g., 27ABCDE1234F1Z5)'

    const ifsc = formData.bankDetails?.ifsc?.trim() || ''
    if (ifsc && !isValidIfscCode(ifsc)) newErrors['bankDetails.ifsc'] = IFSC_FORMAT_HINT


    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      onSave(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter full name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter email address"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter phone number"
        />
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* GST Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sub Partner Type (GST / Normal) <span className="text-red-500">*</span>
        </label>
        <select
          name="agentType"
          value={formData.agentType}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="normal">Normal</option>
          <option value="GST">GST</option>
        </select>
      </div>


      {/* KYC Fields */}
      <div className={`grid grid-cols-1 gap-4 ${formData.agentType === 'GST' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
          <input
            type="text"
            name="kyc.pan"
            value={formData.kyc?.pan || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="PAN number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar</label>
          <input
            type="text"
            name="kyc.aadhaar"
            value={formData.kyc?.aadhaar || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Aadhaar number"
          />
        </div>
        {formData.agentType === 'GST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
            <input
              type="text"
              name="kyc.gst"
              value={formData.kyc?.gst || ''}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors['kyc.gst'] ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g. 27ABCDE1234F1Z5"
              maxLength={15}
              inputMode="text"
              pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$"
            />
            {errors['kyc.gst'] && <p className="mt-1 text-sm text-red-600">{errors['kyc.gst']}</p>}
          </div>
        )}
      </div>

      {/* Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
          <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails?.accountHolderName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account holder name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails?.accountNumber || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input type="text" name="bankDetails.bankName" value={formData.bankDetails?.bankName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input type="text" name="bankDetails.branch" value={formData.bankDetails?.branch || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Branch" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
          <input
            type="text"
            name="bankDetails.ifsc"
            value={formData.bankDetails?.ifsc || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg ${errors['bankDetails.ifsc'] ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="e.g. HDFC0001234 or BARB0KHARAD"
            maxLength={11}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-gray-500">{IFSC_FORMAT_HINT}</p>
          {errors['bankDetails.ifsc'] && (
            <p className="mt-1 text-sm text-red-600">{errors['bankDetails.ifsc']}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50">
          {isSaving ? 'Saving...' : (subAgent ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  )
}

export default SubAgents

