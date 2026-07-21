from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de données (§8 ; migration future PostgreSQL via changement de DATABASE_URL)
    database_url: str = "sqlite+aiosqlite:///./data/lutecium.db"

    # Clé de signature des sessions et des liens de téléchargement (S-04, F-24)
    secret_key: str = "change-me-in-production"

    # Cookie de session Secure (S-04) — désactivable en dev local sur http
    secure_cookies: bool = True

    # Quotas et limites (§6) — défauts codés en dur, overrides runtime via la table settings (P2-08)
    user_daily_quota_gb: float = 20
    guest_download_limit: int = 1
    max_file_size_gb: float = 8
    global_downloads_cap_gb: float = 15
    max_concurrent_downloads: int = 2
    max_queue_size: int = 20
    file_ttl_minutes: int = 5
    session_days: int = 30
    analyze_rate_limit_per_minute: int = 10

    # Répertoire de stockage des fichiers temporaires (ignoré par git)
    downloads_dir: str = "./data/downloads"

    # Bootstrap du compte admin (A-01) : si renseignés et qu'aucun admin n'existe encore,
    # un compte admin est créé au démarrage. Normalement posés par le script d'installation
    # interactif (P5-02) ; laissés vides par défaut (jamais d'identifiants par défaut).
    admin_pseudo: str | None = None
    admin_password: str | None = None


settings = Settings()
