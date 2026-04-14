import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Users, FileDown, Mail, Phone, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import AccountantManagerForm from '../components/AccountantManagerForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { formatAadhaarNumber, formatBankAccountNumber, formatMobileNumber, formatPanNumber } from '../utils/identifierFormatters'

const AccountantManagers = () => {
    const [accountantManagers, setAccountantManagers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [filtersOpen, setFiltersOpen] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [selectedAM, setSelectedAM] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, am: null })

    useEffect(() => {
        fetchAccountantManagers()
    }, [])

    const fetchAccountantManagers = async () => {
        try {
            setLoading(true)
            const response = await api.accountantManagers.getAll({ limit: 200 })
            const data = response.data || response || []
            setAccountantManagers(Array.isArray(data) ? data : [])
        } catch (error) {
            console.error('Error fetching accountant managers:', error)
            setAccountantManagers([])
        } finally {
            setLoading(false)
        }
    }

    const filteredAMs = useMemo(() => {
        return accountantManagers.filter((am) => {
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch =
                !searchTerm ||
                (am.name && am.name.toLowerCase().includes(searchLower)) ||
                (am.email && am.email.toLowerCase().includes(searchLower)) ||
                (am.mobile && am.mobile.toLowerCase().includes(searchLower)) ||
                (am.phone && am.phone.toLowerCase().includes(searchLower))

            const matchesStatus = statusFilter === 'all' || am.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [accountantManagers, searchTerm, statusFilter])

    const sortedAMs = useMemo(() => {
        if (!sortConfig.key) return filteredAMs
        return [...filteredAMs].sort((a, b) => {
            let aVal = a[sortConfig.key] || ''
            let bVal = b[sortConfig.key] || ''

            if (typeof aVal === 'string') aVal = aVal.toLowerCase()
            if (typeof bVal === 'string') bVal = bVal.toLowerCase()

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredAMs, sortConfig])

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }))
    }

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-primary-900" /> : <ArrowDown className="w-4 h-4 text-primary-900" />
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            if (selectedAM && selectedAM._id) {
                await api.accountantManagers.update(selectedAM._id, formData)
                toast.success('Success', 'Accountant Manager updated successfully')
            } else {
                await api.accountantManagers.create(formData)
                toast.success('Success', 'Accountant Manager created successfully')
            }
            setIsCreateModalOpen(false)
            setIsEditModalOpen(false)
            fetchAccountantManagers()
            setSelectedAM(null) // Clear selected AM after save
        } catch (error) {
            console.error('Error saving accountant manager:', error)
            toast.error('Error', error.message || 'Failed to save accountant manager')
        } finally {
            setIsSaving(false)
        }
    }

    const handleView = async (am) => {
        try {
            setLoadingDetails(true)
            // Fetch full details including KYC and bank details
            const amId = am._id || am.id
            if (!amId) {
                toast.error('Error', 'Accountant Manager ID is missing')
                setLoadingDetails(false)
                return
            }
            
            const response = await api.accountantManagers.getById(amId)
            const fullDetails = response.data || response
            setSelectedAM(fullDetails)
            setIsDetailModalOpen(true)
        } catch (error) {
            console.error('Error fetching accountant manager details:', error)
            toast.error('Error', error.message || 'Failed to fetch accountant manager details')
            // Fallback to using the list data if fetch fails
            setSelectedAM(am)
            setIsDetailModalOpen(true)
        } finally {
            setLoadingDetails(false)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!confirmDelete.am) return
        try {
            await api.accountantManagers.delete(confirmDelete.am._id || confirmDelete.am.id)
            toast.success('Success', `Accountant Manager "${confirmDelete.am?.name}" deleted successfully`)
            setConfirmDelete({ isOpen: false, am: null })
            fetchAccountantManagers()
        } catch (error) {
            console.error('Error deleting accountant manager:', error)
            toast.error('Error', error.message || 'Failed to delete accountant manager')
        }
    }

    const handleExport = () => {
        const rows = sortedAMs.map(am => ({
            Name: am.name || 'N/A',
            Email: am.email || 'N/A',
            Mobile: am.mobile || am.phone || 'N/A',
            Status: am.status || 'N/A',
            'Created At': am.createdAt ? new Date(am.createdAt).toLocaleDateString() : 'N/A'
        }))
        exportToExcel(rows, `accountant_managers_${Date.now()}`, 'Accountant Managers')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Accountant Managers</h1>
                    <p className="text-sm text-gray-600 mt-1">Manage accountant team members</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <FileDown className="w-5 h-5" />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => { setSelectedAM(null); setIsCreateModalOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Accountant Manager</span>
                    </button>
                </div>
            </div>

            {/* Compact Summary Bar - Mobile Only */}
            <div className="md:hidden bg-gradient-to-r from-gray-50 to-white rounded-lg shadow-sm border border-gray-200 px-4 py-3.5">
                <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-wide">
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">Total</span>
                        <span className="font-bold text-gray-900">{accountantManagers.length}</span>
                    </div>
                    <span className="text-gray-300 mx-1">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">Active</span>
                        <span className="font-bold text-green-600">{accountantManagers.filter(am => am.status === 'active').length}</span>
                    </div>
                    <span className="text-gray-300 mx-1">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">Inactive</span>
                        <span className="font-bold text-gray-600">{accountantManagers.filter(am => am.status !== 'active').length}</span>
                    </div>
                </div>
            </div>

            {/* Statistics Cards - Desktop Only */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Accountants" value={accountantManagers.length} icon={Users} color="blue" />
                <StatCard title="Active Accountants" value={accountantManagers.filter(am => am.status === 'active').length} icon={ShieldCheck} color="green" />
                <StatCard title="Inactive" value={accountantManagers.filter(am => am.status !== 'active').length} icon={Users} color="gray" />
            </div>

            {/* Filters - Sticky on Mobile */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email or mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-2">Name {getSortIcon('name')}</div>
                                </th>
                                <th className="px-6 py-3 text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => handleSort('email')}>
                                    <div className="flex items-center gap-2">Contact {getSortIcon('email')}</div>
                                </th>
                                <th className="px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                                <th className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : sortedAMs.length === 0 ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No accountant managers found</td></tr>
                            ) : (
                                sortedAMs.map((am) => (
                                    <tr key={am.id || am._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{am.name}</div>
                                            <div className="text-xs text-gray-500">Added on {new Date(am.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600"><Mail className="w-3.5 h-3.5" /> {am.email}</div>
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1"><Phone className="w-3.5 h-3.5" /> {am.mobile || am.phone || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={am.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleView(am)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-colors" title="View Details"><Eye className="w-4 h-4" /></button>
                                                <button onClick={() => { setSelectedAM(am); setIsEditModalOpen(true) }} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-gray-100 rounded-md transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => setConfirmDelete({ isOpen: true, am })} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add New Accountant Manager" size="md">
                <AccountantManagerForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} isSaving={isSaving} />
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedAM(null) }} title="Edit Accountant Manager" size="md">
                <AccountantManagerForm accountantManager={selectedAM} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} isSaving={isSaving} />
            </Modal>

            <Modal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedAM(null) }} title="Accountant Manager Details" size="md">
                {loadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-gray-500">Loading details...</div>
                    </div>
                ) : selectedAM ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Full Name</label>
                                <p className="text-sm font-medium text-gray-900">{selectedAM.name}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                                <div><StatusBadge status={selectedAM.status} /></div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
                                <p className="text-sm text-gray-900">{selectedAM.email}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Mobile Number</label>
                                <p className="text-sm text-gray-900">{formatMobileNumber(selectedAM.mobile || selectedAM.phone) || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">KYC Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">PAN Number</label>
                                    <p className="text-sm text-gray-900">{formatPanNumber(selectedAM.kyc?.pan) || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Aadhaar Number</label>
                                    <p className="text-sm text-gray-900">{formatAadhaarNumber(selectedAM.kyc?.aadhaar) || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">GST Number</label>
                                    <p className="text-sm text-gray-900">{selectedAM.kyc?.gst || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">KYC Verified</label>
                                    <p className="text-sm text-gray-900">{selectedAM.kyc?.verified ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Bank Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Account Holder Name</label>
                                    <p className="text-sm text-gray-900">{selectedAM.bankDetails?.accountHolderName || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Bank Name</label>
                                    <p className="text-sm text-gray-900">{selectedAM.bankDetails?.bankName || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Account Number</label>
                                    <p className="text-sm text-gray-900">{formatBankAccountNumber(selectedAM.bankDetails?.accountNumber) || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">IFSC Code</label>
                                    <p className="text-sm text-gray-900">{selectedAM.bankDetails?.ifsc || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Branch</label>
                                    <p className="text-sm text-gray-900">{selectedAM.bankDetails?.branch || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t flex justify-end gap-3">
                            <button onClick={() => { setIsDetailModalOpen(false); setIsEditModalOpen(true) }} className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 text-sm font-medium transition-colors">Edit Personal Info</button>
                            <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">Close</button>
                        </div>
                    </div>
                ) : null}
            </Modal>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, am: null })}
                onConfirm={handleDeleteConfirm}
                title="Delete Accountant Manager"
                message={`Are you sure you want to delete "${confirmDelete.am?.name}"? All associated data will be removed. This action cannot be undone.`}
                confirmText="Yes, Delete"
                cancelText="Cancel"
                type="danger"
            />
        </div>
    )
}

export default AccountantManagers
