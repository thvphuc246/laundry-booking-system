import { useTranslation } from 'react-i18next'
import type { Me, Run } from '../types'
import { ApartmentPicker } from './ApartmentPicker'
import { CheckIcon, InfoIcon } from './icons'

const STEPS = ['signIn', 'apartment', 'approval'] as const

export function AccessCard({ me, run, onDone }: { me: Me; run: Run; onDone: () => void }) {
  const { t } = useTranslation()
  const current = me.status === 'pending' ? 2 : 1
  const stepClass = (i: number) =>
    i < current ? 'step done' : i === current ? 'step current' : 'step'

  return (
    <section className="card access" aria-label={t('steps.label')}>
      <ol className="steps">
        {STEPS.map((key, i) => (
          <li key={key} className={stepClass(i)} aria-current={i === current ? 'step' : undefined}>
            <span className="step-mark">{i < current ? <CheckIcon /> : i + 1}</span>
            <span>{t(`steps.${key}`)}</span>
          </li>
        ))}
      </ol>
      <p className={`notice ${me.status}`}>
        <InfoIcon />
        {t(`status.${me.status}`, { apartment: me.apartment })}
      </p>
      {me.status !== 'pending' && <ApartmentPicker run={run} onDone={onDone} />}
    </section>
  )
}
