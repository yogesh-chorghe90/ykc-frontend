import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Calculator, AlertCircle, CheckCircle, Save, Edit3 } from 'lucide-react';
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

const EditDisbursementForm = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    disbursement,
    lead,
    loading = false 
}) => {
    const [formData, setFormData] = useState({
        amount: '',
        date: '',
        commission: '',
        commissionType: 'amt', // 'amt' or 'percent'
        commissionPercent: '',
        gst: '',
        notes: ''
    });
    
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Reset form when disbursement changes or modal opens
    useEffect(() => {
        if (isOpen && disbursement && lead) {
            // Determine commission type based on existing data
            // If we can calculate percentage from commission and amount, use percent, else use amt
            const existingCommission = disbursement.commission || 0;
            const existingAmount = disbursement.amount || 0;
            let commissionType = 'amt';
            let commissionPercent = '';
            
            if (existingAmount > 0 && existingCommission > 0) {
                const calculatedPercent = (existingCommission / existingAmount) * 100;
                // If the calculated percentage is a reasonable value (0-100), use percent mode
                if (calculatedPercent >= 0 && calculatedPercent <= 100) {
                    commissionType = 'percent';
                    commissionPercent = calculatedPercent.toFixed(2);
                }
            }
            
            setFormData({
                amount: disbursement.amount || '',
                date: disbursement.date ? new Date(disbursement.date).toISOString().split('T')[0] : '',
                commission: disbursement.commission || '',
                commissionType,
                commissionPercent,
                gst: disbursement.gst || '',
                notes: disbursement.notes || ''
            });
            setErrors({});
            setTouched({});
        }
    }, [isOpen, disbursement, lead]);

    // Handle background scroll prevention
    useEffect(() => {
        preventBackgroundScroll(isOpen);
        return () => preventBackgroundScroll(false);
    }, [isOpen]);

    const loanAmount = lead?.loanAmount || lead?.amount || 0;
    const totalDisbursed = lead?.disbursedAmount || 0;
    const currentDisbursement = disbursement?.amount || 0;
    const otherDisbursements = totalDisbursed - currentDisbursement;
    const maxAmount = loanAmount - otherDisbursements;

    const validateField = (name, value) => {
        const newErrors = { ...errors };
        
        switch (name) {
            case 'amount':
                if (!value) {
                    newErrors.amount = 'Amount is required';
                } else if (isNaN(value) || parseFloat(value) <= 0) {
                    newErrors.amount = 'Amount must be a positive number';
                } else if (parseFloat(value) > maxAmount) {
                    newErrors.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}`;
                }
                break;
            case 'date':
                if (!value) {
                    newErrors.date = 'Date is required';
                }
                break;
            case 'commission':
                if (value && (isNaN(value) || parseFloat(value) < 0)) {
                    newErrors.commission = 'Commission must be a positive number';
                }
                break;
            case 'commissionPercent':
                if (value && (isNaN(value) || parseFloat(value) < 0 || parseFloat(value) > 100)) {
                    newErrors.commissionPercent = 'Commission percentage must be between 0 and 100';
                }
                break;
            case 'gst':
                if (value && (isNaN(value) || parseFloat(value) < 0)) {
                    newErrors.gst = 'GST must be a positive number';
                }
                break;
        }
        
        setErrors(newErrors);
        return !newErrors[name];
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
            if (name === 'commissionPercent' && prev.commissionType === 'percent' && value && formData.amount) {
                const calculatedCommission = (parseFloat(formData.amount) * parseFloat(value)) / 100;
                updated.commission = calculatedCommission.toFixed(2);
            }
            // If commission type is percent and amount changes, recalculate commission
            else if (name === 'amount' && prev.commissionType === 'percent' && prev.commissionPercent && value) {
                const calculatedCommission = (parseFloat(value) * parseFloat(prev.commissionPercent)) / 100;
                updated.commission = calculatedCommission.toFixed(2);
            }
            
            return updated;
        });
        
        // Clear error when user starts typing
        if (touched[name]) {
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
        const requiredFields = ['amount', 'date'];
        const isValid = requiredFields.every(field => 
            validateField(field, formData[field])
        );
        
        // Additional validation: commission must be provided
        if (formData.commissionType === 'amt' && !formData.commission) {
            setErrors(prev => ({ ...prev, commission: 'Commission amount is required' }));
            setTouched(prev => ({ ...prev, commission: true }));
            return;
        }
        if (formData.commissionType === 'percent' && !formData.commissionPercent) {
            setErrors(prev => ({ ...prev, commissionPercent: 'Commission percentage is required' }));
            setTouched(prev => ({ ...prev, commissionPercent: true }));
            return;
        }
        
        if (!isValid) {
            setTouched({
                amount: true,
                date: true,
                commission: true,
                gst: true
            });
            return;
        }

        // Prepare submission data - ensure commission amount is calculated if percentage mode
        const submissionData = {
            amount: parseFloat(formData.amount),
            date: formData.date,
            commission: formData.commissionType === 'percent' && formData.commissionPercent && formData.amount
                ? parseFloat(((parseFloat(formData.amount) * parseFloat(formData.commissionPercent)) / 100).toFixed(2))
                : (formData.commission ? parseFloat(formData.commission) : 0),
            gst: formData.gst ? parseFloat(formData.gst) : 0,
            notes: formData.notes
        };

        onSubmit(submissionData);
    };

    const calculateNetCommission = () => {
        const commission = parseFloat(formData.commission) || 0;
        const gst = parseFloat(formData.gst) || 0;
        return Math.max(0, commission - gst);
    };

    if (!isOpen || !disbursement || !lead) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Edit3 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Edit Disbursement</h2>
                            <p className="text-sm text-gray-600">Update disbursement details for {lead.customerName || 'this lead'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {/* Loan Summary */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Loan Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Loan Amount</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(loanAmount)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Total Disbursed</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(totalDisbursed)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Current Amount</p>
                                <p className="font-semibold text-blue-600">{formatCurrency(currentDisbursement)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Max Editable</p>
                                <p className="font-semibold text-green-600">{formatCurrency(maxAmount)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Current Disbursement Details */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-3">Current Disbursement</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-blue-700">Date</p>
                                <p className="font-medium">{new Date(disbursement.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-blue-700">Amount</p>
                                <p className="font-medium">{formatCurrency(disbursement.amount)}</p>
                            </div>
                            <div>
                                <p className="text-blue-700">Commission</p>
                                <p className="font-medium">{formatCurrency(disbursement.commission || 0)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Amount */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Disbursement Amount *
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="number"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                                            errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="Enter amount"
                                        step="0.01"
                                        min="0"
                                        max={maxAmount}
                                    />
                                </div>
                                {errors.amount && touched.amount && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        {errors.amount}
                                    </p>
                                )}
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Disbursement Date *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                                            errors.date && touched.date ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                </div>
                                {errors.date && touched.date && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        {errors.date}
                                    </p>
                                )}
                            </div>

                            {/* Commission Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Commission Type *</label>
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

                            {/* Commission */}
                            {formData.commissionType === 'amt' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Commission Amount (₹) *
                                    </label>
                                    <div className="relative">
                                        <Calculator className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="number"
                                            name="commission"
                                            value={formData.commission}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                                                errors.commission && touched.commission ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter commission"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                    {errors.commission && touched.commission && (
                                        <p className="mt-1 text-sm text-red-600 flex items-center">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            {errors.commission}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Commission Percentage (%) *
                                    </label>
                                    <div className="relative">
                                        <Calculator className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="number"
                                            name="commissionPercent"
                                            value={formData.commissionPercent}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                                                errors.commissionPercent && touched.commissionPercent ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter percentage"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                        />
                                    </div>
                                    {errors.commissionPercent && touched.commissionPercent && (
                                        <p className="mt-1 text-sm text-red-600 flex items-center">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            {errors.commissionPercent}
                                        </p>
                                    )}
                                    {formData.commissionPercent && formData.amount && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            Calculated Amount: ₹{((parseFloat(formData.amount) * parseFloat(formData.commissionPercent)) / 100).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* GST */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    GST Amount
                                </label>
                                <div className="relative">
                                    <Calculator className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="number"
                                        name="gst"
                                        value={formData.gst}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                                            errors.gst && touched.gst ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="Enter GST"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                {errors.gst && touched.gst && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        {errors.gst}
                                    </p>
                                )}
                            </div>

                            {/* Net Commission Display */}
                            {(formData.commission || formData.gst) && (
                                <div className="md:col-span-2">
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-green-800">Net Commission:</span>
                                            <span className="text-lg font-bold text-green-700">
                                                {formatCurrency(calculateNetCommission())}
                                            </span>
                                        </div>
                                        <p className="text-xs text-green-600 mt-1">
                                            (Commission - GST)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Notes
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="Add any additional notes about this disbursement..."
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:outline-none transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-50 flex items-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Update Disbursement</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditDisbursementForm;