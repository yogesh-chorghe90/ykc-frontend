import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '../services/toastService'

// Prevent background scrolling when modal is open
const preventBackgroundScroll = (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '15px' // Prevent layout shift
  } else {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}

/**
 * Accountant disbursement modal (Add Tranche).
 * Expects `lead` with: loanAmount/amount, disbursedAmount, commissionPercentage (optional).
 * onSubmit should receive: { amount, date, commission, gst, notes }
 */
const DisbursementForm = ({ isOpen, onClose, onSubmit, lead, loading = false }) => {
  const loanAmount = lead?.loanAmount || lead?.amount || 0
  const disbursedAmount = lead?.disbursedAmount || 0
  const remaining = Math.max(0, loanAmount - disbursedAmount)
  const GST_RATE = 18

  // Optional legacy/denormalized commission basis from lead
  const leadCommissionPercentage = useMemo(() => {
    const agentPct = Number(lead?.agentCommissionPercentage || 0)
    if (agentPct > 0) return agentPct

    const associatedPct = Number(lead?.commissionPercentage || 0)
    const hasAssociatedName = !!(lead?.associated?.name || lead?.associatedName)
    const hasSubAgent = !!(lead?.subAgent?.name || lead?.subAgentName)
    if (agentPct === 0 && associatedPct > 0 && hasAssociatedName && !hasSubAgent) {
      return associatedPct
    }
    return 0
  }, [lead])

  const subPartnerCommissionPercentage = Number(lead?.subAgentCommissionPercentage || 0)
  const hasSubAgent = !!(lead?.subAgent?.name || lead?.subAgentName || lead?.subAgent)
  const partnerCommissionPercentage = Math.max(0, leadCommissionPercentage - subPartnerCommissionPercentage)
  const isGstAgent = useMemo(() => {
    const agentType = String(lead?.agent?.agentType || lead?.agentType || '').toUpperCase()
    const hasGstNo = !!String(lead?.agent?.kyc?.gst || lead?.agent?.gst || lead?.kyc?.gst || lead?.gst || '').trim()
    return agentType === 'GST' || hasGstNo
  }, [lead])

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    commission: '',
    gst: '',
    notes: '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isOpen && lead) {
      setFormData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        commission: '',
        gst: '',
        notes: '',
      })
      setErrors({})
      setTouched({})
    }
  }, [isOpen, lead, leadCommissionPercentage])

  useEffect(() => {
    preventBackgroundScroll(isOpen)
    return () => preventBackgroundScroll(false)
  }, [isOpen])

  const parsedAmount = useMemo(() => {
    const n = parseFloat(formData.amount)
    return Number.isFinite(n) ? n : NaN
  }, [formData.amount])

  // Keep commission in sync (basic helper)
  useEffect(() => {
    const amount = Number.isFinite(parsedAmount) ? parsedAmount : null
    if (!amount || amount <= 0) return

    let commissionAmount = 0
    let shouldAutoWriteCommission = false
    if (leadCommissionPercentage > 0) {
      // Commission for accountant entry should follow configured lead/agent commission percentage.
      commissionAmount = (amount * leadCommissionPercentage) / 100
      shouldAutoWriteCommission = true
    } else {
      const manualCommission = parseFloat(formData.commission)
      if (Number.isFinite(manualCommission)) commissionAmount = manualCommission
    }

    const gstAmount = isGstAgent ? (commissionAmount * GST_RATE) / 100 : 0
    setFormData((p) => ({
      ...p,
      commission: shouldAutoWriteCommission ? (commissionAmount ? commissionAmount.toFixed(2) : '') : p.commission,
      gst: gstAmount ? gstAmount.toFixed(2) : '',
    }))
  }, [
    parsedAmount,
    formData.commission,
    leadCommissionPercentage,
    isGstAgent,
  ])

  const validateField = (name, value) => {
    const newErrors = { ...errors }

    switch (name) {
      case 'amount': {
        if (!value || parseFloat(value) <= 0) {
          newErrors.amount = 'Amount is required'
        } else if (parseFloat(value) > remaining) {
          newErrors.amount = `Amount cannot exceed remaining balance of ${remaining}`
        } else if (parseFloat(value) + disbursedAmount > loanAmount) {
          // Defensive: should never happen if remaining is correct
          newErrors.amount = 'Total disbursement would exceed approved amount'
        } else {
          delete newErrors.amount
        }
        break
      }
      case 'date': {
        if (!value) newErrors.date = 'Date is required'
        else delete newErrors.date
        break
      }
      case 'commission': {
        if (value && parseFloat(value) < 0) newErrors.commission = 'Commission cannot be negative'
        else delete newErrors.commission
        break
      }
      case 'gst': {
        if (!isGstAgent) {
          delete newErrors.gst
        } else if (value && parseFloat(value) < 0) newErrors.gst = 'GST cannot be negative'
        else delete newErrors.gst
        break
      }
      default:
        break
    }

    setErrors(newErrors)
    return Object.prototype.hasOwnProperty.call(newErrors, name) ? false : true
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((p) => ({ ...p, [name]: value }))
    setTouched((t) => ({ ...t, [name]: true }))
    validateField(name, value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const amountOk = validateField('amount', formData.amount)
    const dateOk = validateField('date', formData.date)

    if (!amountOk || !dateOk) return

    if (!formData.commission || parseFloat(formData.commission) < 0) {
      setErrors((p) => ({ ...p, commission: 'Commission amount is required' }))
      return
    }

    const submissionData = {
      amount: parseFloat(formData.amount),
      date: formData.date,
      commission: parseFloat(formData.commission || 0),
      gst: formData.gst ? parseFloat(formData.gst) : 0,
      notes: formData.notes || '',
    }

    // Final safety
    if (!submissionData.amount || submissionData.amount <= 0) {
      toast.error('Error', 'Please enter a valid amount')
      return
    }

    onSubmit?.(submissionData)
  }

  if (!isOpen || !lead) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Add Disbursement</h3>
            <p className="text-xs text-gray-600 mt-1">Enter disbursement details for {lead.customerName || lead.formValues?.customerName || 'this customer'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-600 hover:text-gray-900"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Loan</p>
              <p className="text-sm font-bold text-gray-900">{loanAmount}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disbursed</p>
              <p className="text-sm font-bold text-gray-900">{disbursedAmount}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Remaining</p>
              <p className="text-sm font-bold text-orange-600">{remaining}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.amount ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:ring-primary-500'
                  }`}
                  step="0.01"
                  min="0"
                />
                {touched.amount && errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.date ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:ring-primary-500'
                  }`}
                />
                {touched.date && errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission Amount</label>
              <input
                type="number"
                name="commission"
                value={formData.commission}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.commission ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:ring-primary-500'
                }`}
                step="0.01"
                min="0"
                readOnly={leadCommissionPercentage > 0}
              />
              {touched.commission && errors.commission && <p className="mt-1 text-xs text-red-600">{errors.commission}</p>}
              {leadCommissionPercentage > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Auto calculated at {leadCommissionPercentage.toFixed(2)}% on disbursed amount
                </p>
              )}
            </div>

            {isGstAgent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
                <input
                  type="number"
                  name="gst"
                  value={formData.gst}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.gst ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:ring-primary-500'
                  }`}
                  step="0.01"
                  min="0"
                  readOnly
                />
                {touched.gst && errors.gst && <p className="mt-1 text-xs text-red-600">{errors.gst}</p>}
                <p className="mt-1 text-xs text-gray-500">Auto calculated at {GST_RATE}% on commission</p>
              </div>
            )}

            {hasSubAgent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Commission</label>
                  <input
                    type="text"
                    value={`${partnerCommissionPercentage.toFixed(2)}% (${(
                      ((Number.isFinite(parsedAmount) ? parsedAmount : 0) * partnerCommissionPercentage) /
                      100
                    ).toFixed(2)})`}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg border-gray-300 bg-gray-50 text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Partner Commission</label>
                  <input
                    type="text"
                    value={`${subPartnerCommissionPercentage.toFixed(2)}% (${(
                      ((Number.isFinite(parsedAmount) ? parsedAmount : 0) * subPartnerCommissionPercentage) /
                      100
                    ).toFixed(2)})`}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg border-gray-300 bg-gray-50 text-gray-700"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="px-6 py-2 bg-primary-900 text-white rounded-lg disabled:opacity-60" disabled={loading}>
                {loading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default DisbursementForm

