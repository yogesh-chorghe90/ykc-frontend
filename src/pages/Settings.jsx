import { useState, useRef, useEffect } from 'react'
import { User, Camera, Save, X, Eye, EyeOff } from 'lucide-react'
import { toast } from '../services/toastService'
import api from '../services/api'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'

function buildUserState(userData) {
  return {
    name: userData.name || userData.fullName || 'User Name',
    email: userData.email || 'user@example.com',
    phone: userData.phone || userData.mobile || '',
    profileImage: userData.profileImage || null,
    role: userData.role || null,
    status: userData.status ?? null,
    franchise: userData.franchise ?? null,
    managedBy: userData.managedBy ?? null,
    managedByModel: userData.managedByModel ?? null,
    agentType: userData.agentType ?? null,
    commissionPercentage: userData.commissionPercentage ?? null,
    kyc: userData.kyc || {},
    bankDetails: userData.bankDetails || {},
    lastLoginAt: userData.lastLoginAt ?? null,
    createdAt: userData.createdAt ?? null,
    updatedAt: userData.updatedAt ?? null,
    permissions: userData.permissions || [],
  }
}

const Settings = () => {
  const [user, setUser] = useState({
    name: 'User Name',
    email: 'user@example.com',
    phone: '',
    profileImage: null,
    role: null,
    status: null,
    franchise: null,
    managedBy: null,
    managedByModel: null,
    agentType: null,
    commissionPercentage: null,
    kyc: {},
    bankDetails: {},
    lastLoginAt: null,
    createdAt: null,
    updatedAt: null,
    permissions: [],
  })

  const [previewImage, setPreviewImage] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const fileInputRef = useRef(null)

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        const response = await api.auth.getCurrentUser()
        const userData = response.data || response

        if (userData) {
          const userState = buildUserState(userData)

          setUser(userState)
          setFormData({
            name: userState.name,
            email: userState.email,
            phone: userState.phone,
          })

          authService.setUser(userData)
          window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: userData }))
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        const storedUser = authService.getUser()
        if (storedUser) {
          const userState = buildUserState(storedUser)
          setUser(userState)
          setFormData({
            name: userState.name,
            email: userState.email,
            phone: userState.phone,
          })
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Error', 'Image size should be less than 5MB')
        return
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Error', 'Please select a valid image file')
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImage(reader.result)
        setUser((prev) => ({ ...prev, profileImage: reader.result }))
        // Update formData for profileImage
        setFormData((prev) => ({ ...prev, profileImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    const name = formData.name?.trim()
    const email = formData.email?.trim()?.toLowerCase()
    const mobileDigits = (formData.phone || '').replace(/\s+/g, '').trim()

    if (!name) {
      toast.error('Validation', 'Please enter your full name.')
      return
    }
    if (!email) {
      toast.error('Validation', 'Please enter your email address.')
      return
    }
    if (!mobileDigits || mobileDigits.length < 10) {
      toast.error('Validation', 'Please enter a valid mobile number (at least 10 digits).')
      return
    }

    try {
      setSaving(true)
      const payload = {
        name,
        email,
        mobile: mobileDigits,
        phone: mobileDigits,
      }
      if (formData.profileImage) {
        payload.profileImage = formData.profileImage
      }

      const response = await api.auth.updateProfile(payload)
      const userData = response?.data ?? response
      if (!userData || typeof userData !== 'object' || userData._id == null) {
        toast.error('Update Failed', 'Invalid response from server.')
        return
      }

      const userState = buildUserState(userData)
      setUser(userState)
      setFormData({
        name: userState.name,
        email: userState.email,
        phone: userState.phone,
      })
      authService.setUser(userData)
      window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: userData }))
      setPreviewImage(null)
      setIsEditing(false)
      toast.success('Profile Updated', 'Your profile has been updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      // apiRequest already shows toast for HTTP errors
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
    })
    setIsEditing(false)
    setPreviewImage(null) // Clear preview on cancel
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordVisible({ current: false, new: false, confirm: false })
  }

  const handlePasswordFieldChange = (e) => {
    const { name, value } = e.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword || !newPassword) {
      toast.error('Validation', 'Enter your current password and a new password.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Validation', 'New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Validation', 'New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      toast.error('Validation', 'New password must be different from your current password.')
      return
    }

    try {
      setPasswordSubmitting(true)
      const response = await api.auth.changePassword({ currentPassword, newPassword })
      const msg = response?.message || 'Password changed. Please log in again.'
      toast.success('Password updated', msg, 6000)
      closePasswordModal()
      authService.removeToken()
      window.setTimeout(() => {
        window.location.href = '/login'
      }, 600)
    } catch (err) {
      console.error(err)
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading profile...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-primary-900 hover:text-primary-800 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Profile Image */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary-900 flex items-center justify-center text-white font-semibold text-2xl overflow-hidden">
              {previewImage || user.profileImage ? (
                <img
                  src={previewImage || user.profileImage}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="w-12 h-12" />
              )}
            </div>
            {isEditing && (
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-900 rounded-full flex items-center justify-center text-white hover:bg-primary-800 transition-colors cursor-pointer">
                <Camera className="w-4 h-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.role && (
              <p className="text-xs text-primary-600 font-medium mt-1">
                {user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </p>
            )}
            {isEditing && (
              <p className="text-xs text-gray-400 mt-1">Click camera icon to change profile picture</p>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your name"
              />
            ) : (
              <p className="text-sm text-gray-900 py-2">{user.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            {isEditing ? (
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your email"
              />
            ) : (
              <p className="text-sm text-gray-900 py-2">{user.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile
            </label>
            {isEditing ? (
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="10-digit mobile number"
              />
            ) : (
              <p className="text-sm text-gray-900 py-2">{user.phone || '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <p className="text-sm text-gray-900 py-2">
              {user.role ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </span>
              ) : (
                <span className="text-gray-400">Not assigned</span>
              )}
            </p>
          </div>

          {user.status != null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <p className="text-sm text-gray-900 py-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.status === 'active' ? 'bg-green-100 text-green-800' :
                  user.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                }`}>
                  {String(user.status).charAt(0).toUpperCase() + String(user.status).slice(1)}
                </span>
              </p>
            </div>
          )}

          {(user.role === 'agent' || user.role === 'franchise') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
              <p className="text-sm text-gray-900 py-2">
                {user.franchise
                  ? (typeof user.franchise === 'object' && user.franchise?.name ? user.franchise.name : String(user.franchise))
                  : '—'}
              </p>
            </div>
          )}

          {/* Mapped RM / Franchise account details */}
          {user.role === 'agent' && user.managedBy && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {user.managedByModel === 'RelationshipManager' ? 'Mapped RM' : 'Mapped Franchise'}
                </label>
                <p className="text-sm text-gray-900 py-2 font-medium">
                  {typeof user.managedBy === 'object' && user.managedBy?.name
                    ? user.managedBy.name
                    : '—'}
                </p>
              </div>
              {typeof user.managedBy === 'object' && user.managedBy?.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {user.managedByModel === 'RelationshipManager' ? 'RM Email' : 'Franchise Email'}
                  </label>
                  <p className="text-sm text-gray-900 py-2">{user.managedBy.email}</p>
                </div>
              )}
              {typeof user.managedBy === 'object' && user.managedBy?.phone && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {user.managedByModel === 'RelationshipManager' ? 'RM Phone' : 'Franchise Phone'}
                  </label>
                  <p className="text-sm text-gray-900 py-2">{user.managedBy.phone}</p>
                </div>
              )}
              {user.agentType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Type</label>
                  <p className="text-sm py-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.agentType === 'GST' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                      {user.agentType === 'GST' ? 'GST' : 'Normal'}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}

          {user.role === 'agent' && user.commissionPercentage != null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
              <p className="text-sm text-gray-900 py-2">{user.commissionPercentage}%</p>
            </div>
          )}

          {user.lastLoginAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
              <p className="text-sm text-gray-900 py-2">{new Date(user.lastLoginAt).toLocaleString()}</p>
            </div>
          )}

          {user.createdAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joined</label>
              <p className="text-sm text-gray-900 py-2">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          )}

          {user.kyc && (user.kyc.pan || user.kyc.aadhaar || user.kyc.gst || user.kyc.verified != null) && (
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">KYC</label>
              <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50">
                {user.kyc.pan && <p className="text-sm text-gray-900"><span className="text-gray-600">PAN:</span> {user.kyc.pan}</p>}
                {user.kyc.aadhaar && <p className="text-sm text-gray-900"><span className="text-gray-600">Aadhaar:</span> {user.kyc.aadhaar}</p>}
                {user.kyc.gst && <p className="text-sm text-gray-900"><span className="text-gray-600">GST:</span> {user.kyc.gst}</p>}
                {user.kyc.verified != null && (
                  <p className="text-sm text-gray-900">
                    <span className="text-gray-600">Verified:</span>{' '}
                    <span className={user.kyc.verified ? 'text-green-600 font-medium' : 'text-amber-600'}>{user.kyc.verified ? 'Yes' : 'No'}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {user.bankDetails && (user.bankDetails.accountHolderName || user.bankDetails.accountNumber || user.bankDetails.ifsc || user.bankDetails.bankName) && (
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bank Details</label>
              <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50">
                {user.bankDetails.accountHolderName && <p className="text-sm text-gray-900"><span className="text-gray-600">Account Holder:</span> {user.bankDetails.accountHolderName}</p>}
                {user.bankDetails.bankName && <p className="text-sm text-gray-900"><span className="text-gray-600">Bank:</span> {user.bankDetails.bankName}</p>}
                {user.bankDetails.accountNumber && <p className="text-sm text-gray-900"><span className="text-gray-600">Account No:</span> {user.bankDetails.accountNumber}</p>}
                {user.bankDetails.ifsc && <p className="text-sm text-gray-900"><span className="text-gray-600">IFSC:</span> {user.bankDetails.ifsc}</p>}
              </div>
            </div>
          )}

          {user.permissions && user.permissions.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
              <p className="text-sm text-gray-900 py-2 flex flex-wrap gap-1">
                {user.permissions.map((p) => (
                  <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{p}</span>
                ))}
              </p>
            </div>
          )}

          {isEditing && (
            <div className="md:col-span-2 flex items-center gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account Settings Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Change Password</p>
              <p className="text-xs text-gray-500">Update your password to keep your account secure</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 text-sm font-medium text-primary-900 hover:text-primary-800 transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={showPasswordModal} onClose={closePasswordModal} title="Change password" size="sm">
        <form onSubmit={handleChangePasswordSubmit} className="space-y-4 py-2">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={passwordVisible.current ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordFieldChange}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={passwordVisible.current ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                onClick={() =>
                  setPasswordVisible((v) => ({ ...v, current: !v.current }))
                }
              >
                {passwordVisible.current ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={passwordVisible.new ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={handlePasswordFieldChange}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={passwordVisible.new ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                onClick={() => setPasswordVisible((v) => ({ ...v, new: !v.new }))}
              >
                {passwordVisible.new ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={passwordVisible.confirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordFieldChange}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={passwordVisible.confirm ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                onClick={() =>
                  setPasswordVisible((v) => ({ ...v, confirm: !v.confirm }))
                }
              >
                {passwordVisible.confirm ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closePasswordModal}
              disabled={passwordSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 disabled:opacity-50"
            >
              {passwordSubmitting ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Settings
