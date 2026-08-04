import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  const name = process.env.COPYRIGHT_NAME || '';
  const facebookUrl = process.env.SOCIAL_FACEBOOK_URL || '';
  const linkedinUrl = process.env.SOCIAL_LINKEDIN_URL || '';
  const tiktokUrl = process.env.SOCIAL_TIKTOK_URL || '';

  return (
    <footer className={styles.footer}>
      <p className={styles.copyright}>© {year}{name && ` ${name}`}. All rights reserved.</p>
      <nav className={styles.social}>
        {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>}
        {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
        {tiktokUrl && <a href={tiktokUrl} target="_blank" rel="noopener noreferrer">TikTok</a>}
      </nav>
    </footer>
  );
}
