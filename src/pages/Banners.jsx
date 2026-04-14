import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, TrendingUp, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import BannerForm from '../components/BannerForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { authService } from '../services/auth.service'

const Banners = () => {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedBanner, setSelectedBanner] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, banner: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const userRole = authService.getUser()?.role || ''
  const isAdmin = userRole === 'super_admin'

  useEffect(() => {
    fetchBanners()
  }, [])

  const fetchBanners = async () => {
    try {
      setLoading(true)
      const response = await api.banners.getAll()
      const bannersData = response.data || response || []
      setBanners(Array.isArray(bannersData) ? bannersData : [])
    } catch (error) {
      console.error('Error fetching banners:', error)
      setBanners([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const totalBanners = banners.length
  const activeBanners = banners.filter(b => b.status === 'active').length

  // Filter and search banners
  const filteredBanners = useMemo(() => {
    if (!banners || banners.length === 0) return []

    return banners.filter((banner) => {
      if (!banner) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (banner.name && banner.name.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || banner.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [banners, searchTerm, statusFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all'
  const clearBannerFilters = () => { setSearchTerm(''); setStatusFilter('all') }

  // Sort banners
  const sortedBanners = useMemo(() => {
    if (!sortConfig.key) return filteredBanners

    return [...filteredBanners].sort((a, b) => {
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
  }, [filteredBanners, sortConfig])

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
    setSelectedBanner(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (banner) => {
    setSelectedBanner(banner)
    setIsEditModalOpen(true)
  }

  const handleView = (banner) => {
    setSelectedBanner(banner)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      if (selectedBanner) {
        const bannerId = selectedBanner.id || selectedBanner._id
        if (!bannerId) {
          toast.error('Error', 'Banner ID is missing')
          return
        }
        await api.banners.update(bannerId, formData)
        await fetchBanners()
        setIsEditModalOpen(false)
        toast.success('Success', 'Banner updated successfully')
      } else {
        const response = await api.banners.create(formData)
        if (response.success || response.data) {
          await fetchBanners()
          setIsCreateModalOpen(false)
          toast.success('Success', 'Banner created successfully')
        } else {
          throw new Error('Invalid response from server')
        }
      }
      setSelectedBanner(null)
    } catch (error) {
      console.error('Error saving banner:', error)
      toast.error('Error', error.message || 'Failed to save banner')
    }
  }

  const handleDeleteClick = (banner) => {
    setConfirmDelete({ isOpen: true, banner })
  }

  const handleDeleteConfirm = async () => {
    const banner = confirmDelete.banner
    const bannerId = banner.id || banner._id
    if (!bannerId) {
      toast.error('Error', 'Banner ID is missing')
      return
    }

    try {
      await api.banners.delete(bannerId)
      await fetchBanners()
      toast.success('Success', `Banner "${banner.name || 'this banner'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, banner: null })
    } catch (error) {
      console.error('Error deleting banner:', error)
      toast.error('Error', error.message || 'Failed to delete banner')
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
          <h1 className="text-2xl font-bold text-gray-900">Banners Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage banner images</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Banner</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{totalBanners}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{activeBanners}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Banners"
          value={totalBanners}
          icon={ImageIcon}
          color="blue"
        />
        <StatCard
          title="Active Banners"
          value={activeBanners}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
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
                  <input type="text" placeholder="Banner name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
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
                <button type="button" onClick={clearBannerFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium uppercase tracking-wide">Clear all filters</button>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Showing {filteredBanners.length} of {banners.length} banners</span>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preview
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Banner Name
                    {getSortIcon('name')}
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
                    Created At
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
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedBanners.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No banners found
                  </td>
                </tr>
              ) : (
                sortedBanners.map((banner) => {
                  const bannerId = banner.id || banner._id
                  const attachmentUrl = banner.attachment

                  return (
                    <tr key={bannerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attachmentUrl ? (
                          <img
                            src={attachmentUrl}
                            alt={banner.name}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div className="w-16 h-16 bg-gray-200 rounded-lg border border-gray-200 hidden items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{banner.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={banner.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {banner.createdAt ? new Date(banner.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(banner)}
                            className="text-primary-900 hover:text-primary-900 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(banner)}
                                className="text-gray-600 hover:text-gray-900 p-1"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(banner)}
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedBanners.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedBanners.length}</span> of{' '}
              <span className="font-medium">{sortedBanners.length}</span> banners
            </p>
          </div>
        )}
      </div>

      {/* Create Modal (admin only) */}
      {isAdmin && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            fetchBanners() // Refresh list when modal closes
          }}
          title="Create New Banner"
        >
          <BannerForm onSave={handleSave} onClose={() => {
            setIsCreateModalOpen(false)
            fetchBanners() // Refresh list when closing
          }} />
        </Modal>
      )}

      {/* Edit Modal (admin only) */}
      {isAdmin && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedBanner(null)
            fetchBanners() // Refresh list when modal closes
          }}
          title="Edit Banner"
        >
          <BannerForm banner={selectedBanner} onSave={handleSave} onClose={() => {
            setIsEditModalOpen(false)
            setSelectedBanner(null)
            fetchBanners() // Refresh list when closing
          }} />
        </Modal>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedBanner(null)
        }}
        title="Banner Details"
        size="md"
      >
        {selectedBanner && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Banner Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBanner.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedBanner.status} />
                </div>
              </div>
            </div>

            {selectedBanner.attachment && (
              <div>
                <label className="text-sm font-medium text-gray-500">Banner Image</label>
                <div className="mt-2">
                  <img
                    src={selectedBanner.attachment}
                    alt={selectedBanner.name}
                    className="w-full max-w-md rounded-lg border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-full max-w-md h-64 bg-gray-200 rounded-lg border border-gray-200 hidden items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedBanner)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Banner
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal (admin only) */}
      {isAdmin && (
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete({ isOpen: false, banner: null })}
          onConfirm={handleDeleteConfirm}
          title="Delete Banner"
          message={`Are you sure you want to delete banner "${confirmDelete.banner?.name || 'this banner'}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  )
}

export default Banners

