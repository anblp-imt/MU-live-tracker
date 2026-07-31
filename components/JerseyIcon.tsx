import styles from './JerseyIcon.module.css';

// Static back-view jersey artwork (public/jersey-back.png, transparent background,
// pre-cropped to its silhouette) with the squad number overlaid as text — the squad
// number differs per player so it can't be baked into the shared image.
export function JerseyIcon({ jersey }: { jersey: number | null }) {
  return (
    <div className={styles.wrap}>
      <img className={styles.shirt} src="/jersey-back.png" alt="" aria-hidden="true" />
      <span
        className={jersey === null ? `${styles.number} ${styles.noNumber}` : styles.number}
        {...(jersey === null
          ? { title: 'Squad number not yet confirmed', 'aria-label': 'Squad number not yet confirmed' }
          : {})}
      >
        {jersey === null ? '–' : jersey}
      </span>
    </div>
  );
}
