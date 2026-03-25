import { useState, useEffect } from 'react'
import api from '../services/api'
import { formatMobileNumber } from '../utils/identifierFormatters'

const RelationshipManagerForm = ({ relationshipManager, onSave, onClose, isSaving = false }) => {
  const isCreate = !relationshipManager
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    email: '',
    mobile: '',
    password: '',
    regionalManager: '',
  })
  const [errors, setErrors] = useState({})
  const [regionalManagers, setRegionalManagers] = useState([])
  const [loadingRMs, setLoadingRMs] = useState(false)

  useEffect(() => {
    if (relationshipManager) {
      setFormData({
        name: relationshipManager.name || '',
        ownerName: relationshipManager.ownerName || relationshipManager.owner?.name || '',
        email: relationshipManager.email || '',
        mobile: relationshipManager.mobile || '',
        password: '',
        regionalManager:
          (relationshipManager.regionalManager && (relationshipManager.regionalManager._id || relationshipManager.regionalManager.id)) ||
          '',
      })
    }
  }, [relationshipManager])

  useEffect(() => {
    const loadRegionalManagers = async () => {
      setLoadingRMs(true)
      try {
        const response = await api.users.getAll({ role: 'regional_manager', limit: 500 })
        const data = response?.data || response || []
        setRegionalManagers(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error loading regional managers:', error)
        setRegionalManagers([])
      } finally {
        setLoadingRMs(false)
      }
    }
    loadRegionalManagers()
  }, [])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (isCreate) {
      if (!formData.email?.trim()) newErrors.email = 'Email is required for login'
      if (!formData.mobile?.trim()) newErrors.mobile = 'Mobile is required'
      if (!formData.password) newErrors.password = 'Password is required'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const payload = {
        ...formData,
        // Backend requires ownerName; default to the same as RM name if not explicitly set
        ownerName: (formData.ownerName || formData.name || '').trim(),
      }
      if (!isCreate) {
        delete payload.password
      }
      if (!payload.regionalManager) {
        delete payload.regionalManager
      }
      onSave(payload, {})
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const formattedValue = name === 'mobile' ? formatMobileNumber(value) : value
    setFormData((prev) => ({ ...prev, [name]: formattedValue }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Enter name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email {isCreate && <span className="text-red-500">*</span>}
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Email address"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mobile {isCreate && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          name="mobile"
          value={formData.mobile}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Mobile number"
        />
        {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
      </div>

      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Min 6 characters"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assign Regional Manager
          <span className="text-gray-500 text-xs ml-1">(optional)</span>
        </label>
        {loadingRMs ? (
          <p className="text-sm text-gray-500">Loading regional managers...</p>
        ) : regionalManagers.length === 0 ? (
          <p className="text-sm text-gray-500">No regional managers available</p>
        ) : (
          <select
            name="regionalManager"
            value={formData.regionalManager || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 border-gray-300 bg-white text-sm"
          >
            <option value="">Select regional manager</option>
            {regionalManagers.map((rm) => {
              const id = rm._id || rm.id
              return (
                <option key={id} value={id}>
                  {rm.name} ({rm.email})
                </option>
              )
            })}
          </select>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Each regional manager can own at most one relationship manager.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className={`px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-800'}`}
        >
          {isSaving ? (relationshipManager ? 'Updating...' : 'Creating...') : (relationshipManager ? 'Update Relationship Manager' : 'Create Relationship Manager')}
        </button>
      </div>
    </form>
  )
}

export default RelationshipManagerForm
