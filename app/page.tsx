import styles from "./page.module.css";

const NEXT_STEPS = [
  "Intégrer WebLLM (issue #4)",
  "Modèle PNJ et état simulation (issue #3)",
  "Grille 2D et interactions (issues #2, #6)",
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>ETNA · Sprint 168H</p>
        <h1>Animal Talking</h1>
        <p className={styles.lead}>
          POC de dialogues PNJ générés par un LLM local dans le navigateur.
          Grille 2D minimale, état client en mémoire, sans backend.
        </p>

        <section className={styles.status} aria-label="Statut du projet">
          <h2>Statut</h2>
          <p>
            Squelette Next.js + TypeScript initialisé. Prochaines étapes :
          </p>
          <ul>
            {NEXT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>

        <section className={styles.stack} aria-label="Stack technique">
          <h2>Stack cible</h2>
          <dl>
            <div>
              <dt>Framework</dt>
              <dd>Next.js + TypeScript</dd>
            </div>
            <div>
              <dt>LLM</dt>
              <dd>WebLLM · Qwen2.5-3B-Instruct-q4f16_1-MLC</dd>
            </div>
            <div>
              <dt>Rendu</dt>
              <dd>Three.js ou Canvas 2D</dd>
            </div>
            <div>
              <dt>État</dt>
              <dd>Zustand ou React Context</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
