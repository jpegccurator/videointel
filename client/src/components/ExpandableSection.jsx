import { useState } from 'react';

export default function ExpandableSection({ title, defaultOpen = true, children, count }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="section">
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '12px 0',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          marginBottom: open ? 16 : 0,
          userSelect: 'none',
        }}
      >
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {count !== undefined && (
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                fontFamily: 'sans-serif',
              }}
            >
              ({count})
            </span>
          )}
        </h3>
        <span
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          &#9662;
        </span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
