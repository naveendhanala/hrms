import { useState, useEffect, useRef } from 'react';
import { getDirectory } from '../../api/users';

interface Employee { id: number; name: string; designation: string; role: string; }

interface Props {
  value: string;          // comma-separated names
  onChange: (value: string) => void;
}

export default function EmployeeMultiSelect({ value, onChange }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected: string[] = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    getDirectory().then(setEmployees).catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name];
    onChange(next.join(', '));
  };

  const remove = (name: string) => {
    onChange(selected.filter((n) => n !== name).join(', '));
  };

  const filtered = employees.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                className="hover:text-indigo-900 font-bold leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger input */}
      <input
        type="text"
        placeholder={selected.length === 0 ? 'Search and select employees…' : 'Add more…'}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No employees found</p>
          ) : (
            filtered.map((emp) => {
              const checked = selected.includes(emp.name);
              return (
                <label
                  key={emp.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-indigo-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(emp.name)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-900">{emp.name}</span>
                  {emp.designation && (
                    <span className="text-xs text-gray-400 ml-auto">{emp.designation}</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
