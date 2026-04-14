import { useState, useEffect, useRef } from 'react'
import { Bell, Menu } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'
import NotificationDropdown from './NotificationDropdown'
import { authService } from '../services/auth.service'
import api from '../services/api'

const Header = ({ onMenuClick, isMobile = false }) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [user, setUser] = useState({
    name: 'User Name',
    email: 'user@example.com',
    profileImage: null,
    role: null,
  })
  const notificationRef = useRef(null)
  const profileRef = useRef(null)

  const updateUserState = (userData) => {
    if (userData) {
      setUser({
        name: userData.name || userData.fullName || 'User Name',
        email: userData.email || 'user@example.com',
        profileImage: userData.profileImage || null,
        role: userData.role || null,
      })
    }
  }

  const getDashboardTitle = () => {
    if (!user.role) return 'Dashboard'

    const roleMap = {
      'agent': 'Partner Dashboard',
      'franchise': 'Franchisee Dashboard',
      'regional_manager': 'Regional Manager Dashboard',
      'relationship_manager': 'Relationship Manager Dashboard',
      'accounts_manager': 'Accounts Manager Dashboard',
      'super_admin': 'Admin Dashboard',
    }

    return roleMap[user.role] || 'Dashboard'
  }

  useEffect(() => {
    if (!authService.isAuthenticated()) return

    const fetchUnreadCount = async () => {
      try {
        const res = await api.notifications?.getUnreadCount?.()
        const count = res?.data?.count ?? 0
        setUnreadCount(count)
      } catch {
        setUnreadCount(0)
      }
    }
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)

    const storedUser = authService.getUser()
    if (storedUser) {
      updateUserState(storedUser)
    } else {
      api.auth.getCurrentUser()
        .then((response) => {
          const userData = response.data || response
          if (userData) {
            authService.setUser(userData)
            updateUserState(userData)
          }
        })
        .catch((error) => {
          console.error('Error fetching user:', error)
        })
    }

    const handleProfileUpdate = (event) => {
      const userData = event.detail
      if (userData) {
        authService.setUser(userData)
        updateUserState(userData)
      }
    }

    window.addEventListener('userProfileUpdated', handleProfileUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('userProfileUpdated', handleProfileUpdate)
    }
  }, [])

 

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    if (isNotificationOpen || isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotificationOpen, isProfileOpen])

  return (
    <header className="bg-white border-b border-gray-200 h-16 px-3 sm:px-4 md:px-6 flex items-center justify-between relative z-[100] w-full overflow-visible">
      {/* Left Section */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink">
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mr-2"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate uppercase tracking-wide">{getDashboardTitle()}</h1>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-4 pr-0 flex-shrink-0 relative">
        {/* Notification Bell */}
        <div className="relative z-[110]" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center text-[10px] sm:text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
        </div>

        {/* Profile Dropdown */}
        <div className="relative z-[110]" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-900 flex items-center justify-center text-white font-semibold hover:bg-primary-800 transition-colors cursor-pointer relative z-[110] text-sm sm:text-base"
          >
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover"
              />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
          <ProfileDropdown
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            user={user}
          />
        </div>
      </div>
    </header>
  )
}

export default Header
