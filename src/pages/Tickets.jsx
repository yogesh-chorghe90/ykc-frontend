import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Ticket,
  FileText,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { httpClient } from '../services/httpClient'
import Modal from '../components/Modal'
import { toast } from '../services/toastService'
import { authService } from '../services/auth.service'

const TICKET_CATEGORIES = [
  'Payment Not Received',
  'Half Payment Received',
  'Commission Issue',
  'Disbursement Delay',
  'Other',
]

const STATUS_COLORS = {
  Open: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-amber-100 text-amber-800',
  Resolved: 'bg-green-100 text-green-800',
  'Escalated to Regional Manager': 'bg-orange-100 text-orange-800',
  'Escalated to Admin': 'bg-red-100 text-red-800',
}

const getSLABadgeColor = (ticket) => {
  if (ticket.status === 'Resolved') return 'bg-green-100 text-green-800 border-green-200'
  if (!ticket.slaDeadline) return 'bg-gray-100 text-gray-700 border-gray-200'
  const now = new Date()
  const deadline = new Date(ticket.slaDeadline)
  const hoursLeft = (deadline - now) / (1000 * 60 * 60)
  if (hoursLeft <= 0) return 'bg-red-100 text-red-800 border-red-300'
  if (hoursLeft <= 1) return 'bg-amber-100 text-amber-800 border-amber-300'
  return 'bg-green-100 text-green-800 border-green-200'
}

const ROLE_LABELS = {
  relationship_manager: 'Relationship Manager',
  franchise: 'Franchise',
  regional_manager: 'Regional Manager',
  super_admin: 'Admin',
}

const formatAssignedTo = (assignedTo, assignedRole) => {
  const name = assignedTo?.name || '—'
  const role = assignedTo?.role || assignedRole
  const roleLabel = role ? (ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : ''
  return roleLabel ? `${name} (${roleLabel})` : name
}

const RaiseTicketForm = ({ onSuccess, onCancel }) => {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [leadId, setLeadId] = useState('')
  const [leads, setLeads] = useState([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchLeads = async () => {
      setLeadsLoading(true)
      try {
        const res = await api.leads.getAll({ limit: 100 })
        const data = res.data || res || []
        setLeads(Array.isArray(data) ? data : [])
      } catch {
        setLeads([])
      } finally {
        setLeadsLoading(false)
      }
    }
    fetchLeads()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!category || !description?.trim()) {
      toast.error('Validation', 'Category and description are required')
      return
    }
    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('category', category)
      formData.append('description', description.trim())
      if (leadId) formData.append('leadId', leadId)
      if (attachment) {
        formData.append('attachment', attachment)
      }

      const response = await httpClient.post('/tickets', formData, {
        headers: {
          Authorization: `Bearer ${authService.getToken()}`,
        },
      })
      const data = response.data

      toast.success('Success', 'Service request raised successfully')
      onSuccess?.()
    } catch (err) {
      if (err?._authHandled) return
      toast.error('Error', err.message || 'Failed to raise service request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        >
          <option value="">Select category</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer (optional)</label>
        <p className="text-xs text-gray-500 mb-1">Identify which lead this service request relates to (e.g. payment pending for a specific lead)</p>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">— None / Skip —</option>
          {leadsLoading ? (
            <option disabled>Loading leads...</option>
          ) : (
            leads.map((lead) => (
              <option key={lead._id || lead.id} value={lead._id || lead.id}>
                {lead.customerName || lead.applicantMobile || lead.loanAccountNo || 'Customer'} ({lead.status || '—'})
              </option>
            ))
          )}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Describe your issue in detail..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (optional)</label>
        <input
          type="file"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-900 hover:file:bg-primary-100"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50">
          {submitting ? 'Raising...' : 'Raise Service Request'}
        </button>
      </div>
    </form>
  )
}

const Tickets = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const userRole = authService.getUser()?.role || ''

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, categoryFilter])

  useEffect(() => {
    const openTicketId = location.state?.openTicketId
    if (openTicketId) {
      setDetailOpen(true)
      setDetailLoading(true)
      api.tickets.getById(openTicketId)
        .then((res) => {
          setSelectedTicket(res.data || res)
          navigate(location.pathname, { replace: true, state: {} })
        })
        .catch(() => setSelectedTicket(null))
        .finally(() => setDetailLoading(false))
    }
  }, [location.state?.openTicketId])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category = categoryFilter
      const response = await api.tickets.getAll(params)
      const data = response.data || response || []
      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTickets = tickets.filter((t) => {
    const search = searchTerm.toLowerCase()
    return (
      (t.ticketId?.toLowerCase().includes(search)) ||
      (t.agentName?.toLowerCase().includes(search)) ||
      (t.category?.toLowerCase().includes(search)) ||
      (t.description?.toLowerCase().includes(search))
    )
  })

  const isAgent = userRole === 'agent'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-600 mt-1">
            {isAgent ? 'Raise and track your service requests' : 'Manage and resolve service requests'}
          </p>
        </div>
        {isAgent && (
          <button
            onClick={() => setIsRaiseModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800"
          >
            <Plus className="w-5 h-5" />
            Raise Service Request
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search service requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated to Regional Manager">Escalated to RM</option>
            <option value="Escalated to Admin">Escalated to Admin</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-900 mx-auto" />
            <p className="text-gray-500 mt-2">Loading service requests...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">No service requests found</p>
            {isAgent && (
              <button
                onClick={() => setIsRaiseModalOpen(true)}
                className="mt-2 text-primary-900 font-medium hover:underline"
              >
                Raise your first service request
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket._id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                onClick={async () => {
                  const ticketId = ticket._id || ticket.id
                  if (!ticketId) {
                    toast.error('Error', 'Invalid service request ID')
                    return
                  }
                  setDetailOpen(true)
                  setDetailLoading(true)
                  try {
                    const res = await api.tickets.getById(ticketId)
                    console.log('Ticket response:', res)
                    const ticketData = res?.data || res
                    if (ticketData) {
                      setSelectedTicket(ticketData)
                    } else {
                      console.warn('No ticket data in response, using cached ticket')
                      setSelectedTicket(ticket)
                    }
                  } catch (err) {
                    console.error('Error fetching ticket:', err)
                    toast.error('Error', err?.message || 'Failed to load service request details')
                    // Fallback to the ticket from the list
                    setSelectedTicket(ticket)
                  } finally {
                    setDetailLoading(false)
                  }
                }}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg ${getSLABadgeColor(ticket)}`}>
                    {ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : ticket.status === 'Resolved' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{ticket.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSLABadgeColor(ticket)}`}>
                        {ticket.status === 'Resolved' ? 'Resolved' : ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() ? 'Out of SLA' : 'On track'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{ticket.category}</p>
                    {ticket.lead && (
                      <p className="text-xs text-primary-700 mt-0.5">
                        Related Lead: {ticket.lead.customerName || ticket.lead.applicantMobile || ticket.lead.loanAccountNo || '—'}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 truncate">{ticket.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Raised by {ticket.agentName} • {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        title="Raise Service Request"
      >
        <RaiseTicketForm
          onSuccess={() => {
            setIsRaiseModalOpen(false)
            fetchTickets()
          }}
          onCancel={() => setIsRaiseModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedTicket(null) }}
        title={selectedTicket ? `Service Request ${selectedTicket?.ticketId || 'Details'}` : 'Service Request Details'}
        size="lg"
      >
        {detailLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-900 mx-auto" />
          </div>
        ) : selectedTicket ? (
          <TicketDetail
            ticket={selectedTicket}
            onUpdate={() => {
              fetchTickets()
              // Refresh the selected ticket after update
              const ticketId = selectedTicket._id || selectedTicket.id
              if (ticketId) {
                api.tickets.getById(ticketId)
                  .then((res) => {
                    setSelectedTicket(res.data || res || selectedTicket)
                  })
                  .catch(() => {})
              }
            }}
            onClose={() => { setDetailOpen(false); setSelectedTicket(null) }}
          />
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">No ticket selected</p>
            <button
              onClick={() => { setDetailOpen(false); setSelectedTicket(null) }}
              className="mt-4 px-4 py-2 bg-primary-900 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

const TicketDetail = ({ ticket, onUpdate, onClose }) => {
  const navigate = useNavigate()
  const [internalNote, setInternalNote] = useState('')
  const [status, setStatus] = useState(ticket?.status || 'Open')
  const [resolutionNote, setResolutionNote] = useState('')
  const [updating, setUpdating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const userRole = authService.getUser()?.role || ''
  const isAgent = userRole === 'agent'
  const canResolve = ['relationship_manager', 'franchise', 'regional_manager'].includes(userRole)
  const isAdmin = userRole === 'super_admin'

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status || 'Open')
      setResolutionNote('')
    }
  }, [ticket])

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Ticket not found</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary-900 text-white rounded-lg">
          Close
        </button>
      </div>
    )
  }

  const ticketId = ticket._id || ticket.id

  const handleUpdate = async () => {
    if (!ticketId) {
      toast.error('Error', 'Invalid service request ID')
      return
    }
    try {
      setUpdating(true)
      await api.tickets.update(ticketId, {
        status,
        internalNote: internalNote.trim() || undefined,
      })
      toast.success('Updated', 'Service request updated successfully')
      setInternalNote('')
      onUpdate?.()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const handleResolve = async () => {
    if (!ticketId) {
      toast.error('Error', 'Invalid service request ID')
      return
    }
    try {
      setResolving(true)
      await api.tickets.resolve(ticketId, { resolutionNote })
      toast.success('Resolved', 'Service request resolved successfully')
      onUpdate?.()
      onClose?.()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to resolve')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">Service Request Number (SRN)</p>
          <p className="font-medium">{ticket?.ticketId || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Status</p>
          <p className="font-medium">{ticket?.status || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Category</p>
          <p className="font-medium">{ticket?.category || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Raised by</p>
          <p className="font-medium">{ticket?.agentName || ticket?.raisedBy?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Created</p>
          <p className="font-medium">{ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</p>
        </div>
        {ticket?.assignedTo && (
          <div>
            <p className="text-xs text-gray-500 uppercase">Assigned to</p>
            <p className="font-medium">
              {typeof ticket.assignedTo === 'object'
                ? formatAssignedTo(ticket.assignedTo, ticket.assignedRole)
                : '—'}
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase mb-1">Description</p>
        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{ticket?.description || '—'}</p>
      </div>

      {ticket?.lead && (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Related Lead</p>
          <div className="bg-primary-50 p-3 rounded-lg text-sm">
            <p className="font-medium text-gray-900">{ticket.lead?.customerName || '—'}</p>
            <p className="text-gray-600">{ticket.lead?.applicantMobile || ticket.lead?.applicantEmail || '—'}</p>
            <p className="text-gray-500 text-xs mt-1">
              Status: {ticket.lead?.status || '—'} • Loan: {ticket.lead?.loanAmount ? `₹${ticket.lead.loanAmount.toLocaleString()}` : '—'}
            </p>
          </div>
        </div>
      )}

      {ticket?.attachment?.url && (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Attachment</p>
          <a
            href={ticket.attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary-900 hover:underline"
          >
            <FileText className="w-4 h-4" />
            {ticket.attachment?.originalName || ticket.attachment?.fileName || 'View attachment'}
          </a>
        </div>
      )}

      {ticket?.internalNotes && Array.isArray(ticket.internalNotes) && ticket.internalNotes.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Internal Notes</p>
          <div className="space-y-2">
            {ticket.internalNotes.map((n, i) => (
              <div key={i} className="bg-amber-50 p-3 rounded-lg text-sm">
                <p>{n?.note || '—'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {typeof n?.addedBy === 'object' ? (n.addedBy?.name || 'System') : 'System'} • {n?.addedAt ? new Date(n.addedAt).toLocaleString() : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticket?.resolutionNote && (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Resolution</p>
          <p className="text-gray-700 bg-green-50 p-3 rounded-lg">{ticket.resolutionNote}</p>
        </div>
      )}

      {!isAgent && ticket.status !== 'Resolved' && (
        <div className="border-t pt-4 space-y-4">
          {!isAdmin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add internal note</label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Internal note (visible to RM/Admin only)"
                />
              </div>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </>
          )}

          {canResolve && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution note</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                placeholder="Describe how the issue was resolved..."
              />
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {resolving ? 'Resolving...' : 'Mark as Resolved'}
              </button>
            </div>
          )}

          {isAdmin && (
            <p className="text-amber-700 text-sm">Admin cannot resolve tickets. You can reassign or add internal notes.</p>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
          Close
        </button>
      </div>
    </div>
  )
}

export default Tickets

