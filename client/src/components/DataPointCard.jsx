import VerificationBadge from './VerificationBadge';
import MiniChart from './MiniChart';

const CATEGORY_CLASS = {
  macroeconomic: 'tag-macro',
  crypto: 'tag-crypto',
  equities: 'tag-equities',
  commodities: 'tag-commodities',
  geopolitical: 'tag-geopolitical',
  technology: 'tag-technology',
  other: 'tag-other',
};

export default function DataPointCard({ dataPoint }) {
  const { metric, value, claim, category, context, period, verification } = dataPoint;
  const v = verification || {};
  const catClass = CATEGORY_CLASS[category] || 'tag-other';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          {metric}
        </span>
        <span className={`tag ${catClass}`} style={{ fontSize: '0.7rem' }}>
          {category}
        </span>
      </div>

      {/* Claimed value */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {period && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ({period})
          </span>
        )}
        <VerificationBadge status={v.verified || 'false'} />
      </div>

      {/* Verification details */}
      {v.verified === 'true' && v.matchesClaim && (
        <div style={{ fontSize: '0.85rem', color: 'var(--verified)' }}>
          Matches claim.{' '}
          {v.sourceName && v.sourceUrl ? (
            <span>
              Source:{' '}
              <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
                {v.sourceName}
              </a>
            </span>
          ) : v.sourceName ? (
            <span>Source: {v.sourceName}</span>
          ) : null}
        </div>
      )}

      {v.verified === 'partial' && (
        <div style={{ fontSize: '0.85rem', color: '#8A6900' }}>
          Claimed <strong>{value}</strong> but source shows <strong>{v.actualValue}</strong>.{' '}
          {v.sourceName && v.sourceUrl ? (
            <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
              {v.sourceName}
            </a>
          ) : v.sourceName ? (
            <span>Source: {v.sourceName}</span>
          ) : null}
        </div>
      )}

      {v.verified === 'true' && !v.matchesClaim && (
        <div style={{ fontSize: '0.85rem', color: '#8A6900' }}>
          Verified with note: {v.verificationNote}{' '}
          {v.sourceName && v.sourceUrl ? (
            <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
              {v.sourceName}
            </a>
          ) : null}
        </div>
      )}

      {v.verified === 'false' && (
        <div style={{ fontSize: '0.85rem', color: 'var(--unverified)' }}>
          {v.verificationNote || 'Could not verify this claim.'}
        </div>
      )}

      {/* Chart */}
      {v.chartData && <MiniChart data={v.chartData} />}

      {/* Context */}
      {context && (
        <div
          style={{
            fontSize: '0.85rem',
            fontStyle: 'italic',
            color: 'var(--text-secondary)',
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
            lineHeight: 1.5,
          }}
        >
          &ldquo;{context}&rdquo;
        </div>
      )}
    </div>
  );
}
