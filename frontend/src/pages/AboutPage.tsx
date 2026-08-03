import { useLanguage } from '../lib/i18n/LanguageContext'
import './AboutPage.css'

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="about-page">
      <h1 className="about-page__title">{t.about.title}</h1>

      <div className="about-page__prose">
        <p>{t.about.p1}</p>

        <p>{t.about.p2}</p>

        <p>{t.about.p3}</p>

        <p>{t.about.p4}</p>

        <p>
          {t.about.p5Prefix}{' '}
          <a href="https://cobalt.tools" target="_blank" rel="noopener noreferrer">
            Cobalt Tools
          </a>
          {t.about.p5Suffix}
        </p>

        <p>{t.about.p6}</p>

        <p>{t.about.p7}</p>
      </div>

      <section className="about-page__section">
        <h2 className="about-page__heading">{t.about.privacyHeading}</h2>
        <p>{t.about.privacy}</p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">{t.about.sourceHeading}</h2>
        <p>
          {t.about.sourcePrefix}{' '}
          <a href="https://github.com/FantasmaGlad/Lutecium.app" target="_blank" rel="noopener noreferrer">
            {t.about.sourceLinkLabel}
          </a>
          {t.about.sourceSuffix}
        </p>
        <p>{t.about.api}</p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">{t.about.licenseHeading}</h2>
        <p>
          {t.about.license}{' '}
          <a
            href="https://github.com/FantasmaGlad/Lutecium.app/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.about.licenseLinkLabel}
          </a>
          .
        </p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">{t.about.contactHeading}</h2>
        <p>
          {t.about.contactPrefix} <a href="mailto:clement.barillot3901@gmail.com">clement.barillot3901@gmail.com</a>
        </p>
      </section>
    </div>
  )
}
