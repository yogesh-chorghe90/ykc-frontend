import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Users, Building2, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import StaffForm from '../components/StaffForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { formatMobileNumber } from '../utils/identifierFormatters'

const Staff = () => {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, staff: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await api.staff.getAll()
      const staffData = response.data || response || []
      setStaff(Array.isArray(staffData) ? staffData : [])
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const totalStaff = staff.length
  const activeStaff = staff.filter(s => s.status === 'active').length
  const totalSalary = staff.reduce((sum, s) => sum + (s.salary || 0), 0)
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map(dept => ({ value: dept, label: dept })),
  ]

  // Filter and search staff
  const filteredStaff = useMemo(() => {
    if (!staff || staff.length === 0) return []

    return staff.filter((member) => {
      if (!member) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (member.name && member.name.toLowerCase().includes(searchLower)) ||
        (member.email && member.email.toLowerCase().includes(searchLower)) ||
        (member.phone && member.phone.toString().includes(searchTerm)) ||
        (member.role && member.role.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter
      const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter
      return matchesSearch && matchesStatus && matchesDepartment
    })
  }, [staff, searchTerm, statusFilter, departmentFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || departmentFilter !== 'all'
  const clearStaffFilters = () => { setSearchTerm(''); setStatusFilter('all'); setDepartmentFilter('all') }

  // Sort staff
  const sortedStaff = useMemo(() => {
    if (!sortConfig.key) return filteredStaff

    return [...filteredStaff].sort((a, b) => {
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
  }, [filteredStaff, sortConfig])

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
    setSelectedStaff(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (member) => {
    setSelectedStaff(member)
    setIsEditModalOpen(true)
  }

  const handleView = (member) => {
    setSelectedStaff(member)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      if (selectedStaff) {
        // Update existing staff
        const staffId = selectedStaff.id || selectedStaff._id
        if (!staffId) {
          toast.error('Error', 'Staff ID is missing')
          return
        }
        // Map frontend fields to backend fields
        const updateData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || formData.mobile,
          mobile: formData.phone || formData.mobile, // Keep mobile for backward compatibility
          role: formData.role.toLowerCase(), // Backend expects lowercase: 'staff', 'accounts', 'admin'
          status: formData.status,
          department: formData.department?.trim() || undefined,
          salary: formData.salary ? parseFloat(formData.salary) : 0,
        }
        // Only include password if provided
        if (formData.password) {
          updateData.password = formData.password
        }
        await api.staff.update(staffId, updateData)
        await fetchStaff()
        setIsEditModalOpen(false)
        toast.success('Success', 'Staff updated successfully')
      } else {
        // Create new staff - map fields and generate default password
        const { phone, ...rest } = formData

        // Validate required fields
        if (!phone || !phone.trim()) {
          toast.error('Error', 'Phone number is required')
          return
        }
        if (!rest.password || !rest.password.trim()) {
          toast.error('Error', 'Password is required')
          return
        }

        const staffData = {
          name: rest.name,
          email: rest.email,
          phone: phone.trim(), // Send phone directly
          mobile: phone.trim(), // Also send mobile for backward compatibility
          password: rest.password, // Password is required for new staff
          role: rest.role.toLowerCase(), // Backend expects lowercase: 'staff', 'accounts', 'franchise_manager', 'admin'
          status: rest.status || 'active',
          department: rest.department?.trim() || undefined, // Department is required in form
          salary: rest.salary ? parseFloat(rest.salary) : 0,
        }

        console.log('🔍 DEBUG: Creating staff with data:', JSON.stringify(staffData, null, 2))

        await api.staff.create(staffData)
        await fetchStaff()
        setIsCreateModalOpen(false)
        toast.success('Success', 'Staff created successfully')
      }
      setSelectedStaff(null)
    } catch (error) {
      console.error('Error saving staff:', error)
      toast.error('Error', error.message || 'Failed to save staff')
    }
  }

  const handleDeleteClick = (member) => {
    setConfirmDelete({ isOpen: true, staff: member })
  }

  const handleDeleteConfirm = async () => {
    const member = confirmDelete.staff
    const staffId = member.id || member._id
    if (!staffId) {
      toast.error('Error', 'Staff ID is missing')
      return
    }
    try {
      await api.staff.delete(staffId)
      await fetchStaff()
      setConfirmDelete({ isOpen: false, staff: null })
      toast.success('Success', 'Staff deleted successfully')
    } catch (error) {
      console.error('Error deleting staff:', error)
      toast.error('Error', error.message || 'Failed to delete staff')
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage staff members and roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const rows = sortedStaff.map((s) => ({
                Name: s.name || 'N/A',
                Email: s.email || 'N/A',
                Phone: s.phone || s.mobile || 'N/A',
                Role: s.role || 'N/A',
                Department: s.department || 'N/A',
                Salary: s.salary ?? '',
                Status: s.status || 'N/A',
              }))
              exportToExcel(rows, `staff_export_${Date.now()}`, 'Staff')
              toast.success('Export', `Exported ${rows.length} staff to Excel`)
            }}
            disabled={sortedStaff.length === 0}
            title="Export currently filtered data to Excel"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            <span>Export to Excel</span>
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Staff</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{totalStaff}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeStaff}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Depts</span>
            <span className="font-bold text-orange-600">{departments.length}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Staff"
          value={totalStaff}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Staff"
          value={activeStaff}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Departments"
          value={departments.length}
          icon={Building2}
          color="orange"
        />
        <StatCard
          title="Total Salary"
          value={`₹${(totalSalary / 1000).toFixed(0)}K`}
          icon={IndianRupeeIcon}
          color="purple"
        />
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-2 font-medium text-gray-900 uppercase tracking-wide">
            <Filter className="w-5 h-5 text-gray-500 shrink-0" />
            Filter options
            {hasActiveFilters && <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full uppercase">Active</span>}
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
                  <input type="text" placeholder="Name, email, phone, role..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {departmentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearStaffFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium uppercase tracking-wide">Clear all filters</button>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Showing {filteredStaff.length} of {staff.length} staff</span>
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
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center gap-2">
                    Role
                    {getSortIcon('role')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('department')}
                >
                  <div className="flex items-center gap-2">
                    Department
                    {getSortIcon('department')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('salary')}
                >
                  <div className="flex items-center gap-2">
                    Salary
                    {getSortIcon('salary')}
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
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedStaff.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                sortedStaff.map((member, index) => (
                  <tr key={member.id || member._id || `staff-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{member.mobile || member.phone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.role || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.department || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{(member.salary || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(member)}
                          className="text-primary-900 hover:text-primary-800 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(member)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(member)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedStaff.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedStaff.length}</span> of{' '}
              <span className="font-medium">{sortedStaff.length}</span> staff members
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Staff Member"
      >
        <StaffForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedStaff(null)
        }}
        title="Edit Staff Member"
      >
        <StaffForm staff={selectedStaff} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedStaff(null)
        }}
        title="Staff Details"
        size="md"
      >
        {selectedStaff && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedStaff.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedStaff.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{formatMobileNumber(selectedStaff.phone || selectedStaff.mobile) || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedStaff.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <p className="mt-1 text-sm text-gray-900">{selectedStaff.role || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="mt-1 text-sm text-gray-900">{selectedStaff.department || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Salary</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  ₹{(selectedStaff.salary || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedStaff)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Staff Member
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, staff: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Staff"
        message={`Are you sure you want to delete staff "${confirmDelete.staff?.name || 'this staff'}"? This action cannot be undone.`}
      />
    </div>
  )
}

export default Staff
