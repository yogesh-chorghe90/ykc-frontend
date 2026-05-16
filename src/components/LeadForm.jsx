import { useEffect, useState, useMemo } from 'react';
import { Upload, X, File, ExternalLink, Trash2 } from 'lucide-react';
import api from '../services/api';
import {
  applyFormValuesToLeadPayload,
  enrichFieldsWithCatalog,
  filterRedundantGenericContactFields,
} from '../utils/leadFormFieldUtils';
import API_BASE_URL from '../config/api';
import { toast } from '../services/toastService';
import { authService } from '../services/auth.service';
import { hasAnyRole } from '../utils/roleUtils';
import { logoutAndRedirect } from '../services/authSession';
const NEW_LEAD_OPTION = 'new_lead';
/** Roles allowed to load the global field-definition catalog (agents use labels from lead form config). */
const FIELD_CATALOG_ROLES = ['super_admin', 'accounts_manager', 'regional_manager'];

/** Valid MongoDB ObjectId string for pre-lead document uploads (Document.entityId requires ObjectId). */
function generateTempObjectId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Simple mapping of loan types for legacy form
const LOAN_TYPES = [
  { value: 'personal_loan', label: 'Personal' },
  { value: 'home_loan', label: 'Home' },
  { value: 'business_loan', label: 'Business' },
  { value: 'car_loan', label: 'Car' },
  { value: 'education_loan', label: 'Education' },
];

// Fetch a document through the authenticated backend proxy and open it inline in a new tab.
const openDocument = async (docId, mimeType) => {
  try {
    const token = authService.getToken()
    const base = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')
    const res = await fetch(`${base}/api/documents/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) {
      if (res.status === 401) {
        let data = null
        try {
          data = await res.json()
        } catch (_) {
          // ignore
        }
        logoutAndRedirect({ reasonMessage: data?.message, showAlert: data?.message === 'Session expired due to inactivity' })
        return
      }
      throw new Error('Failed to fetch document')
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch {
    toast.error('Could not open file. Please try again.')
  }
}

export default function LeadForm({ lead = null, onSave, onClose, isSubmitting = false }) {
  const userRole = authService.getUser()?.role || '';
  const isAgent = userRole === 'agent';
  const isAdmin = userRole === 'super_admin';
  const isAccountant = userRole === 'accounts_manager';
  const isRelationshipManager = userRole === 'relationship_manager';
  const isFranchise = userRole === 'franchise';
  const canSetCommission = isAdmin || isAccountant || isRelationshipManager || isFranchise;

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(() => {
    if (lead?.leadType === 'new_lead') return NEW_LEAD_OPTION;
    return lead?.bank?._id || lead?.bank || '';
  });
  const [leadFormDef, setLeadFormDef] = useState(null);
  const [fieldCatalog, setFieldCatalog] = useState([]);
  const [loadingFormDef, setLoadingFormDef] = useState(false);

  const [formValues, setFormValues] = useState(() => ({ ...lead?.formValues }));
  const [standard, setStandard] = useState(() => {
    const leadFormValues = lead?.formValues || {};
    return {
      bankId: lead?.bank?._id || lead?.bank || '',
      customerName: lead?.customerName || lead?.leadName || leadFormValues.customerName || leadFormValues.leadName || '',
      leadName: lead?.leadName || lead?.customerName || leadFormValues.leadName || leadFormValues.customerName || '',
      applicantEmail: lead?.applicantEmail || lead?.email || leadFormValues.email || leadFormValues.applicantEmail || '',
      applicantMobile: lead?.applicantMobile || lead?.phone || lead?.mobile || leadFormValues.mobile || leadFormValues.applicantMobile || '',
      address: lead?.address || leadFormValues.address || '',
      loanType: lead?.loanType || leadFormValues.loanType || '',
      loanAmount: lead?.loanAmount || leadFormValues.loanAmount || '',
      branch: lead?.branch || leadFormValues.branch || '',
      loanAccountNo: lead?.loanAccountNo || leadFormValues.loanAccountNo || leadFormValues.loanAccountNumber || '',
      dsaCode: lead?.dsaCode || lead?.codeUse || leadFormValues.dsaCode || leadFormValues.codeUse || '',
      remarks: lead?.remarks || leadFormValues.remark || leadFormValues.remarks || '',
      panNumber: lead?.panNumber || leadFormValues.panNumber || '',
      aadhaarNumber: lead?.aadhaarNumber || leadFormValues.aadhaarNumber || '',
      advancePayment: lead?.advancePayment === true,
      smBmName: lead?.smBm?.name || lead?.smBmName || leadFormValues.smBmName || '',
      smBmEmail: lead?.smBmEmail || leadFormValues.smBmEmail || '',
      smBmMobile: lead?.smBmMobile || leadFormValues.smBmMobile || '',
      asmName: lead?.asmName || leadFormValues.asmName || '',
      asmEmail: lead?.asmEmail || leadFormValues.asmEmail || '',
      asmMobile: lead?.asmMobile || leadFormValues.asmMobile || '',
      commissionPercentage: lead?.commissionPercentage !== undefined && lead?.commissionPercentage !== null ? lead.commissionPercentage : '',
      commissionAmount: lead?.commissionAmount !== undefined && lead?.commissionAmount !== null ? lead.commissionAmount : '',
      // Agent commission fields (for franchise)
      agentCommissionPercentage: lead?.agentCommissionPercentage !== undefined && lead?.agentCommissionPercentage !== null ? lead.agentCommissionPercentage : '',
      agentCommissionAmount: lead?.agentCommissionAmount !== undefined && lead?.agentCommissionAmount !== null ? lead.agentCommissionAmount : '',
      // Sub-agent commission fields (for agent when selecting sub-agent)
      subAgentCommissionPercentage: lead?.subAgentCommissionPercentage !== undefined && lead?.subAgentCommissionPercentage !== null ? lead.subAgentCommissionPercentage : '',
      subAgentCommissionAmount: lead?.subAgentCommissionAmount !== undefined && lead?.subAgentCommissionAmount !== null ? lead.subAgentCommissionAmount : '',
      // Referral franchise commission fields
      referralFranchiseCommissionPercentage: lead?.referralFranchiseCommissionPercentage !== undefined && lead?.referralFranchiseCommissionPercentage !== null ? lead.referralFranchiseCommissionPercentage : '',
      referralFranchiseCommissionAmount: lead?.referralFranchiseCommissionAmount !== undefined && lead?.referralFranchiseCommissionAmount !== null ? lead.referralFranchiseCommissionAmount : '',
    };
  });

  // Admin commission limit for franchise (fetched when bank is selected)
  const [adminCommissionLimit, setAdminCommissionLimit] = useState(null);
  const [loadingCommissionLimit, setLoadingCommissionLimit] = useState(false);

  // When editing new_lead, RM can assign bank - track it separately for the "Assign Bank" section
  const [assignBankId, setAssignBankId] = useState(lead?.bank?._id || lead?.bank || '');

  // Agent assignment for relationship managers
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const currentUser = authService.getUser();
  const [selectedAgentId, setSelectedAgentId] = useState(() => {
    if (lead?.agent) {
      return lead.agent._id || lead.agent || '';
    }
    // Default to 'self' for relationship managers and franchise owners
    return (isRelationshipManager || isFranchise) ? 'self' : '';
  });
  const isSelfSelected = selectedAgentId === 'self';
  // Commission cannot be set when assigned to self (for both RM and Franchise)
  const canSetCommissionForSelf = false;

  // Sub-agent selection for agents
  const [subAgents, setSubAgents] = useState([]);
  const [loadingSubAgents, setLoadingSubAgents] = useState(false);
  const [selectedSubAgentId, setSelectedSubAgentId] = useState(() => {
    if (lead?.subAgent) {
      return lead.subAgent._id || lead.subAgent || '';
    }
    return '';
  });
  const nonAgentSubPartners = useMemo(() => {
    if (isAgent) return [];
    return (agents || []).filter((a) => !!a.parentAgent);
  }, [agents, isAgent]);

  // Refer Franchise selection
  const [franchises, setFranchises] = useState([]);
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  const [selectedReferFranchiseId, setSelectedReferFranchiseId] = useState(() => {
    if (lead?.referralFranchise) {
      return lead.referralFranchise._id || lead.referralFranchise || '';
    }
    return '';
  });

  const [documentTypes, setDocumentTypes] = useState(() => (lead?.documentTypes || []));
  const [uploadedDocs, setUploadedDocs] = useState(() => (lead?.documents || []));
  const [uploading, setUploading] = useState(false);
  
  // Attachments state (for general attachments, separate from required documents)
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedAgent = useMemo(() => {
    if (isAgent || !selectedAgentId || selectedAgentId === 'self') return null;
    return (agents || []).find((a) => (a._id || a.id) === selectedAgentId) || null;
  }, [isAgent, selectedAgentId, agents]);

  // RM-associated leads should not have "Associated Commission" entered manually.
  const isRelationshipManagerAssociatedLead = useMemo(() => {
    // Agent creating lead under RM hierarchy
    if (isAgent && authService.getUser()?.managedByModel === 'RelationshipManager') return true;
    // RM assigning lead to self
    if (isRelationshipManager && selectedAgentId === 'self') return true;
    // Non-agent selected an agent who is managed by RM
    if (selectedAgent?.managedByModel === 'RelationshipManager') return true;
    // Edit mode fallback
    if (lead?.associatedModel === 'RelationshipManager') return true;
    return false;
  }, [isAgent, isRelationshipManager, selectedAgentId, selectedAgent, lead?.associatedModel]);

  // Placeholder ObjectId for pre-uploading docs before lead exists (must match Document schema)
  const tempEntityId = useMemo(() => generateTempObjectId(), []);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await api.banks.getAll();
        setBanks(resp?.data || []);
      } catch (err) {
        console.error('Failed to load banks', err);
      }
    };
    load();
  }, []);

  // Fetch attachments when editing a lead
  useEffect(() => {
    if (lead && (lead.id || lead._id)) {
      fetchAttachments(lead.id || lead._id);
    }
  }, [lead]);

  const fetchAttachments = async (leadId) => {
    if (!leadId) return;
    try {
      setLoadingAttachments(true);
      const response = await api.documents.list('lead', leadId);
      const documents = response.data || response || [];
      // Filter out required documents, only show general attachments (documentType === 'attachment')
      const generalAttachments = Array.isArray(documents) 
        ? documents.filter(doc => doc.documentType === 'attachment' || (!doc.documentType && !documentTypes?.some(dt => dt.key === doc.documentType)))
        : [];
      setAttachments(generalAttachments);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleAttachmentUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const leadId = lead?.id || lead?._id;
    if (!leadId) {
      toast.error('Error', 'Please save the lead first before uploading attachments');
      return;
    }

    const filesArray = Array.from(files);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('entityType', 'lead');
      formData.append('entityId', leadId);
      formData.append('documentType', 'attachment');
      formData.append(
        'description',
        `Lead attachments: ${filesArray.map((f) => f.name).join(', ')}`
      );
      filesArray.forEach((file) => formData.append('file', file));

      const response = await api.documents.upload(formData);
      const payload = response?.data;
      const uploadedDocs = Array.isArray(payload) ? payload : payload ? [payload] : [];
      setAttachments((prev) => [...prev, ...uploadedDocs]);
      toast.success('Success', `Successfully uploaded ${uploadedDocs.length} file(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Upload Failed', error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    try {
      await api.documents.delete(documentId);
      setAttachments(prev => prev.filter(att => (att.id || att._id) !== documentId));
      toast.success('Success', 'Attachment deleted successfully');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Error', error.message || 'Failed to delete attachment');
    }
  };

  // Fetch franchises for Refer Franchise dropdown (all roles including relationship managers can refer a franchise)
  useEffect(() => {
    const loadFranchises = async () => {
      try {
        setLoadingFranchises(true);
        const resp = await api.franchises.getAll();
        const franchisesData = resp?.data || resp || [];
        setFranchises(Array.isArray(franchisesData) ? franchisesData : []);
      } catch (err) {
        console.error('Failed to load franchises', err);
        setFranchises([]);
      } finally {
        setLoadingFranchises(false);
      }
    };
    loadFranchises();
  }, []);

  // Fetch agents for all roles (except agents themselves)
  useEffect(() => {
    const loadAgents = async () => {
      if (isAgent) return; // Skip only for agents
      try {
        setLoadingAgents(true);
        const resp = await api.agents.getAll();
        const agentsData = resp?.data || resp || [];
        setAgents(Array.isArray(agentsData) ? agentsData : []);
      } catch (err) {
        console.error('Failed to load agents', err);
        setAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [isAgent]);

  // Fetch sub-agents for agents when creating leads
  useEffect(() => {
    const loadSubAgents = async () => {
      if (!isAgent || lead) return; // Only for agents creating new leads
      try {
        setLoadingSubAgents(true);
        const resp = await api.subAgents.getAll();
        const subAgentsData = resp?.data || resp || [];
        setSubAgents(Array.isArray(subAgentsData) ? subAgentsData : []);
      } catch (err) {
        console.error('Failed to load sub-agents', err);
        setSubAgents([]);
      } finally {
        setLoadingSubAgents(false);
      }
    };
    loadSubAgents();
  }, [isAgent, lead]);

  useEffect(() => {
    if (!hasAnyRole(FIELD_CATALOG_ROLES)) return;
    const loadCatalog = async () => {
      try {
        const resp = await api.fieldDefs.list();
        setFieldCatalog(resp?.data || []);
      } catch (err) {
        console.error('Failed to load field catalog', err);
        setFieldCatalog([]);
      }
    };
    loadCatalog();
  }, []);

  useEffect(() => {
    // when bank/leadType changes, load lead form
    const loadLeadForm = async () => {
      if (!selectedBank) {
        setLeadFormDef(null);
        return;
      }
      try {
        setLoadingFormDef(true);
        const resp = selectedBank === NEW_LEAD_OPTION
          ? await api.leadForms.getNewLeadForm()
          : await api.leadForms.getByBank(selectedBank);
        const data = resp?.data || null;
        // normalize field flags (ensure `required` is boolean even if backend returns strings)
        let catalog = fieldCatalog;
        if (hasAnyRole(FIELD_CATALOG_ROLES) && !catalog.length) {
          try {
            const listed = await api.fieldDefs.list();
            catalog = listed?.data || [];
            if (catalog.length) setFieldCatalog(catalog);
          } catch {
            catalog = [];
          }
        }

        const normalizeRequired = (f) => ({
          ...f,
          required: !!(f.required === true || f.required === 'true' || f.required === 1 || f.required === '1'),
        });

        const normalized = data
          ? {
            ...data,
            fields: enrichFieldsWithCatalog((data.fields || []).map(normalizeRequired), catalog),
            agentFields: enrichFieldsWithCatalog(
              filterRedundantGenericContactFields((data.agentFields || []).map(normalizeRequired)),
              catalog
            ),
          }
          : null;
        setLeadFormDef(normalized);
        setDocumentTypes(normalized?.documentTypes || []);
        // if lead has formValues, keep; else reset
        if (!lead) {
          setFormValues({});
        }
      } catch (err) {
        console.error('Failed to load lead form for bank', err);
        setLeadFormDef(null);
        setDocumentTypes([]);
      } finally {
        setLoadingFormDef(false);
      }
    };
    loadLeadForm();
  }, [selectedBank, fieldCatalog]);

  // Fetch admin commission limit when bank is selected (for franchise agent commission and referral franchise commission validation)
  useEffect(() => {
    const fetchCommissionLimit = async () => {
      if (!standard.bankId || standard.bankId === NEW_LEAD_OPTION) {
        setAdminCommissionLimit(null);
        return;
      }
      try {
        setLoadingCommissionLimit(true);
        const resp = await api.franchiseCommissionLimits.getByBank(standard.bankId);
        const limit = resp?.data || null;
        setAdminCommissionLimit(limit);
        
        // Auto-fill agent commission percentage with admin limit value if limit type is percentage (only for franchise)
        if (isFranchise && limit && limit.limitType === 'percentage' && !lead) {
          setStandard((p) => {
            const updated = {
              ...p,
              agentCommissionPercentage: limit.maxCommissionValue,
            };
            // Auto-calculate agent commission amount if loan amount exists
            if (p.loanAmount) {
              const loanAmount = parseFloat(p.loanAmount) || 0;
              const percentage = parseFloat(limit.maxCommissionValue) || 0;
              if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
                updated.agentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
              }
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to load commission limit', err);
        setAdminCommissionLimit(null);
      } finally {
        setLoadingCommissionLimit(false);
      }
    };
    fetchCommissionLimit();
  }, [standard.bankId, lead, isFranchise]);

  // Auto-fill agent commission percentage when franchise selects an agent
  useEffect(() => {
    const autoFillAgentCommission = async () => {
      if (!isFranchise || !selectedAgentId || selectedAgentId === 'self' || lead) {
        return;
      }
      try {
        const selectedAgent = agents.find(a => (a._id || a.id) === selectedAgentId);
        if (selectedAgent && selectedAgent.commissionPercentage !== undefined && selectedAgent.commissionPercentage !== null) {
          const agentPercentage = parseFloat(selectedAgent.commissionPercentage) || 0;
          
          // Check if agent percentage exceeds admin limit
          let finalPercentage = agentPercentage;
          if (adminCommissionLimit && adminCommissionLimit.limitType === 'percentage') {
            if (agentPercentage > adminCommissionLimit.maxCommissionValue) {
              finalPercentage = adminCommissionLimit.maxCommissionValue;
            }
          }
          
          setStandard((p) => {
            const updated = {
              ...p,
              agentCommissionPercentage: finalPercentage,
            };
            // Auto-calculate agent commission amount if loan amount exists
            if (p.loanAmount) {
              const loanAmount = parseFloat(p.loanAmount) || 0;
              if (loanAmount > 0 && finalPercentage >= 0 && finalPercentage <= 100) {
                updated.agentCommissionAmount = ((loanAmount * finalPercentage) / 100).toFixed(2);
              }
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to auto-fill agent commission', err);
      }
    };
    autoFillAgentCommission();
  }, [isFranchise, selectedAgentId, agents, lead, adminCommissionLimit]);

  const handleFieldChange = (key, value) => {
    setFormValues((p) => ({ ...(p || {}), [key]: value }));
    // Synchronize with standard state if key matches a standard field
    if (Object.keys(standard).includes(key)) {
      setStandard((p) => ({ ...p, [key]: value }));
    }
  };

  const handleStandardChange = (k, v) => {
    const validateStandardField = (key, rawValue, normalizedValue) => {
      const raw = String(rawValue ?? '');
      const normalized = String(normalizedValue ?? '');

      if (!normalized) return '';

      if (key === 'applicantMobile' || key === 'smBmMobile' || key === 'asmMobile') {
        if (/\D/.test(raw)) return 'Only numbers are allowed';
        if (raw.replace(/\D/g, '').length > 10) return 'Maximum 10 digits allowed';
        if (normalized.length < 10) return 'Enter a 10-digit mobile number';
        return '';
      }

      if (key === 'panNumber') {
        if (/[^a-zA-Z0-9]/.test(raw)) return 'Only letters and numbers are allowed';
        if (raw.replace(/[^a-zA-Z0-9]/g, '').length > 10) return 'PAN cannot exceed 10 characters';
        if (normalized.length < 10) return 'PAN must be 10 characters (e.g. ABCDE1234F)';
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) return 'Invalid PAN format (e.g. ABCDE1234F)';
        return '';
      }

      if (key === 'aadhaarNumber') {
        if (/\D/.test(raw)) return 'Only numbers are allowed';
        if (raw.replace(/\D/g, '').length > 12) return 'Aadhaar cannot exceed 12 digits';
        if (normalized.length < 12) return 'Aadhaar must be 12 digits';
        return '';
      }

      if (key === 'loanAccountNo') {
        if (/[^a-zA-Z0-9]/.test(raw)) return 'Only letters and numbers are allowed';
        if (raw.replace(/[^a-zA-Z0-9]/g, '').length > 18) return 'Loan Account No cannot exceed 18 characters';
        if (normalized.length < 9) return 'Loan Account No must be at least 9 characters';
        return '';
      }

      return '';
    };

    const formatByField = (key, value) => {
      if (value === undefined || value === null) return value;
      const text = String(value);
      if (key === 'applicantMobile' || key === 'smBmMobile' || key === 'asmMobile') {
        return text.replace(/\D/g, '').slice(0, 10);
      }
      if (key === 'panNumber') {
        return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      }
      if (key === 'aadhaarNumber') {
        return text.replace(/\D/g, '').slice(0, 12);
      }
      if (key === 'loanAccountNo') {
        // Keep alphanumeric LAN/account format and normalize to uppercase.
        return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
      }
      return value;
    };
    const normalizedValue = formatByField(k, v);
    const validationMessage = validateStandardField(k, v, normalizedValue);
    setFieldErrors((prev) => ({ ...prev, [k]: validationMessage }));
    setStandard((p) => {
      const updated = { ...p, [k]: normalizedValue };
      
      // Auto-calculate commission amount when percentage is filled
      if (k === 'commissionPercentage' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }
      
      // Auto-calculate commission percentage when amount is filled
      if (k === 'commissionAmount' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.commissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }
      
      // Auto-recalculate commission amount when loan amount changes (if percentage exists)
      if (k === 'loanAmount' && normalizedValue && p.commissionPercentage) {
        const loanAmount = parseFloat(normalizedValue) || 0;
        const percentage = parseFloat(p.commissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate agent commission amount when agent commission percentage changes (for franchise)
      if (k === 'agentCommissionPercentage' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.agentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-recalculate agent commission amount when loan amount changes (if agent commission percentage exists)
      if (k === 'loanAmount' && normalizedValue && p.agentCommissionPercentage) {
        const loanAmount = parseFloat(normalizedValue) || 0;
        const percentage = parseFloat(p.agentCommissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.agentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-recalculate sub-partner commission amount when loan amount changes
      if (k === 'loanAmount' && normalizedValue && p.subAgentCommissionPercentage) {
        const loanAmount = parseFloat(normalizedValue) || 0;
        const percentage = parseFloat(p.subAgentCommissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.subAgentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate sub-agent commission amount when percentage changes (for agents)
      if (k === 'subAgentCommissionPercentage' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.subAgentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate sub-agent commission percentage when amount changes
      if (k === 'subAgentCommissionAmount' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.subAgentCommissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }

      // Auto-calculate referral franchise commission amount when percentage changes
      if (k === 'referralFranchiseCommissionPercentage' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.referralFranchiseCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate referral franchise commission percentage when amount changes
      if (k === 'referralFranchiseCommissionAmount' && normalizedValue && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(normalizedValue) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.referralFranchiseCommissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }

      // Auto-recalculate referral franchise commission amount when loan amount changes
      if (k === 'loanAmount' && normalizedValue && p.referralFranchiseCommissionPercentage) {
        const loanAmount = parseFloat(normalizedValue) || 0;
        const percentage = parseFloat(p.referralFranchiseCommissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.referralFranchiseCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      return updated;
    });
    if (k === 'bankId') setSelectedBank(normalizedValue);
  };

  const handleMultipleFileSelect = async (fileList, docTypeKey, description = '') => {
    if (!fileList?.length || !docTypeKey) return;
    const files = Array.from(fileList);
    try {
      setUploading(true);
      // One multipart request: multer.array('file') + shared body fields (avoids 400s from sequential posts)
      const fd = new FormData();
      fd.append('entityType', 'lead');
      fd.append('entityId', tempEntityId);
      fd.append('documentType', docTypeKey);
      fd.append('description', description || '');
      files.forEach((file) => fd.append('file', file));

      const resp = await api.documents.upload(fd);
      const payload = resp?.data;
      const docs = Array.isArray(payload) ? payload : payload ? [payload] : [];
      if (docs.length > 0) {
        setUploadedDocs((p) => [
          ...p,
          ...docs.map((doc) => ({
            documentType: docTypeKey,
            url: doc.url || doc.filePath || '',
            meta: doc,
          })),
        ]);
        toast.success('Uploaded', docs.length === 1 ? 'Document uploaded' : `${docs.length} files uploaded`);
      } else {
        toast.error('Upload failed', 'No files were saved');
      }
    } catch (err) {
      console.error('Upload error', err);
      const msg = err?.response?.data?.message || err.message || 'Upload failed';
      toast.error('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (file, docTypeKey, description = '') => {
    if (!file || !docTypeKey) return;
    await handleMultipleFileSelect([file], docTypeKey, description);
  };

  const handleRemoveUploaded = (index) => {
    setUploadedDocs((p) => p.filter((_, i) => i !== index));
  };

  const validateAndSubmit = async () => {
    const isNewLead = selectedBank === NEW_LEAD_OPTION || leadFormDef?.leadType === 'new_lead';

    // Agent selection required for relationship managers and franchise owners creating new leads
    if ((isRelationshipManager || isFranchise) && !lead && (!selectedAgentId || selectedAgentId === '')) {
      return toast.error('Please select an agent to assign this lead to');
    }

    // Bank required only for bank-type leads
    if (!isNewLead && !standard.bankId) return toast.error('Bank is required');

    // For agents: If a bank/newLead is selected but no form exists, and it's not currently loading, that's an error state
    // For non-agents: They don't need leadFormDef, they use standard fields
    if (isAgent && !leadFormDef && !loadingFormDef && selectedBank) {
      return toast.error(isNewLead ? 'No New Lead form configured. Ask Admin to set up in Lead Forms.' : 'No Lead Form configured for this bank');
    }

    // Validate commission fields only for bank-type leads (Admin/Accountant/Relationship Manager)
    // Skip for Franchise (they use Partner Commission Details instead)
    // But skip validation if RM or Franchise assigned lead to self
    if (canSetCommission && !isNewLead && !isFranchise && !isRelationshipManagerAssociatedLead && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
      // When creating, both fields are required
      if (!lead) {
        if (!standard.commissionPercentage || standard.commissionPercentage === '') {
          return toast.error('Commission Percentage is required');
        }
        if (!standard.commissionAmount || standard.commissionAmount === '') {
          return toast.error('Commission Amount is required');
        }
      }
      // Validate numeric values if provided
      if (standard.commissionPercentage && standard.commissionPercentage !== '') {
        if (isNaN(parseFloat(standard.commissionPercentage)) || parseFloat(standard.commissionPercentage) < 0 || parseFloat(standard.commissionPercentage) > 100) {
          return toast.error('Commission Percentage must be between 0 and 100');
        }
      }
      if (standard.commissionAmount && standard.commissionAmount !== '') {
        if (isNaN(parseFloat(standard.commissionAmount)) || parseFloat(standard.commissionAmount) < 0) {
          return toast.error('Commission Amount must be a positive number');
        }
      }
    }

    // For agents: if a sub-agent is selected on a bank lead, require sub-agent commission %
    if (isAgent && !lead && !isNewLead && selectedSubAgentId) {
      if (!standard.subAgentCommissionPercentage || standard.subAgentCommissionPercentage === '') {
        return toast.error('Sub Partner Commission Percentage is required when a Sub Partner is selected');
      }
      const pct = parseFloat(standard.subAgentCommissionPercentage) || 0;
      if (pct < 0 || pct > 100) {
        return toast.error('Sub Partner Commission Percentage must be between 0 and 100');
      }
    }

    // Validate agent commission for franchise (when not assigned to self and creating bank leads)
    if (isFranchise && !isNewLead && !isSelfSelected) {
      if (!standard.agentCommissionPercentage || standard.agentCommissionPercentage === '') {
        return toast.error('Partner Commission Percentage is required');
      }
      if (!standard.loanAmount || standard.loanAmount <= 0) {
        return toast.error('Loan Amount is required to calculate Partner Commission');
      }
      
      // Validate agent commission percentage against admin limit
      if (adminCommissionLimit && adminCommissionLimit.limitType === 'percentage') {
        const agentPercentage = parseFloat(standard.agentCommissionPercentage) || 0;
        if (agentPercentage > adminCommissionLimit.maxCommissionValue) {
          return toast.error(`Partner Commission Percentage cannot exceed Admin maximum limit of ${parseFloat(adminCommissionLimit.maxCommissionValue).toFixed(2)}%`);
        }
      }
      
      // Validate agent commission percentage is between 0 and 100
      const agentPercentage = parseFloat(standard.agentCommissionPercentage) || 0;
      if (agentPercentage < 0 || agentPercentage > 100) {
        return toast.error('Partner Commission Percentage must be between 0 and 100');
      }

      // Validate agent commission amount is calculated correctly
      const loanAmount = parseFloat(standard.loanAmount) || 0;
      const expectedAmount = ((loanAmount * agentPercentage) / 100).toFixed(2);
      const actualAmount = parseFloat(standard.agentCommissionAmount) || 0;
      if (Math.abs(actualAmount - parseFloat(expectedAmount)) > 0.01) {
        return toast.error('Partner Commission Amount does not match calculated value. Please ensure Loan Amount is entered.');
      }
    }

    // Validate referral franchise commission (when referral franchise is selected)
    if (selectedReferFranchiseId && !isNewLead) {
      if (standard.referralFranchiseCommissionPercentage !== undefined && standard.referralFranchiseCommissionPercentage !== null && standard.referralFranchiseCommissionPercentage !== '') {
        const referralPercentage = parseFloat(standard.referralFranchiseCommissionPercentage) || 0;
        
        // Validate referral franchise commission percentage against admin limit
        if (adminCommissionLimit && adminCommissionLimit.limitType === 'percentage') {
          if (referralPercentage > adminCommissionLimit.maxCommissionValue) {
            return toast.error(`Referral Franchise Commission Percentage cannot exceed Admin maximum limit of ${parseFloat(adminCommissionLimit.maxCommissionValue).toFixed(2)}%`);
          }
        }
        
        // Validate referral franchise commission percentage is between 0 and 100
        if (referralPercentage < 0 || referralPercentage > 100) {
          return toast.error('Referral Franchise Commission Percentage must be between 0 and 100');
        }
      }
      
      if (standard.referralFranchiseCommissionAmount !== undefined && standard.referralFranchiseCommissionAmount !== null && standard.referralFranchiseCommissionAmount !== '') {
        const referralAmount = parseFloat(standard.referralFranchiseCommissionAmount) || 0;
        if (referralAmount < 0) {
          return toast.error('Referral Franchise Commission Amount must be a positive number');
        }
      }
    }

    // For agents: If leadFormDef exists, validate required fields
    // For non-agents: Validate standard required fields
    if (isAgent && leadFormDef) {
      const fieldsToValidate = leadFormDef.agentFields && leadFormDef.agentFields.length > 0 
        ? leadFormDef.agentFields 
        : (leadFormDef.fields || []);
      const missing = [];
      fieldsToValidate.forEach((f) => {
        if (!f.required) return;
        if ((f.type || '').toLowerCase() === 'file') {
          const hasFile = (uploadedDocs || []).some((d) => d.documentType === f.key && d.url);
          if (!hasFile) missing.push(f.label || f.key);
          return;
        }
        const val = formValues?.[f.key] ?? standard[f.key];
        if (val === undefined || val === null || val === '') missing.push(f.label || f.key);
      });
      const missingDocs = [];
      (leadFormDef.documentTypes || []).forEach((dt) => {
        if (dt.required) {
          const found = (uploadedDocs || []).find((d) => d.documentType === dt.key && d.url);
          if (!found) missingDocs.push(dt.name || dt.key);
        }
      });
      if (missing.length > 0) {
        return toast.error(`Required fields missing: ${missing.join(', ')}`);
      }
      if (missingDocs.length > 0) {
        return toast.error(`Required documents missing: ${missingDocs.join(', ')}`);
      }
    } else if (!isAgent && !isNewLead) {
      // For non-agents creating/editing bank leads: validate standard required fields
      if (!standard.customerName || standard.customerName.trim() === '') {
        return toast.error('Customer Name is required');
      }
      if (!standard.dsaCode || standard.dsaCode.trim() === '') {
        return toast.error('DSA Code is required');
      }
      if (!standard.loanType || standard.loanType.trim() === '') {
        return toast.error('Loan Type is required');
      }
      if (!standard.loanAmount || standard.loanAmount <= 0) {
        return toast.error('Loan Amount must be greater than 0');
      }
    }

    const payload = {
      leadType: isNewLead ? 'new_lead' : 'bank',
      bankId: isNewLead ? undefined : standard.bankId,
      bank: isNewLead ? undefined : standard.bankId,
      leadForm: (isAgent && leadFormDef) ? leadFormDef._id : undefined,
      formValues: (isAgent && leadFormDef) ? formValues : undefined,
      documents: (uploadedDocs || []).map((d) => ({ documentType: d.documentType, url: d.url })),
    };

    if (isAgent && leadFormDef && formValues) {
      applyFormValuesToLeadPayload(payload, formValues);
    }

    // Add sub-agent assignment and commission
    if (selectedSubAgentId && selectedSubAgentId !== '') {
      payload.subAgent = selectedSubAgentId;

      const loanForSub = parseFloat(standard.loanAmount) || 0;
      let subPctRaw = standard.subAgentCommissionPercentage;
      let subAmtRaw = standard.subAgentCommissionAmount;
      if (subPctRaw !== undefined && subPctRaw !== null && subPctRaw !== '') {
        const pct = parseFloat(subPctRaw);
        if (!Number.isNaN(pct)) {
          if ((subAmtRaw === undefined || subAmtRaw === null || subAmtRaw === '') && loanForSub > 0) {
            subAmtRaw = ((loanForSub * pct) / 100).toFixed(2);
          }
          payload.subAgentCommissionPercentage = pct;
        }
      }
      if (subAmtRaw !== undefined && subAmtRaw !== null && subAmtRaw !== '') {
        payload.subAgentCommissionAmount = parseFloat(subAmtRaw);
      }
    }

    // Add agent assignment for non-agent users (including admin/accountant/RM/franchise)
    if (!isAgent && selectedAgentId && selectedAgentId !== '') {
      payload.agent = selectedAgentId === 'self' ? currentUser._id || currentUser.id : selectedAgentId;
    }

    // Add referred franchise if selected (this is different from associated franchise)
    if (selectedReferFranchiseId && selectedReferFranchiseId !== '') {
      payload.referralFranchise = selectedReferFranchiseId;
      // Add referral franchise commission if provided
      if (standard.referralFranchiseCommissionPercentage !== undefined && standard.referralFranchiseCommissionPercentage !== null && standard.referralFranchiseCommissionPercentage !== '') {
        payload.referralFranchiseCommissionPercentage = parseFloat(standard.referralFranchiseCommissionPercentage);
      }
      if (standard.referralFranchiseCommissionAmount !== undefined && standard.referralFranchiseCommissionAmount !== null && standard.referralFranchiseCommissionAmount !== '') {
        payload.referralFranchiseCommissionAmount = parseFloat(standard.referralFranchiseCommissionAmount);
      }
    }

    // Standard fields for non-agents
    if (!isAgent) {
      payload.customerName = standard.customerName?.trim() || standard.leadName?.trim() || undefined;
      payload.leadName = standard.leadName?.trim() || standard.customerName?.trim() || undefined;
      payload.applicantEmail = standard.applicantEmail?.trim() || undefined;
      // When editing, preserve original mobile if form field is empty
      const originalMobile = lead?.applicantMobile || lead?.phone || lead?.mobile || lead?.formValues?.mobile || lead?.formValues?.applicantMobile;
      payload.applicantMobile = standard.applicantMobile?.trim() || (lead && originalMobile ? originalMobile : undefined);
      payload.formValues = {
        ...(lead?.formValues || {}),
        panNumber: standard.panNumber?.trim() || undefined,
        aadhaarNumber: standard.aadhaarNumber?.trim() || undefined,
      };
      payload.address = standard.address?.trim() || undefined;
      payload.branch = standard.branch?.trim() || undefined;
      payload.loanAccountNo = standard.loanAccountNo?.trim() || undefined;
      payload.dsaCode = standard.dsaCode?.trim() || undefined;
      payload.remarks = standard.remarks?.trim() || undefined;
      payload.smBmName = standard.smBmName?.trim() || undefined;
      payload.smBmEmail = standard.smBmEmail?.trim() || undefined;
      payload.smBmMobile = standard.smBmMobile?.trim() || undefined;
      payload.asmName = standard.asmName?.trim() || undefined;
      payload.asmEmail = standard.asmEmail?.trim() || undefined;
      payload.asmMobile = standard.asmMobile?.trim() || undefined;
      payload.advancePayment = standard.advancePayment === true;
      
      // Agent commission fields for franchise (when not assigned to self)
      if (isFranchise && !isSelfSelected && !isNewLead) {
        payload.agentCommissionPercentage = standard.agentCommissionPercentage !== undefined && standard.agentCommissionPercentage !== null && standard.agentCommissionPercentage !== ''
          ? parseFloat(standard.agentCommissionPercentage)
          : undefined;
        payload.agentCommissionAmount = standard.agentCommissionAmount !== undefined && standard.agentCommissionAmount !== null && standard.agentCommissionAmount !== ''
          ? parseFloat(standard.agentCommissionAmount)
          : undefined;
      }
      // Partner (selling agent) commission — Admin / Accountant / RM (table "Partner" columns use agentCommission*)
      if (
        !isNewLead &&
        (isAdmin || isAccountant || isRelationshipManager) &&
        selectedAgentId &&
        selectedAgentId !== '' &&
        selectedAgentId !== 'self'
      ) {
        if (standard.agentCommissionPercentage !== undefined && standard.agentCommissionPercentage !== null && standard.agentCommissionPercentage !== '') {
          payload.agentCommissionPercentage = parseFloat(standard.agentCommissionPercentage);
        }
        if (standard.agentCommissionAmount !== undefined && standard.agentCommissionAmount !== null && standard.agentCommissionAmount !== '') {
          payload.agentCommissionAmount = parseFloat(standard.agentCommissionAmount);
        }
      }
    }

    // Bank-specific fields only for bank-type leads
    if (!isNewLead) {
      payload.loanType = standard.loanType || formValues?.loanType || undefined;
      payload.loanAmount = (standard.loanAmount || formValues?.loanAmount) ? Number(standard.loanAmount || formValues?.loanAmount) : undefined;
      // Only set commission if not assigned to self (for Admin/Accountant/RM, not Franchise - they use Agent Commission)
      if (canSetCommission && !isFranchise && !isRelationshipManagerAssociatedLead && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
      } else if (isRelationshipManagerAssociatedLead) {
        payload.commissionPercentage = 0;
        payload.commissionAmount = 0;
      }
    } else if (lead && isNewLead && assignBankId) {
      // RM editing new_lead: allow adding bank and bank-specific fields
      payload.bankId = assignBankId;
      payload.bank = assignBankId;
      payload.loanType = standard.loanType || formValues?.loanType || undefined;
      payload.loanAmount = (standard.loanAmount || formValues?.loanAmount) ? Number(standard.loanAmount || formValues?.loanAmount) : undefined;
      payload.loanAccountNo = standard.loanAccountNo || formValues?.loanAccountNo || undefined;
      payload.branch = standard.branch || formValues?.branch || undefined;
      // Only set commission if not assigned to self (for both RM and Franchise)
      if (canSetCommission && !isRelationshipManagerAssociatedLead && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
      } else if (isRelationshipManagerAssociatedLead) {
        payload.commissionPercentage = 0;
        payload.commissionAmount = 0;
      }
    }

    // Pass to parent
    if (onSave) onSave(payload);
  };

  const isNewLead = selectedBank === NEW_LEAD_OPTION || leadFormDef?.leadType === 'new_lead';

  return (
    <div className="lead-form space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {isNewLead ? 'Customer Type' : 'Select Bank'} {!isNewLead && '*'}
        </label>
        <select
          value={selectedBank}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedBank(v);
            setStandard((p) => ({ ...p, bankId: v === NEW_LEAD_OPTION ? '' : v }));
          }}
          className="w-full px-4 py-3 border-2 border-primary-100 rounded-lg focus:border-primary-500 transition-colors bg-white text-lg font-medium"
        >
          <option value="">-- Choose Customer Type or Bank --</option>
          <option value={NEW_LEAD_OPTION}>New Customer</option>
          {banks.map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {!selectedBank && !lead && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <p className="text-gray-500 font-medium">Please select New Customer or a bank to load the form.</p>
        </div>
      )}

      {selectedBank && (
        <>
          {loadingFormDef && isAgent ? (
            <div className="py-12 text-center text-gray-600 font-medium whitespace-nowrap overflow-hidden">
              <div className="animate-pulse inline-block">Loading form configuration...</div>
            </div>
          ) : (isAgent && leadFormDef) ? (
            <div className="space-y-8 p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sub Partner Selection Dropdown - For agents when creating new leads */}
                {isAgent && !lead && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Select Sub Partner (Optional)
                      </label>
                      <select
                        value={selectedSubAgentId}
                        onChange={(e) => setSelectedSubAgentId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        disabled={loadingSubAgents}
                      >
                        <option value="">-- Select Sub Partner --</option>
                        {subAgents.map((subAgent) => (
                          <option key={subAgent._id || subAgent.id} value={subAgent._id || subAgent.id}>
                            {subAgent.name || subAgent.email || 'Unknown Sub Partner'}
                          </option>
                        ))}
                      </select>
                      {loadingSubAgents && (
                        <p className="text-sm text-gray-500 mt-1">Loading sub-partners...</p>
                      )}
                      {!loadingSubAgents && subAgents.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">No sub-partners available. Create sub-partners from Sub Partners page.</p>
                      )}
                    </div>

                    {selectedSubAgentId && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Sub Partner Commission (%)
                        </label>
                        <input
                          type="number"
                          value={standard.subAgentCommissionPercentage}
                          onChange={(e) => handleStandardChange('subAgentCommissionPercentage', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Enter sub-agent commission %"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        {standard.loanAmount && standard.subAgentCommissionPercentage && (
                          <p className="mt-1 text-xs text-gray-500">
                            Approx. sub-agent commission amount will be calculated automatically based on loan amount.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
                {filterRedundantGenericContactFields(
                  (leadFormDef.agentFields && leadFormDef.agentFields.length > 0)
                    ? leadFormDef.agentFields
                    : (leadFormDef.fields || [])
                )
                  .filter((f) => {
                    const key = (f.key || '').toLowerCase();
                    const label = (f.label || '').toLowerCase();

                    // For New Lead: show ALL fields admin selected (including leadName, customerName, etc.)
                    // This ensures that any field configured in the Lead Forms builder will be shown
                    if (isNewLead) {
                      return true;
                    }

                    // For bank forms: exclude only truly system-handled fields
                    // Note: leadname and customername are NOT excluded here because admins may
                    // explicitly configure these fields in agentFields for agents to use
                    // Only exclude by exact key match to avoid false positives with field labels
                    const excludedKeys = [
                      'applicantemail', 'applicantmobile',
                      'asmname', 'asmemail', 'asmmobile',
                      'smbmname', 'smbmemail', 'smbmmobile',
                      'salary'
                    ];
                    // Only exclude if the field key exactly matches an excluded key
                    // This prevents excluding fields like "Lead Name" just because the label contains "lead"
                    if (excludedKeys.includes(key)) {
                      return false;
                    }
                    return true;
                  })
                  .filter((f, index, array) => {
                    // Remove duplicate DSA Code fields - keep only the first one
                    const key = (f.key || '').toLowerCase();
                    const label = (f.label || '').toLowerCase();
                    const isDsaCode = key === 'dsacode' || key === 'dsa_code' || key === 'codeuse' || label.includes('dsa code');
                    
                    if (isDsaCode) {
                      // Keep only the first DSA Code field found (by original array order)
                      const firstDsaIndex = array.findIndex((item) => {
                        const itemKey = (item.key || '').toLowerCase();
                        const itemLabel = (item.label || '').toLowerCase();
                        return itemKey === 'dsacode' || itemKey === 'dsa_code' || itemKey === 'codeuse' || itemLabel.includes('dsa code');
                      });
                      return index === firstDsaIndex;
                    }
                    
                    return true;
                  })
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((f, fieldIndex) => {
                  const val = formValues?.[f.key] ?? standard[f.key] ?? '';
                  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none";
                  const isFileField = (f.type || '').toLowerCase() === 'file';
                  const displayLabel = f.label || f.key;
                  return (
                    <div key={`${f.key}-${fieldIndex}`}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{displayLabel}{f.required && ' *'}</label>
                      {f.type === 'select' ? (
                        <select value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass}>
                          <option value="">-- select --</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass} />
                      ) : isFileField ? (
                        <div className="space-y-2">
                          <input
                            type="file"
                            multiple
                            disabled={uploading}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                            onChange={(e) => {
                              const fl = e.target.files;
                              if (fl?.length) handleMultipleFileSelect(fl, f.key, f.label || '');
                              e.target.value = '';
                            }}
                          />
                          <ul className="space-y-1 text-sm">
                            {(uploadedDocs || []).map((d, idx) =>
                              d.documentType === f.key ? (
                                <li key={`${f.key}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1">
                                  <span className="truncate text-gray-800">
                                    {d.meta?.originalFileName || d.meta?.fileName || 'Uploaded file'}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-2">
                                    {d?.meta?._id || d?.meta?.id ? (
                                      <button
                                        type="button"
                                        className="text-xs text-primary-600 hover:underline"
                                        onClick={() => openDocument(d.meta._id || d.meta.id, d.meta?.mimeType)}
                                      >
                                        View
                                      </button>
                                    ) : d?.url ? (
                                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View</a>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="text-xs text-red-600 hover:underline"
                                      onClick={() => handleRemoveUploaded(idx)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </li>
                              ) : null
                            )}
                          </ul>
                        </div>
                      ) : (
                        <input type={f.type || 'text'} value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass} />
                      )}
                    </div>
                  );
                })}
              </div>
              {(leadFormDef.documentTypes || []).length > 0 && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Required Documents</h5>
                  {(leadFormDef.documentTypes || []).map(dt => (
                    <div key={dt.key} className="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{dt.name}{dt.required && ' *'}</span>
                        <label className="px-3 py-1 bg-white border rounded text-xs cursor-pointer hover:bg-gray-100">
                          {uploading ? 'Uploading…' : 'Add files'}
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                              const fl = e.target.files;
                              if (fl?.length) handleMultipleFileSelect(fl, dt.key, dt.name);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                      <ul className="space-y-1">
                        {(uploadedDocs || []).map((d, idx) =>
                          d.documentType === dt.key ? (
                            <li key={`${dt.key}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate text-gray-800">
                                {d.meta?.originalFileName || d.meta?.fileName || 'File'}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-green-600 font-medium">Uploaded</span>
                                {d?.meta?._id || d?.meta?.id ? (
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={() => openDocument(d.meta._id || d.meta.id, d.meta?.mimeType)}
                                  >
                                    View
                                  </button>
                                ) : d?.url ? (
                                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                                ) : null}
                                <button
                                  type="button"
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() => handleRemoveUploaded(idx)}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ) : null
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !isAgent ? (
            // Non-agents see standard fields
            <div className="space-y-8 p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Agent Assignment Dropdown - For all roles except agents when creating new leads */}
                {!isAgent && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assign Partner
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      disabled={loadingAgents}
                    >
                      <option value="">-- Select Partner --</option>
                      {(isRelationshipManager || isFranchise) && (
                        <option value="self">Self ({currentUser?.name || 'Me'})</option>
                      )}
                      {agents.map((agent) => (
                        <option key={agent._id || agent.id} value={agent._id || agent.id}>
                          {agent.name || agent.email || 'Unknown Partner'}
                        </option>
                      ))}
                    </select>
                    {loadingAgents && (
                      <p className="text-sm text-gray-500 mt-1">Loading partners...</p>
                    )}
                  </div>
                )}
                {!isAgent && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Select Sub Partner (Optional)
                    </label>
                    <select
                      value={selectedSubAgentId}
                      onChange={(e) => setSelectedSubAgentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">-- Select Sub Partner --</option>
                      {nonAgentSubPartners.map((subAgent) => (
                        <option key={subAgent._id || subAgent.id} value={subAgent._id || subAgent.id}>
                          {subAgent.name || subAgent.email || 'Unknown Sub Partner'}
                        </option>
                      ))}
                    </select>
                    {nonAgentSubPartners.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">No sub-partners available.</p>
                    )}
                  </div>
                )}
                {!isAgent && selectedSubAgentId && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Sub Partner Commission (%)
                      </label>
                      <input
                        type="number"
                        value={standard.subAgentCommissionPercentage ?? ''}
                        onChange={(e) => handleStandardChange('subAgentCommissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Sub Partner Commission Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={standard.subAgentCommissionAmount ?? ''}
                        onChange={(e) => handleStandardChange('subAgentCommissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                      {standard.loanAmount && standard.subAgentCommissionPercentage ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Updates when loan amount or % changes; you can override the amount if needed.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Refer Franchise Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Refer Franchise
                  </label>
                  <select
                    value={selectedReferFranchiseId}
                    onChange={(e) => {
                      setSelectedReferFranchiseId(e.target.value);
                      // Reset commission when franchise is deselected
                      if (!e.target.value) {
                        setStandard((p) => ({
                          ...p,
                          referralFranchiseCommissionPercentage: '',
                          referralFranchiseCommissionAmount: '',
                        }));
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    disabled={loadingFranchises}
                  >
                    <option value="">-- Select Franchise (Optional) --</option>
                    {franchises.map((franchise) => (
                      <option key={franchise._id || franchise.id} value={franchise._id || franchise.id}>
                        {franchise.name || franchise.email || 'Unknown Franchise'}
                      </option>
                    ))}
                  </select>
                  {loadingFranchises && (
                    <p className="text-sm text-gray-500 mt-1">Loading franchises...</p>
                  )}
                  {!loadingFranchises && franchises.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">No franchises available.</p>
                  )}
                </div>

                {/* Referral Franchise Commission Fields - Show when referral franchise is selected */}
                {selectedReferFranchiseId && !isNewLead && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Referral Franchise Commission Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={standard.referralFranchiseCommissionPercentage || ''}
                        onChange={(e) => handleStandardChange('referralFranchiseCommissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={adminCommissionLimit && adminCommissionLimit.limitType === 'percentage' ? adminCommissionLimit.maxCommissionValue : 100}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Referral Franchise Commission Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={standard.referralFranchiseCommissionAmount || ''}
                        onChange={(e) => handleStandardChange('referralFranchiseCommissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      {standard.loanAmount && parseFloat(standard.loanAmount) > 0 && standard.referralFranchiseCommissionPercentage && (
                        <p className="mt-1 text-xs text-gray-500">
                          Commission amount will be calculated automatically based on loan amount.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Customer Name {!isNewLead && '*'}
                  </label>
                  <input
                    type="text"
                    value={standard.customerName || ''}
                    onChange={(e) => handleStandardChange('customerName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    required={!isNewLead}
                  />
                </div>

                {/* Applicant Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={standard.applicantEmail || ''}
                    onChange={(e) => handleStandardChange('applicantEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                {/* Applicant Mobile */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={standard.applicantMobile || ''}
                    onChange={(e) => handleStandardChange('applicantMobile', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${
                      fieldErrors.applicantMobile ? 'border-red-400' : 'border-gray-300'
                    }`}
                    maxLength={10}
                  />
                  {fieldErrors.applicantMobile && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.applicantMobile}</p>
                  )}
                </div>

                {!isNewLead && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">PAN Number</label>
                      <input
                        type="text"
                        value={standard.panNumber || ''}
                        onChange={(e) => handleStandardChange('panNumber', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none uppercase ${
                          fieldErrors.panNumber ? 'border-red-400' : 'border-gray-300'
                        }`}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                      {fieldErrors.panNumber && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.panNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Aadhaar Number</label>
                      <input
                        type="text"
                        value={standard.aadhaarNumber || ''}
                        onChange={(e) => handleStandardChange('aadhaarNumber', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${
                          fieldErrors.aadhaarNumber ? 'border-red-400' : 'border-gray-300'
                        }`}
                        placeholder="12 digit Aadhaar"
                        maxLength={12}
                      />
                      {fieldErrors.aadhaarNumber && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.aadhaarNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Advance Payment</label>
                      <select
                        value={standard.advancePayment ? 'yes' : 'no'}
                        onChange={(e) => handleStandardChange('advancePayment', e.target.value === 'yes')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Loan Type - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Type *</label>
                    <select
                      value={standard.loanType || ''}
                      onChange={(e) => handleStandardChange('loanType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      required
                    >
                      <option value="">-- select --</option>
                      {LOAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Loan Amount - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Amount *</label>
                    <input
                      type="number"
                      value={standard.loanAmount || ''}
                      onChange={(e) => handleStandardChange('loanAmount', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="0"
                      required
                      min="0"
                    />
                  </div>
                )}

                {/* Branch - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Branch</label>
                    <input
                      type="text"
                      value={standard.branch || ''}
                      onChange={(e) => handleStandardChange('branch', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* Loan Account No - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Account No</label>
                    <input
                      type="text"
                      value={standard.loanAccountNo || ''}
                      onChange={(e) => handleStandardChange('loanAccountNo', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${
                        fieldErrors.loanAccountNo ? 'border-red-400' : 'border-gray-300'
                      }`}
                      maxLength={18}
                    />
                    {fieldErrors.loanAccountNo && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.loanAccountNo}</p>
                    )}
                  </div>
                )}

                {/* DSA Code - required for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">DSA Code *</label>
                    <input
                      type="text"
                      value={standard.dsaCode || ''}
                      onChange={(e) => handleStandardChange('dsaCode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      required
                    />
                  </div>
                )}

                {/* SM/BM Email - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">SM/BM Name</label>
                    <input
                      type="text"
                      value={standard.smBmName || ''}
                      onChange={(e) => handleStandardChange('smBmName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* SM/BM Email - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">SM/BM Email</label>
                    <input
                      type="email"
                      value={standard.smBmEmail || ''}
                      onChange={(e) => handleStandardChange('smBmEmail', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* SM/BM Mobile - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">SM/BM Mobile</label>
                    <input
                      type="tel"
                      value={standard.smBmMobile || ''}
                      onChange={(e) => handleStandardChange('smBmMobile', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${
                        fieldErrors.smBmMobile ? 'border-red-400' : 'border-gray-300'
                      }`}
                      maxLength={10}
                    />
                    {fieldErrors.smBmMobile && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.smBmMobile}</p>
                    )}
                  </div>
                )}

                {/* ASM Name - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ASM Name</label>
                    <input
                      type="text"
                      value={standard.asmName || ''}
                      onChange={(e) => handleStandardChange('asmName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* ASM Email - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ASM Email</label>
                    <input
                      type="email"
                      value={standard.asmEmail || ''}
                      onChange={(e) => handleStandardChange('asmEmail', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* ASM Contact Number - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ASM Contact Number</label>
                    <input
                      type="tel"
                      value={standard.asmMobile || ''}
                      onChange={(e) => handleStandardChange('asmMobile', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${
                        fieldErrors.asmMobile ? 'border-red-400' : 'border-gray-300'
                      }`}
                      maxLength={10}
                    />
                    {fieldErrors.asmMobile && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.asmMobile}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Remark - required for bank leads */}
              {!isNewLead && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remark</label>
                  <textarea
                    value={standard.remarks || ''}
                    onChange={(e) => handleStandardChange('remarks', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    rows={3}
                  />
                </div>
              )}

              {/* Assign Bank - RM can add bank when editing new_lead */}
              {lead && isNewLead && canSetCommission && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Assign Bank & Bank Details (Optional)</h5>
                  <p className="text-sm text-gray-600">Relationship Manager can assign this lead to a bank and fill bank-specific details.</p>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bank</label>
                    <select
                      value={assignBankId}
                      onChange={(e) => setAssignBankId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">-- Not assigned --</option>
                      {banks.map((b) => (
                        <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  {assignBankId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Only show commission fields if not assigned to self (for both RM and Franchise) */}
                      {!isRelationshipManagerAssociatedLead && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf) && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Percentage (%)</label>
                            <input
                              type="number"
                              value={standard.commissionPercentage || ''}
                              onChange={(e) => handleStandardChange('commissionPercentage', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Amount (₹)</label>
                            <input
                              type="number"
                              value={standard.commissionAmount || ''}
                              onChange={(e) => handleStandardChange('commissionAmount', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </>
                      )}
                      {/* Show message when RM or Franchise assigns to self */}
                      {(isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf && (
                        <div className="col-span-2">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 font-medium">
                              Commission cannot be set when lead is assigned to self.
                            </p>
                          </div>
                        </div>
                      )}
                      {isRelationshipManagerAssociatedLead && (
                        <div className="col-span-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800 font-medium">
                              Associated commission is not required for RM-associated leads. Franchise commission will be applied.
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Type</label>
                        <select
                          value={standard.loanType || ''}
                          onChange={(e) => handleStandardChange('loanType', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">-- select --</option>
                          {LOAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Amount</label>
                        <input
                          type="number"
                          value={standard.loanAmount || ''}
                          onChange={(e) => handleStandardChange('loanAmount', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Commission Fields - Only for bank-type leads and non-agents */}
              {/* Hidden if RM or Franchise assigned lead to self */}
              {/* For franchise, show Partner Commission Details instead, so hide this section */}
              {canSetCommission && !isNewLead && !isAgent && !isFranchise && !isRelationshipManagerAssociatedLead && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf) && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Commission Details</h5>
                  <p className="text-xs text-gray-600">
                    These values appear under <span className="font-medium">Associated Comm</span> (franchise / RM share). Use <span className="font-medium">Partner Commission</span> below for the selling partner&apos;s column.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Commission Percentage (%) {!lead && '*'}
                      </label>
                      <input
                        type="number"
                        value={standard.commissionPercentage || ''}
                        onChange={(e) => handleStandardChange('commissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                        required={!lead}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Commission Amount (₹) {!lead && '*'}
                      </label>
                      <input
                        type="number"
                        value={standard.commissionAmount || ''}
                        onChange={(e) => handleStandardChange('commissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required={!lead}
                      />
                    </div>
                  </div>
                </div>
              )}
              {canSetCommission && !isNewLead && !isAgent && !isFranchise && isRelationshipManagerAssociatedLead && (
                <div className="border-t pt-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium">
                      This lead is under Relationship Manager hierarchy, so Associated Commission is auto-set to 0.
                    </p>
                  </div>
                </div>
              )}

              {/* Partner (selling agent) commission — Admin / Accountant / RM; table &quot;Partner&quot; columns */}
              {canSetCommission && !isNewLead && !isAgent && !isFranchise && selectedAgentId && selectedAgentId !== 'self' && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf) && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Partner (Agent) Commission</h5>
                  <p className="text-xs text-gray-600">
                    Shown as Partner Comm % / Amt on the customers list. Optional unless your process requires it.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Partner Commission Percentage (%)</label>
                      <input
                        type="number"
                        value={standard.agentCommissionPercentage ?? ''}
                        onChange={(e) => handleStandardChange('agentCommissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Partner Commission Amount (₹)</label>
                      <input
                        type="number"
                        value={standard.agentCommissionAmount ?? ''}
                        onChange={(e) => handleStandardChange('agentCommissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Auto from % and loan"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Commission Fields - Only for Franchise when creating bank leads and not assigned to self */}
              {isFranchise && !isNewLead && !isAgent && !isSelfSelected && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Partner Commission Details</h5>
                  {loadingCommissionLimit && (
                    <p className="text-sm text-gray-500">Loading commission limit...</p>
                  )}
                  {adminCommissionLimit && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800 font-medium">
                        Admin Maximum Limit: {adminCommissionLimit.limitType === 'percentage' 
                          ? `${parseFloat(adminCommissionLimit.maxCommissionValue).toFixed(2)}%` 
                          : `₹${adminCommissionLimit.maxCommissionValue.toLocaleString()}`}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Partner Commission Percentage (%) *
                      </label>
                      <input
                        type="number"
                        value={standard.agentCommissionPercentage || ''}
                        onChange={(e) => handleStandardChange('agentCommissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={adminCommissionLimit && adminCommissionLimit.limitType === 'percentage' ? adminCommissionLimit.maxCommissionValue : 100}
                        required
                      />
                      {adminCommissionLimit && adminCommissionLimit.limitType === 'percentage' && (
                        <p className="text-xs text-gray-500 mt-1">Max: {parseFloat(adminCommissionLimit.maxCommissionValue).toFixed(2)}%</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Partner Commission Amount (₹) *
                      </label>
                      <input
                        type="number"
                        value={standard.agentCommissionAmount || ''}
                        onChange={(e) => handleStandardChange('agentCommissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50"
                        placeholder="Auto-calculated"
                        step="0.01"
                        min="0"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* Show message when RM or Franchise assigns to self */}
              {(isRelationshipManager || isFranchise) && isSelfSelected && !isNewLead && !canSetCommissionForSelf && (
                <div className="border-t pt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      Commission cannot be set when lead is assigned to self.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : isAgent ? (
            <div className="py-12 bg-red-50 text-red-700 text-center rounded-xl border border-red-200">
              No Lead Form configured for this bank.
            </div>
          ) : null}
        </>
      )}

      {/* Attachments Section - Show for all roles when editing an existing lead */}
      {lead && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">
                Attachments
                {attachments.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                    {attachments.length}
                  </span>
                )}
              </span>
            </div>
            <label
              htmlFor="lead-attachments"
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-primary-900 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-primary-800 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading…' : 'Add Files'}
            </label>
            <input
              type="file"
              id="lead-attachments"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleAttachmentUpload(e.target.files)}
              disabled={uploading}
              className="hidden"
            />
          </div>

          {/* Attachments list */}
          {loadingAttachments ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
              Loading attachments…
            </div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const name = attachment.fileName || attachment.originalFileName || attachment.name || 'Attachment';
                const ext = name.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
                const isPdf = ext === 'pdf';
                const sizeKB = attachment.fileSize ? (attachment.fileSize / 1024).toFixed(1) : null;
                return (
                  <div
                    key={attachment.id || attachment._id}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                      isImage ? 'bg-green-500' : isPdf ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {isImage ? '🖼' : isPdf ? 'PDF' : ext.toUpperCase().slice(0,3) || 'FILE'}
                    </div>
                    {/* Name & size */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {sizeKB && <p className="text-xs text-gray-500">{sizeKB} KB</p>}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {attachment.url && (
                        <button
                          type="button"
                          onClick={() => openDocument(attachment.id || attachment._id, attachment.mimeType)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(attachment.id || attachment._id)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                        title="Delete attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-center">
              <File className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No attachments yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Click "Add Files" to upload</p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-6 border-t font-semibold">
        <button type="button" className="px-5 py-2 border rounded-lg" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="px-8 py-2 bg-primary-900 text-white rounded-lg disabled:opacity-50"
          disabled={uploading || isSubmitting || (isAgent && selectedBank && !leadFormDef && !loadingFormDef)}
          onClick={validateAndSubmit}
        >
          {uploading || isSubmitting ? 'Processing...' : (lead ? 'Update' : 'Create')}
        </button>
      </div>
    </div>
  );
}

