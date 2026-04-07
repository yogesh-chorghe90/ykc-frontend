import { useState, useEffect } from 'react'
import { Upload, X, File } from 'lucide-react'
import { toast } from '../services/toastService'
import api from '../services/api'
import { formatBankAccountNumber, formatIfscCode, IFSC_FORMAT_HINT, isIfscValidOrIncomplete, isValidIfscCode } from '../utils/identifierFormatters'

const PayoutForm = ({ payout = null, onSave, onClose, leads = [] }) => {
  const [formData, setFormData] = useState({
    leadId: '',
    agent: '',
    franchise: '',
    totalAmount: '',
    tdsAmount: '',
    netPayable: '',
    status: 'pending',
    remarks: '',
    invoices: [],
  })
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
  })
  const [errors, setErrors] = useState({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loadingLead, setLoadingLead] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leadPreview, setLeadPreview] = useState(null)

  const formatLoanTypeLabel = (loanType) => {
    if (!loanType || typeof loanType !== 'string') return 'N/A'
    return loanType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  useEffect(() => {
    if (payout) {
      setFormData({
        leadId: payout.lead?._id || payout.lead?.id || '',
        agent: payout.agent?._id || payout.agent?.id || payout.agent || '',
        franchise: payout.franchise?._id || payout.franchise?.id || payout.franchise || '',
        totalAmount: payout.totalAmount || '',
        tdsAmount: payout.tdsAmount || '',
        netPayable: payout.netPayable || '',
        status: payout.status || 'pending',
        remarks: payout.remarks || '',
        invoices: payout.invoices?.map((inv) => inv._id || inv.id || inv) || [],
      })
      setBankDetails({
        accountHolderName: payout.bankDetails?.accountHolderName || '',
        accountNumber: formatBankAccountNumber(payout.bankDetails?.accountNumber || ''),
        ifsc: payout.bankDetails?.ifsc || '',
        bankName: payout.bankDetails?.bankName || '',
      })
    }
  }, [payout])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLeadChange = (e) => {
    const leadId = e.target.value

    // Always set leadId immediately for controlled <select>
    setFormData((prev) => ({
      ...prev,
      leadId,
    }))

    if (!leadId) {
      setFormData((prev) => ({
        ...prev,
        agent: '',
        franchise: '',
      }))
      setLeadPreview(null)
      return
    }

    // Helper: resolve only the required confirmation fields from a lead object
    const selectedLead = leads.find(
      (lead) => String(lead._id || lead.id) === String(leadId)
    )

    const resolveFromLeadObject = (lead) => {
      const agentId =
        lead?.agent?._id ||
        lead?.agent?.id ||
        lead?.agentId ||
        lead?.agent ||
        ''

      // For payouts backend requires `franchise` (ObjectId). In our hierarchy a lead can be associated to:
      // - Franchise (associatedModel === 'Franchise')  → use lead.associated
      // - RelationshipManager (associatedModel === 'RelationshipManager') → store lead.associated in `franchise` as well
      //   (backend schema expects `franchise` ref; ObjectId is still accepted even if populate can't resolve)
      // - Otherwise infer from agent.managedBy when agent.managedByModel === 'Franchise'
      let franchiseId = ''
      if (lead?.associatedModel === 'Franchise') {
        franchiseId =
          lead?.associated?._id ||
          lead?.associated?.id ||
          lead?.associated ||
          ''
      } else if (lead?.associatedModel === 'RelationshipManager') {
        franchiseId =
          lead?.associated?._id ||
          lead?.associated?.id ||
          lead?.associated ||
          ''
      } else if (lead?.agent?.managedByModel === 'Franchise') {
        franchiseId =
          lead?.agent?.managedBy?._id ||
          lead?.agent?.managedBy?.id ||
          lead?.agent?.managedBy ||
          ''
      }

      return { agentId, franchiseId }
    }

    // Always fetch minimal confirmation data by leadId (no conditional skipping)
    ;(async () => {
      try {
        setLoadingLead(true)
        const res = await api.leads.getById(leadId)
        const lead = res?.data || res

        const fv =
          lead?.formValues && typeof lead.formValues === 'object' && !Array.isArray(lead.formValues)
            ? lead.formValues
            : {}
        const leadLan =
          lead?.loanAccountNo ||
          lead?.loanAccountNumber ||
          fv.loanAccountNo ||
          fv.loanAccountNumber ||
          fv.lan ||
          fv.lanNumber ||
          fv.account_no ||
          fv.loan_acc_no ||
          ''
        const loanAccountDisplay = String(leadLan).trim() || 'N/A'
        const bankDisplay =
          (typeof lead?.bank === 'object' && lead?.bank?.name) ||
          lead?.bankName ||
          fv.bankName ||
          fv.bank ||
          'N/A'

        setLeadPreview({
          customerName:
            lead?.customerName ||
            fv.customerName ||
            fv.leadName ||
            fv.name ||
            fv.applicant_name ||
            lead?.leadName ||
            'N/A',
          loanAmount: lead?.loanAmount ?? lead?.amount ?? 0,
          loanAccountNo: loanAccountDisplay,
          bankName: bankDisplay,
          loanTypeLabel: formatLoanTypeLabel(lead?.loanType || fv.loanType),
        })

        const { agentId: fetchedAgentId, franchiseId: fetchedFranchiseId } = resolveFromLeadObject(lead)

        // Don't block the user here; just auto-fill whatever is available.

        setFormData((prev) => ({
          ...prev,
          agent: fetchedAgentId || '',
          franchise: fetchedFranchiseId || '',
        }))
      } catch (err) {
        console.error('Error fetching lead for payout confirmation:', err)
        toast.error('Error', 'Failed to load selected lead details.')
      } finally {
        setLoadingLead(false)
      }
    })()
  }

  const handleBankDetailsChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    if (name === 'ifsc') formattedValue = formatIfscCode(value)
    if (name === 'accountNumber') formattedValue = formatBankAccountNumber(value)
    setBankDetails((prev) => ({ ...prev, [name]: formattedValue }))
    if (name === 'ifsc') {
      const msg = formattedValue && !isIfscValidOrIncomplete(formattedValue) ? IFSC_FORMAT_HINT : ''
      setErrors((prev) => ({ ...prev, ifsc: msg }))
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Error', 'Invalid file type. Please upload PDF or image file.')
        return
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Error', 'File size must be less than 10MB')
        return
      }
      setSelectedFile(file)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
  }

  const calculateNetPayable = () => {
    const total = parseFloat(formData.totalAmount) || 0
    const tds = parseFloat(formData.tdsAmount) || 0
    return Math.max(0, total - tds)
  }

  useEffect(() => {
    if (formData.totalAmount || formData.tdsAmount) {
      const netPayable = calculateNetPayable()
      setFormData((prev) => ({ ...prev, netPayable: netPayable.toString() }))
    }
  }, [formData.totalAmount, formData.tdsAmount])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.leadId) {
      toast.error('Error', 'Lead is required')
      return
    }
    // Backend requires agent + franchise for payouts.
    // If the selected lead isn't mapped, block early with a clear message.
    if (!formData.agent || !formData.franchise) {
      toast.error('Error', 'This lead is not mapped to a Partner/Franchise. Please map it first, then create payout.')
      return
    }
    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      toast.error('Error', 'Total amount must be greater than 0')
      return
    }
    if (!formData.netPayable || parseFloat(formData.netPayable) <= 0) {
      toast.error('Error', 'Net payable must be greater than 0')
      return
    }
    const ifsc = bankDetails.ifsc?.trim() || ''
    if (ifsc && !isValidIfscCode(ifsc)) {
      const msg = IFSC_FORMAT_HINT
      setErrors((prev) => ({ ...prev, ifsc: msg }))
      toast.error('Error', msg)
      return
    }

    try {
      setLoading(true)

      // Build payload for parent page
      let payload

      if (selectedFile) {
        // Use FormData when uploading a receipt
        setUploading(true)
        const fd = new FormData()
        fd.append('leadId', formData.leadId)
        fd.append('agent', formData.agent)
        fd.append('franchise', formData.franchise)
        fd.append('totalAmount', formData.totalAmount)
        fd.append('tdsAmount', formData.tdsAmount || '0')
        fd.append('netPayable', formData.netPayable)
        fd.append('status', formData.status)
        fd.append('remarks', formData.remarks || '')
        fd.append('invoices', JSON.stringify(formData.invoices))
        fd.append('bankDetails', JSON.stringify(bankDetails))
        fd.append('bankPaymentReceipt', selectedFile)
        payload = fd
      } else {
        // No file → JSON payload
        payload = {
          leadId: formData.leadId,
          agent: formData.agent,
          franchise: formData.franchise,
          totalAmount: parseFloat(formData.totalAmount),
          tdsAmount: parseFloat(formData.tdsAmount) || 0,
          netPayable: parseFloat(formData.netPayable),
          status: formData.status,
          remarks: formData.remarks || '',
          invoices: formData.invoices,
          bankDetails: bankDetails,
        }
      }

      await onSave(payload)
    } catch (error) {
      console.error('Error saving payout:', error)
      toast.error('Error', error.message || 'Failed to save payout')
    } finally {
      setUploading(false)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead <span className="text-red-500">*</span>
          </label>
          <select
            name="leadId"
            value={formData.leadId}
            onChange={handleLeadChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select Lead</option>
            {leads.map((lead) => (
              <option key={lead._id || lead.id} value={lead._id || lead.id}>
                {lead.customerName || lead.caseNumber || lead.loanAccountNo || (lead._id || lead.id)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Agent and Franchise will be auto-filled from the selected lead.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="totalAmount"
            value={formData.totalAmount}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TDS Amount</label>
          <input
            type="number"
            name="tdsAmount"
            value={formData.tdsAmount}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Net Payable <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="netPayable"
            value={formData.netPayable}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Calculated automatically (Total - TDS)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="pending">Pending</option>
            <option value="gst_pending">GST Pending</option>
            <option value="gst_received">GST received</option>
            <option value="payment_received">Payment received</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="recovery_pending">Recovery Pending</option>
            <option value="recovery_received">Recovery Received</option>
            <option value="complete">Complete</option>
          </select>
        </div>
      </div>

      {leadPreview && (
        <div className="border-t pt-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Lead summary</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium text-gray-700">Customer name</div>
              <div className="text-sm text-gray-900 mt-1">{leadPreview.customerName}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Loan amount (₹)</div>
              <div className="text-sm text-gray-900 mt-1">
                {Number(leadPreview.loanAmount).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Loan account no</div>
              <div className="text-sm text-gray-900 mt-1 font-mono">{leadPreview.loanAccountNo}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Bank name</div>
              <div className="text-sm text-gray-900 mt-1">{leadPreview.bankName}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-sm font-medium text-gray-700">Loan type</div>
              <div className="text-sm text-gray-900 mt-1">{leadPreview.loanTypeLabel}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Details */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Bank Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              name="accountHolderName"
              value={bankDetails.accountHolderName}
              onChange={handleBankDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              name="accountNumber"
              value={bankDetails.accountNumber}
              onChange={handleBankDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Enter account number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
            <input
              type="text"
              name="ifsc"
              value={bankDetails.ifsc}
              onChange={handleBankDetailsChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.ifsc ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g. HDFC0001234 or BARB0KHARAD"
              maxLength={11}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-gray-500">{IFSC_FORMAT_HINT}</p>
            {errors.ifsc && <p className="mt-1 text-sm text-red-600">{errors.ifsc}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              name="bankName"
              value={bankDetails.bankName}
              onChange={handleBankDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Bank Payment Receipt Upload */}
      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bank Payment Receipt (PDF/Image)
        </label>
        {selectedFile ? (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <File className="w-5 h-5 text-gray-500" />
            <span className="flex-1 text-sm text-gray-700">{selectedFile.name}</span>
            <button
              type="button"
              onClick={removeFile}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : payout?.bankPaymentReceipt?.url ? (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <File className="w-5 h-5 text-gray-500" />
            <span className="flex-1 text-sm text-gray-700">{payout.bankPaymentReceipt.filename || 'Existing receipt'}</span>
            <a
              href={payout.bankPaymentReceipt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-900 hover:text-primary-800 text-sm"
            >
              View
            </a>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
            <input
              type="file"
              id="bankPaymentReceipt"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="bankPaymentReceipt"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600">Click to upload bank payment receipt</span>
              <span className="text-xs text-gray-500">PDF or Image (Max 10MB)</span>
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading || loading}
          className="px-5 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading...' : loading ? 'Saving...' : payout ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}

export default PayoutForm

