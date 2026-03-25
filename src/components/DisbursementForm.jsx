import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Calculator, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

// Prevent background scrolling when modal is open
const preventBackgroundScroll = (isOpen) => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '15px'; // Prevent layout shift
    } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
};

const DisbursementForm = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    lead,
    loading = false 
}) => {
    console.log('🔍 DEBUG: DisbursementForm rendered with:', { isOpen, leadId: lead?._id, loading });
    
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        commission: '',
        commissionType: 'amt', // 'amt' or 'percent'
        commissionPercent: '',
        gst: '',
        notes: ''
    });
    
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Reset form when lead changes or modal opens
    useEffect(() => {
        if (isOpen && lead) {
            const loanAmount = lead.loanAmount || lead.amount || 0;
            const disbursed = lead.disbursedAmount || 0;
            const remaining = loanAmount - disbursed;
            
            setFormData({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                commission: '',
                commissionType: 'amt',
                commissionPercent: '',
                gst: '',
                notes: ''
            });
            setErrors({});
            setTouched({});
        }
    }, [isOpen, lead]);

    // Prevent background scrolling
    useEffect(() => {
        preventBackgroundScroll(isOpen);
        return () => preventBackgroundScroll(false);
    }, [isOpen]);

    if (!isOpen || !lead) return null;

    const loanAmount = lead.loanAmount || lead.amount || 0;
    const disbursed = lead.disbursedAmount || 0;
    const remaining = loanAmount - disbursed;
    const commissionPercentage = lead.commissionPercentage || 0;

    // Debug logging for progress bar
    console.log('Progress bar values:', {
        loanAmount,
        disbursed,
        remaining,
        percentage: loanAmount > 0 ? (disbursed / loanAmount) * 100 : 0
    });

    const validateField = (name, value) => {
        const newErrors = { ...errors };
        
        switch (name) {
            case 'amount':
                if (!value || value <= 0) {
                    newErrors.amount = 'Amount is required';
                } else if (parseFloat(value) > remaining) {
                    newErrors.amount = `Amount cannot exceed remaining balance of ${formatCurrency(remaining)}`;
                } else if (parseFloat(value) + disbursed > loanAmount) {
                    newErrors.amount = `Total disbursement would exceed approved amount`;
                } else {
                    delete newErrors.amount;
                }
                break;
                
            case 'date':
                if (!value) {
                    newErrors.date = 'Date is required';
                } else {
                    delete newErrors.date;
                }
                break;
                
            case 'commission':
                if (value && parseFloat(value) < 0) {
                    newErrors.commission = 'Commission cannot be negative';
                } else {
                    delete newErrors.commission;
                }
                break;
                
            case 'commissionPercent':
                if (value && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
                    newErrors.commissionPercent = 'Commission percentage must be between 0 and 100';
                } else {
                    delete newErrors.commissionPercent;
                }
                break;
                
            case 'gst':
                if (value && parseFloat(value) < 0) {
                    newErrors.gst = 'GST cannot be negative';
                } else {
                    delete newErrors.gst;
                }
                break;
                
            default:
                break;
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        // Handle commission type change
        if (name === 'commissionType') {
            setFormData(prev => ({ 
                ...prev, 
                [name]: value,
                commission: '',
                commissionPercent: ''
            }));
            return;
        }
        
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            
            // If commission type is percent and commissionPercent changes, calculate commission amount
            if (name === 'commissionPercent' && prev.commissionType === 'percent' && value && prev.amount) {
                const calculatedCommission = (parseFloat(prev.amount) * parseFloat(value)) / 100;
                updated.commission = calculatedCommission.toFixed(2);
            }
            // If commission type is percent and amount changes, recalculate commission
            else if (name === 'amount' && prev.commissionType === 'percent' && prev.commissionPercent && value) {
                const calculatedCommission = (parseFloat(value) * parseFloat(prev.commissionPercent)) / 100;
                updated.commission = calculatedCommission.toFixed(2);
            }
            // If commission type is amt and commission amount changes, calculate commission percentage
            else if (name === 'commission' && prev.commissionType === 'amt' && value && prev.amount) {
                const disbursementAmount = parseFloat(prev.amount) || 0;
                const commissionAmount = parseFloat(value) || 0;
                if (disbursementAmount > 0 && commissionAmount >= 0) {
                    updated.commissionPercent = ((commissionAmount / disbursementAmount) * 100).toFixed(2);
                }
            }
            // Auto-calculate commission if amount changes and lead has commission percentage (legacy behavior)
            else if (name === 'amount' && commissionPercentage > 0 && value && prev.commissionType === 'amt' && !prev.commission) {
                const calculatedCommission = (parseFloat(value) * commissionPercentage) / 100;
                updated.commission = calculatedCommission.toFixed(2);
            }
            
            return updated;
        });
        
        // Mark field as touched for validation
        setTouched(prev => ({ ...prev, [name]: true }));
        
        // Validate the field
        if (touched[name] || name === 'amount') {
            validateField(name, value);
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        validateField(name, value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate all fields
        const isValid = Object.keys(formData).every(field => 
            validateField(field, formData[field])
        );
        
        if (!isValid) {
            return;
        }
        
        onSubmit(formData);
    };

    const getFieldError = (fieldName) => {
        return touched[fieldName] ? errors[fieldName] : '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pt-8 sm:pt-12 bg-black/60 backdrop-blur-md">
            {/* Modal Container - Fixed size with proper scrolling */}
            <div className="relative w-full max-w-2xl h-[80vh] sm:h-[85vh] max-h-[550px] sm:max-h-[650px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header - Fixed at top */}
                <div className="flex-shrink-0 p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Add Disbursement</h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">Enter disbursement details for {lead.customerName}</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Financial Summary - Fixed below header */}
                <div className="flex-shrink-0 px-5 sm:px-6 py-4 bg-gradient-to-r from-primary-50/50 to-blue-50/50 border-b border-gray-100">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                        <div>
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider">Loan Amount</p>
                            <p className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(loanAmount)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Currently Disbursed</p>
                            <p className="text-base sm:text-lg font-bold text-emerald-700">{formatCurrency(disbursed)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] sm:text-[10px] font-bold text-orange-600 uppercase tracking-wider">Remaining</p>
                            <p className="text-base sm:text-lg font-bold text-orange-700">{formatCurrency(remaining)}</p>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ 
                                width: loanAmount > 0 ? `${Math.min(100, (disbursed / loanAmount) * 100)}%` : '0%',
                                minWidth: '0%',
                                maxWidth: '100%'
                            }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>
                            {loanAmount > 0 ? Math.round((disbursed / loanAmount) * 100) : 0}%
                        </span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Scrollable Body - Main content area */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                        {/* Amount and Date Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <DollarSign size={14} className="text-gray-500" />
                                    Disbursement Amount *
                                </label>
                                <input
                                    type="number"
                                    name="amount"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all ${
                                        getFieldError('amount') 
                                            ? 'border-red-300 focus:ring-red-500/20' 
                                            : 'border-gray-200'
                                    }`}
                                    disabled={loading}
                                />
                                {getFieldError('amount') && (
                                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {getFieldError('amount')}
                                    </p>
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <Calendar size={14} className="text-gray-500" />
                                    Disbursement Date *
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all ${
                                        getFieldError('date') 
                                            ? 'border-red-300 focus:ring-red-500/20' 
                                            : 'border-gray-200'
                                    }`}
                                    disabled={loading}
                                />
                                {getFieldError('date') && (
                                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {getFieldError('date')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Commission Section */}
                        <div className="p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl border border-blue-100 space-y-4">
                            <h4 className="text-sm font-bold text-blue-800 uppercase flex items-center gap-2">
                                <Calculator size={16} />
                                Commission Details
                            </h4>
                            
                            {/* Commission Type Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Commission Type *</label>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="commissionType"
                                            value="amt"
                                            checked={formData.commissionType === 'amt'}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Amount (₹)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="commissionType"
                                            value="percent"
                                            checked={formData.commissionType === 'percent'}
                                            onChange={handleInputChange}
                                            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Percentage (%)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {formData.commissionType === 'amt' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2">
                                            Commission Amount (₹) *
                                            {commissionPercentage > 0 && (
                                                <span className="text-blue-600 ml-1 text-xs font-normal">
                                                    (suggested: {commissionPercentage}% of amount)
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            name="commission"
                                            placeholder="0.00"
                                            value={formData.commission}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            step="0.01"
                                            min="0"
                                            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                                                getFieldError('commission') 
                                                    ? 'border-red-300 focus:ring-red-500/20' 
                                                    : 'border-blue-200'
                                            }`}
                                            disabled={loading}
                                        />
                                        {getFieldError('commission') && (
                                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {getFieldError('commission')}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2">
                                            Commission Percentage (%) *
                                        </label>
                                        <input
                                            type="number"
                                            name="commissionPercent"
                                            placeholder="0.00"
                                            value={formData.commissionPercent}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                                                getFieldError('commissionPercent') 
                                                    ? 'border-red-300 focus:ring-red-500/20' 
                                                    : 'border-blue-200'
                                            }`}
                                            disabled={loading}
                                        />
                                        {getFieldError('commissionPercent') && (
                                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {getFieldError('commissionPercent')}
                                            </p>
                                        )}
                                        {formData.commissionPercent && formData.amount && (
                                            <p className="text-xs text-blue-600 mt-1">
                                                Calculated Amount: ₹{((parseFloat(formData.amount) * parseFloat(formData.commissionPercent)) / 100).toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2">
                                        GST Amount (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name="gst"
                                        placeholder="0.00"
                                        value={formData.gst}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all ${
                                            getFieldError('gst') 
                                                ? 'border-red-300 focus:ring-red-500/20' 
                                                : 'border-gray-200'
                                        }`}
                                        disabled={loading}
                                    />
                                    {getFieldError('gst') && (
                                        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            {getFieldError('gst')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {/* Net Commission Display */}
                            {(formData.commission || formData.gst) && (
                                <div className="bg-white/50 rounded-lg p-3 border border-blue-100">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-blue-700">Net Commission:</span>
                                        <span className="text-lg font-bold text-emerald-600">
                                            {formatCurrency((parseFloat(formData.commission) || 0) - (parseFloat(formData.gst) || 0))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                                Notes / Remarks
                            </label>
                            <textarea
                                name="notes"
                                rows="4"
                                placeholder="Any additional information about this disbursement..."
                                value={formData.notes}
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none"
                                disabled={loading}
                            ></textarea>
                        </div>
                    </form>
                </div>

                {/* Footer - Fixed at bottom */}
                <div className="flex-shrink-0 p-5 sm:p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-all disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading || Object.keys(errors).length > 0}
                            className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                loading || Object.keys(errors).length > 0
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/30'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span className="text-sm">Processing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    <span className="text-sm">Add Disbursement</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisbursementForm;