import { useState } from 'react';

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('videointel_disclaimer_dismissed') === 'true'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('videointel_disclaimer_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="disclaimer-banner">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <span>
          <strong>DISCLAIMER:</strong> This tool is for educational and informational purposes only.
          Not intended for UK audiences. This does not constitute financial advice. Capital at risk.
          Please refer to the FCA's guidelines at{' '}
          <a href="https://www.fca.org.uk" target="_blank" rel="noopener noreferrer">
            fca.org.uk
          </a>{' '}
          before making any financial decisions.
        </span>
        <button className="disclaimer-close" onClick={handleDismiss} aria-label="Dismiss disclaimer">
          &times;
        </button>
      </div>
    </div>
  );
}
