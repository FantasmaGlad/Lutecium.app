import { getLanguage } from './language'
import { fr, en } from './i18n/translations'

const ASKED_KEY = 'lutecium:notif-asked'
const dictionaries = { fr, en }

/** Permission demandée au bon moment (1er job mis en file), pas à l'arrivée sur le site (UI §5.1). */
export function requestNotificationPermissionOnce(): void {
  if (!('Notification' in window)) return
  if (sessionStorage.getItem(ASKED_KEY)) return
  sessionStorage.setItem(ASKED_KEY, '1')
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

export function notifyDownloadReady(title: string): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  const t = dictionaries[getLanguage()]
  const notification = new Notification(t.done.readyStatus, { body: title, tag: 'lutecium-ready' })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
