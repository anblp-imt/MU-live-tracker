import styles from './JerseyIcon.module.css';

// Static back-view jersey artwork (public/jersey-back.png and public/jersey-gk.png,
// both transparent background, pre-cropped to their silhouette) with the squad number
// overlaid as text — the squad number differs per player so it can't be baked into the
// shared image. Goalkeepers get the green goalkeeper kit instead of the red outfield one.
export function JerseyIcon({ jersey, isGoalkeeper }: { jersey: number | null; isGoalkeeper?: boolean }) {
  return (
    <div className={styles.wrap}>
      <img className={styles.shirt} src={isGoalkeeper ? '/jersey-gk.png' : '/jersey-back.png'} alt="" aria-hidden="true" />
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
