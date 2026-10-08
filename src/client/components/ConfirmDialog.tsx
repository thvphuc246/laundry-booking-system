import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

type Tone = 'primary' | 'danger'
type Ask = (message: string, confirmLabel: string, tone?: Tone) => Promise<boolean>

const ConfirmContext = createContext<Ask>(() => Promise.resolve(false))

export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const titleId = useId()
  const messageId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const settle = useRef<(ok: boolean) => void>(undefined)
  const [text, setText] = useState({ message: '', confirmLabel: '', tone: 'danger' as Tone })

  const ask = useCallback<Ask>((message, confirmLabel, tone = 'danger') => {
    settle.current?.(false)
    setText({ message, confirmLabel, tone })
    const el = dialog.current
    if (!el) return Promise.resolve(false)
    el.returnValue = ''
    el.showModal()
    return new Promise((resolve) => {
      settle.current = resolve
    })
  }, [])

  const onClose = () => {
    settle.current?.(dialog.current?.returnValue === 'confirm')
    settle.current = undefined
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        className="confirm"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClose={onClose}
      >
        <form method="dialog">
          <h2 id={titleId} className="confirm-title">
            {t('appName')}
          </h2>
          <p id={messageId} className="confirm-message">
            {text.message}
          </p>
          <div className="confirm-actions">
            <button type="submit" value="dismiss" className="btn secondary">
              {t('confirm.dismiss')}
            </button>
            <button
              type="submit"
              value="confirm"
              className={text.tone === 'danger' ? 'btn danger' : 'btn'}
            >
              {text.confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </ConfirmContext.Provider>
  )
}
