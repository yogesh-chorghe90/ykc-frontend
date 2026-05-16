import { useState } from 'react';
import api from '../services/api';
import { toast } from '../services/toastService';
import { suggestFieldKeyFromLabel } from '../utils/leadFormFieldUtils';

const defaultState = { key: '', label: '', type: 'text', required: false, isSearchable: false, description: '', options: '' };

export default function KeyBuilder({ onCreated }) {
  const [state, setState] = useState(defaultState);
  const [loading, setLoading] = useState(false);

  const handleChange = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setState((p) => ({ ...p, [k]: val }));
  };

  const handleLabelBlur = () => {
    if (state.key?.trim() || !state.label?.trim()) return;
    setState((p) => ({ ...p, key: suggestFieldKeyFromLabel(p.label) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.label?.trim()) return toast.error('Label is required');
    const normalizedKey =
      String(state.key || suggestFieldKeyFromLabel(state.label))
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    if (!normalizedKey) return toast.error('Key is required (use a unique key, e.g. asm_email)');
    if (normalizedKey === 'email' || normalizedKey === 'mobile') {
      toast.error(
        'Use a unique key',
        'Keys "email" and "mobile" are already used for generic fields. Try asm_email, sm_bm_email, asm_mobile, etc.'
      );
      return;
    }
    const payload = {
      key: normalizedKey,
      label: state.label.trim(),
      type: state.type,
      required: !!state.required,
      isSearchable: !!state.isSearchable,
      options: state.options ? state.options.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    try {
      setLoading(true);
      const resp = await api.fieldDefs.create(payload);
      const created = resp?.data;
      if (created) {
        if (resp?.message?.includes('already exists')) {
          toast.success('Updated', `Field "${created.label}" (${created.key}) is ready to use`);
        } else {
          toast.success('Created', 'Field definition created');
        }
        setState(defaultState);
        if (typeof onCreated === 'function') onCreated(created);
      }
    } catch (err) {
      console.error('Key create error', err);
      toast.error('Create failed', err.message || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="p-3 border rounded bg-white" onSubmit={handleSubmit}>
      <h3 className="font-semibold mb-2">Create Field</h3>
      <p className="text-xs text-gray-500 mb-2">
        Use a unique key per field (e.g. <code className="text-gray-700">asm_email</code>,{' '}
        <code className="text-gray-700">sm_bm_mobile</code>). Do not reuse <code className="text-gray-700">email</code> or{' '}
        <code className="text-gray-700">mobile</code>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="p-2 border rounded"
          placeholder="key (e.g. asm_email)"
          value={state.key}
          onChange={handleChange('key')}
        />
        <input
          className="p-2 border rounded"
          placeholder="label (e.g. ASM Email)"
          value={state.label}
          onChange={handleChange('label')}
          onBlur={handleLabelBlur}
        />
        <select className="p-2 border rounded" value={state.type} onChange={handleChange('type')}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="select">Select</option>
          <option value="textarea">Textarea</option>
          <option value="email">Email</option>
          <option value="tel">Phone</option>
          <option value="file">File</option>
        </select>
        <input className="p-2 border rounded" placeholder="description" value={state.description} onChange={handleChange('description')} />
        <input className="p-2 border rounded col-span-2" placeholder="options (comma separated, for select)" value={state.options} onChange={handleChange('options')} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.required} onChange={handleChange('required')} />
          <span className="text-sm">Required</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.isSearchable} onChange={handleChange('isSearchable')} />
          <span className="text-sm">Searchable</span>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="px-3 py-1 bg-primary-900 text-white rounded" disabled={loading}>
          {loading ? 'Creating...' : 'Create Field'}
        </button>
        <button type="button" className="px-3 py-1 border rounded" onClick={() => setState(defaultState)} disabled={loading}>
          Reset
        </button>
      </div>
    </form>
  );
}
 

