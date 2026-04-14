import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search, Building2, Mail, Phone, Plus, Filter, ChevronDown, ChevronUp, Users, Link2, Edit, Trash2 } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import RegionalManagerForm from '../components/RegionalManagerForm'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'

const RegionalManagers = () => {
  const navigate = useNavigate()
  const [regionalManagers, setRegionalManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRM, setSelectedRM] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, rm: null })
  const [assignFranchiseRM, setAssignFranchiseRM] = useState(null)
  const [assignFranchiseIds, setAssignFranchiseIds] = useState([])
  const [assignSaving, setAssignSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [usersRes, franchisesRes, rmsRes] = await Promise.all([
        api.users.getAll({ role: 'regional_manager', limit: 200 }),
        api.franchises.getAll({ limit: 500 }),
        api.relationshipManagers.getAll({ limit: 500 }),
      ])
      const users = usersRes?.data || []
      const franchList = Array.isArray(franchisesRes?.data) ? franchisesRes.data : franchisesRes?.franchises || []
      const rmsList = Array.isArray(rmsRes?.data) ? rmsRes.data : []
      setRegionalManagers(Array.isArray(users) ? users : [])
      setFranchises(franchList)
      setRelationshipManagers(rmsList)
    } catch (err) {
      setRegionalManagers([])
      setFranchises([])
      setRelationshipManagers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authService.getUser()?.role !== 'super_admin') {
      navigate('/', { replace: true })
      return
    }
    load()
  }, [navigate])

  const getFranchisesForRM = (rmId) =>
    franchises.filter((f) => f.regionalManager && (f.regionalManager._id || f.regionalManager).toString() === (rmId || '').toString())

  const filtered = useMemo(() => {
    return regionalManagers.filter((rm) => {
      const s = searchTerm.toLowerCase()
      const matchesSearch =
        !searchTerm ||
        (rm.name && rm.name.toLowerCase().includes(s)) ||
        (rm.email && rm.email.toLowerCase().includes(s)) ||
        (rm.phone && rm.phone.toString().includes(searchTerm)) ||
        (rm.mobile && rm.mobile.toString().includes(searchTerm))
      const matchesStatus = statusFilter === 'all' || rm.status === statusFilter
      let matchesFranchise = true
      if (franchiseFilter) {
        const rmFranchises = getFranchisesForRM(rm._id)
        matchesFranchise = rmFranchises.some((f) => (f._id || f.id).toString() === franchiseFilter)
      }
      return matchesSearch && matchesStatus && matchesFranchise
    })
  }, [regionalManagers, searchTerm, statusFilter, franchiseFilter, franchises])

  const kpis = useMemo(() => {
    const total = regionalManagers.length
    const active = regionalManagers.filter((r) => r.status === 'active').length
    const franchisesCovered = franchises.filter((f) => f.regionalManager).length
    const getCountForRM = (rmId) =>
      franchises.filter((f) => f.regionalManager && (f.regionalManager._id || f.regionalManager).toString() === (rmId || '').toString()).length
    const withoutFranchises = regionalManagers.filter((r) => getCountForRM(r._id) === 0).length
    return { total, active, franchisesCovered, withoutFranchises }
  }, [regionalManagers, franchises])

  const handleCreateRM = async (data) => {
    try {
      await api.users.create(data)
      toast.success('Success', 'Regional Manager created successfully')
      setIsCreateModalOpen(false)
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to create Regional Manager')
    }
  }

  const handleEditRM = (rm) => {
    setSelectedRM(rm)
    setIsEditModalOpen(true)
  }

  const handleUpdateRM = async (data) => {
    if (!selectedRM) return
    try {
      await api.users.update(selectedRM._id, data)
      toast.success('Success', 'Regional Manager updated successfully')
      setIsEditModalOpen(false)
      setSelectedRM(null)
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to update Regional Manager')
    }
  }

  const handleDeleteClick = (rm) => {
    setConfirmDelete({ isOpen: true, rm })
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.rm) return
    try {
      await api.users.delete(confirmDelete.rm._id)
      toast.success('Success', 'Regional Manager deleted successfully')
      setConfirmDelete({ isOpen: false, rm: null })
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to delete Regional Manager')
    }
  }

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== ''
  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
  }

  const openAssignFranchises = (rm) => {
    const currentIds = getFranchisesForRM(rm._id).map((f) => (f._id || f.id).toString())
    setAssignFranchiseRM(rm)
    setAssignFranchiseIds(currentIds)
  }

  const getRelationshipManagersForRM = (rmId) =>
    relationshipManagers.filter((r) => r.regionalManager && (r.regionalManager._id || r.regionalManager).toString() === (rmId || '').toString())

  const [assignRelationshipRM, setAssignRelationshipRM] = useState(null)
  const [assignRelationshipIds, setAssignRelationshipIds] = useState([])
  const [assignRelationshipSaving, setAssignRelationshipSaving] = useState(false)

  const openAssignRelationships = (rm) => {
    const currentIds = getRelationshipManagersForRM(rm._id).map((r) => (r._id || r.id).toString())
    setAssignRelationshipRM(rm)
    setAssignRelationshipIds(currentIds)
  }

  const toggleAssignRelationship = (relationshipId) => {
    const id = (relationshipId || '').toString()
    setAssignRelationshipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSaveAssignRelationships = async () => {
    if (!assignRelationshipRM) return
    setAssignRelationshipSaving(true)
    try {
      const rmId = assignRelationshipRM._id.toString()
      const updates = []
      for (const r of relationshipManagers) {
        const rid = (r._id || r.id).toString()
        const currentRM = r.regionalManager ? (r.regionalManager._id || r.regionalManager).toString() : null
        const shouldBeAssigned = assignRelationshipIds.includes(rid)
        if (shouldBeAssigned && currentRM !== rmId) {
          updates.push(api.relationshipManagers.update(rid, { regionalManager: rmId }))
        } else if (!shouldBeAssigned && currentRM === rmId) {
          updates.push(api.relationshipManagers.update(rid, { regionalManager: null }))
        }
      }
      await Promise.all(updates)
      toast.success('Success', 'Relationship manager assignments updated successfully')
      setAssignRelationshipRM(null)
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to update relationship manager assignments')
    } finally {
      setAssignRelationshipSaving(false)
    }
  }

  const toggleAssignFranchise = (franchiseId) => {
    const id = (franchiseId || '').toString()
    setAssignFranchiseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSaveAssignFranchises = async () => {
    if (!assignFranchiseRM) return
    setAssignSaving(true)
    try {
      const rmId = assignFranchiseRM._id.toString()
      const updates = []
      for (const f of franchises) {
        const fid = (f._id || f.id).toString()
        const currentRM = f.regionalManager ? (f.regionalManager._id || f.regionalManager).toString() : null
        const shouldBeAssigned = assignFranchiseIds.includes(fid)
        if (shouldBeAssigned && currentRM !== rmId) {
          updates.push(api.franchises.update(fid, { regionalManager: rmId }))
        } else if (!shouldBeAssigned && currentRM === rmId) {
          updates.push(api.franchises.update(fid, { regionalManager: null }))
        }
      }
      await Promise.all(updates)
      toast.success('Success', 'Franchise assignments updated successfully')
      setAssignFranchiseRM(null)
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to update franchise assignments')
    } finally {
      setAssignSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Regional Managers</span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Regional Managers</h1>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium uppercase tracking-wide"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span className="whitespace-nowrap">Add Regional Manager</span>
        </button>
      </div>

      {/* Compact Summary Bar - Mobile Only */}
      <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Total</span>
            <span className="font-bold text-gray-900">{kpis.total}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Active</span>
            <span className="font-bold text-green-600">{kpis.active}</span>
          </div>
          <span className="text-gray-300 mx-1">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Franchises</span>
            <span className="font-bold text-orange-600">{kpis.franchisesCovered}</span>
          </div>
        </div>
      </div>

      {/* KPIs - Desktop Only */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Regional Managers" value={kpis.total} icon={Users} color="blue" />
        <StatCard title="Active" value={kpis.active} icon={MapPin} color="green" />
        <StatCard title="Franchises Covered" value={kpis.franchisesCovered} icon={Building2} color="purple" />
        <StatCard title="Unassigned" value={kpis.withoutFranchises} icon={MapPin} color="orange" />
      </div>

      {/* Filters - Sticky on Mobile */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900 uppercase tracking-wide">
            <Filter className="w-5 h-5 text-gray-500 shrink-0" />
            Filters
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full uppercase">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Name, email, mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[120px]"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Franchise</label>
              <select
                value={franchiseFilter}
                onChange={(e) => setFranchiseFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[180px]"
              >
                <option value="">All franchises</option>
                {franchises.map((f) => (
                  <option key={f._id || f.id} value={f._id || f.id}>
                    {f.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((rm) => {
            const rmFranchises = getFranchisesForRM(rm._id)
            const rmRelationships = getRelationshipManagersForRM(rm._id)
            return (
              <div
                key={rm._id}
                className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 uppercase">{rm.name || 'Unnamed'}</h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      {rm.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span className="email-lowercase" data-email="true">{rm.email}</span>
                        </span>
                      )}
                      {(rm.mobile || rm.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {rm.mobile || rm.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Assigned Franchises ({rmFranchises.length})
                      </h3>
                      {rmFranchises.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {rmFranchises.map((f) => (
                            <li key={f._id} className="text-sm text-gray-600 pl-6">
                              <span className="uppercase">{f.name}</span>{' '}
                              {f.address && typeof f.address === 'object'
                                ? `• ${(f.address.city || f.address.line1 || '').toString().toUpperCase()}`
                                : f.address
                                  ? `• ${String(f.address).toUpperCase()}`
                                  : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1 pl-6">No franchises assigned</p>
                      )}
                      <div className="mt-4">
                        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          Assigned Relationship Managers ({rmRelationships.length})
                        </h3>
                        {rmRelationships.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {rmRelationships.map((r) => (
                              <li key={r._id} className="text-sm text-gray-600 pl-6">
                                <span className="uppercase">{r.name}</span>
                                {r.email ? (
                                  <>
                                    {' • '}
                                    <span className="email-lowercase" data-email="true">{r.email}</span>
                                  </>
                                ) : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 pl-6">No relationship managers assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openAssignFranchises(rm)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200"
                    >
                      <Link2 className="w-4 h-4" />
                      Assign franchises
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssignRelationships(rm)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200"
                    >
                      <Users className="w-4 h-4" />
                      Assign Relationship M
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditRM(rm)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="Edit Regional Manager"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(rm)}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg"
                      title="Delete Regional Manager"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className={`px-2 py-1 text-xs rounded-full ${rm.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {rm.status || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">No regional managers found</div>
          )}
        </div>
      )}

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Regional Manager" size="md">
        <RegionalManagerForm
          onSave={handleCreateRM}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedRM(null) }} title="Edit Regional Manager" size="md">
        <RegionalManagerForm
          regionalManager={selectedRM}
          onSave={handleUpdateRM}
          onClose={() => { setIsEditModalOpen(false); setSelectedRM(null) }}
        />
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, rm: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Regional Manager"
        message={`Are you sure you want to delete "${confirmDelete.rm?.name || 'this regional manager'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <Modal
        isOpen={!!assignFranchiseRM}
        onClose={() => !assignSaving && setAssignFranchiseRM(null)}
        title={assignFranchiseRM ? `Assign franchises — ${assignFranchiseRM.name || 'Regional Manager'}` : 'Assign franchises'}
        size="md"
      >
        {assignFranchiseRM && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select the franchises to assign to this regional manager. Uncheck to unassign.
            </p>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {franchises.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No franchises available</p>
              ) : (
                franchises
                  .filter((f) => {
                    // only show franchises that are unassigned or already assigned to this RM
                    const fid = f._id || f.id
                    const currentRM = f.regionalManager ? (f.regionalManager._id || f.regionalManager).toString() : null
                    const targetRM = assignFranchiseRM ? (assignFranchiseRM._id || assignFranchiseRM.id).toString() : null
                    return !currentRM || currentRM === targetRM
                  })
                  .map((f) => {
                    const fid = (f._id || f.id).toString()
                    const checked = assignFranchiseIds.includes(fid)
                    return (
                      <label
                        key={fid}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignFranchise(fid)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-900">{f.name || 'Unnamed'}</span>
                        {f.address && (
                          <span className="text-xs text-gray-500 truncate">
                            {typeof f.address === 'object' ? (f.address.city || f.address.line1 || '') : f.address}
                          </span>
                        )}
                      </label>
                    )
                  })
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveAssignFranchises}
                disabled={assignSaving}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
              >
                {assignSaving ? 'Saving...' : 'Save assignments'}
              </button>
              <button
                type="button"
                onClick={() => setAssignFranchiseRM(null)}
                disabled={assignSaving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!assignRelationshipRM}
        onClose={() => !assignRelationshipSaving && setAssignRelationshipRM(null)}
        title={assignRelationshipRM ? `Assign relationship managers — ${assignRelationshipRM.name || 'Regional Manager'}` : 'Assign relationship managers'}
        size="md"
      >
        {assignRelationshipRM && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select the relationship managers to assign to this regional manager. Uncheck to unassign.
            </p>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {relationshipManagers.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No relationship managers available</p>
              ) : (
                relationshipManagers
                  .filter((r) => {
                    const rid = r._id || r.id
                    const currentRM = r.regionalManager ? (r.regionalManager._id || r.regionalManager).toString() : null
                    const targetRM = assignRelationshipRM ? (assignRelationshipRM._id || assignRelationshipRM.id).toString() : null
                    return !currentRM || currentRM === targetRM
                  })
                  .map((r) => {
                    const rid = (r._id || r.id).toString()
                    const checked = assignRelationshipIds.includes(rid)
                    return (
                      <label
                        key={rid}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignRelationship(rid)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-900">{r.name || 'Unnamed'}</span>
                        {r.email && (
                          <span className="text-xs text-gray-500 truncate">
                            {r.email}
                          </span>
                        )}
                      </label>
                    )
                  })
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveAssignRelationships}
                disabled={assignRelationshipSaving}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
              >
                {assignRelationshipSaving ? 'Saving...' : 'Save assignments'}
              </button>
              <button
                type="button"
                onClick={() => setAssignRelationshipRM(null)}
                disabled={assignRelationshipSaving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default RegionalManagers
