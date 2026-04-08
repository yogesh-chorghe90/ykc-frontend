// Utility for currency formatting
export const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '-') return '-';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// Utility for formatting amounts in crores (e.g., 1.5cr, 1.8cr)
export const formatInCrores = (amount) => {
    if (amount === undefined || amount === null || amount === 0) return '₹0';
    const crore = 10000000; // 1 crore = 1,00,00,000
    if (amount >= crore) {
        return `₹${(amount / crore).toFixed(1)}cr`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
};

const LEAD_STATUS_LABELS = {
    logged: 'Logged',
    sanctioned: 'Sanctioned',
    partial_disbursed: 'Partial Disbursed',
    disbursed: 'Disbursed',
    completed: 'Completed',
    rejected: 'Rejected',
    approved: 'Approved',
    processing: 'Processing',
};

export const formatLeadStatusLabel = (status) => {
    if (status == null || status === '') return '—';
    return LEAD_STATUS_LABELS[status] ?? String(status).replace(/_/g, ' ');
};

const INVOICE_STATUS_LABELS = {
    pending: 'Pending',
    gst_paid: 'GST Paid',
    paid: 'Paid',
    regular_paid: 'Regular Paid',
};

export const formatInvoiceStatusLabel = (status) => {
    if (status == null || status === '') return '—';
    return INVOICE_STATUS_LABELS[status] ?? String(status).replace(/_/g, ' ');
};

const PAYOUT_STATUS_LABELS = {
    pending: 'Pending',
    gst_pending: 'GST Pending',
    gst_received: 'GST received',
    payment_received: 'Payment received',
    payment_pending: 'Payment Pending',
    recovery_pending: 'Recovery Pending',
    recovery_received: 'Recovery Received',
    complete: 'Complete',
};

export const formatPayoutStatusLabel = (status) => {
    if (status == null || status === '') return '—';
    return PAYOUT_STATUS_LABELS[status] ?? String(status).replace(/_/g, ' ');
};