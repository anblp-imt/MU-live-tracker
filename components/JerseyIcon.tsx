import styles from './JerseyIcon.module.css';

// A flat-illustration jersey evoking the 1998-99 Umbro home kit (the Treble-winning
// shirt): set-in sleeves, a white V-neck collar with black piping, white cuffs with
// black piping, and a diagonal white shoulder-seam piping line. No club crest — that's
// a trademarked graphic this component deliberately doesn't reproduce. The body outline
// uses --mu-white (not a darker red) so it reads clearly against the red fill, and the
// silhouette is a single polygon with no concave notch at the underarm — an earlier
// version had a gap there that exposed the page background as an unwanted dark wedge.
export function JerseyIcon({ jersey }: { jersey: number | null }) {
  return (
    <div className={styles.wrap}>
      <svg className={styles.shirt} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M29,19 L14,26 L9,40 L21,46 L29,46 L29,92 L71,92 L71,46 L79,46 L91,40 L86,26 L71,19 Z"
          fill="#DA291C" stroke="#EDE6D6" strokeWidth="1.6" strokeLinejoin="round"
        />
        <path d="M29,19 L21,46" stroke="#EDE6D6" strokeWidth="1.1" opacity="0.9" />
        <path d="M71,19 L79,46" stroke="#EDE6D6" strokeWidth="1.1" opacity="0.9" />
        <path
          d="M36,17 L45,22 L50,29 L55,22 L64,17 L64,21 L56,29 L50,36 L44,29 L36,21 Z"
          fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1.3" strokeLinejoin="round"
        />
        <path d="M9,40 L21,46 L19.5,49.5 L7.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1" />
        <path d="M91,40 L79,46 L80.5,49.5 L92.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" strokeWidth="1" />
      </svg>
      <span className={jersey === null ? `${styles.number} ${styles.noNumber}` : styles.number}>
        {jersey === null ? '–' : jersey}
      </span>
    </div>
  );
}
