import { useState, useRef } from 'react'
import { User, Settings, LogOut, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { authService } from '../services/auth.service'

const ProfileDropdown = ({ isOpen, onClose, user }) => {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const handleProfileClick = () => {
    navigate('/settings')
    onClose()
  }

  const handleSettingsClick = () => {
    navigate('/settings')
    onClose()
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      authService.removeToken()
      navigate('/login')
      onClose()
    }
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // TODO: Upload image to server
      // For now, create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        // You can store this in state or send to API
        console.log('Image selected:', reader.result)
        // Update user profile image
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-[110]" style={{ right: '0' }}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary-900 flex items-center justify-center text-white font-semibold text-lg">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                )}
              </div>
              <button
                onClick={handleImageClick}
                className="absolute bottom-0 right-0 w-6 h-6 bg-primary-900 rounded-full flex items-center justify-center text-white hover:bg-primary-800 transition-colors"
                title="Change profile picture"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.name || 'User Name'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                <span className="email-lowercase" data-email="true">{user?.email || 'user@example.com'}</span>
              </p>
              {user?.role && (
                <p className="text-xs text-primary-900 font-medium mt-0.5 truncate">
                  {user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="py-2">
          <button
            onClick={handleProfileClick}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <User className="w-4 h-4" />
            <span>My Profile</span>
          </button>
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        <div className="border-t border-gray-200 py-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
    </>
  )
}

export default ProfileDropdown
