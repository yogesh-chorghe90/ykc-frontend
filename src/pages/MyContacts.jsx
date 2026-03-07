import { useState, useEffect } from 'react'
import { Mail, Phone, MapPin, User, Building2, Users, CreditCard, MapPinned } from 'lucide-react'
import api from '../services/api'

const ContactCard = ({ label, name, email, phone, mobile, address, extra = [] }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <User className="w-5 h-5 text-primary-900" />
      </div>
      <div>
        <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">{label}</p>
        <p className="text-base font-semibold text-gray-900">{name || '—'}</p>
      </div>
    </div>
    <div className="space-y-1.5 text-sm text-gray-600">
      {email && (
        <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary-900 transition-colors">
          <Mail className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span className="break-all">{email}</span>
        </a>
      )}
      {(phone || mobile) && (
        <a href={`tel:${phone || mobile}`} className="flex items-center gap-2 hover:text-primary-900 transition-colors">
          <Phone className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span>{phone || mobile}</span>
        </a>
      )}
      {address && (phone || mobile) !== address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" />
          <span>{address}</span>
        </div>
      )}
      {extra.map((item, i) => item.value ? (
        <div key={i} className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-medium w-20 flex-shrink-0">{item.label}</span>
          <span className="text-gray-700">{item.value}</span>
        </div>
      ) : null)}
    </div>
  </div>
)

const EmptyState = ({ icon: Icon, message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <Icon className="w-12 h-12 mb-3 opacity-30" />
    <p className="text-sm">{message}</p>
  </div>
)

const MyContacts = () => {
  const [activeTab, setActiveTab] = useState('manager')
  const [loading, setLoading] = useState(true)
  const [manager, setManager] = useState(null)
  const [managerType, setManagerType] = useState(null)
  const [regionalManager, setRegionalManager] = useState(null)
  const [accountants, setAccountants] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [profileResp, accountantsResp, rmResp] = await Promise.all([
          api.auth.getCurrentUser(),
          api.accountantManagers.getContacts(),
          api.accountantManagers.getMyRegionalManager(),
        ])

        const userData = profileResp.data || profileResp
        if (userData?.managedBy && typeof userData.managedBy === 'object') {
          setManager(userData.managedBy)
          setManagerType(userData.managedByModel)
        }

        const amData = accountantsResp.data || accountantsResp || []
        if (Array.isArray(amData)) setAccountants(amData)

        const rmData = rmResp.data || rmResp || null
        if (rmData && typeof rmData === 'object' && rmData.name) setRegionalManager(rmData)
      } catch (err) {
        console.error('Failed to load contacts:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const managerLabel = managerType === 'RelationshipManager' ? 'Relationship Manager' : 'Franchise'
  const managerIcon = managerType === 'RelationshipManager' ? Users : Building2

  const tabs = [
    { id: 'manager', label: managerLabel, icon: managerIcon },
    { id: 'regional_manager', label: 'Regional Manager', icon: MapPinned },
    { id: 'accountant', label: 'Accountants', icon: CreditCard },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">Your assigned {managerLabel} and accountant team</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-48 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'manager' ? (
        manager ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ContactCard
              label={managerLabel}
              name={manager.name}
              email={manager.email}
              phone={manager.phone || manager.mobile}
              address={
                manager.address
                  ? [manager.address.city, manager.address.state].filter(Boolean).join(', ')
                  : null
              }
              extra={[
                { label: 'Status', value: manager.status ? (manager.status.charAt(0).toUpperCase() + manager.status.slice(1)) : null },
              ]}
            />
          </div>
        ) : (
          <EmptyState icon={managerType === 'RelationshipManager' ? Users : Building2} message={`No ${managerLabel} assigned yet`} />
        )
      ) : activeTab === 'regional_manager' ? (
        regionalManager ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ContactCard
              label="Regional Manager"
              name={regionalManager.name}
              email={regionalManager.email}
              phone={regionalManager.phone || regionalManager.mobile}
              address={
                regionalManager.address
                  ? [regionalManager.address.city, regionalManager.address.state].filter(Boolean).join(', ')
                  : null
              }
              extra={[
                { label: 'Status', value: regionalManager.status ? (regionalManager.status.charAt(0).toUpperCase() + regionalManager.status.slice(1)) : null },
              ]}
            />
          </div>
        ) : (
          <EmptyState icon={MapPinned} message="No Regional Manager assigned yet" />
        )
      ) : (
        accountants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accountants.map((ac, i) => (
              <ContactCard
                key={ac._id || ac.id || i}
                label="Accountant"
                name={ac.name}
                email={ac.email}
                phone={ac.phone || ac.mobile}
                extra={[
                  { label: 'Dept', value: ac.department || null },
                ]}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={CreditCard} message="No accountants assigned yet" />
        )
      )}
    </div>
  )
}

export default MyContacts
