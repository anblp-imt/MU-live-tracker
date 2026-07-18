import styles from './PageHeading.module.css';

// [React] Shared by Today, Schedule, and Standings (Task 9) — a plain reusable
// component rather than copy-pasting the same rule+kicker markup three times.
export function PageHeading({ title }: { title: string }) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <h1>{title}</h1>
      <div className={styles.rule} />
      <p className={styles.kicker}>Matchday Programme · {date}</p>
    </>
  );
}
