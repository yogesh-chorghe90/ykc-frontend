import { useEffect, useState, useMemo } from 'react';
import { Upload, X, File, Download, Trash2 } from 'lucide-react';
import api from '../services/api';
import { toast } from '../services/toastService';
import { authService } from '../services/auth.service';

const NEW_LEAD_OPTION = 'new_lead';

// Simple mapping of loan types for legacy form
const LOAN_TYPES = [
  { value: 'personal_loan', label: 'Personal' },
  { value: 'home_loan', label: 'Home' },
  { value: 'business_loan', label: 'Business' },
  { value: 'car_loan', label: 'Car' },
  { value: 'education_loan', label: 'Education' },
];

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
      smBmEmail: lead?.smBmEmail || leadFormValues.smBmEmail || '',
      smBmMobile: lead?.smBmMobile || leadFormValues.smBmMobile || '',
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

  // temp id for pre-uploading docs before lead is created
  const tempEntityId = useMemo(() => `temp-${Date.now()}-${Math.round(Math.random() * 1e6)}`, []);

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
      const uploadPromises = filesArray.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'lead');
        formData.append('entityId', leadId);
        formData.append('documentType', 'attachment');
        formData.append('description', `Lead attachment: ${file.name}`);

        const response = await api.documents.upload(formData);
        return response.data || response;
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      setAttachments(prev => [...prev, ...uploadedDocs]);
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
      if (isAgent || lead) return; // Skip for agents and when editing
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
  }, [isAgent, lead]);

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
        const normalized = data
          ? {
            ...data,
            fields: (data.fields || []).map((f) => ({
              ...f,
              required: !!(f.required === true || f.required === 'true' || f.required === 1 || f.required === '1'),
            })),
            agentFields: (data.agentFields || []).map((f) => ({
              ...f,
              required: !!(f.required === true || f.required === 'true' || f.required === 1 || f.required === '1'),
            })),
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
  }, [selectedBank]);

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
    setStandard((p) => {
      const updated = { ...p, [k]: v };
      
      // Auto-calculate commission amount when percentage is filled
      if (k === 'commissionPercentage' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(v) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }
      
      // Auto-calculate commission percentage when amount is filled
      if (k === 'commissionAmount' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(v) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.commissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }
      
      // Auto-recalculate commission amount when loan amount changes (if percentage exists)
      if (k === 'loanAmount' && v && p.commissionPercentage) {
        const loanAmount = parseFloat(v) || 0;
        const percentage = parseFloat(p.commissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate agent commission amount when agent commission percentage changes (for franchise)
      if (k === 'agentCommissionPercentage' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(v) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.agentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-recalculate agent commission amount when loan amount changes (if agent commission percentage exists)
      if (k === 'loanAmount' && v && p.agentCommissionPercentage) {
        const loanAmount = parseFloat(v) || 0;
        const percentage = parseFloat(p.agentCommissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.agentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate sub-agent commission amount when percentage changes (for agents)
      if (k === 'subAgentCommissionPercentage' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(v) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.subAgentCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate sub-agent commission percentage when amount changes
      if (k === 'subAgentCommissionAmount' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(v) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.subAgentCommissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }

      // Auto-calculate referral franchise commission amount when percentage changes
      if (k === 'referralFranchiseCommissionPercentage' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(v) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.referralFranchiseCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      // Auto-calculate referral franchise commission percentage when amount changes
      if (k === 'referralFranchiseCommissionAmount' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(v) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.referralFranchiseCommissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }

      // Auto-recalculate referral franchise commission amount when loan amount changes
      if (k === 'loanAmount' && v && p.referralFranchiseCommissionPercentage) {
        const loanAmount = parseFloat(v) || 0;
        const percentage = parseFloat(p.referralFranchiseCommissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.referralFranchiseCommissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }

      return updated;
    });
    if (k === 'bankId') setSelectedBank(v);
  };

  const handleFileSelect = async (file, docTypeKey, description = '') => {
    if (!file || !docTypeKey) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'lead');
      // upload against temporary id so we can provide URL in create payload
      fd.append('entityId', tempEntityId);
      fd.append('documentType', docTypeKey);
      fd.append('description', description || '');
      const resp = await api.documents.upload(fd);
      const doc = resp?.data;
      if (doc) {
        setUploadedDocs((p) => [...(p || []), { documentType: docTypeKey, url: doc.url || doc.filePath || '', meta: doc }]);
        toast.success('Uploaded', 'Document uploaded');
      } else {
        toast.error('Upload failed', 'No response data');
      }
    } catch (err) {
      console.error('Upload error', err);
      toast.error('Upload failed', err.message || '');
    } finally {
      setUploading(false);
    }
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
    // Skip for Franchise (they use Agent Commission Details instead)
    // But skip validation if RM or Franchise assigned lead to self
    if (canSetCommission && !isNewLead && !isFranchise && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
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
        return toast.error('Sub Agent Commission Percentage is required when a Sub Agent is selected');
      }
      const pct = parseFloat(standard.subAgentCommissionPercentage) || 0;
      if (pct < 0 || pct > 100) {
        return toast.error('Sub Agent Commission Percentage must be between 0 and 100');
      }
    }

    // Validate agent commission for franchise (when not assigned to self and creating bank leads)
    if (isFranchise && !isNewLead && !isSelfSelected) {
      if (!standard.agentCommissionPercentage || standard.agentCommissionPercentage === '') {
        return toast.error('Agent Commission Percentage is required');
      }
      if (!standard.loanAmount || standard.loanAmount <= 0) {
        return toast.error('Loan Amount is required to calculate Agent Commission');
      }
      
      // Validate agent commission percentage against admin limit
      if (adminCommissionLimit && adminCommissionLimit.limitType === 'percentage') {
        const agentPercentage = parseFloat(standard.agentCommissionPercentage) || 0;
        if (agentPercentage > adminCommissionLimit.maxCommissionValue) {
          return toast.error(`Agent Commission Percentage cannot exceed Admin maximum limit of ${parseFloat(adminCommissionLimit.maxCommissionValue).toFixed(2)}%`);
        }
      }
      
      // Validate agent commission percentage is between 0 and 100
      const agentPercentage = parseFloat(standard.agentCommissionPercentage) || 0;
      if (agentPercentage < 0 || agentPercentage > 100) {
        return toast.error('Agent Commission Percentage must be between 0 and 100');
      }

      // Validate agent commission amount is calculated correctly
      const loanAmount = parseFloat(standard.loanAmount) || 0;
      const expectedAmount = ((loanAmount * agentPercentage) / 100).toFixed(2);
      const actualAmount = parseFloat(standard.agentCommissionAmount) || 0;
      if (Math.abs(actualAmount - parseFloat(expectedAmount)) > 0.01) {
        return toast.error('Agent Commission Amount does not match calculated value. Please ensure Loan Amount is entered.');
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
        if (f.required) {
          const val = formValues?.[f.key] ?? standard[f.key];
          if (val === undefined || val === null || val === '') missing.push(f.label || f.key);
        }
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
      // When editing, check if original lead has mobile; if not, validate it's provided
      const originalMobile = lead?.applicantMobile || lead?.phone || lead?.mobile || lead?.formValues?.mobile || lead?.formValues?.applicantMobile;
      if ((!standard.applicantMobile || standard.applicantMobile.trim() === '') && (!lead || !originalMobile)) {
        return toast.error('Mobile is required');
      }
      if (!standard.dsaCode || standard.dsaCode.trim() === '') {
        return toast.error('DSA Code is required');
      }
      if (!standard.remarks || standard.remarks.trim() === '') {
        return toast.error('Remark is required');
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

    // Add sub-agent assignment and commission for agents
    if (isAgent && selectedSubAgentId && selectedSubAgentId !== '') {
      payload.subAgent = selectedSubAgentId;

      // Sub-agent commission fields (optional)
      if (standard.subAgentCommissionPercentage !== undefined && standard.subAgentCommissionPercentage !== null && standard.subAgentCommissionPercentage !== '') {
        payload.subAgentCommissionPercentage = parseFloat(standard.subAgentCommissionPercentage);
      }
      if (standard.subAgentCommissionAmount !== undefined && standard.subAgentCommissionAmount !== null && standard.subAgentCommissionAmount !== '') {
        payload.subAgentCommissionAmount = parseFloat(standard.subAgentCommissionAmount);
      }
    }

    // Add agent assignment for relationship managers and franchise owners
    if ((isRelationshipManager || isFranchise) && selectedAgentId && selectedAgentId !== '') {
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
      payload.address = standard.address?.trim() || undefined;
      payload.branch = standard.branch?.trim() || undefined;
      payload.loanAccountNo = standard.loanAccountNo?.trim() || undefined;
      payload.dsaCode = standard.dsaCode?.trim() || undefined;
      payload.remarks = standard.remarks?.trim() || undefined;
      payload.smBmEmail = standard.smBmEmail?.trim() || undefined;
      payload.smBmMobile = standard.smBmMobile?.trim() || undefined;
      
      // Agent commission fields for franchise (when not assigned to self)
      if (isFranchise && !isSelfSelected && !isNewLead) {
        payload.agentCommissionPercentage = standard.agentCommissionPercentage !== undefined && standard.agentCommissionPercentage !== null && standard.agentCommissionPercentage !== ''
          ? parseFloat(standard.agentCommissionPercentage)
          : undefined;
        payload.agentCommissionAmount = standard.agentCommissionAmount !== undefined && standard.agentCommissionAmount !== null && standard.agentCommissionAmount !== ''
          ? parseFloat(standard.agentCommissionAmount)
          : undefined;
      }
    }

    // Bank-specific fields only for bank-type leads
    if (!isNewLead) {
      payload.loanType = standard.loanType || formValues?.loanType || undefined;
      payload.loanAmount = (standard.loanAmount || formValues?.loanAmount) ? Number(standard.loanAmount || formValues?.loanAmount) : undefined;
      // Only set commission if not assigned to self (for Admin/Accountant/RM, not Franchise - they use Agent Commission)
      if (canSetCommission && !isFranchise && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
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
      if (canSetCommission && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
      }
    }

    // Pass to parent
    if (onSave) onSave(payload);
  };

  const isNewLead = selectedBank === NEW_LEAD_OPTION || leadFormDef?.leadType === 'new_lead';

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {isNewLead ? 'Lead Type' : 'Select Bank'} {!isNewLead && '*'}
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
          <option value="">-- Choose Lead Type or Bank --</option>
          <option value={NEW_LEAD_OPTION}>New Lead</option>
          {banks.map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {!selectedBank && !lead && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <p className="text-gray-500 font-medium">Please select New Lead or a bank to load the form.</p>
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
                {/* Sub-Agent Selection Dropdown - For agents when creating new leads */}
                {isAgent && !lead && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Select Sub Agent (Optional)
                      </label>
                      <select
                        value={selectedSubAgentId}
                        onChange={(e) => setSelectedSubAgentId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        disabled={loadingSubAgents}
                      >
                        <option value="">-- Select Sub Agent --</option>
                        {subAgents.map((subAgent) => (
                          <option key={subAgent._id || subAgent.id} value={subAgent._id || subAgent.id}>
                            {subAgent.name || subAgent.email || 'Unknown Sub Agent'}
                          </option>
                        ))}
                      </select>
                      {loadingSubAgents && (
                        <p className="text-sm text-gray-500 mt-1">Loading sub-agents...</p>
                      )}
                      {!loadingSubAgents && subAgents.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">No sub-agents available. Create sub-agents from Sub Agents page.</p>
                      )}
                    </div>

                    {selectedSubAgentId && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Sub Agent Commission (%)
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
                {((leadFormDef.agentFields && leadFormDef.agentFields.length > 0) 
                  ? leadFormDef.agentFields 
                  : (leadFormDef.fields || []))
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
                  .map((f) => {
                  const val = formValues?.[f.key] ?? standard[f.key] ?? '';
                  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none";
                  return (
                    <div key={f.key}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{f.label}{f.required && ' *'}</label>
                      {f.type === 'select' ? (
                        <select value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass}>
                          <option value="">-- select --</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass} />
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
                    <div key={dt.key} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <span className="text-sm font-medium">{dt.name}{dt.required && ' *'}</span>
                      <div className="flex items-center gap-2">
                        <input type="file" className="hidden" id={`file-${dt.key}`} onChange={(e) => handleFileSelect(e.target.files?.[0], dt.key, dt.name)} />
                        <label htmlFor={`file-${dt.key}`} className="px-3 py-1 bg-white border rounded text-xs cursor-pointer hover:bg-gray-100">Upload</label>
                        {uploadedDocs.filter(d => d.documentType === dt.key).map((d, i) => (
                          <div key={i} className="text-xs text-green-600 font-bold">Uploaded</div>
                        ))}
                      </div>
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
                {!isAgent && !lead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assign Agent *
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      disabled={loadingAgents}
                    >
                      <option value="">-- Select Agent --</option>
                      {(isRelationshipManager || isFranchise) && (
                        <option value="self">Self ({currentUser?.name || 'Me'})</option>
                      )}
                      {agents.map((agent) => (
                        <option key={agent._id || agent.id} value={agent._id || agent.id}>
                          {agent.name || agent.email || 'Unknown Agent'}
                        </option>
                      ))}
                    </select>
                    {loadingAgents && (
                      <p className="text-sm text-gray-500 mt-1">Loading agents...</p>
                    )}
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
                    Mobile {!isNewLead && '*'}
                  </label>
                  <input
                    type="tel"
                    value={standard.applicantMobile || ''}
                    onChange={(e) => handleStandardChange('applicantMobile', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    required={!isNewLead}
                  />
                </div>

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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Address - textarea, full width */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
                <textarea
                  value={standard.address || ''}
                  onChange={(e) => handleStandardChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  rows={3}
                />
              </div>

              {/* Remark - required for bank leads */}
              {!isNewLead && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remark *</label>
                  <textarea
                    value={standard.remarks || ''}
                    onChange={(e) => handleStandardChange('remarks', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    rows={3}
                    required
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
                      {!((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf) && (
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
              {/* For franchise, show Agent Commission Details instead, so hide this section */}
              {canSetCommission && !isNewLead && !isAgent && !isFranchise && !((isRelationshipManager || isFranchise) && isSelfSelected && !canSetCommissionForSelf) && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Commission Details</h5>
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

              {/* Agent Commission Fields - Only for Franchise when creating bank leads and not assigned to self */}
              {isFranchise && !isNewLead && !isAgent && !isSelfSelected && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Agent Commission Details</h5>
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
                        Agent Commission Percentage (%) *
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
                        Agent Commission Amount (₹) *
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

      {/* Attachments Section - Only show when editing existing lead and user is accountant */}
      {lead && isAccountant && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
          </label>
          
          {/* File Upload Input */}
          <div className="mb-4">
            <input
              type="file"
              id="lead-attachments"
              multiple
              onChange={(e) => handleAttachmentUpload(e.target.files)}
              disabled={uploading}
              className="hidden"
            />
            <label
              htmlFor="lead-attachments"
              className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700">
                {uploading ? 'Uploading...' : 'Upload Attachments (Multiple files allowed)'}
              </span>
            </label>
          </div>

          {/* Existing Attachments List */}
          {loadingAttachments ? (
            <div className="text-sm text-gray-500 py-2">Loading attachments...</div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id || attachment._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.fileName || attachment.name || 'Attachment'}
                      </p>
                      {attachment.fileSize && (
                        <p className="text-xs text-gray-500">
                          {(attachment.fileSize / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {attachment.url && (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(attachment.id || attachment._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-2">No attachments uploaded yet</p>
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

