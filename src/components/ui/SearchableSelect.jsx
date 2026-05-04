import { useState, useRef, useEffect } from 'react';

/**
 * A searchable dropdown that renders options as a floating list.
 * Props:
 *   options: [{ value, label, sub? }]
 *   value: currently selected value
 *   onChange: (value) => void
 *   placeholder: string
 *   disabled: bool
 *   id: string
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search and select…',
  disabled = false,
  id,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(o => !o);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`form-input text-left flex items-center justify-between gap-2 ${
          disabled ? 'bg-slate-50 cursor-not-allowed' : 'cursor-pointer'
        } ${!selected ? 'text-slate-400' : 'text-slate-900'}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && !disabled && (
            <span
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg animate-slide-up overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Options */}
          <ul className="max-h-52 overflow-y-auto scrollbar-thin py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 text-center">No results</li>
            ) : (
              filtered.map(opt => (
                <li
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${
                    opt.value === value ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <div>{opt.label}</div>
                  {opt.sub && <div className="text-xs text-slate-400">{opt.sub}</div>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
