export default function VerificationBadge({ status, size = 'normal' }) {
  const isSmall = size === 'small';

  const styles = {
    true: {
      bg: 'var(--verified-bg)',
      color: 'var(--verified)',
      border: 'var(--verified)',
      label: 'Verified',
      icon: '\u2713',
    },
    partial: {
      bg: 'var(--warning-bg)',
      color: '#8A6900',
      border: 'var(--warning)',
      label: 'Partially Verified',
      icon: '~',
    },
    false: {
      bg: 'var(--unverified-bg)',
      color: 'var(--unverified)',
      border: 'var(--unverified)',
      label: 'Unverified',
      icon: '\u2717',
    },
  };

  const s = styles[status] || styles['false'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '2px 8px' : '4px 12px',
        fontSize: isSmall ? '0.75rem' : '0.85rem',
        fontWeight: 600,
        borderRadius: '20px',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 700 }}>{s.icon}</span>
      {s.label}
    </span>
  );
}
