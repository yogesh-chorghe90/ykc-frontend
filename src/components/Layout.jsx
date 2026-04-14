import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useInactivityLogout } from '../utils/useInactivityLogout'

const Layout = () => {
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Auto-logout on client inactivity (10 minutes)
  useInactivityLogout()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        onMinimizeChange={setSidebarMinimized} 
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[80] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isMobile ? 'ml-0' : sidebarMinimized ? 'ml-20' : 'ml-64'
      } relative z-0 min-w-0 overflow-hidden`}>
        <Header onMenuClick={() => setSidebarOpen(true)} isMobile={isMobile} />
        <main className="main-content flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 relative z-10 w-full">
          <div className="w-full max-w-full mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
