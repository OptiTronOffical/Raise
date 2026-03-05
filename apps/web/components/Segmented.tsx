"use client";

interface SegmentedProps {
  a: string;
  b: string;
  value: 'a' | 'b';
  onChange: (value: 'a' | 'b') => void;
  disabled?: boolean;
}

export function Segmented({ a, b, value, onChange, disabled = false }: SegmentedProps) {
  return (
    <div className={`segmented ${disabled ? 'disabled' : ''}`}>
      <button
        className={value === 'a' ? 'active' : ''}
        onClick={() => onChange('a')}
        disabled={disabled}
        aria-pressed={value === 'a'}
      >
        {a}
      </button>
      <button
        className={value === 'b' ? 'active' : ''}
        onClick={() => onChange('b')}
        disabled={disabled}
        aria-pressed={value === 'b'}
      >
        {b}
      </button>

      <style jsx>{`
        .segmented {
          display: flex;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 4px;
          gap: 4px;
        }

        .segmented button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .segmented button.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .segmented button:not(.active):hover {
          background: rgba(255,255,255,0.5);
        }

        .segmented.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .segmented.disabled button {
          cursor: not-allowed;
        }

        .segmented button:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}