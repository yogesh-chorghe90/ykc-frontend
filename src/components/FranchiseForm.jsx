import { useState, useEffect } from 'react'
import { authService } from '../services/auth.service'
import { api } from '../services/api'
import Modal from './Modal'
import { formatAadhaarNumber, formatBankAccountNumber, formatMobileNumber, formatPanNumber } from '../utils/identifierFormatters'

const FranchiseForm = ({ franchise, onSave, onClose, isSaving = false }) => {
  const isCreate = !franchise
  const isAdmin = authService.getUser()?.role === 'super_admin'
  const canAssignRM = ['super_admin', 'regional_manager'].includes(authService.getUser()?.role)
  const [regionalManagers, setRegionalManagers] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    email: '',
    mobile: '',
    password: '',
    status: 'active',
    franchiseType: 'normal',
    regionalManager: '',
    relationshipManager: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
  })

  const [errors, setErrors] = useState({})
  // initialize kyc and bank details
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kyc: prev.kyc || { pan: '', aadhaar: '', gst: '' },
      bankDetails: prev.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
      documents: prev.documents || [],
      additionalDocuments: prev.additionalDocuments || [],
      pendingFiles: prev.pendingFiles || {},
    }))
  }, [])

  useEffect(() => {
    if (isAdmin) {
      api.users.getAll({ role: 'regional_manager', limit: 200 }).then((res) => {
        setRegionalManagers(res.data || [])
      }).catch(() => setRegionalManagers([]))
    }
  }, [isAdmin])

  useEffect(() => {
    // Relationship managers are not linked to franchises per updated hierarchy.
  }, [canAssignRM])

  useEffect(() => {
    if (franchise) {
      setFormData({
        name: franchise.name || '',
        ownerName: franchise.ownerName || '',
        email: franchise.email || '',
        mobile: formatMobileNumber(franchise.mobile || ''),
        password: '',
        status: franchise.status || 'active',
        franchiseType: franchise.franchiseType || 'normal',
        regionalManager: franchise.regionalManager?._id || franchise.regionalManager || '',
        relationshipManager: '',
        address: {
          street: franchise.address?.street || '',
          city: franchise.address?.city || '',
          state: franchise.address?.state || '',
          pincode: franchise.address?.pincode || '',
        },
        kyc: {
          ...(franchise.kyc || {}),
          pan: formatPanNumber(franchise.kyc?.pan),
          aadhaar: formatAadhaarNumber(franchise.kyc?.aadhaar),
          gst: franchise.kyc?.gst || '',
        },
        bankDetails: {
          ...(franchise.bankDetails || {}),
          accountHolderName: franchise.bankDetails?.accountHolderName || '',
          accountNumber: formatBankAccountNumber(franchise.bankDetails?.accountNumber),
          bankName: franchise.bankDetails?.bankName || '',
          branch: franchise.bankDetails?.branch || '',
          ifsc: franchise.bankDetails?.ifsc || '',
        },
        documents: franchise.documents || [],
      })
    }
  }, [franchise])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Franchise name is required'
    if (isCreate) {
      if (!formData.email?.trim()) newErrors.email = 'Email is required for login'
      if (!formData.mobile?.trim()) newErrors.mobile = 'Mobile is required'
      if (!formData.password) newErrors.password = 'Password is required for owner login'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const payload = { ...formData }
      if (!isCreate) {
        delete payload.password
      }
      if (!isAdmin) {
        delete payload.regionalManager
      } else {
        payload.regionalManager = formData.regionalManager || null
      }
      const files = {
        pendingFiles: formData.pendingFiles || {},
        additionalDocuments: formData.additionalDocuments || [],
      }
      onSave(payload, files)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    if (name === 'mobile') formattedValue = formatMobileNumber(value)
    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleNestedChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      if (parent === 'kyc' && child === 'pan') formattedValue = formatPanNumber(value)
      if (parent === 'kyc' && child === 'aadhaar') formattedValue = formatAadhaarNumber(value)
      if (parent === 'bankDetails' && child === 'accountNumber') formattedValue = formatBankAccountNumber(value)
      setFormData((prev) => ({ ...prev, [parent]: { ...(prev[parent] || {}), [child]: formattedValue } }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: formattedValue }))
    }
  }

  const handleFileChange = async (e) => {
    // legacy single-file handler - delegate to typed handler
    const file = e.target.files && e.target.files[0]
    if (!file) return
    return handleFileChangeForType(file, 'kyc')
  }

  const handleFileChangeForType = async (file, docType, label = '') => {
    if (!file) return
    if (franchise && (franchise._id || franchise.id)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'franchise')
        fd.append('entityId', franchise._id || franchise.id)
        fd.append('documentType', docType)
        if (label) fd.append('label', label)
        const resp = await api.documents.upload(fd)
        const doc = resp.data || resp
        if (docType === 'additional') {
          setFormData((prev) => ({ ...prev, additionalDocuments: [...(prev.additionalDocuments || []), doc] }))
        } else {
          setFormData((prev) => ({ ...prev, documents: [...(prev.documents || []), { ...doc, documentType: docType }] }))
        }
      } catch (err) {
        console.error('File upload failed', err)
      }
    } else {
      setFormData((prev) => ({ ...prev, pendingFiles: { ...(prev.pendingFiles || {}), [docType]: { file, label } } }))
    }
  }

  const [newAdditionalLabel, setNewAdditionalLabel] = useState('')
  const [newAdditionalFile, setNewAdditionalFile] = useState(null)
  const addAdditionalDocument = () => {
    if (!newAdditionalLabel || !newAdditionalFile) return
    if (franchise && (franchise._id || franchise.id)) {
      handleFileChangeForType(newAdditionalFile, 'additional', newAdditionalLabel)
      setNewAdditionalLabel('')
      setNewAdditionalFile(null)
    } else {
      setFormData((prev) => ({ ...prev, additionalDocuments: [...(prev.additionalDocuments || []), { label: newAdditionalLabel, file: newAdditionalFile }] }))
      setNewAdditionalLabel('')
      setNewAdditionalFile(null)
    }
  }

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewName, setPreviewName] = useState('')
  const openPreview = (doc) => {
    if (!doc) return
    if (doc.url) {
      setPreviewUrl(doc.url)
      setPreviewName(doc.originalFileName || doc.fileName || doc.label || 'Document')
      setPreviewOpen(true)
      return
    }
    const file = doc.file || doc
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setPreviewName(doc.label || file.name)
    setPreviewOpen(true)
  }
  const closePreview = () => {
    setPreviewOpen(false)
    try { URL.revokeObjectURL(previewUrl) } catch (e) {}
    setPreviewUrl('')
    setPreviewName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Franchise Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter franchise name"
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="login email"
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="mobile number"
        />
        {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
      </div>

      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Login Password <span className="text-red-500">*</span>
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

      {/* Franchise Type — moved to top so GST fields can conditionally show below */}
      {canAssignRM && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Franchise Type <span className="text-red-500">*</span>
          </label>
          <select
            name="franchiseType"
            value={formData.franchiseType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="normal">Normal</option>
            <option value="GST">GST</option>
          </select>
        </div>
      )}

      {/* Regional Manager — moved up alongside Franchise Type */}
      {isAdmin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Regional Manager
          </label>
          <select
            name="regionalManager"
            value={formData.regionalManager}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">None</option>
            {regionalManagers.map((rm) => (
              <option key={rm._id} value={rm._id}>
                {rm.name} {rm.email ? `(${rm.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Street Address
        </label>
        <input
          type="text"
          name="address.street"
          value={formData.address.street}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            address: { ...prev.address, street: e.target.value }
          }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter street address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            name="address.city"
            value={formData.address.city}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, city: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter city"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            type="text"
            name="address.state"
            value={formData.address.state}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, state: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter state"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pincode
        </label>
        <input
          type="text"
          name="address.pincode"
          value={formData.address.pincode}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            address: { ...prev.address, pincode: e.target.value }
          }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter pincode"
        />
      </div>

      {/* KYC Fields */}
      <div className={`grid grid-cols-1 gap-4 ${formData.franchiseType === 'GST' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
          <input type="text" name="kyc.pan" value={formData.kyc?.pan || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="PAN number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar</label>
          <input type="text" name="kyc.aadhaar" value={formData.kyc?.aadhaar || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Aadhaar number" />
        </div>
        {formData.franchiseType === 'GST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
            <input type="text" name="kyc.gst" value={formData.kyc?.gst || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="GST number" />
          </div>
        )}
      </div>

      {/* Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
          <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails?.accountHolderName || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account holder name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails?.accountNumber || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input type="text" name="bankDetails.bankName" value={formData.bankDetails?.bankName || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input type="text" name="bankDetails.branch" value={formData.bankDetails?.branch || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Branch" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
          <input type="text" name="bankDetails.ifsc" value={formData.bankDetails?.ifsc || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="IFSC code" />
        </div>
      </div>

      {/* Document upload - separate fields (including shop act) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN Card (upload)</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFileChangeForType(e.target.files[0], 'pan')} />
          {(formData.pendingFiles?.pan || (formData.documents || []).find(d => d.documentType === 'pan')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'pan') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'pan'))} className="text-primary-700 underline">Preview uploaded PAN</button>
              ) : <span>File selected (will upload after creation)</span>}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Card (upload)</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFileChangeForType(e.target.files[0], 'aadhaar')} />
          {(formData.pendingFiles?.aadhaar || (formData.documents || []).find(d => d.documentType === 'aadhaar')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'aadhaar') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'aadhaar'))} className="text-primary-700 underline">Preview uploaded Aadhaar</button>
              ) : <span>File selected (will upload after creation)</span>}
            </div>
          )}
        </div>
        {formData.franchiseType === 'GST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Certificate (upload)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFileChangeForType(e.target.files[0], 'gst')} />
            {(formData.pendingFiles?.gst || (formData.documents || []).find(d => d.documentType === 'gst')) && (
              <div className="mt-1 text-sm text-gray-600">
                {(formData.documents || []).find(d => d.documentType === 'gst') ? (
                  <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'gst'))} className="text-primary-700 underline">Preview uploaded GST</button>
                ) : <span>File selected (will upload after creation)</span>}
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Statement / Cancelled Cheque (upload)</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFileChangeForType(e.target.files[0], 'bank_statement')} />
          {(formData.pendingFiles?.bank_statement || (formData.documents || []).find(d => d.documentType === 'bank_statement')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'bank_statement') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'bank_statement'))} className="text-primary-700 underline">Preview uploaded Bank Document</button>
              ) : <span>File selected (will upload after creation)</span>}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shop Act (upload)</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFileChangeForType(e.target.files[0], 'shop_act')} />
          {(formData.pendingFiles?.shop_act || (formData.documents || []).find(d => d.documentType === 'shop_act')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'shop_act') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'shop_act'))} className="text-primary-700 underline">Preview uploaded Shop Act</button>
              ) : <span>File selected (will upload after creation)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Additional documents */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Add Additional Document</label>
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Document description" value={newAdditionalLabel} onChange={(e) => setNewAdditionalLabel(e.target.value)} className="px-3 py-2 border rounded-lg w-1/2" />
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setNewAdditionalFile(e.target.files && e.target.files[0])} />
          <button type="button" onClick={addAdditionalDocument} className="px-3 py-2 bg-primary-900 text-white rounded-lg">Add</button>
        </div>
        {(formData.additionalDocuments || []).length > 0 && (
          <ul className="mt-2 space-y-1">
            {(formData.additionalDocuments || []).map((d, idx) => (
              <li key={d._id || d.id || idx} className="flex items-center justify-between text-sm text-gray-700">
                <div>
                  <span className="font-medium">{d.label || d.originalFileName || d.fileName || `Document ${idx + 1}`}</span>
                  <div className="text-xs text-gray-500">{d.url ? (d.originalFileName || d.fileName) : (d.file && d.file.name)}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openPreview(d)} className="text-primary-700 underline text-sm">Preview</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={previewOpen} onClose={closePreview} title={previewName} size="lg">
        {previewUrl && (previewUrl.endsWith('.pdf') || previewUrl.includes('application/pdf')) ? (
          <iframe src={previewUrl} className="w-full h-[70vh]" title={previewName}></iframe>
        ) : (
          <img src={previewUrl} alt={previewName} className="max-w-full max-h-[70vh] mx-auto" />
        )}
      </Modal>

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
          disabled={isSaving}
          className={`px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-800'}`}
        >
          {isSaving ? (franchise ? 'Updating...' : 'Creating...') : (franchise ? 'Update Franchise' : 'Create Franchise')}
        </button>
      </div>
    </form>
  )
}

export default FranchiseForm
