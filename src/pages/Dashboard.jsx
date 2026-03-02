import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Building2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import StatCard from '../components/StatCard'
import api from '../services/api'
import { authService } from '../services/auth.service'
import { toast } from '../services/toastService'
import AccountantOverview from './AccountantOverview'
import { formatInCrores } from '../utils/formatUtils'

const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalAgents: 0,
    totalFranchises: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    totalLoanAmount: 0,
  })
  const [relatedLists, setRelatedLists] = useState({
    recentLeads: [],
    recentAgents: [],
    recentFranchises: [],
    recentInvoices: [],
  })
  const [agentData, setAgentData] = useState({
    completedLeadsWithoutInvoices: [],
    pendingInvoicesForAction: [],
    escalatedInvoicesList: [],
  })
  const [loanDistribution, setLoanDistribution] = useState([])
  const [leadConversionFunnel, setLeadConversionFunnel] = useState([])
  const [selectedLoanSegmentIndex, setSelectedLoanSegmentIndex] = useState(null)
  const [funnelFilter, setFunnelFilter] = useState('monthly') // 'weekly', 'monthly', 'yearly'

  const [loading, setLoading] = useState(true)

  const userRole = authService.getUser()?.role || 'super_admin'

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        funnelPeriod: funnelFilter, // Add funnel filter parameter
      }

      let dashboardData
      try {
        switch (userRole) {
          case 'agent':
            dashboardData = await api.dashboard.getAgentDashboard(params)
            break
          case 'franchise':
            dashboardData = await api.dashboard.getFranchiseOwnerDashboard(params)
            break
          case 'relationship_manager':
            dashboardData = await api.dashboard.getStaffDashboard(params)
            break
          case 'accounts_manager':
            dashboardData = await api.dashboard.getAccountsDashboard(params)
            break
          case 'regional_manager':
          case 'super_admin':
          default:
            dashboardData = await api.dashboard.getAdminDashboard(params)
            break
        }
      } catch (roleError) {
        if (userRole === 'relationship_manager' || userRole === 'accounts_manager' || userRole === 'agent' || userRole === 'franchise') {
          throw roleError
        }
        console.warn('Role-specific dashboard failed, trying admin:', roleError)
        dashboardData = await api.dashboard.getAdminDashboard(params)
      }

      // Handle different response formats
      const data = dashboardData.data || dashboardData || {}

      console.log('🔍 DEBUG: Dashboard data received:', data)

      if (userRole === 'agent') {
        setStats({
          totalLeads: data.leads?.total || 0,
          totalAgents: 0,
          totalInvoices: (data.invoices?.pending || 0) + (data.invoices?.approved || 0) + (data.invoices?.escalated || 0),
          totalRevenue: data.totalCommission || 0,
          leads: data.leads || {},
          invoices: data.invoices || {},
          payouts: data.payouts || {},
        })
        setLeadConversionFunnel(Array.isArray(data.leadConversionFunnel) ? data.leadConversionFunnel : [])
      } else {
        setStats({
          totalLeads: data.totalLeads || data.leads?.total || 0,
          totalAgents: data.totalAgents || data.agents?.total || 0,
          totalFranchises: data.totalFranchises || 0,
          totalInvoices: data.totalInvoices || data.invoices?.total || 0,
          totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
          totalLoanAmount: data.totalLoanAmount || 0,
        })
      }

      console.log('🔍 DEBUG: Dashboard stats set:', {
        totalLeads: data.totalLeads || data.leads?.total || 0,
        totalAgents: data.totalAgents || data.agents?.total || 0,
        totalInvoices: data.totalInvoices || data.invoices?.total || 0,
        totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
      })

      // Set agent-specific data
      if (userRole === 'agent') {
        setAgentData({
          completedLeadsWithoutInvoices: Array.isArray(data.completedLeadsWithoutInvoices) ? data.completedLeadsWithoutInvoices : [],
          pendingInvoicesForAction: Array.isArray(data.pendingInvoicesForAction) ? data.pendingInvoicesForAction : [],
          escalatedInvoicesList: Array.isArray(data.escalatedInvoicesList) ? data.escalatedInvoicesList : [],
        })
        setRelatedLists((prev) => ({ ...prev, recentLeads: [] }))
      }

      // Set related lists (for admin, regional manager, and franchise owner dashboards)
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'relationship_manager' || userRole === 'franchise') {
        setRelatedLists({
          recentLeads: Array.isArray(data.recentLeads) ? data.recentLeads : [],
          recentAgents: Array.isArray(data.recentAgents) ? data.recentAgents : [],
          recentFranchises: Array.isArray(data.recentFranchises) ? data.recentFranchises : [],
          recentInvoices: Array.isArray(data.recentInvoices) ? data.recentInvoices : [],
          relationshipManagers: Array.isArray(data.relationshipManagers) ? data.relationshipManagers : [],
        })
      }
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'relationship_manager' || userRole === 'franchise') {
        setLoanDistribution(Array.isArray(data.loanDistribution) ? data.loanDistribution : [])
        setLeadConversionFunnel(Array.isArray(data.leadConversionFunnel) ? data.leadConversionFunnel : [])
        setSelectedLoanSegmentIndex(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to empty stats on error - app will still render
      setStats({
        totalLeads: 0,
        totalAgents: 0,
        totalFranchises: 0,
        totalInvoices: 0,
        totalRevenue: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [userRole, funnelFilter])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRaiseInvoice = async (leadId) => {
    try {
      // Navigate to lead details page
      // Invoices are typically auto-generated when leads are completed
      // If invoice is missing, admin can generate it from the lead details page
      navigate(`/leads/${leadId}`)
      toast.info('Info', 'Viewing lead details. Contact admin if invoice needs to be generated.')
    } catch (error) {
      console.error('Error navigating to lead:', error)
      toast.error('Error', 'Failed to open lead details')
    }
  }

  const handleAcceptInvoice = async (invoiceId) => {
    try {
      await api.invoices.accept(invoiceId)
      toast.success('Success', 'Invoice accepted successfully')
      fetchDashboardData()
    } catch (error) {
      console.error('Error accepting invoice:', error)
      toast.error('Error', error.message || 'Failed to accept invoice')
    }
  }

  const handleEscalateInvoice = async (invoiceId) => {
    const reason = prompt('Please provide escalation reason:')
    if (!reason) return

    const remarks = prompt('Additional remarks (optional):') || ''

    try {
      await api.invoices.escalate(invoiceId, { reason, remarks })
      toast.success('Success', 'Invoice escalated successfully')
      fetchDashboardData()
    } catch (error) {
      console.error('Error escalating invoice:', error)
      toast.error('Error', error.message || 'Failed to escalate invoice')
    }
  }

  const { totalLeads, totalAgents, totalFranchises, totalRevenue, totalLoanAmount } = stats
  const isAgent = userRole === 'agent'
  const isAccountant = userRole === 'accounts_manager'

  // For admin / regional / RM / franchise dashboards: aggregate total loan amount by type
  const totalLoanAmountForChart = Array.isArray(loanDistribution)
    ? loanDistribution.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
    : 0

  // Render Accountant-specific dashboard
  if (isAccountant) {
    return <AccountantOverview />
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Home</span>
        {isAgent && <><span>/</span><span className="text-gray-900 font-medium">Agent Portal</span></>}
        {!isAgent && <><span>/</span><span className="text-gray-900 font-medium">Analytics</span></>}
      </div>

      {/* Agent Dashboard */}
      {isAgent ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard
              title="Total Leads"
              value={stats.totalLeads || 0}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Pending"
              value={stats.leads?.pending || 0}
              icon={FileCheck}
              color="orange"
            />
            <StatCard
              title="Pending Invoices"
              value={stats.invoices?.pending || 0}
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Total Commission"
              value={`₹${((stats.totalRevenue || 0) / 1000).toFixed(1)}K`}
              icon={IndianRupeeIcon}
              color="green"
            />
          </div>

          {/* Raise Payout Invoices Section */}
          {agentData.completedLeadsWithoutInvoices.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Raise Payout Invoices</h2>
                <span className="text-xs md:text-sm text-gray-600">{agentData.completedLeadsWithoutInvoices.length} completed leads without invoices</span>
              </div>
              <div className="space-y-3 md:space-y-3">
                {agentData.completedLeadsWithoutInvoices.slice(0, 5).map((lead) => (
                  <div key={lead._id || lead.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">{lead.loanAccountNo || 'N/A'}</p>
                      <p className="text-xs text-gray-600 mt-1 break-words">
                        {lead.loanAccountNo || 'N/A'} • {lead.bank?.name || 'N/A'} • ₹{(lead.loanAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRaiseInvoice(lead._id || lead.id)}
                      className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm font-medium"
                    >
                      Request Invoice
                    </button>
                  </div>
                ))}
                {agentData.completedLeadsWithoutInvoices.length > 5 && (
                  <button
                    onClick={() => navigate('/leads?status=completed&hasInvoice=false')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium py-2"
                  >
                    View All ({agentData.completedLeadsWithoutInvoices.length} leads)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Accept or Escalate Invoices Section */}
          {agentData.pendingInvoicesForAction.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 flex-1 min-w-0">Pending Invoices - Action Required</h2>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 whitespace-nowrap flex-shrink-0">
                  {agentData.pendingInvoicesForAction.length} Pending
                </span>
              </div>
              <div className="space-y-4 md:space-y-3">
                {agentData.pendingInvoicesForAction.slice(0, 5).map((invoice) => (
                  <div key={invoice._id || invoice.id} className="flex flex-col gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">{invoice.invoiceNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-600 mt-1 break-words">
                        {invoice.lead?.loanAccountNo || 'N/A'} • ₹{(invoice.commissionAmount || invoice.netPayable || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 xs:gap-4">
                      <button
                        onClick={() => handleAcceptInvoice(invoice._id || invoice.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium w-full xs:w-auto"
                      >
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleEscalateInvoice(invoice._id || invoice.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium w-full xs:w-auto"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Escalate</span>
                      </button>
                    </div>
                  </div>
                ))}
                {agentData.pendingInvoicesForAction.length > 5 && (
                  <button
                    onClick={() => navigate('/invoices?status=pending')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium py-2"
                  >
                    View All ({agentData.pendingInvoicesForAction.length} invoices)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Escalated Invoices Section */}
          {agentData.escalatedInvoicesList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 flex-1 min-w-0">Escalated Invoices</h2>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 whitespace-nowrap flex-shrink-0">
                  {agentData.escalatedInvoicesList.length} Escalated
                </span>
              </div>
              <div className="space-y-4 md:space-y-3">
                {agentData.escalatedInvoicesList.slice(0, 5).map((invoice) => (
                  <div key={invoice._id || invoice.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">{invoice.invoiceNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-600 mt-1 break-words">
                        {invoice.lead?.loanAccountNo || 'N/A'} • ₹{(invoice.commissionAmount || invoice.netPayable || 0).toLocaleString()}
                      </p>
                      {invoice.escalationReason && (
                        <p className="text-xs text-orange-700 mt-1 break-words">Reason: {invoice.escalationReason}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center justify-center px-3 py-1.5 bg-orange-200 text-orange-800 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 self-start sm:self-auto">
                      Under Review
                    </span>
                  </div>
                ))}
                {agentData.escalatedInvoicesList.length > 5 && (
                  <button
                    onClick={() => navigate('/invoices?status=escalated')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium py-2"
                  >
                    View All ({agentData.escalatedInvoicesList.length} invoices)
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Summary Cards - Admin/Relationship Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
              title="Total Leads"
              value={totalLeads}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Active Agents"
              value={totalAgents}
              icon={Users}
              color="green"
            />
            <StatCard
              title="Active Franchises"
              value={totalFranchises}
              icon={Building2}
              color="teal"
            />
            <StatCard
              title="Total Amount"
              value={formatInCrores(totalLoanAmount || 0)}
              icon={IndianRupeeIcon}
              color="orange"
            />
            <StatCard
              title="Total Revenue"
              value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
              icon={IndianRupeeIcon}
              color="purple"
            />
          </div>

          {/* Loan Distribution & Lead Conversion Funnel - Admin, Regional Manager, Relationship Manager & Franchise Owner */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'regional_manager' || authService.getUser()?.role === 'relationship_manager' || authService.getUser()?.role === 'franchise') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Loan Distribution</h2>
                {loanDistribution.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-48 h-48 relative flex-shrink-0 [&_svg]:outline-none [&_*]:outline-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart style={{ outline: 'none' }}>
                          <Pie
                            data={loanDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={1}
                            stroke="none"
                            activeShape={(props) => <Sector {...props} stroke="none" />}
                            onClick={(_, index) => setSelectedLoanSegmentIndex(index)}
                            style={{ cursor: 'pointer', outline: 'none' }}
                          >
                            {loanDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold text-gray-700 text-center px-2">
                          {formatInCrores(totalLoanAmountForChart || totalLoanAmount || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <ul className="space-y-2">
                        {loanDistribution.map((item, idx) => (
                          <li
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedLoanSegmentIndex(idx)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelectedLoanSegmentIndex(idx)}
                            className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 ${selectedLoanSegmentIndex === idx ? 'bg-gray-100' : ''}`}
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-700 truncate">
                              {item.name} ({item.count || 0})
                            </span>
                            <span className="font-medium text-gray-900 ml-auto">
                              {formatInCrores(item.totalAmount || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No loan distribution data</p>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Lead Conversion Funnel</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFunnelFilter('weekly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'weekly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('monthly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'monthly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('yearly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'yearly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
                {leadConversionFunnel.length > 0 ? (
                  <div className="space-y-2 max-w-md">
                    {leadConversionFunnel.map((stage) => {
                      const maxVal = Math.max(...leadConversionFunnel.map((s) => s.value || 0), 1)
                      const widthPct = maxVal > 0 ? Math.max(((stage.value || 0) / maxVal) * 100, 18) : 18
                      return (
                        <div key={stage.stage} className="flex items-center gap-3">
                          <div
                            className="h-11 rounded flex items-center px-3 transition-all min-w-[120px]"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: stage.fill,
                            }}
                          >
                            <span className="text-white font-medium text-sm truncate">{stage.stage}</span>
                          </div>
                          <span className="text-gray-700 font-semibold tabular-nums text-right flex-shrink-0 min-w-[80px]">
                            {formatInCrores(stage.value || 0)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No funnel data</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
