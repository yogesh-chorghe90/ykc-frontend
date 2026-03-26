import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Filter, ChevronDown, ChevronUp, MoreVertical, FileDown,
    Plus, Edit, Trash2, ArrowRight, User, Building, CreditCard,
    FileText, Calendar, CheckCircle2, AlertCircle, Clock, X, Save, Calculator, PieChart, DollarSign,
    Percent, Hash, Tag, Eye, Download, CheckCircle
} from 'lucide-react';
import api from '../services/api';
import { toast } from '../services/toastService';
import { formatCurrency } from '../utils/formatUtils';
import LeadExpandedDetails from '../components/LeadExpandedDetails';
import DisbursementForm from '../components/DisbursementForm';
import EditDisbursementForm from '../components/EditDisbursementForm';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import LeadForm from '../components/LeadForm';
import DisbursementEmailModal from '../components/DisbursementEmailModal';
import { downloadInvoicePDF, loadLogoFromPublic } from '../utils/generateInvoicePDF';
import { preloadRobotoFont, getCachedRobotoFont } from '../utils/robotoFont';

// Financial calculation utilities
const calculateRemainingAmount = (loanAmount, disbursedAmount) => {
    const loan = loanAmount || 0;
    const disbursed = disbursedAmount || 0;
    return Math.max(0, loan - disbursed);
};

const calculateProgressPercentage = (disbursedAmount, loanAmount) => {
    const loan = loanAmount || 0;
    const disbursed = disbursedAmount || 0;
    return loan > 0 ? Math.round((disbursed / loan) * 100) : 0;
};

const determineLoanStatus = (loanAmount, disbursedAmount, currentStatus) => {
    const remaining = calculateRemainingAmount(loanAmount, disbursedAmount);

    if (remaining === 0) return 'completed';
    if (disbursedAmount > 0 && remaining > 0) return 'partial_disbursed';
    if (currentStatus === 'approved' || currentStatus === 'sanctioned') return 'approved';
    return currentStatus || 'processing';
};

const calculateCommission = (amount, percentage) => {
    const amt = parseFloat(amount) || 0;
    const pct = parseFloat(percentage) || 0;
    return (amt * pct) / 100;
};

const calculateNetCommission = (commission, gst) => {
    const comm = parseFloat(commission) || 0;
    const gstAmount = parseFloat(gst) || 0;
    return Math.max(0, comm - gstAmount);
};

const getPartnerCommissionPercentage = (lead) => {
    const agentPct = lead.agentCommissionPercentage;
    const associatedPct = lead.commissionPercentage;

    // Normal case: agent commission explicitly set and > 0
    const parsedAgent = parseFloat(agentPct || 0) || 0;
    if (parsedAgent > 0) return parsedAgent;

    // Special case: lead created from RM dashboard – backend stored commission
    // in generic commissionPercentage instead of agentCommissionPercentage.
    // We detect this when:
    // - agent commission is 0
    // - associated name is present
    // - sub agent is empty
    const hasAssociatedName = !!(lead.associated?.name || lead.associatedName);
    const hasSubAgent = !!(lead.subAgent?.name || lead.subAgentName);
    const parsedAssociated = parseFloat(associatedPct || 0) || 0;

    if (parsedAgent === 0 && parsedAssociated > 0 && hasAssociatedName && !hasSubAgent) {
        return parsedAssociated;
    }

    return parsedAgent;
};

const getPartnerCommissionAmount = (lead) => {
    const agentAmt = lead.agentCommissionAmount;
    const associatedAmt = lead.commissionAmount;

    const parsedAgent = parseFloat(agentAmt || 0) || 0;
    if (parsedAgent > 0) return parsedAgent;

    const hasAssociatedName = !!(lead.associated?.name || lead.associatedName);
    const hasSubAgent = !!(lead.subAgent?.name || lead.subAgentName);
    const parsedAssociated = parseFloat(associatedAmt || 0) || 0;

    if (parsedAgent === 0 && parsedAssociated > 0 && hasAssociatedName && !hasSubAgent) {
        return parsedAssociated;
    }

    return parsedAgent;
};

const getAssociatedCommissionPercentage = (lead) => {
    const agentPct = parseFloat(lead.agentCommissionPercentage || 0) || 0;
    const pct = parseFloat(lead.commissionPercentage || 0) || 0;

    const hasAssociatedName = !!(lead.associated?.name || lead.associatedName);
    const hasSubAgent = !!(lead.subAgent?.name || lead.subAgentName);

    // If we already mapped commission to Partner (agentPct == 0, pct>0, associated present, no sub-agent),
    // then Associated should show 0.
    if (agentPct === 0 && pct > 0 && hasAssociatedName && !hasSubAgent) {
        return 0;
    }

    return pct;
};

const getAssociatedCommissionAmount = (lead) => {
    const agentAmt = parseFloat(lead.agentCommissionAmount || 0) || 0;
    const amt = parseFloat(lead.commissionAmount || 0) || 0;

    const hasAssociatedName = !!(lead.associated?.name || lead.associatedName);
    const hasSubAgent = !!(lead.subAgent?.name || lead.subAgentName);

    if (agentAmt === 0 && amt > 0 && hasAssociatedName && !hasSubAgent) {
        return 0;
    }

    return amt;
};

const AccountantLeads = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditDisbursementModalOpen, setIsEditDisbursementModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [confirmDeleteLead, setConfirmDeleteLead] = useState({ isOpen: false, lead: null });
    const [isDisbursementEmailModalOpen, setIsDisbursementEmailModalOpen] = useState(false);
    const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null);

    const [viewLeadData, setViewLeadData] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [selectedDisbursement, setSelectedDisbursement] = useState(null);
    const [disbursementToDelete, setDisbursementToDelete] = useState(null);

    const [filters, setFilters] = useState({
        status: '',
        bank: '',
        agent: '',
        dateRange: { from: '', to: '' }
    });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        commission: '',
        gst: '',
        notes: ''
    });
    const [expandedLeadInvoices, setExpandedLeadInvoices] = useState([]);
    const [generatingInvoiceFor, setGeneratingInvoiceFor] = useState(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    useEffect(() => {
        if (!expandedRow) {
            setExpandedLeadInvoices([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await api.invoices.getAll({ leadId: expandedRow, limit: 200 });
                const data = res?.data || res || [];
                if (!cancelled) setExpandedLeadInvoices(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setExpandedLeadInvoices([]);
            }
        })();
        return () => { cancelled = true; };
    }, [expandedRow]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await api.accountant.getApprovedLeads({
                search: searchTerm,
                page: 1,
                limit: 100
            });
            const leadsData = response?.data?.leads || response?.leads || [];
            setLeads(Array.isArray(leadsData) ? leadsData : []);
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Error', 'Failed to fetch approved customers');
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    const handleEditDisbursement = (leadId, disbursement) => {
        setSelectedLeadId(leadId);
        setSelectedDisbursement(disbursement);
        setIsEditDisbursementModalOpen(true);
    };

    const handleDeleteDisbursement = (leadId, disbursement) => {
        setSelectedLeadId(leadId);
        setDisbursementToDelete(disbursement);
        setIsDeleteConfirmOpen(true);
    };

    const handleEditDisbursementSubmit = async (data) => {
        try {
            const response = await api.accountant.editDisbursement(selectedLeadId, selectedDisbursement._id, data);
            toast.success('Success', response.message || 'Disbursement updated successfully');

            // Refresh the leads data
            await fetchLeads();

            // Close modal
            setIsEditDisbursementModalOpen(false);
            setSelectedDisbursement(null);
        } catch (error) {
            console.error('Error updating disbursement:', error);
            toast.error('Error', error.message || 'Failed to update disbursement');
        }
    };

    const handleDeleteDisbursementConfirm = async () => {
        try {
            const response = await api.accountant.deleteDisbursement(selectedLeadId, disbursementToDelete._id);
            toast.success('Success', response.message || 'Disbursement deleted successfully');

            // Refresh the leads data
            await fetchLeads();

            // Close modal
            setIsDeleteConfirmOpen(false);
            setDisbursementToDelete(null);
        } catch (error) {
            console.error('Error deleting disbursement:', error);
            toast.error('Error', error.message || 'Failed to delete disbursement');
        }
    };

    const handleAddDisbursementSubmit = async (data) => {
        try {
            const response = await api.accountant.addDisbursement(selectedLeadId, data);
            toast.success('Success', response.message || 'Disbursement added successfully');

            // Refresh the leads data
            await fetchLeads();

            // Close modal
            setIsModalOpen(false);
            setSelectedLeadId(null);
        } catch (error) {
            console.error('Error adding disbursement:', error);
            toast.error('Error', error.message || 'Failed to add disbursement');
        }
    };

    const handleGenerateInvoice = async (leadId, disbursementId) => {
        const key = `${leadId}-${disbursementId}`;
        setGeneratingInvoiceFor(key);
        try {
            await api.invoices.generateForDisbursement({ leadId, disbursementId });
            toast.success('Success', 'Agent and Sub-Agent invoices generated.');
            if (expandedRow === leadId) {
                const res = await api.invoices.getAll({ leadId, limit: 200 });
                const data = res?.data || res || [];
                setExpandedLeadInvoices(Array.isArray(data) ? data : []);
            }
            await fetchLeads();
        } catch (error) {
            console.error('Error generating invoices:', error);
            toast.error('Error', error.message || error.response?.data?.error || 'Failed to generate invoices');
        } finally {
            setGeneratingInvoiceFor(null);
        }
    };

    const handleDownloadInvoices = async (invoices) => {
        if (!invoices || invoices.length === 0) return;
        try {
            let robotoFontBase64 = getCachedRobotoFont();
            if (!robotoFontBase64) await preloadRobotoFont();
            robotoFontBase64 = getCachedRobotoFont();
            const companyRes = await api.companySettings.get();
            const companySettings = companyRes?.data || companyRes || {};
            const logoData = await loadLogoFromPublic();
            const settingsWithLogo = { ...companySettings, companyLogo: logoData || companySettings.companyLogo };
            for (let i = 0; i < invoices.length; i++) {
                const inv = invoices[i];
                const id = inv.id || inv._id;
                if (!id) continue;
                const detailRes = await api.invoices.getById(id);
                const full = detailRes?.data || detailRes;
                const typeLabel = full.invoiceType === 'sub_agent' ? 'SubAgent' : 'Agent';
                downloadInvoicePDF(full, settingsWithLogo, null, robotoFontBase64);
                if (i < invoices.length - 1) await new Promise((r) => setTimeout(r, 400));
            }
            toast.success('Success', 'Invoice PDF(s) downloaded');
        } catch (error) {
            console.error('Error downloading invoices:', error);
            toast.error('Error', error.message || 'Failed to download invoice PDF');
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchLeads();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);


    const openViewModal = (leadId) => {
        const lead = leads.find(l => (l._id || l.id) === leadId);
        setViewLeadData(lead);
        setIsViewModalOpen(true);
    };

    const openEditModal = (leadId) => {
        const lead = leads.find(l => (l._id || l.id) === leadId);
        setSelectedLead(lead);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (formData) => {
        if (!selectedLead) return;
        try {
            const leadId = selectedLead._id || selectedLead.id;

            // Must match Leads.jsx handleSave — LeadForm sends agentCommission*, subAgent*, etc.
            // A narrow mapping here previously dropped those fields so Partner / Sub Partner columns never updated.
            const toOptionalNumber = (value) => {
                if (value === '' || value === null || value === undefined) return undefined;
                const parsed = parseFloat(value);
                return Number.isNaN(parsed) ? undefined : parsed;
            };

            const leadData = {
                leadType: formData.leadType || 'bank',
                caseNumber: formData.caseNumber?.trim() || undefined,
                applicantMobile: formData.applicantMobile?.trim() || undefined,
                applicantEmail: formData.applicantEmail?.trim() || undefined,
                loanType: formData.loanType,
                loanAmount: toOptionalNumber(formData.loanAmount),
                loanAccountNo: formData.loanAccountNo?.trim() || undefined,
                agent: formData.agentId || formData.agent || undefined,
                associated: formData.associated || formData.associatedId || formData.franchiseId || undefined,
                associatedModel: formData.associatedModel || (formData.franchiseId ? 'Franchise' : undefined),
                bank: formData.bankId || formData.bank || undefined,
                subAgent: formData.subAgent || undefined,
                subAgentCommissionPercentage: toOptionalNumber(formData.subAgentCommissionPercentage),
                subAgentCommissionAmount: toOptionalNumber(formData.subAgentCommissionAmount),
                agentCommissionPercentage: toOptionalNumber(formData.agentCommissionPercentage),
                agentCommissionAmount: toOptionalNumber(formData.agentCommissionAmount),
                referralFranchise: formData.referralFranchise || undefined,
                referralFranchiseCommissionPercentage: toOptionalNumber(formData.referralFranchiseCommissionPercentage),
                referralFranchiseCommissionAmount: toOptionalNumber(formData.referralFranchiseCommissionAmount),
                leadForm: formData.leadForm || undefined,
                formValues: formData.formValues || undefined,
                documents: formData.documents || undefined,
                customerName: formData.customerName?.trim() || undefined,
                commissionBasis: formData.commissionBasis || undefined,
                commissionPercentage: toOptionalNumber(formData.commissionPercentage),
                commissionAmount: toOptionalNumber(formData.commissionAmount),
                smBmName: formData.smBmName?.trim() || undefined,
                smBmEmail: formData.smBmEmail?.trim() || undefined,
                smBmMobile: formData.smBmMobile?.trim() || undefined,
                asmName: formData.asmName?.trim() || undefined,
                asmEmail: formData.asmEmail?.trim() || undefined,
                asmMobile: formData.asmMobile?.trim() || undefined,
                dsaCode: formData.dsaCode?.trim() || formData.codeUse?.trim() || undefined,
                branch: formData.branch?.trim() || undefined,
                remarks: formData.remarks?.trim() || undefined,
            };

            Object.keys(leadData).forEach((key) => {
                if (leadData[key] === undefined) delete leadData[key];
            });

            await api.leads.update(leadId, leadData);
            toast.success('Success', 'Customer updated successfully');
            await fetchLeads();
            setIsEditModalOpen(false);
            setSelectedLead(null);
        } catch (error) {
            console.error('Error updating lead:', error);
            toast.error('Error', error.message || 'Failed to update customer');
        }
    };

    const handleDeleteLeadClick = (lead) => {
        setConfirmDeleteLead({ isOpen: true, lead });
    };

    const handleDeleteLeadConfirm = async () => {
        const lead = confirmDeleteLead.lead;
        const leadId = lead._id || lead.id;
        if (!leadId) {
            toast.error('Error', 'Customer ID is missing');
            return;
        }

        try {
            await api.leads.delete(leadId);
            await fetchLeads();
            toast.success('Success', `Customer "${lead.leadId || lead.customerName || 'this customer'}" deleted successfully`);
            setConfirmDeleteLead({ isOpen: false, lead: null });
        } catch (error) {
            console.error('Error deleting lead:', error);
            toast.error('Error', error.message || 'Failed to delete customer');
        }
    };

    const handleStatusUpdate = async (leadId, newStatus) => {
        if (!leadId) {
            toast.error('Error', 'Customer ID is missing');
            return;
        }
        try {
            await api.accountant.updateLeadStatus(leadId, { status: newStatus });
            await fetchLeads();
            toast.success('Success', 'Customer status updated successfully');
        } catch (error) {
            console.error('Error updating lead status:', error);
            toast.error('Error', error.message || 'Failed to update customer status');
        }
    };

    const handleDisbursementEmail = (lead) => {
        setSelectedLeadForEmail(lead);
        setIsDisbursementEmailModalOpen(true);
    };

    const handleDeleteInstallment = (leadId, installmentId) => {
        if (!window.confirm('Are you sure you want to delete this disbursement record?')) {
            return;
        }
        toast.error('Feature restricted', 'Deletion of tranches is not allowed for security.');
    };


    const openDisbursementModal = (leadId) => {
        setSelectedLeadId(leadId);
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            commission: '',
            gst: '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleSaveDisbursement = async (formData) => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Error', 'Please enter a valid amount');
            return;
        }

        try {
            const response = await api.accountant.addDisbursement(selectedLeadId, formData);
            toast.success('Success', response.message || 'Disbursement added successfully');

            // Refresh the leads data
            await fetchLeads();

            // Close modal
            setIsModalOpen(false);
            setSelectedLeadId(null);
        } catch (error) {
            toast.error('Error', error.message || 'Failed to add disbursement');
        }
    };

    const toggleRow = (id) => {
        if (expandedRow === id) {
            setExpandedRow(null);
        } else {
            setExpandedRow(id);
        }
    };

    // Filtered and sorted leads
    const filteredAndSortedLeads = useMemo(() => {
        if (!Array.isArray(leads)) return [];
        let filtered = [...leads];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(lead =>
                (lead.customerName && lead.customerName.toLowerCase().includes(term)) ||
                (lead.leadId && lead.leadId.toLowerCase().includes(term)) ||
                (lead.loanAccountNo && lead.loanAccountNo.toLowerCase().includes(term)) ||
                (lead.agentName && lead.agentName.toLowerCase().includes(term))
            );
        }

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(lead => lead.status === filters.status);
        }

        // Apply bank filter
        if (filters.bank) {
            filtered = filtered.filter(lead =>
                (lead.bank?.name && lead.bank.name === filters.bank) ||
                lead.bankName === filters.bank
            );
        }

        // Apply agent filter
        if (filters.agent) {
            filtered = filtered.filter(lead =>
                (lead.agent?.name && lead.agent.name === filters.agent) ||
                lead.agentName === filters.agent
            );
        }

        // Apply date range filter
        if (filters.dateRange.from || filters.dateRange.to) {
            filtered = filtered.filter(lead => {
                const leadDate = new Date(lead.createdAt);
                const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
                const toDate = filters.dateRange.to ? new Date(filters.dateRange.to) : null;

                if (fromDate && leadDate < fromDate) return false;
                if (toDate && leadDate > toDate) return false;
                return true;
            });
        }

        // Apply sorting
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle nested properties
                if (sortConfig.key.includes('.')) {
                    const keys = sortConfig.key.split('.');
                    aValue = keys.reduce((obj, key) => obj?.[key], a);
                    bValue = keys.reduce((obj, key) => obj?.[key], b);
                }

                // Handle date comparison
                if (aValue instanceof Date || bValue instanceof Date) {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }

                // Handle null/undefined values
                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (sortConfig.direction === 'asc') {
                    return aValue > bValue ? 1 : -1;
                } else {
                    return aValue < bValue ? 1 : -1;
                }
            });
        }

        return filtered;
    }, [leads, searchTerm, filters, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ChevronDown size={14} className="text-gray-400" />;
        return sortConfig.direction === 'asc' ?
            <ChevronUp size={14} className="text-primary-600" /> :
            <ChevronDown size={14} className="text-primary-600" />;
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved':
            case 'sanctioned': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'disbursed':
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'partial_disbursed': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getUniqueValues = (array, key) => {
        const values = array.map(item => {
            if (key.includes('.')) {
                const keys = key.split('.');
                return keys.reduce((obj, k) => obj?.[k], item);
            }
            return item[key];
        }).filter(Boolean);
        return [...new Set(values)];
    };

    const uniqueBanks = getUniqueValues(leads, 'bank.name');
    const uniqueAgents = getUniqueValues(leads, 'agent.name');
    const uniqueStatuses = getUniqueValues(leads, 'status');

    return (
        <>
            <div className="bg-white rounded-lg sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)] w-full max-w-full overflow-hidden">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col gap-3 sm:gap-4 shrink-0">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Approved Loan Customers</h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage disbursements and calculate commissions</p>
                        </div>

                        {/* Search and Export */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name, ID, account..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg sm:rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                                />
                            </div>
                            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl text-sm font-medium sm:font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm whitespace-nowrap">
                                <FileDown size={18} />
                                <span>Export</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Section - Collapsible */}
                    <div className="border-t border-gray-200 pt-3">
                        <button
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Filter size={16} />
                                Filters
                            </span>
                            {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {filtersOpen && (
                            <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-200 mt-3">
                                <div className="flex-1 min-w-[140px] sm:min-w-[150px]">
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                                    <div className="relative">
                                        <select
                                            value={filters.status}
                                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none appearance-none bg-white"
                                        >
                                            <option value="">All Statuses</option>
                                            {uniqueStatuses.map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-[140px] sm:min-w-[150px]">
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Bank</label>
                                    <div className="relative">
                                        <select
                                            value={filters.bank}
                                            onChange={(e) => setFilters(prev => ({ ...prev, bank: e.target.value }))}
                                            className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none appearance-none bg-white"
                                        >
                                            <option value="">All Banks</option>
                                            {uniqueBanks.map(bank => (
                                                <option key={bank} value={bank}>{bank}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-[140px] sm:min-w-[150px]">
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Agent</label>
                                    <div className="relative">
                                        <select
                                            value={filters.agent}
                                            onChange={(e) => setFilters(prev => ({ ...prev, agent: e.target.value }))}
                                            className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none appearance-none bg-white"
                                        >
                                            <option value="">All Agents</option>
                                            {uniqueAgents.map(agent => (
                                                <option key={agent} value={agent}>{agent}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-center w-full sm:w-auto sm:items-end">
                                    <button
                                        onClick={() => setFilters({ status: '', bank: '', agent: '', dateRange: { from: '', to: '' } })}
                                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-gray-200">
                        <div className="text-xs sm:text-sm text-gray-600">
                            Showing {filteredAndSortedLeads.length} of {leads.length} customers
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                            Showing 1 to {filteredAndSortedLeads.length} of {leads.length} customer entries
                        </div>
                    </div>
                </div>

                {/* Main Content Area - Table */}
                <div className="flex-1 overflow-hidden bg-white">
                    <div className="w-full h-full overflow-x-auto overflow-y-auto table-wrapper">
                        <table className="w-full text-left border-collapse min-w-[2000px]">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr className="text-[10px] sm:text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[40px] sm:min-w-[60px]"></th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[100px]">
                                        <div className="flex items-center gap-2">
                                            <span>Customer ID</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <span>Customer</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[100px] cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-2">
                                            <span>Status</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <span>Account No</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <span>Advance Payment</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[100px] cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('loanType')}>
                                        <div className="flex items-center gap-2">
                                            <span>Loan Type</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[120px] text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Loan Amount</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[120px] text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Disbursed</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap min-w-[120px] cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('remainingAmount')}>
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Remaining</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal min-w-[90px] cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('agentCommissionPercentage')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Partner<br />Comm&nbsp;%
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal min-w-[90px] cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('agentCommissionAmount')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Partner<br />Comm&nbsp;Amt
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('subAgentCommissionPercentage')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Sub&nbsp;Partner<br />Comm&nbsp;%
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('subAgentCommissionAmount')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Sub&nbsp;Partner<br />Comm&nbsp;Amt
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('commissionPercentage')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Associated<br />Comm&nbsp;%
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('commissionAmount')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Associated<br />Comm&nbsp;Amt
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('referralFranchiseCommissionPercentage')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Refer&nbsp;Assoc.<br />Comm&nbsp;%
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-normal cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('referralFranchiseCommissionAmount')}>
                                        <div className="flex items-center justify-end gap-1 text-right">
                                            <span className="leading-tight text-[10px] sm:text-[11px] text-right">
                                                Refer&nbsp;Assoc.<br />Comm&nbsp;Amt
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Partner</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Sub Partner</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Associated</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Referral Associated</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('bank.name')}>
                                        <div className="flex items-center gap-2">
                                            <span>Bank</span>

                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>SM/BM</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>ASM</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('branch')}>
                                        <div className="flex items-center gap-2">
                                            <span>Branch</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('disbursementDate')}>
                                        <div className="flex items-center gap-2">
                                            <span>Disbursement Date</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sanctionedDate')}>
                                        <div className="flex items-center gap-2">
                                            <span>Sanctioned Date</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Date</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">Remark</th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">GST</th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('codeUse')}>
                                        <div className="flex items-center gap-2">
                                            <span>DSA Code</span>
                                        </div>
                                    </th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">UTR Number</th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">Generate Invoice</th>
                                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredAndSortedLeads.map((lead) => {
                                    const isExpanded = expandedRow === lead._id;
                                    const loanAmountValue = lead.loanAmount || lead.amount || 0;
                                    const disbursedAmount = lead.disbursedAmount || 0;
                                    const remainingAmount = calculateRemainingAmount(loanAmountValue, disbursedAmount);
                                    const progressPercentage = calculateProgressPercentage(disbursedAmount, loanAmountValue);
                                    const loanStatus = determineLoanStatus(loanAmountValue, disbursedAmount, lead.status);
                                    const history = lead.disbursementHistory || [];

                                    return (
                                        <React.Fragment key={lead._id}>
                                            <tr
                                                className={`transition-all duration-300 hover:bg-gray-50 cursor-pointer group ${isExpanded ? 'bg-gray-50 shadow-sm' : ''}`}
                                                onClick={() => toggleRow(lead._id)}
                                            >
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-400 group-hover:text-primary-600 transition-colors">
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs font-mono text-gray-500 font-medium">
                                                    {lead.leadId || lead.caseNumber || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs">
                                                            {(lead.customerName || 'U').charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900">{lead.customerName || 'N/A'}</div>
                                                            <div className="text-[11px] text-gray-500">{lead.contactNumber || lead.applicantMobile || lead.applicantEmail || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(loanStatus)}`}>
                                                        {loanStatus}
                                                    </span>
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                                                    {lead.loanAccountNo || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                    {lead.advancePayment ? 'True' : 'False'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                    <div className="text-xs sm:text-sm font-medium text-gray-900">
                                                        {lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900 text-right font-mono">
                                                    {formatCurrency(lead.loanAmount || lead.amount)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-emerald-600 text-right font-mono">
                                                    {formatCurrency(disbursedAmount)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-orange-600 text-right font-mono">
                                                    {formatCurrency(remainingAmount)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 text-right">
                                                    {(() => {
                                                        const percentage = getPartnerCommissionPercentage(lead);
                                                        return percentage.toFixed(2);
                                                    })()}%
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-blue-600 text-right font-mono">
                                                    {formatCurrency(getPartnerCommissionAmount(lead))}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 text-right">
                                                    {(() => {
                                                        const percentage = lead.subAgentCommissionPercentage || 0;
                                                        return typeof percentage === 'number' ? percentage.toFixed(2) : parseFloat(percentage || 0).toFixed(2);
                                                    })()}%
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-blue-600 text-right font-mono">
                                                    {formatCurrency(lead.subAgentCommissionAmount || 0)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 text-right">
                                                    {(() => {
                                                        const percentage = getAssociatedCommissionPercentage(lead);
                                                        return percentage.toFixed(2);
                                                    })()}%
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-blue-600 text-right font-mono">
                                                    {formatCurrency(getAssociatedCommissionAmount(lead))}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 text-right">
                                                    {(() => {
                                                        const percentage = lead.referralFranchiseCommissionPercentage || 0;
                                                        return typeof percentage === 'number' ? percentage.toFixed(2) : parseFloat(percentage || 0).toFixed(2);
                                                    })()}%
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-blue-600 text-right font-mono">
                                                    {formatCurrency(lead.referralFranchiseCommissionAmount || 0)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.agentName || lead.agent?.name || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.subAgentName || lead.subAgent?.name || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.associated?.name || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.referralFranchise?.name || lead.referralAssociated?.name || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.bank?.name || lead.bankName || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.smBm?.name || lead.smBmName || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.asm?.name || lead.asmName || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                    {lead.branch || 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                    {lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                    {lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                    {new Date(lead.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate">
                                                    <span title={lead.remarks || lead.remark || 'N/A'}>
                                                        {lead.remarks || lead.remark || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                    {formatCurrency(lead.gst || 0)}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                                                    {lead.codeUse || lead.dsaCode || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500 max-w-[100px] truncate">
                                                    <span title={lead.utrNumber || 'N/A'}>
                                                        {lead.utrNumber || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                    {(() => {
                                                        // For disbursed status: Check if agent invoice exists
                                                        if (lead.status === 'disbursed') {
                                                            // Check if lead has subAgent
                                                            const hasSubAgent = lead.subAgent || lead.subAgentName;
                                                            const hasBothInvoices = lead.hasAgentInvoice && lead.hasSubAgentInvoice;
                                                            const hasAnyInvoice = lead.hasAgentInvoice || lead.hasSubAgentInvoice;

                                                            if (hasAnyInvoice) {
                                                                if (hasSubAgent && hasBothInvoices) {
                                                                    return (
                                                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                                                            <CheckCircle2 size={14} />
                                                                            Both Generated
                                                                        </span>
                                                                    );
                                                                } else if (hasSubAgent && !hasBothInvoices) {
                                                                    return (
                                                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold">
                                                                            <AlertCircle size={14} />
                                                                            Partial
                                                                        </span>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                                                            <CheckCircle2 size={14} />
                                                                            Generated
                                                                        </span>
                                                                    );
                                                                }
                                                            } else {
                                                                return (
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            try {
                                                                                // Check if partner (agent) commission percentage is set.
                                                                                // Use the same helper that powers the table so RM-created leads
                                                                                // (where commission is stored in commissionPercentage) also pass.
                                                                                const agentCommissionPercentage = getPartnerCommissionPercentage(lead);
                                                                                if (agentCommissionPercentage <= 0) {
                                                                                    toast.error('Error', 'Cannot generate invoice. Agent commission percentage is not set or is zero. Please set the commission percentage for this customer.');
                                                                                    return;
                                                                                }

                                                                                // If subAgent exists, check subAgent commission percentage
                                                                                if (hasSubAgent) {
                                                                                    const subAgentCommissionPercentage = lead.subAgentCommissionPercentage || 0;
                                                                                    if (subAgentCommissionPercentage <= 0) {
                                                                                        toast.error('Error', 'Cannot generate split invoices. Sub-agent commission percentage is not set or is zero.');
                                                                                        return;
                                                                                    }
                                                                                }

                                                                                const response = await api.invoices.generateFromLead(lead._id);

                                                                                // Check if split invoices were generated
                                                                                if (response.data?.isSplit) {
                                                                                    toast.success('Success', 'Split invoices generated successfully (Agent and SubAgent)');
                                                                                } else {
                                                                                    toast.success('Success', 'Agent invoice generated successfully');
                                                                                }

                                                                                // Refresh leads to update the UI
                                                                                await fetchLeads();
                                                                            } catch (error) {
                                                                                console.error('Error generating invoice:', error);
                                                                                toast.error('Error', error.message || 'Failed to generate invoice');
                                                                            }
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
                                                                    >
                                                                        <FileText size={14} />
                                                                        {hasSubAgent ? 'Generate Split' : 'Generate'}
                                                                    </button>
                                                                );
                                                            }
                                                        }

                                                        // For completed status: Check if franchise invoice exists
                                                        if (lead.status === 'completed') {
                                                            const isRMAssociatedLead = lead.associatedModel === 'RelationshipManager';
                                                            const hasReferralFranchise = !!(lead.referralFranchise || lead.referralAssociated);
                                                            const canGenerateCompletedInvoice = !isRMAssociatedLead || hasReferralFranchise;

                                                            if (!canGenerateCompletedInvoice) {
                                                                return (
                                                                    <span className="text-xs text-gray-400">
                                                                        N/A
                                                                    </span>
                                                                );
                                                            }

                                                            if (lead.hasFranchiseInvoice) {
                                                                return (
                                                                    <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                                                        <CheckCircle2 size={14} />
                                                                        Generated
                                                                    </span>
                                                                );
                                                            } else {
                                                                return (
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            try {
                                                                                // Check if loan amount is available
                                                                                const loanAmount = lead.loanAmount || 0;
                                                                                if (loanAmount <= 0) {
                                                                                    toast.error('Error', 'Cannot generate franchise invoice. Loan amount is not set or is zero.');
                                                                                    return;
                                                                                }

                                                                                await api.invoices.generateFromLead(lead._id);
                                                                                toast.success('Success', 'Franchise invoice generated successfully');
                                                                                // Refresh leads to update the UI
                                                                                await fetchLeads();
                                                                            } catch (error) {
                                                                                console.error('Error generating invoice:', error);
                                                                                toast.error('Error', error.message || 'Failed to generate invoice');
                                                                            }
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
                                                                    >
                                                                        <FileText size={14} />
                                                                        Generate
                                                                    </button>
                                                                );
                                                            }
                                                        }

                                                        // For other statuses: Don't show invoice generation
                                                        return (
                                                            <span className="text-xs text-gray-400">
                                                                N/A
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => openViewModal(lead._id)}
                                                            className="text-primary-900 hover:text-primary-800 p-1"
                                                            title="View Details"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(lead._id)}
                                                            className="text-gray-600 hover:text-gray-900 p-1"
                                                            title="Edit"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        {(lead.status === 'partial_disbursed' || lead.status === 'disbursed' || lead.status === 'completed') && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDisbursementEmail(lead);
                                                                }}
                                                                className="text-blue-600 hover:text-blue-800 p-1"
                                                                title="Disbursement Confirmation"
                                                            >
                                                                <CheckCircle size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteLeadClick(lead)}
                                                            className="text-red-600 hover:text-red-900 p-1"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <select
                                                            value={lead.status || 'sanctioned'}
                                                            onChange={(e) => handleStatusUpdate(lead._id, e.target.value)}
                                                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="sanctioned">Sanctioned</option>
                                                            <option value="partial_disbursed">Partial Disbursed</option>
                                                            <option value="disbursed">Disbursed</option>
                                                            <option value="completed">Completed</option>
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* EXPANDED ROW */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50 animate-in slide-in-from-top-2 duration-300">
                                                    <td colSpan="21" className="p-0 border-b border-gray-100">
                                                        <div className="p-6 border-b border-gray-100 transition-all duration-300">
                                                            <LeadExpandedDetails
                                                                lead={lead}
                                                                onAddDisbursement={openDisbursementModal}
                                                                onViewHistory={() => console.log('View history for', lead._id)}
                                                                onEditDisbursement={handleEditDisbursement}
                                                                onDeleteDisbursement={handleDeleteDisbursement}
                                                                leadInvoices={expandedRow === lead._id ? expandedLeadInvoices : []}
                                                                onGenerateInvoice={handleGenerateInvoice}
                                                                onDownloadInvoices={handleDownloadInvoices}
                                                                generatingInvoiceKey={generatingInvoiceFor}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-3 sm:p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                        <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                            Showing 1 to {filteredAndSortedLeads.length} of {leads.length} customer entries
                        </div>
                        <div className="flex items-center gap-2 order-1 sm:order-2">
                            <button
                                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed disabled:opacity-50"
                                disabled
                            >
                                Previous
                            </button>
                            <button
                                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed disabled:opacity-50"
                                disabled
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals - Outside main container */}
            <EditDisbursementForm
                isOpen={isEditDisbursementModalOpen}
                onClose={() => {
                    setIsEditDisbursementModalOpen(false);
                    setSelectedDisbursement(null);
                }}
                onSubmit={handleEditDisbursementSubmit}
                disbursement={selectedDisbursement}
                lead={leads.find(lead => lead._id === selectedLeadId)}
                loading={false}
            />

            {/* Delete Confirmation Modal */}
            {isDeleteConfirmOpen && disbursementToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
                                Delete Disbursement Entry
                            </h3>
                            <p className="text-gray-600 text-center mb-6">
                                Are you sure you want to delete this disbursement entry? This action cannot be undone.
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600">Date</p>
                                        <p className="font-medium">{new Date(disbursementToDelete.date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Amount</p>
                                        <p className="font-medium text-red-600">{formatCurrency(disbursementToDelete.amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Commission</p>
                                        <p className="font-medium">{formatCurrency(disbursementToDelete.commission || 0)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteDisbursementConfirm}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <DisbursementForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveDisbursement}
                lead={leads.find(l => (l._id || l.id) === selectedLeadId)}
                loading={false}
            />

            {/* View Lead Modal */}
            {isViewModalOpen && viewLeadData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div>
                                    <h3 className="text-xl font-bold text-gray-900">Customer Details</h3>
                                    <p className="text-sm text-gray-500">Complete information for {viewLeadData.customerName || viewLeadData.formValues?.customerName || viewLeadData.formValues?.leadName || 'this customer'}</p>
                            </div>
                            <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Customer Information */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <User size={16} className="text-primary-600" />
                                    Customer Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                            <label className="text-xs font-semibold text-gray-500">Customer ID</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.caseNumber || viewLeadData.leadId || viewLeadData._id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Customer Name</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.customerName || viewLeadData.formValues?.customerName || viewLeadData.formValues?.leadName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Contact Number</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.applicantMobile || viewLeadData.contactNumber || viewLeadData.formValues?.applicantMobile || viewLeadData.formValues?.mobile || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Email</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.applicantEmail || viewLeadData.email || viewLeadData.formValues?.applicantEmail || viewLeadData.formValues?.email || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Loan Information */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CreditCard size={16} className="text-primary-600" />
                                    Loan Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Loan Account No</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.loanAccountNo || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Loan Type</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.loanType || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Loan Amount</label>
                                        <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(viewLeadData.loanAmount || viewLeadData.amount || 0)}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Status</label>
                                        <p className="mt-1">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(viewLeadData.status)}`}>
                                                {viewLeadData.status || 'N/A'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Bank Name</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.bank?.name || viewLeadData.bankName || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Commission Information */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Commission Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Partner Commission %</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {getPartnerCommissionPercentage(viewLeadData).toFixed(2)}%
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Partner Commission Amount</label>
                                        <p className="text-sm font-bold text-gray-900 mt-1">
                                            {formatCurrency(getPartnerCommissionAmount(viewLeadData))}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Sub Partner Commission %</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {(() => {
                                                const pct = viewLeadData.subAgentCommissionPercentage || 0;
                                                return typeof pct === 'number'
                                                    ? pct.toFixed(2)
                                                    : parseFloat(pct || 0).toFixed(2);
                                            })()}%
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Sub Partner Commission Amount</label>
                                        <p className="text-sm font-bold text-gray-900 mt-1">
                                            {formatCurrency(viewLeadData.subAgentCommissionAmount || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Associated Commission %</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {getAssociatedCommissionPercentage(viewLeadData).toFixed(2)}%
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Associated Commission Amount</label>
                                        <p className="text-sm font-bold text-gray-900 mt-1">
                                            {formatCurrency(getAssociatedCommissionAmount(viewLeadData))}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Refer Franchise Commission %</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {(() => {
                                                const pct = viewLeadData.referralFranchiseCommissionPercentage || 0;
                                                return typeof pct === 'number'
                                                    ? pct.toFixed(2)
                                                    : parseFloat(pct || 0).toFixed(2);
                                            })()}%
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Refer Franchise Commission Amount</label>
                                        <p className="text-sm font-bold text-gray-900 mt-1">
                                            {formatCurrency(viewLeadData.referralFranchiseCommissionAmount || 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Agent & Banker Information */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Agent & Partner Details</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Partner (Agent)</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.agent?.name || viewLeadData.agentName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Partner Contact</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.agent?.mobile || viewLeadData.agent?.phone || viewLeadData.agentContact || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Sub Partner</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.subAgent?.name || viewLeadData.subAgentName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Associated (RM / Franchise)</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.associated?.name || viewLeadData.associatedName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Refer Franchise / Associated</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.referralFranchise?.name || viewLeadData.referralAssociated?.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">DSA Code</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.dsaCode || viewLeadData.codeUse || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Banker Details</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">SM/BM Name</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.smBm?.name || viewLeadData.smBmName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">SM/BM Mobile</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.smBm?.mobile || viewLeadData.smBmMobile || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">ASM Name</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.asm?.name || viewLeadData.asmName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">ASM Mobile</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.asm?.mobile || viewLeadData.asmMobile || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Branch</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.branch || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Additional Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Created Date</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.createdAt ? new Date(viewLeadData.createdAt).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500">Updated Date</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.updatedAt ? new Date(viewLeadData.updatedAt).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-gray-500">Remark</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.remarks || viewLeadData.remark || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setIsViewModalOpen(false)}
                                className="w-full py-3 px-4 bg-primary-900 text-white rounded-xl text-sm font-bold hover:bg-primary-800 shadow-lg shadow-primary-900/10 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Lead Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedLead(null);
                }}
                    title="Edit Customer"
            >
                <LeadForm lead={selectedLead} onSave={handleSaveEdit} onClose={() => setIsEditModalOpen(false)} />
            </Modal>

            {/* Delete Lead Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDeleteLead.isOpen}
                onClose={() => setConfirmDeleteLead({ isOpen: false, lead: null })}
                onConfirm={handleDeleteLeadConfirm}
                    title="Delete Customer"
                    message={`Are you sure you want to delete customer "${confirmDeleteLead.lead?.leadId || confirmDeleteLead.lead?.customerName || 'this customer'}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />

            {/* Disbursement Email Modal */}
            <DisbursementEmailModal
                isOpen={isDisbursementEmailModalOpen}
                onClose={() => {
                    setIsDisbursementEmailModalOpen(false);
                    setSelectedLeadForEmail(null);
                }}
                leadId={selectedLeadForEmail?._id || selectedLeadForEmail?.id}
            />
        </>
    );
};

export default AccountantLeads;


