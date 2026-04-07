import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '/logo.webp'
import { authService } from '../services/auth.service'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Store,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  MapPin,
  History,
  Image,
  Receipt,
  Ticket,
  UserCog,
  Percent,
  Wallet,
  X,
  BookUser,
} from 'lucide-react'

const Sidebar = ({ onMinimizeChange, isMobile = false, isOpen = false, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false)

  const currentUser = authService.getUser()
  const userRole = currentUser?.role || 'super_admin'

  useEffect(() => {
    if (isMobile) {
      setIsMinimized(false)
    }
  }, [isMobile])

  const handleToggle = () => {
    if (isMobile) {
      onClose?.()
      return
    }
    const newState = !isMinimized
    setIsMinimized(newState)
    if (onMinimizeChange) {
      onMinimizeChange(newState)
    }
  }

  const handleLinkClick = () => {
    if (isMobile) {
      onClose?.()
    }
  }

  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent', 'accounts_manager'] },
    { icon: MapPin, label: 'Regional Manager', path: '/regional-managers', roles: ['super_admin'] },
    { icon: Store, label: 'Franchises', path: '/franchises', roles: ['super_admin', 'regional_manager', 'accounts_manager'] },
    { icon: Users, label: 'Relationship Managers', path: '/relationship-managers', roles: ['super_admin', 'regional_manager', 'accounts_manager'] },
    { icon: UserCheck, label: 'Partners', path: '/agents', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'accounts_manager'] },
    { icon: UserCog, label: 'Sub Partners', path: '/sub-agents', roles: ['agent'] },
    { icon: BookUser, label: 'My Contacts', path: '/my-contacts', roles: ['agent'] },
    { icon: Users, label: 'Customers', path: '/leads', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent', 'accounts_manager'] },
    { icon: Building2, label: 'Banks', path: '/banks', roles: ['super_admin', 'regional_manager', 'relationship_manager'] },
    { icon: UserCheck, label: 'Accountant Managers', path: '/accountant-managers', roles: ['super_admin'] },
    { icon: FileText, label: 'Invoices', path: '/invoices', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent', 'accounts_manager'] },
    { icon: Wallet, label: 'Payouts', path: '/payouts', roles: ['super_admin', 'accounts_manager'] },
    { icon: FileText, label: 'Lead Forms', path: '/lead-forms', roles: ['super_admin', 'regional_manager'] },
    // Banners: visible to all roles, but only super_admin can edit/delete (enforced in UI + backend)
    { icon: Image, label: 'Banners', path: '/banners', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent', 'accounts_manager'] },
    { icon: Receipt, label: 'Form 16 / TDS', path: '/form16', roles: ['super_admin', 'accounts_manager', 'agent', 'franchise', 'relationship_manager', 'regional_manager'] },
    { icon: Ticket, label: 'Service Requests', path: '/tickets', roles: ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent'] },
    { icon: History, label: 'History', path: '/history', roles: ['super_admin', 'accounts_manager'] },
    { icon: Percent, label: 'Commission', path: '/franchise-commission', roles: ['super_admin', 'accounts_manager'] },
  ]

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole))

  const bottomMenuItems = [
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help Center', path: '/help' },
  ]

  return (
    <div className={`bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-[90] shadow-sm sidebar-transition ${
      isMobile 
        ? `${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64` 
        : `${isMinimized ? 'w-20' : 'w-64'}`
    }`}>
      {/* Minimize Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {(!isMinimized || isMobile) && (
          <div>
            <img src={logo} alt="YKC CRM" className="object-contain max-h-10" />
          </div>
        )}
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              onClick={handleToggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {!isMobile && (
        <button
          onClick={handleToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isMinimized ? (
            <ChevronRight className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          )}
        </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col h-[calc(100vh-73px)] overflow-hidden p-4">
        <div className="flex-1 overflow-y-auto min-h-0">
          {!isMinimized && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Navigation
            </h3>
          )}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                      ? 'bg-primary-50 text-primary-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                  title={isMinimized && !isMobile ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {(!isMinimized || isMobile) && <span className="text-sm uppercase">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Bottom Menu */}
        <div className="pt-6 border-t border-gray-200 flex-shrink-0">
          {!isMinimized && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Support
            </h3>
          )}
          <nav className="space-y-1">
            {bottomMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                      ? 'bg-primary-50 text-primary-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                  title={isMinimized && !isMobile ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {(!isMinimized || isMobile) && <span className="text-sm uppercase">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
