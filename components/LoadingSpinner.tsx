import styles from './LoadingSpinner.module.css';

export function LoadingSpinner() {
  return (
    <div role="status" aria-label="Loading" className={styles.wrap}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative spinner, next/image's overhead isn't needed here */}
      <img src="/reddevils-logo-transparent.png" alt="" width={96} height={96} className={styles.spin} />
    </div>
  );
}
