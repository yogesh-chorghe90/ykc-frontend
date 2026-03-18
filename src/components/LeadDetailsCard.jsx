import React from 'react';
import { X, User, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const LeadDetailsCard = ({ isOpen, lead, onClose }) => {
  if (!isOpen || !lead) return null;

  const viewLeadData = lead;

  const getStatusColor = (status) => {
    switch (status) {
      case 'disbursed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'partial_disbursed':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Customer Details</h3>
            <p className="text-sm text-gray-500">
              Complete information for {viewLeadData.customerName || viewLeadData.formValues?.customerName || viewLeadData.formValues?.leadName || 'this lead'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900"
          >
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
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.caseNumber || viewLeadData.leadId || viewLeadData._id || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Customer Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.customerName || viewLeadData.formValues?.customerName || viewLeadData.formValues?.leadName || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Contact Number</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.applicantMobile || viewLeadData.contactNumber || viewLeadData.formValues?.applicantMobile || viewLeadData.formValues?.mobile || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Email</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.applicantEmail || viewLeadData.email || viewLeadData.formValues?.applicantEmail || viewLeadData.formValues?.email || 'N/A'}
                </p>
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
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {formatCurrency(viewLeadData.loanAmount || viewLeadData.amount || 0)}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Status</label>
                <p className="mt-1">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(
                      viewLeadData.status,
                    )}`}
                  >
                    {viewLeadData.status || 'N/A'}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Bank Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.bank?.name || viewLeadData.bankName || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Commission %</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.agentCommissionPercentage ||
                    viewLeadData.commissionPercentage ||
                    viewLeadData.commissionPercent ||
                    0}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* Agent & Banker Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Agent Details</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Agent Name</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.agent?.name || viewLeadData.agentName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Contact</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.agent?.mobile || viewLeadData.agent?.phone || viewLeadData.agentContact || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">DSA Code</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.dsaCode || viewLeadData.codeUse || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Banker Details</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Banker Name</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.smBm?.name || viewLeadData.asmName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Contact</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.smBm?.mobile || viewLeadData.smBmMobile || viewLeadData.asmMobile || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Branch</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {viewLeadData.branch || 'N/A'}
                  </p>
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
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.createdAt ? new Date(viewLeadData.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Updated Date</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.updatedAt ? new Date(viewLeadData.updatedAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500">Remark</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {viewLeadData.remarks || viewLeadData.remark || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-primary-900 text-white rounded-xl text-sm font-bold hover:bg-primary-800 shadow-lg shadow-primary-900/10 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsCard;

