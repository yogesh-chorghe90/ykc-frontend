import { useState, useEffect } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'
import { authService } from '../services/auth.service'

const PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const VALID_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const Form16Form = ({ form16, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    attachmentName: '',
    formType: 'form16',
    user: '',
  })

  // pendingFiles: files chosen but not yet uploaded (new record flow)
  const [pendingFiles, setPendingFiles] = useState([])
  // uploadedFiles: already-uploaded docs (edit record flow)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [errors, setErrors] = useState({})
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const userRole = authService.getUser()?.role
  const isAdminOrAccountant = userRole === 'super_admin' || userRole === 'accounts_manager'

  useEffect(() => {
    if (isAdminOrAccountant && !form16) fetchUsers()
  }, [isAdminOrAccountant, form16])

  useEffect(() => {
    if (form16) {
      setFormData({
        attachmentName: form16.attachmentName || '',
        formType: form16.formType || 'form16',
        user: form16.user?._id || form16.user || '',
      })
      // Fetch existing documents for this form16 record
      fetchExistingDocuments(form16._id || form16.id)
    } else {
      const currentUser = authService.getUser()
      setFormData({
        attachmentName: '',
        formType: 'form16',
        user: isAdminOrAccountant ? '' : (currentUser?._id || currentUser?.id || ''),
      })
      setPendingFiles([])
      setUploadedFiles([])
    }
  }, [form16, isAdminOrAccountant])

  const fetchExistingDocuments = async (entityId) => {
    try {
      const resp = await api.documents.list('form16', entityId)
      const docs = resp.data || resp || []
      setUploadedFiles(Array.isArray(docs) ? docs : [])
    } catch (e) {
      console.error('Error fetching form16 documents:', e)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const roles = ['agent', 'franchise', 'relationship_manager', 'regional_manager']
      const allUsers = []
      for (const role of roles) {
        try {
          const response = await api.users.getAll({ role, limit: 1000 })
          const data = response.data || response || []
          if (Array.isArray(data)) allUsers.push(...data)
        } catch (e) {
          console.error(`Error fetching ${role} users:`, e)
        }
      }
      const uniqueUsers = allUsers.filter((user, i, self) =>
        i === self.findIndex((u) => (u._id || u.id) === (user._id || user.id))
      )
      setUsers(uniqueUsers)
    } catch (e) {
      console.error('Error fetching users:', e)
    } finally {
      setLoadingUsers(false)
    }
  }

  const validate = () => {
    const newErrors = {}
    if (isAdminOrAccountant && !formData.user) newErrors.user = 'User selection is required'
    const hasFiles = pendingFiles.length > 0 || uploadedFiles.length > 0
    if (!hasFiles) newErrors.files = 'At least one file is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFilesChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const validFiles = []
    for (const file of files) {
      if (!VALID_TYPES.includes(file.type)) {
        toast.error('Invalid File', `${file.name}: Only PDF or image files are allowed`)
        continue
      }
      if (file.size > MAX_SIZE) {
        toast.error('File Too Large', `${file.name}: Must be less than 10MB`)
        continue
      }
      validFiles.push(file)
    }

    if (!validFiles.length) return

    // If editing an existing form16, upload immediately
    if (form16 && (form16._id || form16.id)) {
      setUploading(true)
      let uploaded = 0
      for (const file of validFiles) {
        try {
          setUploadProgress(`Uploading ${file.name} (${++uploaded}/${validFiles.length})...`)
          const fd = new FormData()
          fd.append('file', file)
          fd.append('entityType', 'form16')
          fd.append('entityId', form16._id || form16.id)
          fd.append('documentType', 'form16_attachment')
          fd.append('description', 'Form 16 / TDS attachment')
          const resp = await api.documents.upload(fd)
          const doc = resp.data || resp
          setUploadedFiles(prev => [...prev, doc])
        } catch (err) {
          toast.error('Upload Failed', `${file.name}: ${err.message || 'Upload failed'}`)
        }
      }
      setUploading(false)
      setUploadProgress('')
      if (uploaded > 0) toast.success('Success', `${uploaded} file(s) uploaded`)
    } else {
      // Queue for upload on submit
      setPendingFiles(prev => [...prev, ...validFiles])
    }

    // Reset input so same file can be re-selected
    e.target.value = ''
    if (errors.files) setErrors(prev => ({ ...prev, files: '' }))
  }

  const handleRemovePending = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveUploaded = async (doc) => {
    const docId = doc._id || doc.id
    try {
      await api.documents.delete(docId)
      setUploadedFiles(prev => prev.filter(d => (d._id || d.id) !== docId))
      toast.success('Removed', 'File removed successfully')
    } catch (e) {
      toast.error('Error', 'Failed to remove file')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setUploading(true)
    try {
      if (!form16) {
        // Create the form16 record first with a placeholder
        const initialData = {
          formType: formData.formType,
          attachmentName: formData.attachmentName?.trim() || '',
          attachment: PLACEHOLDER_URL,
          user: formData.user || undefined,
          status: 'active',
        }
        const createResp = await api.form16.create(initialData)
        const newForm = createResp.data || createResp
        if (!newForm?._id) throw new Error('Failed to create record')

        // Upload all pending files
        let firstFileUrl = PLACEHOLDER_URL
        for (let i = 0; i < pendingFiles.length; i++) {
          const file = pendingFiles[i]
          setUploadProgress(`Uploading ${file.name} (${i + 1}/${pendingFiles.length})...`)
          const fd = new FormData()
          fd.append('file', file)
          fd.append('entityType', 'form16')
          fd.append('entityId', newForm._id)
          fd.append('documentType', 'form16_attachment')
          fd.append('description', 'Form 16 / TDS attachment')
          const uploadResp = await api.documents.upload(fd)
          const doc = uploadResp.data || uploadResp
          if (i === 0) firstFileUrl = doc.url || doc.filePath || PLACEHOLDER_URL
        }

        // Update with first file's URL for backward compat
        await api.form16.update(newForm._id, {
          formType: formData.formType,
          attachmentName: formData.attachmentName?.trim() || '',
          attachment: firstFileUrl,
          user: formData.user || undefined,
          fileName: pendingFiles[0]?.name,
          fileSize: pendingFiles[0]?.size,
          mimeType: pendingFiles[0]?.type,
          status: 'active',
        })

        toast.success('Success', `Form 16 created with ${pendingFiles.length} file(s)`)
        onClose()
      } else {
        // Update existing record metadata only (files already uploaded in handleFilesChange)
        const submitData = {
          formType: formData.formType,
          attachmentName: formData.attachmentName?.trim() || '',
          user: formData.user || undefined,
          status: 'active',
        }
        onSave(submitData)
      }
    } catch (error) {
      console.error('Error submitting Form 16:', error)
      toast.error('Error', error.message || 'Failed to save')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const totalFiles = uploadedFiles.length + pendingFiles.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* User selector */}
      {isAdminOrAccountant && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select User <span className="text-red-500">*</span>
          </label>
          {loadingUsers ? (
            <p className="text-sm text-gray-500">Loading users...</p>
          ) : (
            <select
              name="user"
              value={formData.user}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.user ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name || user.email} ({user.role || 'N/A'})
                </option>
              ))}
            </select>
          )}
          {errors.user && <p className="mt-1 text-sm text-red-600">{errors.user}</p>}
        </div>
      )}

      {/* Attachment Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Attachment Name</label>
        <input
          type="text"
          name="attachmentName"
          value={formData.attachmentName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter attachment name (optional)"
        />
      </div>

      {/* File Upload Zone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Files <span className="text-red-500">*</span>
          {totalFiles > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">({totalFiles} file{totalFiles !== 1 ? 's' : ''} selected)</span>
          )}
        </label>

        <label
          htmlFor="form16-files"
          className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            errors.files ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center justify-center py-4">
            {uploading ? (
              <>
                <Loader2 className="w-7 h-7 mb-1 text-primary-600 animate-spin" />
                <p className="text-sm text-primary-600 font-medium">{uploadProgress || 'Uploading...'}</p>
              </>
            ) : (
              <>
                <Upload className={`w-7 h-7 mb-1 ${errors.files ? 'text-red-400' : 'text-gray-400'}`} />
                <p className="text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG, WebP, GIF · Max 10MB each · Multiple files allowed</p>
              </>
            )}
          </div>
          <input
            id="form16-files"
            type="file"
            multiple
            className="hidden"
            accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFilesChange}
            disabled={uploading}
          />
        </label>
        {errors.files && <p className="mt-1 text-sm text-red-600">{errors.files}</p>}
      </div>

      {/* Already-uploaded files (edit mode) */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Uploaded files</p>
          {uploadedFiles.map((doc) => {
            const docId = doc._id || doc.id
            const name = doc.originalFileName || doc.fileName || 'File'
            const sizeKB = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''
            return (
              <div key={docId} className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                  {sizeKB && <p className="text-xs text-gray-500">{sizeKB}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUploaded(doc)}
                  className="flex-shrink-0 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pending files (create mode — not yet uploaded) */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ready to upload</p>
          {pendingFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePending(index)}
                className="flex-shrink-0 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
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
          disabled={uploading}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {uploadProgress || 'Uploading...'}
            </span>
          ) : form16 ? 'Update' : 'Create Form 16'}
        </button>
      </div>
    </form>
  )
}

export default Form16Form
