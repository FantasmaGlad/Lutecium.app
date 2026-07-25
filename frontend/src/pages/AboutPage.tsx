import './AboutPage.css'

export function AboutPage() {
  return (
    <div className="about-page">
      <h1 className="about-page__title">À propos</h1>

      <div className="about-page__prose">
        <p>Lutecium vient de Lutèce, la ville de Paris, et de « cium », comme un minerai.</p>

        <p>
          Je souhaitais une alternative aux sites de téléchargement de vidéo saturés de pubs, de liens
          redirecteurs douteux et de paywalls.
        </p>

        <p>
          Un outil simple et honnête, où tu colles un lien et récupères ton fichier en qualité maximale (ou
          moins si tu regardes tes vidéos sur un Kidizoom), sans détour et sans rien payer.
        </p>

        <p>
          Lutecium, c'est aussi mon projet self-hosté de bout en bout — API, base de données, interface,
          déploiement — pour apprendre à le faire tourner en vrai, et pour offrir enfin un service sur
          lequel on peut compter.
        </p>

        <p>
          L'esprit du projet et l'interface s'inspirent de{' '}
          <a href="https://cobalt.tools" target="_blank" rel="noopener noreferrer">
            Cobalt Tools
          </a>{' '}
          : simple, rapide, sans détour.
        </p>

        <p>Dédicace à Baamix, la mascotte de mon site, mon hamster :)</p>

        <p>Celle qui m'a donné envie de me lancer dans le développement il y a deux ans, le 19/09/2024.</p>
      </div>

      <section className="about-page__section">
        <h2 className="about-page__heading">Confidentialité</h2>
        <p>
          Aucun tracking, aucune pub. La base de données ne sert qu'à te proposer un historique de tes
          téléchargements et à limiter les abus (bots, usage excessif du mode invité) — rien n'est revendu
          ni partagé. Les fichiers téléchargés sont supprimés automatiquement 5 minutes après la fin du
          traitement.
        </p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">Code source</h2>
        <p>
          Le code source sera bientôt publié. Lutecium s'inscrit dans une démarche de libre accès : après
          avoir profité d'innombrables outils open source pour construire ce projet, il est temps de rendre
          la pareille à cette communauté.
        </p>
        <p>Une API est prévue pour les sites ou scripts qui voudraient utiliser Lutecium de façon automatisée.</p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">Contact</h2>
        <p>
          Une question, un bug, une suggestion ? Écris-moi :{' '}
          <a href="mailto:clement.barillot3901@gmail.com">clement.barillot3901@gmail.com</a>
        </p>
      </section>
    </div>
  )
}
