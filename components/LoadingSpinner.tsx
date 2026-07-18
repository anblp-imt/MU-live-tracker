import styles from './LoadingSpinner.module.css';

// Original devil-head + trident mark (same hand-drawn shapes as app/icon.svg), spun as a
// loading indicator — deliberately not Manchester United's actual crest/mascot artwork.
export function LoadingSpinner() {
  return (
    <div role="status" aria-label="Loading" className={styles.wrap}>
      <svg viewBox="0 0 32 32" className={styles.spin} width="72" height="72">
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="#C9A227" strokeWidth="1.2" />
        <g fill="#DA291C">
          <path d="M11 10 L13.2 5 L14.3 10 Z" />
          <path d="M21 10 L18.8 5 L17.7 10 Z" />
          <path d="M16 6.5c-3 0-5 2.2-5 5s2 4.8 5 4.8 5-2.1 5-4.8-2-5-5-5Z" />
        </g>
        <circle cx="14.1" cy="11.2" r="0.9" fill="#0d0d0d" />
        <circle cx="17.9" cy="11.2" r="0.9" fill="#0d0d0d" />
        <g stroke="#DA291C" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1="16" y1="26.5" x2="16" y2="19.5" />
          <line x1="10.5" y1="21" x2="21.5" y2="21" />
          <line x1="16" y1="19.5" x2="16" y2="16" />
          <path d="M10.5 21 L9.5 17" />
          <path d="M21.5 21 L22.5 17" />
        </g>
      </svg>
    </div>
  );
}
