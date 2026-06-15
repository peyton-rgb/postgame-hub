import styles from "./FutureOpportunities.module.css";
import { OPPORTUNITIES } from "@/data/opportunities";

interface FutureOpportunitiesProps {
  /** Brand name for the intro line. Falls back to "your brand" if missing. */
  brandName?: string | null;
}

export default function FutureOpportunities({ brandName }: FutureOpportunitiesProps) {
  const who = brandName && brandName.trim() ? brandName.trim() : "your brand";

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.headline}>Future Opportunities To Consider</h2>
        <p className={styles.intro}>
          Ways <span className={styles.brand}>{who}</span> can activate around the moments on the
          calendar below — each one a lane Postgame runs end-to-end.
        </p>

        <div className={styles.grid}>
          {OPPORTUNITIES.map((o) => (
            <div key={o.title} className={styles.card}>
              <h3 className={styles.cardTitle}>
                {o.title}
                {o.isNew && <span className={styles.pill}>New</span>}
              </h3>
              <p className={styles.cardBlurb}>{o.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
