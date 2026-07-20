from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de données (§8 ; migration future PostgreSQL via changement de DATABASE_URL)
    database_url: str = "sqlite+aiosqlite:///./data/lutecium.db"

    # Clé de signature des sessions et des liens de téléchargement (S-04, F-24)
    secret_key: str = "change-me-in-production"

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


settings = Settings()
