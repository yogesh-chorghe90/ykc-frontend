import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import Modal from './Modal'
import {
  formatGstNumber,
  formatIfscCode,
  IFSC_FORMAT_HINT,
  isIfscValidOrIncomplete,
  isValidGstNumber,
  isValidIfscCode,
} from '../utils/identifierFormatters'
import { uppercasePayload } from '../utils/uppercasePayload'

const AgentForm = ({ agent, onSave, onClose, isSaving = false, fixedManagedBy = null, fixedManagedByModel = null, hideManagedBySelector = false }) => {
  const currentUser = useMemo(() => authService.getUser(), [])

  const defaultManagedByModel = currentUser?.role === 'franchise' ? 'Franchise' : (currentUser?.role === 'relationship_manager' ? 'RelationshipManager' : 'Franchise')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    agentType: 'normal', // 'normal' or 'GST'
    // new flexible ownership fields
    managedBy: '',
    managedByModel: defaultManagedByModel, // or 'RelationshipManager'
  })
 
  // Add KYC, bank details and document placeholders
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kyc: prev.kyc || { pan: '', aadhaar: '', gst: '' },
      bankDetails: prev.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
      documents: prev.documents || [], // uploaded document records (objects returned from server)
      additionalDocuments: prev.additionalDocuments || [], // objects: { label, file/url, _id }
      pendingFiles: prev.pendingFiles || {}, // hold files for new agent before creation
    }))
  }, [])

  const [errors, setErrors] = useState({})
  const [franchises, setFranchises] = useState([])
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [franchiseSearch, setFranchiseSearch] = useState('')
  const [rmSearch, setRmSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  const [loadingRMs, setLoadingRMs] = useState(false)

  useEffect(() => {
    // If the logged in user is a franchise owner, default ownership to their franchise and prevent changing it
    if (currentUser && currentUser.role === 'franchise') {
      const franchiseId = currentUser.franchiseOwned || currentUser.franchise?._id || currentUser.franchise
      setFormData(prev => ({
        ...prev,
        managedByModel: 'Franchise',
        managedBy: franchiseId || prev.managedBy,
      }))
      // Pre-fill franchise search text if franchises list already loaded
      if (franchiseId && franchises.length > 0) {
        const found = franchises.find(f => (f._id || f.id)?.toString() === franchiseId?.toString())
        if (found) setFranchiseSearch(found.name)
      } else if (currentUser.franchise && currentUser.franchise.name) {
        setFranchiseSearch(currentUser.franchise.name)
      }
    }

    // Only fetch relationship managers on mount. Franchises will be loaded lazily when the user interacts
    const fetchRelationshipManagers = async () => {
      try {
        setLoadingRMs(true)
        const resp = await api.relationshipManagers.getAll({ status: 'active' })
        const rmData = resp.data || resp || []
        if (Array.isArray(rmData)) setRelationshipManagers(rmData)
      } catch (err) {
        console.error('Failed to fetch relationship managers:', err)
      } finally {
        setLoadingRMs(false)
      }
    }

    fetchRelationshipManagers()
  }, [])

  // If the logged in user is a relationship manager, default ownership to their RM profile and hide selector.
  useEffect(() => {
    if (!agent && currentUser && currentUser.role === 'relationship_manager' && !fixedManagedBy) {
      const rmProfile = relationshipManagers.find((rm) => {
        const ownerId = rm?.owner?._id || rm?.owner?.id || rm?.owner
        const currentUserId = currentUser?._id || currentUser?.id
        return ownerId && currentUserId && ownerId.toString() === currentUserId.toString()
      })
      setFormData(prev => ({
        ...prev,
        managedByModel: 'RelationshipManager',
        managedBy: rmProfile?._id || rmProfile?.id || prev.managedBy || '',
      }))
      // show RM name if available
      if (rmProfile?.name || currentUser.name) setRmSearch(rmProfile?.name || currentUser.name)
    }
  }, [agent, currentUser, fixedManagedBy, relationshipManagers])

  // Fetch franchises lazily when needed (e.g., when the franchise search input is focused)
  const fetchFranchises = async () => {
    try {
      setLoadingFranchises(true)
      const response = await api.franchises.getActive()
      const data = response.data || response || []
      if (Array.isArray(data)) {
        setFranchises(data)
      }
    } catch (error) {
      console.error('Failed to fetch franchises:', error)
    } finally {
      setLoadingFranchises(false)
    }
  }

  const loadFranchisesIfNeeded = () => {
    if (franchises.length === 0 && !loadingFranchises) {
      fetchFranchises()
    }
  }

  useEffect(() => {
    if (agent) {
      const managedById = agent.managedBy?._id || agent.managedBy || agent.franchise?._id || agent.franchise || ''
      const managedByModel = agent.managedByModel || (agent.franchise ? 'Franchise' : 'Franchise')

      setFormData({
        name: agent.name || '',
        email: agent.email || '',
        phone: agent.phone || agent.mobile || '',
        status: agent.status || 'active',
        agentType: agent.agentType || 'normal',
        managedBy: managedById,
        managedByModel,
        kyc: agent.kyc || { pan: '', aadhaar: '', gst: '' },
        bankDetails: agent.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
        documents: agent.documents || [],
      })
      
      // Set initial search string if franchise is populated
      // populate search text for managedBy depending on type
      if (managedByModel === 'Franchise') {
        if (agent.franchise && typeof agent.franchise === 'object' && agent.franchise.name) {
          setFranchiseSearch(agent.franchise.name)
        } else if (managedById && franchises.length > 0) {
          const found = franchises.find(f => f._id === managedById || f.id === managedById)
          if (found) setFranchiseSearch(found.name)
        }
      } else {
        if (agent.managedBy && typeof agent.managedBy === 'object' && agent.managedBy.name) {
          setRmSearch(agent.managedBy.name)
        } else if (managedById && relationshipManagers.length > 0) {
          const found = relationshipManagers.find(r => r._id === managedById || r.id === managedById)
          if (found) setRmSearch(found.name)
        }
      }
    }
  }, [agent, franchises])

  // If parent context provides fixed managedBy, set it on mount (for create-from-RM or create-from-Franchise flows)
  useEffect(() => {
    if (!agent && fixedManagedBy) {
      setFormData(prev => ({
        ...prev,
        managedBy: fixedManagedBy,
        managedByModel: fixedManagedByModel || prev.managedByModel,
      }))
      // set display search strings if name known in passed context (optional)
      if (fixedManagedByModel === 'Franchise' && fixedManagedBy?.name) {
        setFranchiseSearch(fixedManagedBy.name)
      } else if (fixedManagedByModel === 'RelationshipManager' && fixedManagedBy?.name) {
        setRmSearch(fixedManagedBy.name)
      }
    }
  }, [agent, fixedManagedBy, fixedManagedByModel])

  // Whether the current user should be restricted to their own franchise
  const isFranchiseCreator = currentUser?.role === 'franchise'
  const isRelationshipManagerCreator = currentUser?.role === 'relationship_manager'
  const effectiveHideManagedBySelector = Boolean(hideManagedBySelector || isRelationshipManagerCreator)

  const validate = (dataParam) => {
    const newErrors = {}
    const data = dataParam || formData
    if (!data.name.trim()) newErrors.name = 'Name is required'
    if (!data.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = 'Email is invalid'
    if (!data.phone.trim()) newErrors.phone = 'Phone is required'
    if (!data.managedBy) newErrors.managedBy = `${data.managedByModel === 'Franchise' ? 'Franchise' : 'Relationship Manager'} is required`

    const ifsc = data.bankDetails?.ifsc?.trim() || ''
    if (ifsc && !isValidIfscCode(ifsc)) newErrors['bankDetails.ifsc'] = IFSC_FORMAT_HINT
    const gst = data.kyc?.gst?.trim() || ''
    if (gst && !isValidGstNumber(gst)) newErrors['kyc.gst'] = 'GST number format is invalid (e.g., 27ABCDE1234F1Z5)'

    // Password validation - required for new agents, optional for updates
    if (!agent) {
      if (!data.password || data.password.length < 6) {
        newErrors.password = 'Password is required and must be at least 6 characters'
      }
      // KYC file uploads are mandatory when creating a partner (uploads apply after user is created)
      const pf = data.pendingFiles || {}
      const docs = data.documents || []
      const hasDocFile = (type) =>
        Boolean(pf[type]?.file) || docs.some((d) => d.documentType === type)
      if (!hasDocFile('pan')) newErrors.documents_pan = 'PAN card upload is required'
      if (!hasDocFile('aadhaar')) newErrors.documents_aadhaar = 'Aadhaar card upload is required'
      if (!hasDocFile('bank_statement')) {
        newErrors.documents_bank_statement = 'Bank statement or cancelled cheque upload is required'
      }
      if (data.agentType === 'GST' && !hasDocFile('gst')) {
        newErrors.documents_gst = 'GST certificate upload is required'
      }
    } else if (data.password && data.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Ensure typed names are resolved to IDs before validation/submit
    const resolveManagedByIfNeeded = () => {
      // already an id
      if (formData.managedBy) return formData
      if (formData.managedByModel === 'Franchise' && franchiseSearch) {
        const f = franchises.find(x => x.name.toLowerCase() === franchiseSearch.toLowerCase())
        if (f) return { ...formData, managedBy: f._id || f.id }
      }
      if (formData.managedByModel === 'RelationshipManager' && rmSearch) {
        const r = relationshipManagers.find(x => x.name.toLowerCase() === rmSearch.toLowerCase())
        if (r) return { ...formData, managedBy: r._id || r.id }
      }
      return formData
    }

    const resolved = uppercasePayload(resolveManagedByIfNeeded())
    setFormData(resolved)
    if (validate(resolved)) {
      const files = {
        pendingFiles: resolved.pendingFiles || {},
        additionalDocuments: resolved.additionalDocuments || [],
      }
      onSave(resolved, files)
    }
  }

  const handleChange = (e) => {
    const { name } = e.target
    let { value } = e.target
    // Support nested keys like kyc.pan or bankDetails.accountNumber
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      if (parent === 'bankDetails' && child === 'ifsc') {
        value = formatIfscCode(value)
        const msg = value && !isIfscValidOrIncomplete(value) ? IFSC_FORMAT_HINT : ''
        setErrors((prev) => ({ ...prev, [name]: msg }))
      } else if (parent === 'kyc' && child === 'gst') {
        value = formatGstNumber(value)
        const msg = value && !isValidGstNumber(value)
          ? 'GST number format is invalid (e.g., 27ABCDE1234F1Z5)'
          : ''
        setErrors((prev) => ({ ...prev, [name]: msg }))
      }
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...(prev[parent] || {}), [child]: value },
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
      if (name === 'agentType' && value !== 'GST') {
        setErrors((prev) => ({ ...prev, documents_gst: '' }))
      }
    }
    // Clear error when user starts typing
    if (errors[name] && name !== 'bankDetails.ifsc' && name !== 'kyc.gst') {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleFranchiseSearchChange = (e) => {
    const value = e.target.value
    setFranchiseSearch(value)
    setShowSuggestions(true)
    // If user clears input, allow them to see required error on submit
    if (value === '') {
        setFormData(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const handleRmSearchChange = (e) => {
    const value = e.target.value
    setRmSearch(value)
    setShowSuggestions(true)
    if (value === '') {
      setFormData(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const handleFileChange = async (e) => {
    // legacy single-file handler kept for backward compatibility; prefer handleFileChangeForType
    const file = e.target.files && e.target.files[0]
    if (!file) return
    // default to generic 'kyc' upload when no type provided
    return handleFileChangeForType(file, 'kyc')
  }

  const handleFileChangeForType = async (file, docType, label = '') => {
    if (!file) return
    // If editing an existing agent, upload immediately
    if (agent && (agent._id || agent.id)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'user')
        fd.append('entityId', agent._id || agent.id)
        fd.append('documentType', docType) // e.g. pan, aadhaar, gst, bank_statement, shop_act, additional
        if (label) fd.append('label', label)
        const resp = await api.documents.upload(fd)
        const doc = resp.data || resp
        // If it's an additional document, push to additionalDocuments
        if (docType === 'additional') {
          setFormData((prev) => ({ ...prev, additionalDocuments: [...(prev.additionalDocuments || []), doc] }))
        } else {
          setFormData((prev) => ({ ...prev, documents: [...(prev.documents || []), { ...doc, documentType: docType }] }))
        }
      } catch (err) {
        console.error('File upload failed', err)
      }
    } else {
      // For new agents, keep pending file in pendingFiles keyed by docType
      setFormData((prev) => ({ ...prev, pendingFiles: { ...(prev.pendingFiles || {}), [docType]: { file, label } } }))
      const docErrKey =
        docType === 'bank_statement' ? 'documents_bank_statement' : `documents_${docType}`
      setErrors((prev) => ({ ...prev, [docErrKey]: '' }))
    }
  }

  // Helper to add an additional doc from inputs (used for new agents)
  const [newAdditionalLabel, setNewAdditionalLabel] = useState('')
  const [newAdditionalFile, setNewAdditionalFile] = useState(null)
  const addAdditionalDocument = () => {
    if (!newAdditionalLabel || !newAdditionalFile) return
    // If agent exists, upload via API
    if (agent && (agent._id || agent.id)) {
      handleFileChangeForType(newAdditionalFile, 'additional', newAdditionalLabel)
      setNewAdditionalLabel('')
      setNewAdditionalFile(null)
    } else {
      // add as pending additional document
      setFormData((prev) => ({ ...prev, additionalDocuments: [...(prev.additionalDocuments || []), { label: newAdditionalLabel, file: newAdditionalFile }] }))
      setNewAdditionalLabel('')
      setNewAdditionalFile(null)
    }
  }

  // Preview modal state
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
    // Pending file object
    const file = doc.file || doc
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setPreviewName(doc.label || file.name)
    setPreviewOpen(true)
  }
  const closePreview = () => {
    setPreviewOpen(false)
    // revoke object URL if it was created from a File
    try { URL.revokeObjectURL(previewUrl) } catch (e) {}
    setPreviewUrl('')
    setPreviewName('')
  }

  const selectFranchise = (franchise) => {
    setFormData(prev => ({ ...prev, managedBy: franchise._id || franchise.id, managedByModel: 'Franchise' }))
    setFranchiseSearch(franchise.name)
    setShowSuggestions(false)
    if (errors.managedBy) {
      setErrors(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const selectRM = (rm) => {
    setFormData(prev => ({ ...prev, managedBy: rm._id || rm.id, managedByModel: 'RelationshipManager' }))
    setRmSearch(rm.name)
    setShowSuggestions(false)
    if (errors.managedBy) {
      setErrors(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const filteredFranchises = franchises.filter(f => f.name.toLowerCase().includes(franchiseSearch.toLowerCase()))
  const filteredRMs = relationshipManagers.filter(r => r.name.toLowerCase().includes(rmSearch.toLowerCase()))

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
          Managed By <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3 mb-2">
          {!effectiveHideManagedBySelector ? (
            !isFranchiseCreator ? (
              <>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="managedByModel"
                    value="Franchise"
                    checked={formData.managedByModel === 'Franchise'}
                    onChange={() => setFormData(prev => ({ ...prev, managedByModel: 'Franchise', managedBy: '' }))}
                    className="mr-2"
                  />
                  Franchise
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="managedByModel"
                    value="RelationshipManager"
                    checked={formData.managedByModel === 'RelationshipManager'}
                    onChange={() => setFormData(prev => ({ ...prev, managedByModel: 'RelationshipManager', managedBy: '' }))}
                    className="mr-2"
                  />
                  Relationship Manager
                </label>
              </>
            ) : (
              <div className="text-sm text-gray-700">Associated with your franchise</div>
            )
          ) : (
            // When selector is hidden because the parent context fixes ownership,
            // show a small label indicating the fixed association.
            <div className="text-sm text-gray-700">
              {formData.managedByModel === 'Franchise' ? 'Associated with Franchise' : 'Associated with Relationship Manager'}
            </div>
          )}
        </div>

        {formData.managedByModel === 'Franchise' ? (
          <div className="relative">
            <input
              type="text"
              value={franchiseSearch}
              onChange={handleFranchiseSearchChange}
              onFocus={() => { setShowSuggestions(true); loadFranchisesIfNeeded(); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.managedBy ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder={isFranchiseCreator ? 'Your franchise' : 'Search and select franchise'}
              autoComplete="off"
              readOnly={isFranchiseCreator || isRelationshipManagerCreator || effectiveHideManagedBySelector}
            />
            {!effectiveHideManagedBySelector && showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loadingFranchises ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                ) : filteredFranchises.length > 0 ? (
                  filteredFranchises.map((franchise) => (
                    <div
                      key={franchise._id || franchise.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!isFranchiseCreator) selectFranchise(franchise)
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    >
                      {franchise.name}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No franchises found</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={rmSearch}
              onChange={handleRmSearchChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.managedBy ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Search and select relationship manager"
              autoComplete="off"
              readOnly={isFranchiseCreator || isRelationshipManagerCreator || effectiveHideManagedBySelector}
            />
            {!effectiveHideManagedBySelector && showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loadingRMs ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                ) : filteredRMs.length > 0 ? (
                  filteredRMs.map((rm) => (
                    <div
                      key={rm._id || rm.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!isFranchiseCreator) selectRM(rm)
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    >
                      {rm.name}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No relationship managers found</div>
                )}
              </div>
            )}
          </div>
        )}

        {errors.managedBy && <p className="mt-1 text-sm text-red-600">{errors.managedBy}</p>}
      </div>

      {/* Partner Type - Always show for all users */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Partner Type <span className="text-red-500">*</span>
        </label>
        <select
          name="agentType"
          value={formData.agentType}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="normal">Normal</option>
          <option value="GST">GST</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password {agent ? '(Optional)' : <span className="text-red-500">*</span>}
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

      {/* KYC Fields */}
      <div className={`grid grid-cols-1 gap-4 ${formData.agentType === 'GST' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
          <input type="text" name="kyc.pan" value={formData.kyc?.pan || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="PAN number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar</label>
          <input type="text" name="kyc.aadhaar" value={formData.kyc?.aadhaar || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Aadhaar number" />
        </div>
        {formData.agentType === 'GST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
            <input
              type="text"
              name="kyc.gst"
              value={formData.kyc?.gst || ''}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors['kyc.gst'] ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g. 27ABCDE1234F1Z5"
              maxLength={15}
              inputMode="text"
              pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$"
            />
            {errors['kyc.gst'] && (
              <p className="mt-1 text-sm text-red-600">{errors['kyc.gst']}</p>
            )}
          </div>
        )}
      </div>

      {/* Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
          <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails?.accountHolderName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account holder name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails?.accountNumber || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input type="text" name="bankDetails.bankName" value={formData.bankDetails?.bankName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input type="text" name="bankDetails.branch" value={formData.bankDetails?.branch || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Branch" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
          <input
            type="text"
            name="bankDetails.ifsc"
            value={formData.bankDetails?.ifsc || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg ${errors['bankDetails.ifsc'] ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="e.g. HDFC0001234 or BARB0KHARAD"
            maxLength={11}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-gray-500">{IFSC_FORMAT_HINT}</p>
          {errors['bankDetails.ifsc'] && (
            <p className="mt-1 text-sm text-red-600">{errors['bankDetails.ifsc']}</p>
          )}
        </div>
      </div>

      {/* Document upload - mandatory for new partners */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-1">
        <p className="text-sm font-medium text-gray-800">
          KYC documents {!agent && <span className="text-red-500">*</span>}
        </p>
        {!agent && (
          <p className="text-xs text-gray-600">Upload all required files before creating the partner. Files are stored after the account is created.</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PAN Card (upload) {!agent && <span className="text-red-500">*</span>}
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            className={errors.documents_pan ? 'block w-full text-sm text-red-600 file:mr-2' : 'block w-full text-sm'}
            onChange={(e) => handleFileChangeForType(e.target.files[0], 'pan')}
          />
          {errors.documents_pan && <p className="mt-1 text-sm text-red-600">{errors.documents_pan}</p>}
          {(formData.pendingFiles?.pan || (formData.documents || []).find(d => d.documentType === 'pan')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'pan') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'pan'))} className="text-primary-700 underline">Preview uploaded PAN</button>
              ) : (
                <span>File selected (will upload after creation)</span>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aadhaar Card (upload) {!agent && <span className="text-red-500">*</span>}
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            className={errors.documents_aadhaar ? 'block w-full text-sm text-red-600 file:mr-2' : 'block w-full text-sm'}
            onChange={(e) => handleFileChangeForType(e.target.files[0], 'aadhaar')}
          />
          {errors.documents_aadhaar && <p className="mt-1 text-sm text-red-600">{errors.documents_aadhaar}</p>}
          {(formData.pendingFiles?.aadhaar || (formData.documents || []).find(d => d.documentType === 'aadhaar')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'aadhaar') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'aadhaar'))} className="text-primary-700 underline">Preview uploaded Aadhaar</button>
              ) : <span>File selected (will upload after creation)</span>}
            </div>
          )}
        </div>
        {formData.agentType === 'GST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Certificate (upload) {!agent && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept="application/pdf,image/*"
              className={errors.documents_gst ? 'block w-full text-sm text-red-600 file:mr-2' : 'block w-full text-sm'}
              onChange={(e) => handleFileChangeForType(e.target.files[0], 'gst')}
            />
            {errors.documents_gst && <p className="mt-1 text-sm text-red-600">{errors.documents_gst}</p>}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank Statement / Cancelled Cheque (upload) {!agent && <span className="text-red-500">*</span>}
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            className={errors.documents_bank_statement ? 'block w-full text-sm text-red-600 file:mr-2' : 'block w-full text-sm'}
            onChange={(e) => handleFileChangeForType(e.target.files[0], 'bank_statement')}
          />
          {errors.documents_bank_statement && (
            <p className="mt-1 text-sm text-red-600">{errors.documents_bank_statement}</p>
          )}
          {(formData.pendingFiles?.bank_statement || (formData.documents || []).find(d => d.documentType === 'bank_statement')) && (
            <div className="mt-1 text-sm text-gray-600">
              {(formData.documents || []).find(d => d.documentType === 'bank_statement') ? (
                <button type="button" onClick={() => openPreview((formData.documents || []).find(d => d.documentType === 'bank_statement'))} className="text-primary-700 underline">Preview uploaded Bank Document</button>
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

      {/* Preview modal */}
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
          className={`px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isSaving ? (agent ? 'Updating...' : 'Creating...') : (agent ? 'Update Partner' : 'Create Partner')}
        </button>
      </div>
    </form>
  )
}

export default AgentForm
