import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Password field with show/hide toggle. Appends right padding for the eye control.
 * Optional `leftSlot` for icons (e.g. Login lock) — use `pl-*` on the input when used.
 */
export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  disabled,
  className = '',
  leftSlot,
  'aria-invalid': ariaInvalid,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {leftSlot}
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={`${className} pr-10`.trim()}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
      </button>
    </div>
  )
}
