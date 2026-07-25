import { AnimatePresence, motion } from 'framer-motion'
import { useToast } from '../lib/ToastContext'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './Toasts.css'

export function Toasts() {
  const { toasts, dismissToast } = useToast()
  const { t } = useLanguage()

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toasts__item toasts__item--${toast.kind}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            role="status"
          >
            <span>{toast.message}</span>
            <button type="button" aria-label={t.toasts.close} onClick={() => dismissToast(toast.id)}>
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
