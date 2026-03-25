import { useState, useEffect } from 'react'
import api from '../services/api'

const AccountantManagerForm = ({ accountantManager, onSave, onClose, isSaving = false }) => {
    const isEdit = !!accountantManager
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
        assignedRegionalManagers: [],
    })
    const [errors, setErrors] = useState({})
    const [regionalManagers, setRegionalManagers] = useState([])
    const [loadingRMs, setLoadingRMs] = useState(false)

    useEffect(() => {
        const loadRegionalManagers = async () => {
            setLoadingRMs(true)
            try {
                const response = await api.users.getAll({ role: 'regional_manager', limit: 500 })
                setRegionalManagers(response?.data || [])
            } catch (error) {
                console.error('Error loading regional managers:', error)
                setRegionalManagers([])
            } finally {
                setLoadingRMs(false)
            }
        }
        loadRegionalManagers()
    }, [])

    useEffect(() => {
        if (accountantManager) {
            const assignedRMs = accountantManager.assignedRegionalManagers || []
            // Extract IDs and convert to strings for consistent comparison
            const assignedRMIds = Array.isArray(assignedRMs) 
                ? assignedRMs.map(rm => {
                    // Handle both populated objects and plain IDs
                    const id = rm._id || rm.id || rm;
                    return id?.toString ? id.toString() : String(id);
                }).filter(Boolean)
                : [];
            
            setFormData({
                name: accountantManager.name || '',
                email: accountantManager.email || '',
                mobile: accountantManager.mobile || accountantManager.phone || '',
                password: '', // Password shouldn't be pre-filled
                assignedRegionalManagers: assignedRMIds,
            })
        }
    }, [accountantManager])

    const validate = () => {
        const newErrors = {}
        if (!formData.name.trim()) newErrors.name = 'Name is required'
        if (!formData.email.trim()) newErrors.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
        if (!formData.mobile.trim()) newErrors.mobile = 'Mobile is required'
        if (!isEdit && (!formData.password || formData.password.length < 6)) {
            newErrors.password = 'Password must be at least 6 characters'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validate()) {
            const payload = { ...formData, role: 'accounts_manager' }
            if (isEdit && !payload.password) {
                delete payload.password // Don't update password if empty during edit
            }
            onSave(payload)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    }

    const handleRegionalManagerToggle = (rmId) => {
        setFormData((prev) => {
            const current = prev.assignedRegionalManagers || []
            // Convert all IDs to strings for consistent comparison
            const currentStrings = current.map(id => id?.toString ? id.toString() : String(id))
            const rmIdString = rmId?.toString ? rmId.toString() : String(rmId)
            const isSelected = currentStrings.includes(rmIdString)
            return {
                ...prev,
                assignedRegionalManagers: isSelected
                    ? current.filter(id => {
                        const idString = id?.toString ? id.toString() : String(id)
                        return idString !== rmIdString
                    })
                    : [...current, rmIdString]
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Full name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="email@example.com"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span></label>
                    <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="10-digit mobile number"
                    />
                    {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password {!isEdit && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder={isEdit ? "Leave blank to keep current" : "Min 6 characters"}
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
            </div>

            <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Regional Managers <span className="text-gray-500 text-xs">(Select one or multiple)</span>
                </label>
                {loadingRMs ? (
                    <p className="text-sm text-gray-500">Loading regional managers...</p>
                ) : regionalManagers.length === 0 ? (
                    <p className="text-sm text-gray-500">No regional managers available</p>
                ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
                        {regionalManagers.map((rm) => {
                            const rmId = rm._id || rm.id
                            const rmIdString = rmId?.toString ? rmId.toString() : String(rmId)
                            // Convert all IDs in formData to strings for comparison
                            const assignedIds = (formData.assignedRegionalManagers || []).map(id => 
                                id?.toString ? id.toString() : String(id)
                            )
                            const isSelected = assignedIds.includes(rmIdString)
                            return (
                                <label
                                    key={rmIdString}
                                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleRegionalManagerToggle(rmIdString)}
                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-900">{rm.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">({rm.email})</span>
                                    </div>
                                </label>
                            )
                        })}
                    </div>
                )}
                {formData.assignedRegionalManagers?.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                        {formData.assignedRegionalManagers.length} Regional Manager(s) selected
                    </p>
                )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : (isEdit ? 'Update Accountant Manager' : 'Create Accountant Manager')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}

export default AccountantManagerForm
