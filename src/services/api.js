import API_BASE_URL from '../config/api';
import { authService } from './auth.service';
import { toast } from './toastService';
import { httpClient } from './httpClient';
import { logoutAndRedirect } from './authSession';

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  try {
    const token = authService.getToken();
    const method = options.method || 'GET';
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    // axios uses `data` for the request body.
    const response = await httpClient.request({
      url: endpoint,
      method,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      data: options.body,
    });

    return response.data;
  } catch (error) {
    // If Axios interceptor handled the auth error, don't double-handle.
    if (error?._authHandled) throw error;

    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const errorMessage =
      responseData?.message || responseData?.error || `HTTP ${status || ''}: ${error?.response?.statusText || 'Request failed'}`;

    const isNotificationEndpoint = endpoint.includes('/notifications');

    // Silently handle 404 for notification endpoints (API might not be implemented yet)
    if (status === 404 && isNotificationEndpoint) {
      const apiError = new Error(errorMessage);
      apiError._toastShown = true;
      apiError._silent = true;
      throw apiError;
    }

    // Permission errors
    if (status === 403) {
      toast.error('Permission Denied', errorMessage || 'You do not have permission to perform this action');
    } else if (!(status === 404 && isNotificationEndpoint)) {
      toast.error('Error', errorMessage);
    }

    throw new Error(errorMessage);
  }
};

// API service object with all endpoints
export const api = {
  // Auth endpoints (no auth required)
  auth: {
    login: async (credentials) => {
      try {
        const response = await httpClient.post('/auth/login', credentials, {
          headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
      } catch (error) {
        if (!error?.response && (error?.code === 'ECONNREFUSED' || error?.message === 'Network Error')) {
          const origin = API_BASE_URL.replace(/\/api\/?$/, '');
          throw new Error(
            `Cannot reach the API at ${origin}. Start the backend (e.g. npm run dev in backend) and ensure SERVER_PORT matches VITE_API_BASE_URL.`
          );
        }
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Network error: Could not connect to server';
        throw new Error(message);
      }
    },
    register: async (userData) => {
      try {
        const response = await httpClient.post('/auth/signup', userData, {
          headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Network error: Could not connect to server';
        throw new Error(message);
      }
    },
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    getCurrentUser: () => apiRequest('/auth/me'),
    updateProfile: (data) => apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    changePassword: ({ currentPassword, newPassword }) =>
      apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  // Leads endpoints
  leads: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/leads${queryString ? `?${queryString}` : ''}`);
    },
    getApproved: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/leads/approved${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/leads/${id}`),
    create: (data) => apiRequest('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/leads/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/leads/${id}`, { method: 'DELETE' }),
    getHistory: (id, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/leads/${id}/history${queryString ? `?${queryString}` : ''}`);
    },
    addDisbursement: (id, data) => {
      console.log('🔍 DEBUG: addDisbursement called with:', { id, data });
      return apiRequest(`/leads/${id}/disbursement`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    getDisbursementEmailPreview: (id) => apiRequest(`/leads/${id}/disbursement-email/preview`),
    sendDisbursementEmail: (id, data) => apiRequest(`/leads/${id}/disbursement-email/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Agents endpoints
  agents: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/agents${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/agents/${id}`),
    create: (data) => apiRequest('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/agents/${id}`, { method: 'DELETE' }),
  },

  // Sub-Agents endpoints (for agents)
  subAgents: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/agents/sub-agents${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/agents/sub-agents/${id}`),
    create: (data) => apiRequest('/agents/sub-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/agents/sub-agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/agents/sub-agents/${id}`, { method: 'DELETE' }),
  },

  // Staff endpoints
  staff: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/staff${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/staff/${id}`),
    create: (data) => apiRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/staff/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/staff/${id}`, { method: 'DELETE' }),
  },

  // Invoices endpoints
  invoices: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/invoices${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/invoices/${id}`),
    create: (data) => apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    generateFromLead: (leadId) => apiRequest(`/invoices/generate/${leadId}`, {
      method: 'POST',
    }),
    generateForDisbursement: (data) => apiRequest('/invoices/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
    accept: (id, data = {}) => apiRequest(`/invoices/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    escalate: (id, data = {}) => apiRequest(`/invoices/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    approve: (id) => apiRequest(`/invoices/${id}/approve`, { method: 'POST' }),
    reject: (id) => apiRequest(`/invoices/${id}/reject`, { method: 'POST' }),
  },

  // Payouts endpoints
  payouts: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/payouts${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/payouts/${id}`),
    process: () => apiRequest('/payouts/process', { method: 'POST' }),
    generateCsv: (id) => apiRequest(`/payouts/${id}/generate-csv`, { method: 'POST' }),
    confirmPayment: (id) => apiRequest(`/payouts/${id}/confirm`, { method: 'POST' }),
    create: (data) => {
      // If data is FormData, send it directly (for file uploads)
      if (data instanceof FormData) {
        const token = authService.getToken();
        return httpClient.post('/payouts', data, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }).then((res) => res.data);
      }
      // Otherwise, send as JSON
      return apiRequest('/payouts', {
      method: 'POST',
      body: JSON.stringify(data),
      });
    },
    update: (id, data) => {
      // If data is FormData, send it directly (for file uploads)
      if (data instanceof FormData) {
        const token = authService.getToken();
        return httpClient.put(`/payouts/${id}`, data, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }).then((res) => res.data);
      }
      return apiRequest(`/payouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      });
    },
    delete: (id) => apiRequest(`/payouts/${id}`, { method: 'DELETE' }),
  },

  // Relationship Managers endpoints
  relationshipManagers: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/relationship-managers${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/relationship-managers/${id}`),
    create: (data) => apiRequest('/relationship-managers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/relationship-managers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/relationship-managers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/relationship-managers/${id}`, { method: 'DELETE' }),
    getFranchises: (id) => apiRequest(`/relationship-managers/${id}/franchises`),
    getPerformance: (id) => apiRequest(`/relationship-managers/${id}/performance`),
  },

  // Franchises endpoints
  franchises: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/franchises${queryString ? `?${queryString}` : ''}`);
    },
    getActive: () => apiRequest('/franchises/active'),
    getById: (id) => apiRequest(`/franchises/${id}`),
    create: (data) => apiRequest('/franchises', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/franchises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/franchises/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/franchises/${id}`, { method: 'DELETE' }),
    getAgents: (id) => apiRequest(`/franchises/${id}/agents`),
    getPerformance: (id) => apiRequest(`/franchises/${id}/performance`),
  },

  // Users endpoints
  users: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/users${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/users/${id}`),
    create: (data) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
    updateStatus: (id, status) => apiRequest(`/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  },

  // Accountant Managers endpoints
  accountantManagers: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/accountant-managers${queryString ? `?${queryString}` : ''}`);
    },
    getContacts: () => apiRequest('/accountant-managers/contacts'),
    getMyRegionalManager: () => apiRequest('/accountant-managers/regional-manager'),
    getById: (id) => apiRequest(`/accountant-managers/${id}`),
    create: (data) => apiRequest('/accountant-managers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/accountant-managers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/accountant-managers/${id}`, { method: 'DELETE' }),
    updateStatus: (id, status) => apiRequest(`/accountant-managers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  },

  // Documents (file uploads)
  documents: {
    /**
     * Upload a single file using multipart/form-data.
     * Expects server route POST /documents
     * @param {FormData} formData
     */
    upload: async (formData) => {
      const token = authService.getToken();
      const response = await httpClient.post('/documents', formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return response.data;
    },
    /**
     * List documents for an entity
     * GET /documents/:entityType/:entityId
     * @param {String} entityType
     * @param {String} entityId
     * @param {Object} params - optional query params (page, limit, verificationStatus)
     */
    list: (entityType, entityId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/documents/${entityType}/${entityId}${queryString ? `?${queryString}` : ''}`);
    },
    /**
     * Delete a document
     * DELETE /documents/:id
     * @param {String} documentId
     */
    delete: (documentId) => {
      return apiRequest(`/documents/${documentId}`, {
        method: 'DELETE',
      });
    },
    /**
     * Open a document in a new browser tab.
     * The server proxies the file (streams it), so we fetch with auth headers
     * and create a local blob URL — no CORS or redirect issues.
     */
    open: async (documentId) => {
      try {
        const token = authService.getToken()
        const rawBase = API_BASE_URL.replace(/\/api$/, '')
        const downloadUrl = `${rawBase}/api/documents/${documentId}/download`

        const res = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          if (res.status === 401) {
            let data = null
            try {
              data = await res.json()
            } catch (_) {
              // ignore parse issues
            }

            logoutAndRedirect({
              reasonMessage: data?.message,
              showAlert: data?.message === 'Session expired due to inactivity',
            })
            return
          }

          throw new Error(`Server error: ${res.status}`)
        }

        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      } catch (err) {
        console.error('openDocument error:', err)
        toast.error('Error', 'Could not open file. Please try again.')
      }
    },
  },

  // Banks endpoints
  banks: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/banks${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/banks/${id}`),
    create: (data) => apiRequest('/banks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/banks/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    sendEmail: (id, emailData) => apiRequest(`/banks/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(emailData),
    }),
    delete: (id) => apiRequest(`/banks/${id}`, { method: 'DELETE' }),
  },

  // Form 16 / TDS endpoints
  form16: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/form16${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/form16/${id}`),
    create: (data) => apiRequest('/form16', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/form16/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/form16/${id}`, { method: 'DELETE' }),
  },

  // Banners endpoints
  banners: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/banners${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/banners/${id}`),
    create: (data) => apiRequest('/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/banners/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/banners/${id}`, { method: 'DELETE' }),
  },

  // Lead Forms (dynamic forms per bank)
  leadForms: {
    getByBank: (bankId) => apiRequest(`/lead-forms/bank/${bankId}`),
    getNewLeadForm: () => apiRequest('/lead-forms/new-lead'),
    create: (data) => apiRequest('/lead-forms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/lead-forms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    list: () => apiRequest('/lead-forms'),
  },
  // Field definitions (canonical keys) used by Lead Form builder
  fieldDefs: {
    list: () => apiRequest('/field-defs'),
    create: (data) => apiRequest('/field-defs', { method: 'POST', body: JSON.stringify(data) }),
    remove: (key) =>
      apiRequest(`/field-defs/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  // Dashboard endpoints
  dashboard: {
    getAgentDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/agent${queryString ? `?${queryString}` : ''}`);
    },
    getStaffDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/staff${queryString ? `?${queryString}` : ''}`);
    },
    getAccountsDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/accounts${queryString ? `?${queryString}` : ''}`);
    },
    getAdminDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/admin${queryString ? `?${queryString}` : ''}`);
    },
    getFranchiseOwnerDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/franchise${queryString ? `?${queryString}` : ''}`);
    },
  },

  // Bank Managers endpoints
  bankManagers: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/bank-managers${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/bank-managers/${id}`),
    create: (data) => apiRequest('/bank-managers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/bank-managers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/bank-managers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/bank-managers/${id}`, { method: 'DELETE' }),
  },

  // Accountant Dashboard endpoints
  accountant: {
    // Dashboard Summary
    getDashboard: () => apiRequest('/accountant/dashboard'),
    
    // Approved Leads
    getApprovedLeads: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/accountant/leads${queryString ? `?${queryString}` : ''}`);
    },
    getLeadDetails: (id) => apiRequest(`/accountant/leads/${id}`),
    
    // Disbursements
    addDisbursement: (leadId, data) => apiRequest(`/accountant/disbursements/${leadId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    editDisbursement: (leadId, disbursementId, data) => apiRequest(`/accountant/disbursements/${leadId}/${disbursementId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    deleteDisbursement: (leadId, disbursementId) => apiRequest(`/accountant/disbursements/${leadId}/${disbursementId}`, {
      method: 'DELETE',
    }),
    getDisbursementHistory: (leadId) => apiRequest(`/accountant/disbursements/${leadId}/history`),
    
    // Lead Management (limited to accountant scope)
    updateLeadStatus: (leadId, data) => apiRequest(`/accountant/leads/${leadId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    addLeadNote: (leadId, data) => apiRequest(`/accountant/leads/${leadId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
    // Reports
    getCommissionReport: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/accountant/reports/commission${queryString ? `?${queryString}` : ''}`);
    },
  },

  // History
  history: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/history${queryString ? `?${queryString}` : ''}`);
    },
    getStats: () => apiRequest('/history/stats'),
  },

  // Tickets endpoints
  tickets: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/tickets${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/tickets/${id}`),
    create: (data) => apiRequest('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    resolve: (id, data = {}) => apiRequest(`/tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getCategories: () => apiRequest('/tickets/categories'),
  },

  // Notifications endpoints
  notifications: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/notifications${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/notifications/${id}`),
    markAsRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllAsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
    delete: (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
    getUnreadCount: () => apiRequest('/notifications/unread-count'),
  },

  // Franchise Commission Limits endpoints (admin only)
  franchiseCommissionLimits: {
    getAll: () => apiRequest('/franchise-commission-limits'),
    getById: (id) => apiRequest(`/franchise-commission-limits/${id}`),
    getByBank: (bankId) => apiRequest(`/franchise-commission-limits/bank/${bankId}`),
    create: (data) => apiRequest('/franchise-commission-limits', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/franchise-commission-limits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/franchise-commission-limits/${id}`, { method: 'DELETE' }),
  },

  // Company Settings endpoints
  companySettings: {
    get: () => apiRequest('/company-settings'),
    update: (data) => apiRequest('/company-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },
};

export default api;
