import { useState, useEffect } from 'react'
import { formatMobileNumber } from '../utils/identifierFormatters'
import { uppercasePayload } from '../utils/uppercasePayload'

const StaffForm = ({ staff, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: '',
    department: '',
    salary: '',
    status: 'active',
  })

  const [errors, setErrors] = useState({})

  // Backend expects: 'staff', 'accounts', 'admin'
  const roles = [
    { value: 'staff', label: 'Staff' },
    { value: 'accounts', label: 'Accounts' },

    { value: 'admin', label: 'Admin' },
  ]
  const departments = ['Operations', 'Finance', 'Customer Service', 'HR', 'IT', 'Sales', 'Marketing']

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        email: staff.email || '',
        phone: staff.phone || '',
        role: staff.role || '',
        department: staff.department || '',
        salary: staff.salary || '',
        status: staff.status || 'active',
      })
    }
  }, [staff])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.role) newErrors.role = 'Role is required'
    if (!formData.department) newErrors.department = 'Department is required'
    if (!formData.salary || formData.salary <= 0) newErrors.salary = 'Salary must be greater than 0'

    // Password validation - required for new staff, optional for updates
    if (!staff) {
      if (!formData.password || formData.password.length < 6) {
        newErrors.password = 'Password is required and must be at least 6 characters'
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const dataToSave = uppercasePayload({ ...formData })
      if (staff && !dataToSave.password) {
        delete dataToSave.password
      }
      onSave({
        ...dataToSave,
        salary: parseFloat(dataToSave.salary),
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const formattedValue = name === 'phone' ? formatMobileNumber(value) : value
    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
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
          Password {staff ? '(Optional)' : <span className="text-red-500">*</span>}
        </label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter password (min 6 characters)"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.role ? 'border-red-500' : 'border-gray-300'
              }`}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            name="department"
            value={formData.department}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.department ? 'border-red-500' : 'border-gray-300'
              }`}
          >
            <option value="">Select a department</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Salary (₹) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="salary"
          value={formData.salary}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.salary ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter salary"
          min="0"
          step="1000"
        />
        {errors.salary && <p className="mt-1 text-sm text-red-600">{errors.salary}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
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
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors"
        >
          {staff ? 'Update Staff' : 'Create Staff'}
        </button>
      </div>
    </form>
  )
}

export default StaffForm
