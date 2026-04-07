import { useState, useEffect } from 'react'
import api from '../services/api'
import { uppercasePayload } from '../utils/uppercasePayload'

const RegionalManagerForm = ({ regionalManager, onSave, onClose }) => {
  const isEdit = !!regionalManager
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (regionalManager) {
      setFormData({
        name: regionalManager.name || '',
        email: regionalManager.email || '',
        mobile: regionalManager.mobile || regionalManager.phone || '',
        password: '', // Don't pre-fill password
      })
    }
  }, [regionalManager])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (!formData.mobile.trim()) newErrors.mobile = 'Mobile is required'
    // Password is only required when creating, not when editing
    if (!isEdit && (!formData.password || formData.password.length < 6)) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    // If editing and password is provided, it must be at least 6 characters
    if (isEdit && formData.password && formData.password.length > 0 && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const dataToSave = uppercasePayload({ ...formData, role: 'regional_manager' })
      // If editing and password is empty, don't include it in the update
      if (isEdit && !formData.password) {
        delete dataToSave.password
      }
      onSave(dataToSave)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          {isEdit && <span className="text-gray-500 text-xs">(leave blank to keep current password)</span>}
        </label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
          placeholder={isEdit ? "Leave blank to keep current password" : "Min 6 characters"}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>
      <div className="flex gap-3 pt-4">
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
          {isEdit ? 'Update Regional Manager' : 'Create Regional Manager'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default RegionalManagerForm
