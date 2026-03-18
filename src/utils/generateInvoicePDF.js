import jsPDF from 'jspdf';
import { initializeRobotoFontSync } from './robotoFont.js';

// Design constants (A4 landscape: 297 x 210 mm)
const MARGIN = 15;
const LINE_HEIGHT = 5;
const LINE_HEIGHT_TIGHT = 4;
const HEADER_ROW_HEIGHT = 8;
const BODY_ROW_HEIGHT = 7;
const TABLE_HEADER_BG = [245, 245, 245];
const BORDER_COLOR = [220, 220, 220];
const PRIMARY_COLOR = [41, 128, 185];
const DARK_GRAY = [51, 51, 51];
const LIGHT_GRAY = [128, 128, 128];

/** Format amount in Indian currency: ₹ 10,00,000.00 (no letter spacing) */
const formatINR = (amount) => {
  const str = Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '₹ ' + str;
};

/** Display value; show '-' instead of 'N/A' */
const na = (v) => (v == null || v === '' || String(v).trim().toUpperCase() === 'N/A' ? '-' : String(v));

/**
 * Generate PDF invoice from invoice data
 * @param {Object} invoiceData - Invoice data with populated fields
 * @param {Object} companySettings - Company settings data (optional: companyLogo base64 for top-left logo)
 * @param {string} robotoFontBase64 - Optional base64 encoded Roboto font
 * @returns {jsPDF} PDF document
 */
export const generateInvoicePDF = (invoiceData, companySettings = {}, robotoFontBase64 = null) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  if (robotoFontBase64) {
    initializeRobotoFontSync(doc, robotoFontBase64);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * MARGIN;
  let yPosition = MARGIN;

  const fontFamily = doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica';

  const addText = (text, x, y, options = {}) => {
    const { fontSize = 10, fontStyle = 'normal', color = DARK_GRAY, align = 'left' } = options;
    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, fontStyle);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, x, y, { align });
  };

  const addLine = (x1, y1, x2, y2, color = BORDER_COLOR) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.line(x1, y1, x2, y2);
  };

  const drawRect = (x, y, w, h, fill = null) => {
    if (fill) {
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(x, y, w, h, 'F');
    }
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.rect(x, y, w, h);
  };

  // Determine receiver (Agent, SubAgent, or Franchise)
  let receiver = null;
  if (invoiceData.invoiceType === 'sub_agent') {
    // For SubAgent invoices, the receiver should be the SubAgent
    receiver = invoiceData.subAgent;
    // Fallback to agent only if subAgent is not populated (shouldn't happen, but safety check)
    if (!receiver || (typeof receiver === 'object' && !receiver.name)) {
      console.warn('⚠️ SubAgent invoice but subAgent not populated, falling back to agent');
      receiver = invoiceData.agent;
    }
  } else if (invoiceData.invoiceType === 'agent') {
    receiver = invoiceData.agent;
  } else {
    receiver = invoiceData.franchise;
  }

  // Determine if receiver is a "normal" (non-GST) user
  // For agents/sub-agents we look at agent.agentType
  // For franchises we look at franchise.franchiseType
  let isNormalGSTUser = false;
  if (invoiceData.invoiceType === 'agent' || invoiceData.invoiceType === 'sub_agent') {
    const agent = invoiceData.agent || receiver;
    isNormalGSTUser = agent?.agentType === 'normal';
  } else if (invoiceData.invoiceType === 'franchise') {
    const franchise = invoiceData.franchise || receiver;
    isNormalGSTUser = franchise?.franchiseType === 'normal';
  }
  
  // Debug logging
  console.log('🔍 Invoice PDF - Receiver Details:', {
    invoiceType: invoiceData.invoiceType,
    receiverName: receiver?.name,
    receiverId: receiver?._id || receiver?.id,
    hasSubAgent: !!invoiceData.subAgent,
    subAgentName: invoiceData.subAgent?.name,
    agentName: invoiceData.agent?.name
  });
  
  const receiverName = receiver?.name || 'N/A';
  // Handle address - franchises have address object, users might have city
  let receiverAddress = 'N/A';
  if (receiver?.address) {
    const addr = receiver.address;
    receiverAddress = `${addr.street || ''}${addr.street && addr.city ? ', ' : ''}${addr.city || ''}${(addr.street || addr.city) && addr.state ? ', ' : ''}${addr.state || ''}${addr.pincode ? ' - ' + addr.pincode : ''}`.replace(/^,\s*|,\s*$/g, '').trim();
    if (!receiverAddress || receiverAddress === '-') receiverAddress = receiver.city || 'N/A';
  } else if (receiver?.city) {
    receiverAddress = receiver.city;
  }
  const receiverPAN = receiver?.kyc?.pan || 'N/A';
  const receiverGST = receiver?.kyc?.gst || 'N/A';
  const receiverMobile = receiver?.mobile || 'N/A';
  const receiverEmail = receiver?.email || 'N/A';

  // Company settings (who paid - YKC); normalize legacy name to new branding
  const rawName = companySettings.companyName || 'YKC finserv PVT. LTD';
  const companyName = (rawName && String(rawName).trim().toUpperCase() === 'YKC FINANCIAL SERVICES')
    ? 'YKC finserv PVT. LTD'
    : rawName;
  const companyAddress = companySettings.address || 'F-3, 3rd Floor, Gangadhar Chambers Co Op Society, Opposite Prabhat Press, Narayan Peth, Pune, Maharashtra 411030';
  const companyGST = companySettings.gstNo || '27AABCY2731J28';
  const companyPAN = companySettings.panNo || 'N/A';
  const companyEmail = companySettings.email || 'N/A';
  const companyMobile = companySettings.mobile || '9130011700';
  const companyLogo = companySettings.companyLogo || companySettings.logoBase64 || null;

  // Bank details from receiver (raw; use na() for display)
  const bankDetails = receiver?.bankDetails || {};
  const cpCode = bankDetails.cpCode || 'N/A';
  const bankName = bankDetails.bankName || 'N/A';
  const accountNumber = bankDetails.accountNumber || 'N/A';
  const ifsc = bankDetails.ifsc || 'N/A';
  const branch = bankDetails.branch || 'N/A';

  // Tax configuration: GST = 18% of Taxable, TDS = 2% of Taxable, Gross = Taxable + GST - TDS
  const totalGstRatePct = 18; // 18% GST on taxable
  const cgstRate = companySettings.taxConfig?.cgstRate ?? 9;
  const sgstRate = companySettings.taxConfig?.sgstRate ?? 9;
  const tdsRate = invoiceData.tdsPercentage ?? companySettings.taxConfig?.defaultTdsRate ?? 2;

  // Lead information; use disbursement amount when invoice is per-disbursement
  const lead = invoiceData.lead || {};
  const leadName = lead.customerName || lead.leadId || 'N/A';
  const bankName_lead = lead.bank?.name || 'N/A';
  const product = lead.loanType ? lead.loanType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
  const amountDisbursed = invoiceData.disbursementAmount != null && invoiceData.disbursementAmount > 0
    ? Number(invoiceData.disbursementAmount)
    : (lead.disbursedAmount || lead.loanAmount || 0);

  // Payout rate: prefer invoice (disbursement-based) then lead
  let payoutRate = invoiceData.commissionRate != null ? Number(invoiceData.commissionRate) : 0;
  if (payoutRate === 0) {
    if (invoiceData.invoiceType === 'sub_agent') {
      payoutRate = lead.subAgentCommissionPercentage || invoiceData.subAgentCommissionPercentage || 0;
    } else if (invoiceData.invoiceType === 'agent') {
      const agentTotalPercentage = lead.agentCommissionPercentage || invoiceData.agentCommissionPercentage || receiver?.commissionPercentage || 0;
      const subAgentPercentage = lead.subAgentCommissionPercentage || 0;
      payoutRate = agentTotalPercentage - subAgentPercentage;
    } else {
      payoutRate = lead.commissionPercentage || invoiceData.commissionPercentage || receiver?.commissionPercentage || 0;
    }
  }

  // Use commission amount from invoice if available, otherwise calculate
  let commission = invoiceData.commissionAmount || 0;
  
  // If commission is 0 but we have amount and rate, calculate it
  if (commission === 0 && amountDisbursed > 0 && payoutRate > 0) {
    commission = (amountDisbursed * payoutRate) / 100;
  }
  
  // If we have commission but no rate, calculate rate backwards
  if (payoutRate === 0 && commission > 0 && amountDisbursed > 0) {
    payoutRate = (commission / amountDisbursed) * 100;
  }
  
  // GST = 18% of Taxable (commission)
  let gstAmount = invoiceData.gstAmount ?? 0;
  if (gstAmount === 0 && commission > 0) {
    gstAmount = (commission * totalGstRatePct) / 100;
  }

  // TDS = 2% of Taxable (or invoice tdsPercentage)
  let tdsAmount = invoiceData.tdsAmount ?? 0;
  if (tdsAmount === 0 && commission > 0) {
    tdsAmount = (commission * tdsRate) / 100;
  }

  // Gross = Taxable + GST - TDS (always compute for correct PDF display)
  const grossValue = commission + gstAmount - tdsAmount;

  const invoiceNumber = invoiceData.invoiceNumber || 'N/A';
  const invoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  doc.setCharSpace(0);

  // ---------- HEADER (no logo) ----------
  addText('TAX INVOICE', pageWidth / 2, yPosition + 8, {
    fontSize: 24,
    fontStyle: 'bold',
    color: PRIMARY_COLOR,
    align: 'center',
  });
  const boxW = 52;
  const boxH = 22;
  const boxX = pageWidth - MARGIN - boxW;
  drawRect(boxX, yPosition, boxW, boxH);
  addText('Invoice No.', boxX + 4, yPosition + 6, { fontSize: 9, fontStyle: 'bold' });
  addText(invoiceNumber, boxX + 4, yPosition + 11, { fontSize: 10 });
  addText('Date', boxX + 4, yPosition + 16, { fontSize: 9, fontStyle: 'bold' });
  addText(invoiceDate, boxX + 4, yPosition + 21, { fontSize: 10 });
  // Place divider clearly below the invoice box (no overlap)
  const headerBottom = MARGIN + boxH;
  yPosition = headerBottom + 8;
  addLine(MARGIN, yPosition, pageWidth - MARGIN, yPosition, LIGHT_GRAY);
  yPosition += 10;

  // ---------- TWO COLUMNS: Receiver (left) | Bill From (right) ----------
  const col1X = MARGIN;
  const col2X = pageWidth / 2 + 5;
  const colWidth = pageWidth / 2 - MARGIN - 10;
  const sectionTitleH = 6;
  const lineH = LINE_HEIGHT;
  const twoColStartY = yPosition;

  addText('Receiver Details', col1X, yPosition, { fontSize: 11, fontStyle: 'bold' });
  addLine(col1X, yPosition + 1, col1X + 45, yPosition + 1, DARK_GRAY);
  yPosition += sectionTitleH + 2;
  addText(receiverName, col1X, yPosition, { fontSize: 11, fontStyle: 'bold' });
  yPosition += lineH;
  const addrText = receiverAddress && receiverAddress !== 'N/A' ? receiverAddress : '-';
  const addrLines = doc.splitTextToSize(addrText, colWidth);
  addrLines.forEach((line) => { addText(line, col1X, yPosition, { fontSize: 9 }); yPosition += lineH; });
  addText(`PAN: ${na(receiverPAN)}`, col1X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`GST: ${na(receiverGST)}`, col1X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`Mobile: ${receiverMobile}`, col1X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`Email: ${receiverEmail}`, col1X, yPosition, { fontSize: 9 });
  const leftColEndY = yPosition;
  yPosition += lineH;

  yPosition = twoColStartY;
  addText('Party Details (Company who paid)', col2X, yPosition, { fontSize: 11, fontStyle: 'bold' });
  addLine(col2X, yPosition + 1, col2X + 70, yPosition + 1, DARK_GRAY);
  yPosition += sectionTitleH + 2;
  addText(companyName, col2X, yPosition, { fontSize: 11, fontStyle: 'bold' });
  yPosition += lineH;
  const compAddrLines = doc.splitTextToSize(companyAddress, colWidth);
  compAddrLines.forEach((line) => { addText(line, col2X, yPosition, { fontSize: 9 }); yPosition += lineH; });
  addText(`GST Number: ${companyGST}`, col2X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`PAN Number: ${na(companyPAN)}`, col2X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`Email: ${companyEmail}`, col2X, yPosition, { fontSize: 9 });
  yPosition += lineH;
  addText(`Mobile: ${companyMobile}`, col2X, yPosition, { fontSize: 9 });
  yPosition = Math.max(leftColEndY, yPosition) + 8;

  // ---------- TABLE ----------
  const tableLeft = MARGIN;
  const tableRight = pageWidth - MARGIN;
  const tableW = tableRight - tableLeft;
  const colKeys = ['sr', 'customer', 'bank', 'product', 'amount', 'payoutPct', 'grossPayout'];
  if (!isNormalGSTUser) colKeys.push('gst');
  colKeys.push('tds', 'netPayout');
  const colW = {
    sr: 10,
    customer: 38,
    bank: 34,
    product: 26,
    amount: 24,
    payoutPct: 18,
    grossPayout: 24,
    gst: 22,
    tds: 20,
    netPayout: 26,
  };
  let xCur = tableLeft;
  const colPos = [];
  // Shorter, horizontal-friendly column labels to avoid overlap
  const headers = [
    'Sr No',
    'Customer / Lead',
    'Bank',
    'Product',
    'Amt Disbursed',
    'Payout %',
    'Taxable Amt',
  ];
  if (!isNormalGSTUser) headers.push('GST');
  headers.push('TDS', 'Gross Value');
  colKeys.forEach((k, i) => {
    const w = i === colKeys.length - 1 ? tableRight - xCur : colW[k];
    colPos.push({ key: k, x: xCur, w, right: ['amount', 'payoutPct', 'grossPayout', 'gst', 'tds', 'netPayout'].includes(k) });
    xCur += w;
  });

  const headerY = yPosition;
  doc.setFillColor(TABLE_HEADER_BG[0], TABLE_HEADER_BG[1], TABLE_HEADER_BG[2]);
  doc.rect(tableLeft, headerY, tableW, HEADER_ROW_HEIGHT, 'F');
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.rect(tableLeft, headerY, tableW, HEADER_ROW_HEIGHT);
  colPos.forEach((c, i) => {
    if (i > 0) doc.line(c.x, headerY, c.x, headerY + HEADER_ROW_HEIGHT);
    const tx = c.x + (c.right ? c.w - 2 : 4);
    addText(headers[i], tx, headerY + 5.5, { fontSize: 8, fontStyle: 'bold', align: c.right ? 'right' : 'left' });
  });
  yPosition += HEADER_ROW_HEIGHT;

  const rowY = yPosition;
  doc.rect(tableLeft, rowY, tableW, BODY_ROW_HEIGHT);
  colPos.forEach((c, i) => {
    if (i > 0) doc.line(c.x, rowY, c.x, rowY + BODY_ROW_HEIGHT);
  });
  const customerColW = colPos.find(p => p.key === 'customer')?.w ?? 34;
  const customerNameText = doc.splitTextToSize(leadName, customerColW - 4);
  const rowTexts = [
    '1',
    customerNameText[0] || leadName.substring(0, 20),
    bankName_lead.substring(0, 14),
    product.substring(0, 12),
    formatINR(amountDisbursed),
    Math.abs(payoutRate).toFixed(2) + '%',
    formatINR(Math.max(0, commission)),
  ];
  if (!isNormalGSTUser) rowTexts.push(formatINR(Math.max(0, gstAmount)));
  rowTexts.push(formatINR(Math.max(0, tdsAmount)), formatINR(grossValue));
  colPos.forEach((c, i) => {
    const tx = c.x + (c.right ? c.w - 2 : 4);
    addText(rowTexts[i], tx, rowY + 4.5, { fontSize: 8, align: c.right ? 'right' : 'left' });
  });
  yPosition += BODY_ROW_HEIGHT;
  addLine(tableLeft, yPosition, tableRight, yPosition);

  // ---------- BANK DETAILS ----------
  yPosition += 10;
  addText('Bank Details', MARGIN, yPosition, { fontSize: 11, fontStyle: 'bold' });
  addLine(MARGIN, yPosition + 1, MARGIN + 50, yPosition + 1, DARK_GRAY);
  yPosition += 8;
  const bankColX = MARGIN;
  addText(`CP Code: ${na(cpCode)}`, bankColX, yPosition, { fontSize: 9 });
  yPosition += LINE_HEIGHT;
  addText(`Bank Name: ${na(bankName)}`, bankColX, yPosition, { fontSize: 9 });
  yPosition += LINE_HEIGHT;
  addText(`Account Number: ${na(accountNumber)}`, bankColX, yPosition, { fontSize: 9 });
  yPosition += LINE_HEIGHT;
  addText(`IFSC Code: ${na(ifsc)}`, bankColX, yPosition, { fontSize: 9 });
  yPosition += LINE_HEIGHT;
  addText(`Branch: ${na(branch)}`, bankColX, yPosition, { fontSize: 9 });
  yPosition += 10;

  if (invoiceData.notes || invoiceData.remarks) {
    addText('Notes:', MARGIN, yPosition, { fontSize: 10, fontStyle: 'bold' });
    yPosition += 6;
    const notes = (invoiceData.notes || invoiceData.remarks || '').trim();
    const notesLines = doc.splitTextToSize(notes, contentWidth);
    notesLines.forEach((line) => { addText(line, MARGIN, yPosition, { fontSize: 9 }); yPosition += LINE_HEIGHT; });
    yPosition += 4;
  }

  // ---------- SIGNATURE SECTION ----------
  const footerY = pageHeight - 40;
  yPosition = footerY;
  addLine(MARGIN, yPosition, tableRight, yPosition, BORDER_COLOR);
  yPosition += 6;
  addText('Authorized Signatory', tableRight, yPosition, { fontSize: 10, fontStyle: 'bold', align: 'right' });
  yPosition += 4;
  addText(`(${receiverName})`, tableRight, yPosition, { fontSize: 9, align: 'right' });

  return doc;
};

/**
 * Load logo from Public folder as PNG data URL for use in PDF.
 * Tries /logo.webp and /logo.png. Converts WebP to PNG for jsPDF compatibility.
 */
export async function loadLogoFromPublic() {
  for (const path of ['/logo.webp', '/logo.png']) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      if (blob.type === 'image/webp') {
        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = dataUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      }
      return dataUrl;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Download invoice as PDF
 * @param {Object} invoiceData - Invoice data with populated fields
 * @param {Object} companySettings - Company settings data
 * @param {String} filename - Optional filename
 */
export const downloadInvoicePDF = (invoiceData, companySettings = {}, filename = null, robotoFontBase64 = null) => {
  const doc = generateInvoicePDF(invoiceData, companySettings, robotoFontBase64);
  const invoiceNumber = invoiceData.invoiceNumber || 'INV';
  const date = new Date().toISOString().split('T')[0];
  const pdfFilename = filename || `Invoice_${invoiceNumber}_${date}.pdf`;
  doc.save(pdfFilename);
};
