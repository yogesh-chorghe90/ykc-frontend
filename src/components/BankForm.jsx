import { useState, useEffect } from 'react'
import { uppercasePayload } from '../utils/uppercasePayload'

const LOAN_TYPES = [
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'home_loan', label: 'Home Loan' },
  { value: 'business_loan', label: 'Business Loan' },
  { value: 'loan_against_property', label: 'Loan Against Property' },
  { value: 'education_loan', label: 'Education Loan' },
  { value: 'car_loan', label: 'Car Loan' },
  { value: 'gold_loan', label: 'Gold Loan' },
]

const BankForm = ({ bank, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    loanTypes: [],
    type: 'bank',
    status: 'active',
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (bank) {
      setFormData({
        name: bank.name || '',
        loanTypes: bank.loanTypes || [],
        type: bank.type || 'bank',
        status: bank.status || 'active',
      })
    } else {
      setFormData({
        name: '',
        loanTypes: [],
        type: 'bank',
        status: 'active',
      })
    }
  }, [bank])

  const validate = () => {
    const newErrors = {}
    if (!formData.name || !formData.name.trim()) newErrors.name = 'Bank name is required'
    if (!formData.loanTypes || formData.loanTypes.length === 0) newErrors.loanTypes = 'Please select at least one loan type'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSave(uppercasePayload(formData))
    }
  }

  const handleLoanTypeToggle = (value) => {
    setFormData((prev) => {
      const current = prev.loanTypes || []
      const updated = current.includes(value)
        ? current.filter((t) => t !== value)
        : [...current, value]
      return { ...prev, loanTypes: updated }
    })
    if (errors.loanTypes) {
      setErrors((prev) => ({ ...prev, loanTypes: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bank Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank / NBFC Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, name: e.target.value }))
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter bank / NBFC name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Loan Types */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Loan Types <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOAN_TYPES.map((lt) => {
            const checked = formData.loanTypes.includes(lt.value)
            return (
              <label
                key={lt.value}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                  checked
                    ? 'border-primary-600 bg-primary-50 text-primary-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleLoanTypeToggle(lt.value)}
                  className="w-4 h-4 accent-primary-900 flex-shrink-0"
                />
                <span className="text-sm font-medium">{lt.label}</span>
              </label>
            )
          })}
        </div>
        {errors.loanTypes && <p className="mt-1 text-sm text-red-600">{errors.loanTypes}</p>}
      </div>

      {/* Footer Buttons */}
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
          {bank ? 'Update Bank' : 'Create Bank'}
        </button>
      </div>
    </form>
  )
}

export default BankForm
