import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileDown,
  Download,
  Loader2,
} from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import Form16Form from '../components/Form16Form'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { authService } from '../services/auth.service'

const Form16 = () => {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, form: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [detailDocuments, setDetailDocuments] = useState([])
  const [loadingDetailDocs, setLoadingDetailDocs] = useState(false)

  const userRole = authService.getUser()?.role
  const isAdminOrAccountant = userRole === 'super_admin' || userRole === 'accounts_manager'

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      setLoading(true)
      const response = await api.form16.getAll()
      const data = response.data || response || []
      setForms(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching Form 16:', error)
      setForms([])
    } finally {
      setLoading(false)
    }
  }

  const totalForms = forms.length

  const filteredForms = useMemo(() => {
    if (!forms || forms.length === 0) return []

    return forms.filter((form) => {
      if (!form) return false
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (form.fileName && form.fileName.toLowerCase().includes(searchLower)) ||
        (form.attachmentName && form.attachmentName.toLowerCase().includes(searchLower)) ||
        (form.formType && form.formType.toLowerCase().includes(searchLower))
      const formDate = form.attachmentDate
        ? new Date(form.attachmentDate).toISOString().slice(0, 10)
        : ''
      const matchesDate = !dateFilter || formDate === dateFilter
      return matchesSearch && matchesDate
    })
  }, [forms, searchTerm, dateFilter])

  const sortedForms = useMemo(() => {
    if (!sortConfig.key) return filteredForms

    return [...filteredForms].sort((a, b) => {
      if (!a || !b) return 0
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''
      if (sortConfig.key === 'attachmentDate') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredForms, sortConfig])

  const hasActiveFilters = searchTerm !== '' || dateFilter !== ''
  const clearFilters = () => {
    setSearchTerm('')
    setDateFilter('')
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

  const handleCreate = () => {
    setSelectedForm(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (form) => {
    setSelectedForm(form)
    setIsEditModalOpen(true)
  }

  const handleView = async (form) => {
    setSelectedForm(form)
    setDetailDocuments([])
    setIsDetailModalOpen(true)
    const entityId = form._id || form.id
    if (entityId) {
      setLoadingDetailDocs(true)
      try {
        const resp = await api.documents.list('form16', entityId)
        const docs = resp.data || resp || []
        setDetailDocuments(Array.isArray(docs) ? docs : [])
      } catch (e) {
        console.error('Error fetching form16 documents:', e)
      } finally {
        setLoadingDetailDocs(false)
      }
    }
  }

  const handleSave = async (formData) => {
    try {
      if (selectedForm) {
        const id = selectedForm.id || selectedForm._id
        if (!id) {
          toast.error('Error', 'Record ID is missing')
          return
        }
        await api.form16.update(id, formData)
        await fetchForms()
        setIsEditModalOpen(false)
        toast.success('Success', 'Form 16 updated successfully')
      } else {
        const response = await api.form16.create(formData)
        if (response.success || response.data) {
          await fetchForms()
          setIsCreateModalOpen(false)
          toast.success('Success', 'Form 16 created successfully')
        } else {
          throw new Error('Invalid response from server')
        }
      }
      setSelectedForm(null)
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Error', error.message || 'Failed to save')
    }
  }

  const handleDeleteClick = (form) => {
    setConfirmDelete({ isOpen: true, form })
  }

  const handleDeleteConfirm = async () => {
    const form = confirmDelete.form
    const id = form.id || form._id
    if (!id) {
      toast.error('Error', 'Record ID is missing')
      return
    }
    try {
      await api.form16.delete(id)
      await fetchForms()
      toast.success('Success', 'Form 16 record deleted successfully')
      setConfirmDelete({ isOpen: false, form: null })
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Error', error.message || 'Failed to delete')
    }
  }

  const formatDate = (d) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleDateString()
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Form 16 / TDS</h1>
              {/* Compact Inline Badge - Mobile Only */}
              <span className="md:hidden inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {totalForms} records
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage Form 16 and TDS documents</p>
          </div>
        </div>
        
        {/* Primary Action Button - Full Width on Mobile (Admin/Accountant only) */}
        {isAdminOrAccountant && (
          <button
            onClick={handleCreate}
            className="w-full md:w-auto md:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Form 16</span>
          </button>
        )}
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="Total Records" value={totalForms} icon={FileText} color="blue" />
      </div>

      {/* Filters - Collapsible Accordion */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900 text-sm">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            <span className="hidden sm:inline">Filter options</span>
            <span className="sm:hidden">Filters</span>
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </span>
          {filtersOpen ? (
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          )}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Attachment name, file name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Attachment Date
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  Clear all filters
                </button>
                <span className="text-sm text-gray-500">
                  Showing {filteredForms.length} of {forms.length} records
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('attachmentDate')}
                >
                  <div className="flex items-center gap-2">
                    Attachment Date
                    {getSortIcon('attachmentDate')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('attachmentName')}
                >
                  <div className="flex items-center gap-2">
                    Attachment Name
                    {getSortIcon('attachmentName')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
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
              ) : sortedForms.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                sortedForms.map((form) => (
                  <tr key={form.id || form._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(form.attachmentDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {form.attachmentName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {form.fileName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(form)}
                          className="text-primary-900 hover:text-primary-800 p-1"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdminOrAccountant && (
                          <>
                            <button
                              onClick={() => handleEdit(form)}
                              className="text-gray-600 hover:text-gray-900 p-1"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(form)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedForms.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedForms.length}</span> of{' '}
              <span className="font-medium">{sortedForms.length}</span> records
            </p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : sortedForms.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">No records found</p>
          </div>
        ) : (
          sortedForms.map((form) => (
            <div
              key={form.id || form._id}
              className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500">
                      {formatDate(form.attachmentDate)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {form.attachmentName || 'N/A'}
                  </h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleView(form)}
                    className="p-1.5 text-primary-900 hover:bg-primary-50 rounded"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {isAdminOrAccountant && (
                    <>
                      <button
                        onClick={() => handleEdit(form)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(form)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Card Details */}
              <div className="pt-2 border-t border-gray-100">
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-[80px]">File Name:</span>
                    <span className="text-xs text-gray-900 flex-1 break-words">
                      {form.fileName || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Mobile Summary */}
        {sortedForms.length > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-2.5">
            <p className="text-xs text-gray-600 text-center">
              Showing <span className="font-medium">{sortedForms.length}</span> of{' '}
              <span className="font-medium">{sortedForms.length}</span> records
            </p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          fetchForms()
        }}
        title="Create Form 16"
      >
        <Form16Form
          onSave={handleSave}
          onClose={() => {
            setIsCreateModalOpen(false)
            fetchForms()
          }}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedForm(null)
          fetchForms()
        }}
        title="Edit Form 16"
      >
        <Form16Form
          form16={selectedForm}
          onSave={handleSave}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedForm(null)
            fetchForms()
          }}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedForm(null)
          setDetailDocuments([])
        }}
        title="Form 16 Details"
        size="md"
      >
        {selectedForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Form Type</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{selectedForm.formType?.replace('form', 'Form ') || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Attachment Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedForm.attachmentName || 'N/A'}</p>
              </div>
              {selectedForm.user && (
                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedForm.user?.name || selectedForm.user?.email || 'N/A'}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(selectedForm.createdAt)}</p>
              </div>
            </div>

            {/* Files */}
            <div className="border-t border-gray-200 pt-3">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Files
                {detailDocuments.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-500">({detailDocuments.length})</span>
                )}
              </label>
              {loadingDetailDocs ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading files...
                </div>
              ) : detailDocuments.length > 0 ? (
                <div className="space-y-2">
                  {detailDocuments.map((doc) => {
                    const docId = doc._id || doc.id
                    const name = doc.originalFileName || doc.fileName || 'File'
                    const sizeKB = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''
                    return (
                      <div key={docId} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {sizeKB && <p className="text-xs text-gray-500">{sizeKB}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => api.documents.open(docId)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex-shrink-0"
                          title="View / Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                          View
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">No files attached</p>
              )}
            </div>

            {isAdminOrAccountant && (
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedForm)
                  }}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, form: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Form 16"
        message="Are you sure you want to delete this Form 16 / TDS record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Form16

