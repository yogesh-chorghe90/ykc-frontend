import { X } from 'lucide-react'
import { useEffect } from 'react'

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-12 sm:pt-20 pb-4 px-2 sm:px-4 overflow-y-auto" style={{ zIndex: 10000 }}>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal panel */}
      <div
        className={`relative bg-white rounded-lg text-left overflow-hidden shadow-xl w-full ${sizeClasses[size]} max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)] flex flex-col mt-2 sm:mt-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0 sticky top-0 bg-white z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 pr-2 uppercase tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>{children}</div>
      </div>
    </div>
  )
}

export default Modal
