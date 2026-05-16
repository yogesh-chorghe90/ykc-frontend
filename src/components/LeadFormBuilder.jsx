import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../services/api';
import { toast } from '../services/toastService';
import KeyBuilder from './KeyBuilder';
import KeyPicker from './KeyPicker';
import { enrichFieldsWithCatalog } from '../utils/leadFormFieldUtils';

const NEW_LEAD_OPTION = 'new_lead';

const PROTECTED_FIELD_KEYS = new Set([
  'leadname',
  'mobile',
  'email',
  'address',
  'dsacode',
  'loantype',
  'loanamount',
  'branch',
  'loanaccountno',
]);

const normalizeFieldKey = (key) =>
  String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const isProtectedFieldKey = (key) => PROTECTED_FIELD_KEYS.has(normalizeFieldKey(key));

export default function LeadFormBuilder({ onSaved }) {
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [availableKeys, setAvailableKeys] = useState([]);
  const [form, setForm] = useState({ name: '', fields: [], documentTypes: [], active: true });
  const [loading, setLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await api.banks.getAll();
        setBanks(resp?.data || []);
        const defs = await api.fieldDefs.list();
        setAvailableKeys(defs?.data || []);
      } catch (err) {
        console.error('Load error', err);
        toast.error('Load failed', err.message || '');
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadForm = async () => {
      if (!selectedBank) {
        setForm({ name: '', fields: [], documentTypes: [], active: true });
        return;
      }
      try {
        setLoading(true);
        const resp = selectedBank === NEW_LEAD_OPTION
          ? await api.leadForms.getNewLeadForm()
          : await api.leadForms.getByBank(selectedBank);
        const data = resp?.data || null;
        if (data) {
          // Use agentFields (Admin-configured fields for agents) for the selected state
          const rawFields = (data.agentFields || data.fields || []).map(f => ({ ...f, options: (f.options || []).join(',') }));
          
          // Remove excluded fields and duplicate DSA Code fields from loaded form
          const filteredFields = rawFields.filter((f, index, array) => {
            const key = (f.key || '').toLowerCase();
            const label = (f.label || '').toLowerCase();
            
            // Fields to exclude
            // Note: leadname and customername are NOT excluded here because admins may
            // explicitly configure these fields in agentFields for agents to use
            const excludedKeys = [
              'applicantemail', 'applicant_email', 'applicant-email',
              'applicantmobile', 'applicant_mobile', 'applicant-mobile',
              'salary', 'Salary',
              'commissionpercentage', 'commission_percentage', 'commission-percentage', 'commissionpercent', 'commission_percent', 'commission-percent',
              'commissionamount', 'commission_amount', 'commission-amount', 'commissionamt', 'commission_amt', 'commission-amt',
              'commission', 'Commission', 'comission', 'Comission', 'comissionpercentage', 'comissionamount'
            ];
            
            // Check if field key or label matches excluded fields
            if (excludedKeys.some(excluded => key === excluded.toLowerCase() || label.includes(excluded.toLowerCase()))) {
              return false;
            }
            
            // Allow SM/BM and AM/BM fields - they will pass through the filter
            if (label.includes('applicant') && (label.includes('email') || label.includes('mobile'))) {
              return false;
            }
            // Note: Removed check for 'customer name' and 'lead name' - admins can now configure these fields
            if (label.includes('salary')) {
              return false;
            }
            if (label.includes('commission') || key.includes('commission') || 
                label.includes('comission') || key.includes('comission')) {
              return false;
            }
            
            // Remove duplicate DSA Code fields - keep only one
            const isDsaCode = key === 'dsacode' || key === 'dsa_code' || key === 'codeuse' || label.includes('dsa code');
            
            if (isDsaCode) {
              // Prefer 'dsaCode' (camelCase) over 'dsacode' (lowercase)
              const hasDsaCode = array.some(item => item.key === 'dsaCode');
              const hasDsacode = array.some(item => item.key === 'dsacode');
              
              if (hasDsaCode && f.key === 'dsacode') {
                return false; // Remove 'dsacode' if 'dsaCode' exists
              }
              if (hasDsacode && f.key === 'dsaCode') {
                return true; // Keep 'dsaCode' if both exist
              }
              
              // Keep only the first one found
              const firstDsaIndex = array.findIndex((item) => {
                const itemKey = (item.key || '').toLowerCase();
                const itemLabel = (item.label || '').toLowerCase();
                return itemKey === 'dsacode' || itemKey === 'dsa_code' || itemKey === 'codeuse' || itemLabel.includes('dsa code');
              });
              return index === firstDsaIndex;
            }
            
            return true;
          });
          
          setForm({
            ...data,
            fields: enrichFieldsWithCatalog(filteredFields, availableKeys),
            documentTypes: data.documentTypes || [],
            active: data.active,
          });
        } else {
          setForm({ name: '', fields: [], documentTypes: [], active: true });
        }
      } catch (err) {
        console.error('Load form error', err);
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [selectedBank, availableKeys]);

  const handleToggle = (key) => {
    const exists = (form.fields || []).some(f => f.key === key);
    if (exists) {
      setForm(p => ({ ...p, fields: p.fields.filter(f => f.key !== key) }));
    } else {
      const k = (availableKeys || []).find(a => a.key === key) || { key, label: key, type: 'text', required: false, isSearchable: false, description: '', options: '' };
      const toAdd = {
        key: k.key,
        label: k.label || k.key,
        type: k.type || 'text',
        required: !!k.required,
        isSearchable: !!k.isSearchable,
        description: k.description || '',
        options: Array.isArray(k.options) ? k.options.join(',') : (k.options || ''),
        order: (form.fields?.length || 0) + 1,
      };
      setForm(p => ({ ...p, fields: [...(p.fields || []), toAdd] }));
    }
  };

  const handleSetOrder = (key, order) => {
    const num = parseInt(order, 10) || 0;
    setForm(p => ({ ...p, fields: p.fields.map(f => (f.key === key ? { ...f, order: num } : f)) }));
  };

  const handleEditField = (key, patch) => {
    setForm(p => ({ ...p, fields: p.fields.map(f => (f.key === key ? { ...f, ...patch } : f)) }));
  };

  const handleDeleteFieldDef = async (key, label, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isProtectedFieldKey(key)) {
      toast.error('Cannot delete', 'Core system fields cannot be removed.');
      return;
    }
    const confirmed = window.confirm(
      `Delete "${label}" (${key}) from Available Fields?\n\nThis removes it from the global catalog. Click Save Lead Form on each bank if it was already added to agent fields.`
    );
    if (!confirmed) return;
    try {
      setDeletingKey(key);
      await api.fieldDefs.remove(key);
      setAvailableKeys((p) => p.filter((k) => k.key !== key));
      setForm((p) => ({
        ...p,
        fields: (p.fields || []).filter((f) => f.key !== key),
      }));
      toast.success('Deleted', `"${label}" removed from Available Fields`);
    } catch (err) {
      console.error('Delete field error', err);
      toast.error('Delete failed', err.message || '');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleCreateFieldDef = (created) => {
    setAvailableKeys((p) => {
      const next = [...p.filter((x) => x.key !== created.key), created];
      return next.sort((a, b) => (a.key || '').localeCompare(b.key || ''));
    });
    setForm((p) => {
      if ((p.fields || []).some((f) => f.key === created.key)) return p;
      const toAdd = {
        key: created.key,
        label: created.label || created.key,
        type: created.type || 'text',
        required: !!created.required,
        isSearchable: !!created.isSearchable,
        description: created.description || '',
        options: Array.isArray(created.options) ? created.options.join(',') : created.options || '',
        order: (p.fields?.length || 0) + 1,
      };
      return { ...p, fields: [...(p.fields || []), toAdd] };
    });
  };

  const handleSave = async () => {
    if (!selectedBank) return toast.error('Select a bank or New Lead first');
    try {
      setLoading(true);
      
      // Remove excluded fields and duplicate DSA Code fields before saving
      const isNewLeadForm = selectedBank === NEW_LEAD_OPTION;
      const fieldsToSave = (form.fields || []).filter((f, index, array) => {
        const key = (f.key || '').toLowerCase();
        const label = (f.label || '').toLowerCase();

        // For New Lead form: keep all fields admin selected (including Lead Name, customerName)
        if (isNewLeadForm) {
          // Only exclude commission fields for new lead
          const newLeadExcluded = [
            'commissionpercentage', 'commission_percentage', 'commissionamount', 'commission_amount',
            'commission', 'Commission', 'comission', 'Comission'
          ];
          if (newLeadExcluded.some(ex => key.includes(ex) || label.includes(ex))) return false;
          if (label.includes('commission') || key.includes('commission')) return false;
          // Skip duplicate DSA Code handling below - fall through
        } else {
          // For bank forms: exclude system-handled fields
          // Note: leadname and customername are NOT excluded here because admins may
          // explicitly configure these fields in agentFields for agents to use
          const excludedKeys = [
            'applicantemail', 'applicant_email', 'applicant-email',
            'applicantmobile', 'applicant_mobile', 'applicant-mobile',
            'salary', 'Salary',
            'commissionpercentage', 'commission_percentage', 'commission-percentage', 'commissionpercent', 'commission_percent', 'commission-percent',
            'commissionamount', 'commission_amount', 'commission-amount', 'commissionamt', 'commission_amt', 'commission-amt',
            'commission', 'Commission', 'comission', 'Comission', 'comissionpercentage', 'comissionamount'
          ];
          if (excludedKeys.some(excluded => key === excluded.toLowerCase() || label.includes(excluded.toLowerCase()))) {
            return false;
          }
          if (label.includes('applicant') && (label.includes('email') || label.includes('mobile'))) return false;
          // Note: Removed check for 'customer name' and 'lead name' - admins can now configure these fields
          if (label.includes('salary')) return false;
          if (label.includes('commission') || key.includes('commission') || label.includes('comission') || key.includes('comission')) return false;
        }

        // Remove duplicate DSA Code fields - keep only one
        const isDsaCode = key === 'dsacode' || key === 'dsa_code' || key === 'codeuse' || label.includes('dsa code');
        
        if (isDsaCode) {
          // Prefer 'dsaCode' (camelCase) over 'dsacode' (lowercase)
          const hasDsaCode = array.some(item => item.key === 'dsaCode');
          const hasDsacode = array.some(item => item.key === 'dsacode');
          
          if (hasDsaCode && f.key === 'dsacode') {
            return false; // Remove 'dsacode' if 'dsaCode' exists
          }
          if (hasDsacode && f.key === 'dsaCode') {
            return true; // Keep 'dsaCode' if both exist
          }
          
          // Keep only the first one found
          const firstDsaIndex = array.findIndex((item) => {
            const itemKey = (item.key || '').toLowerCase();
            const itemLabel = (item.label || '').toLowerCase();
            return itemKey === 'dsacode' || itemKey === 'dsa_code' || itemKey === 'codeuse' || itemLabel.includes('dsa code');
          });
          return index === firstDsaIndex;
        }
        
        return true;
      });
      
      const agentFieldsPayload = enrichFieldsWithCatalog(fieldsToSave, availableKeys).map((f) => ({
        ...f,
        options: f.options ? f.options.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }));
      const payload = {
        leadType: selectedBank === NEW_LEAD_OPTION ? 'new_lead' : 'bank',
        bank: selectedBank === NEW_LEAD_OPTION ? null : selectedBank,
        name: form.name || (selectedBank === NEW_LEAD_OPTION ? 'New Lead Form' : 'Lead Form'),
        agentFields: agentFieldsPayload, // Fields shown ONLY to Agents
        documentTypes: form.documentTypes || [],
        active: form.active,
      };
      const resp = await api.leadForms.create(payload);
      toast.success('Saved', 'Lead form saved');
      setForm(p => ({ ...p, _id: resp?.data?._id || p._id }));
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      console.error('Save error', err);
      try {
        if (form._id) {
          await api.leadForms.update(form._id, form);
          toast.success('Updated', 'Lead form updated');
          if (typeof onSaved === 'function') onSaved();
        } else {
          toast.error('Save failed', err.message || '');
        }
      } catch (uerr) {
        console.error('Update fallback failed', uerr);
        toast.error('Save failed', uerr.message || '');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1">
        <div className="p-3 border rounded bg-white mb-3">
          <h3 className="font-semibold mb-2">Select Bank / Lead Type</h3>
          <select className="p-2 border rounded w-full" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            <option value="">-- choose bank or New Lead --</option>
            <option value={NEW_LEAD_OPTION}>New Lead</option>
            {banks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <div className="mt-3">
            <label className="block text-sm">Form name</label>
            <input className="p-2 border rounded w-full" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm(p => ({ ...p, active: e.target.checked }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>

        <div className="mb-3">
          <KeyBuilder onCreated={handleCreateFieldDef} />
        </div>
      </div>

      <div className="col-span-2">
        <div className="p-3 border rounded bg-white mb-3">
          <h3 className="font-semibold mb-2">Available Fields</h3>
          <div className="space-y-4 max-h-96 overflow-auto">
            {(() => {
              const filteredCatalog = (availableKeys || []).filter((k, index, array) => {
                const key = (k.key || '').toLowerCase();
                const label = (k.label || '').toLowerCase();

                // Always include basic lead fields (Lead Name, Mobile, Email, Address)
                const includeKeys = ['leadname', 'lead_name', 'lead-name', 'mobile', 'email', 'address'];
                if (includeKeys.includes(key)) return true;

                // Fields to exclude
                // Note: leadname and customername are NOT excluded here because admins may
                // explicitly configure these fields in agentFields for agents to use
                const excludedKeys = [
                  'applicantemail', 'applicant_email', 'applicant-email',
                  'applicantmobile', 'applicant_mobile', 'applicant-mobile',
                  'salary', 'Salary',
                  'commissionpercentage', 'commission_percentage', 'commission-percentage', 'commissionpercent', 'commission_percent', 'commission-percent',
                  'commissionamount', 'commission_amount', 'commission-amount', 'commissionamt', 'commission_amt', 'commission-amt',
                  'commission', 'Commission', 'comission', 'Comission', 'comissionpercentage', 'comissionamount'
                ];
                
                // Check if field key or label matches excluded fields
                if (excludedKeys.some(excluded => key === excluded.toLowerCase() || label.includes(excluded.toLowerCase()))) {
                  return false;
                }
                
                // Allow SM/BM and AM/BM fields - they will pass through the filter
                if (label.includes('applicant') && (label.includes('email') || label.includes('mobile'))) {
                  return false;
                }
                // Note: Removed check for 'customer name' and 'lead name' - admins can now configure these fields
                if (label.includes('salary')) {
                  return false;
                }
                if (label.includes('commission') || key.includes('commission') || 
                    label.includes('comission') || key.includes('comission')) {
                  return false;
                }
                
                // Remove duplicate DSA Code fields - keep only one
                const isDsaCode = key === 'dsacode' || key === 'dsa_code' || key === 'codeuse' || label.includes('dsa code');
                
                if (isDsaCode) {
                  // Check if this field is already selected in the form
                  const isSelected = (form.fields || []).some(f => f.key === k.key);
                  if (isSelected) {
                    return true; // Keep the one that's already selected
                  }
                  
                  // Find the first DSA Code field (prefer camelCase 'dsaCode' over 'dsacode')
                  const firstDsaIndex = array.findIndex((item) => {
                    const itemKey = (item.key || '').toLowerCase();
                    const itemLabel = (item.label || '').toLowerCase();
                    return itemKey === 'dsacode' || itemKey === 'dsa_code' || itemKey === 'codeuse' || itemLabel.includes('dsa code');
                  });
                  
                  // Prefer 'dsaCode' (camelCase) over 'dsacode' (lowercase)
                  if (index === firstDsaIndex) {
                    return true;
                  }
                  
                  // If we have both 'dsaCode' and 'dsacode', keep 'dsaCode'
                  const hasDsaCode = array.some(item => item.key === 'dsaCode');
                  const hasDsacode = array.some(item => item.key === 'dsacode');
                  
                  if (hasDsaCode && k.key === 'dsacode') {
                    return false; // Remove 'dsacode' if 'dsaCode' exists
                  }
                  if (hasDsacode && k.key === 'dsaCode') {
                    return true; // Keep 'dsaCode' if both exist
                  }
                  
                  // Keep only the first one found
                  return index === firstDsaIndex;
                }
                
                return true;
              });

              const catalogKeys = new Set(filteredCatalog.map((k) => k.key));
              const selectedOnly = (form.fields || [])
                .filter((f) => f.key && !catalogKeys.has(f.key))
                .map((f) => ({
                  key: f.key,
                  label: f.label || f.key,
                  type: f.type || 'text',
                  required: !!f.required,
                  isSearchable: !!f.isSearchable,
                  category: 'other',
                  order: f.order || 0,
                }));
              const filtered = [...filteredCatalog, ...selectedOnly];

              const catOrder = { personal: 0, bank: 1, other: 2 };
              const sorted = [...filtered].sort((a, b) => {
                const catA = catOrder[a.category] ?? 2;
                const catB = catOrder[b.category] ?? 2;
                if (catA !== catB) return catA - catB;
                return (a.order || 0) - (b.order || 0) || (a.key || '').localeCompare(b.key || '');
              });
              const byCategory = { personal: [], bank: [], other: [] };
              sorted.forEach(k => {
                const cat = k.category || 'other';
                if (byCategory[cat]) byCategory[cat].push(k);
                else byCategory.other.push(k);
              });
              const sections = [
                { key: 'personal', title: 'Personal Details' },
                { key: 'bank', title: 'Bank Details' },
                { key: 'other', title: 'Other' },
              ];
              return sections.map(sec => {
                const fields = byCategory[sec.key] || [];
                if (fields.length === 0) return null;
                return (
                  <div key={sec.key}>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">{sec.title}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {fields.map(k => (
                        <div key={k.key} className="p-2 border rounded flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={(form.fields || []).some(f => f.key === k.key)}
                            onChange={() => handleToggle(k.key)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{k.label}</div>
                            <div className="text-xs text-gray-500">{k.key} · {k.type}{k.required ? ' · required' : ''}{k.isSearchable ? ' · searchable' : ''}</div>
                          </div>
                          {!isProtectedFieldKey(k.key) && (
                            <button
                              type="button"
                              className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0 disabled:opacity-50"
                              title="Delete from Available Fields"
                              disabled={deletingKey === k.key}
                              onClick={(e) => handleDeleteFieldDef(k.key, k.label, e)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="p-3 border rounded bg-white">
          <h3 className="font-semibold mb-2">Agent Fields (selected)</h3>
          <p className="text-xs text-gray-500 mb-2">These fields apply ONLY to Agents. RM/Admin/Others see all available fields.</p>
          <div className="space-y-2">
            {(form.fields || []).sort((a,b) => (a.order || 0) - (b.order || 0)).map(f => (
              <div key={f.key} className="p-2 border rounded flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{f.label} <span className="text-xs text-gray-400">({f.key})</span></div>
                  <div className="text-xs text-gray-500">{f.type}{f.required ? ' · required' : ''}</div>
                  <div className="text-xs text-gray-500">{f.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input className="p-1 border rounded w-16" value={f.order || ''} onChange={(e) => handleSetOrder(f.key, e.target.value)} />
                  <button type="button" className="px-2 py-1 border rounded" onClick={() => {
                    // quick edit: toggle required
                    handleEditField(f.key, { required: !f.required });
                  }}>{f.required ? 'Req' : 'Opt'}</button>
                  <button type="button" className="px-2 py-1 border rounded text-red-600" onClick={() => handleToggle(f.key)}>Remove</button>
                </div>
              </div>
            ))}
            {(form.fields || []).length === 0 && <div className="text-sm text-gray-500">No fields selected</div>}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-3 py-1 bg-primary-900 text-white rounded" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Lead Form'}
            </button>
            <button className="px-3 py-1 border rounded" onClick={() => { setForm({ name: '', fields: [], documentTypes: [], active: true }); setSelectedBank(''); }}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


