import { Link } from 'react-router-dom'
import './GuestInvite.css'

export function GuestInvite() {
  return (
    <div className="guest-invite">
      <p className="guest-invite__message">
        Inscris-toi pour continuer à télécharger gratuitement tes vidéos ! :)
      </p>
      <div className="guest-invite__actions">
        <Link to="/register" className="guest-invite__button guest-invite__button--primary">
          Créer un compte
        </Link>
        <Link to="/login" className="guest-invite__button">
          Se connecter
        </Link>
      </div>
    </div>
  )
}
