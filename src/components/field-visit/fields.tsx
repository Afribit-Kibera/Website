'use client'

import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CURRENCIES,
  NEVER,
  UNKNOWN,
  localToday,
  weekOptions,
  type Answers,
  type Field,
} from '@/lib/field-visit'

export const inputClass =
  'w-full rounded-2xl border border-border-soft bg-bg-surface/80 px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bitcoin disabled:opacity-50'

const optionClass = (selected: boolean) =>
  cn(
    'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base transition-colors',
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bitcoin',
    selected
      ? 'border-bitcoin/70 bg-bitcoin/10 text-foreground'
      : 'border-border-soft bg-bg-surface/60 text-text-soft hover:border-border-strong hover:bg-bg-elevated',
  )

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type FieldProps = {
  field: Field
  answers: Answers
  error?: string
  onChange: (id: string, value: string | string[]) => void
}

function describedBy(field: Field, error?: string) {
  return [field.hint && `${field.id}-hint`, error && `${field.id}-error`].filter(Boolean).join(' ') || undefined
}

function Hint({ field }: { field: Field }) {
  return field.hint ? <p id={`${field.id}-hint`} className="text-sm leading-6 text-muted-foreground">{field.hint}</p> : null
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-red-400">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {error}
    </p>
  )
}

const labelClass = 'block text-base font-medium leading-7 text-foreground sm:text-lg'

function RadioCards({ name, options, value, onSelect, describedById, columns }: {
  name: string
  options: { value: string; label: string }[]
  value: unknown
  onSelect: (value: string) => void
  describedById?: string
  columns: string
}) {
  return (
    <div className={cn('grid gap-2.5', columns)}>
      {options.map(option => {
        const selected = value === option.value
        return (
          <label key={option.value} className={optionClass(selected)}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onSelect(option.value)}
              aria-describedby={describedById}
              className="sr-only"
            />
            <span
              className={cn('grid size-5 shrink-0 place-items-center rounded-full border', selected ? 'border-bitcoin bg-bitcoin text-black' : 'border-border-strong')}
              aria-hidden="true"
            >
              {selected && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span>{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function NotSureToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'shrink-0 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin',
        active ? 'border-bitcoin/70 bg-bitcoin/10 text-bitcoin-light' : 'border-border-soft text-muted-foreground hover:border-border-strong hover:text-foreground',
      )}
    >
      Not sure
    </button>
  )
}

export function FieldInput({ field, answers, error, onChange }: FieldProps) {
  const value = answers[field.id]
  const text = typeof value === 'string' ? value : ''
  const invalid = !!error
  const aria = describedBy(field, error)
  const common = { id: field.id, name: field.id, 'aria-invalid': invalid || undefined, 'aria-describedby': aria }

  switch (field.kind) {
    case 'text':
      return (
        <div className="space-y-2.5">
          <label htmlFor={field.id} className={labelClass}>{field.label}</label>
          <Hint field={field} />
          <input {...common} type="text" value={text} maxLength={field.maxLength} placeholder={field.placeholder}
            autoComplete={field.autoComplete ?? 'off'} onChange={event => onChange(field.id, event.target.value)}
            className={cn(inputClass, invalid && 'border-red-500')} />
          <ErrorText id={field.id} error={error} />
        </div>
      )

    case 'textarea':
      return (
        <div className="space-y-2.5">
          <label htmlFor={field.id} className={labelClass}>
            {field.label}{field.optional && <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>}
          </label>
          <Hint field={field} />
          <textarea {...common} rows={5} value={text} maxLength={field.maxLength} placeholder={field.placeholder}
            onChange={event => onChange(field.id, event.target.value)}
            className={cn(inputClass, 'min-h-36 resize-y', invalid && 'border-red-500')} />
          <div className="flex items-start justify-between gap-3">
            <ErrorText id={field.id} error={error} />
            <span className="ml-auto text-xs text-text-faint" aria-hidden="true">{text.length}/{field.maxLength}</span>
          </div>
        </div>
      )

    case 'date':
      return (
        <div className="space-y-2.5">
          <label htmlFor={field.id} className={labelClass}>{field.label}</label>
          <Hint field={field} />
          <input {...common} type="date" value={text} min="2015-01-01" max={localToday()}
            onChange={event => onChange(field.id, event.target.value)}
            className={cn(inputClass, 'scheme-dark', invalid && 'border-red-500')} />
          <ErrorText id={field.id} error={error} />
        </div>
      )

    case 'currency':
      return (
        <div className="space-y-2.5">
          <label htmlFor={field.id} className={labelClass}>{field.label}</label>
          <Hint field={field} />
          <select {...common} value={text} onChange={event => onChange(field.id, event.target.value)}
            className={cn(inputClass, 'scheme-dark', invalid && 'border-red-500')}>
            <option value="" disabled>Choose a currency</option>
            {CURRENCIES.map(currency => <option key={currency.value} value={currency.value}>{currency.label}</option>)}
          </select>
          <ErrorText id={field.id} error={error} />
        </div>
      )

    case 'choice':
      return (
        <fieldset className="space-y-3" aria-describedby={aria}>
          <legend className={cn(labelClass, 'mb-3')}>{field.label}</legend>
          <Hint field={field} />
          <RadioCards name={field.id} options={field.options} value={value} onSelect={next => onChange(field.id, next)} describedById={aria} columns={field.options.length === 3 ? 'grid-cols-1 min-[420px]:grid-cols-3' : 'grid-cols-2'} />
          <ErrorText id={field.id} error={error} />
        </fieldset>
      )

    case 'week': {
      const options = weekOptions(typeof answers.visitDate === 'string' ? answers.visitDate : '')
      return (
        <fieldset className="space-y-3" aria-describedby={aria}>
          <legend className={cn(labelClass, 'mb-1')}>{field.label}</legend>
          <Hint field={field} />
          <RadioCards name={field.id} value={value} describedById={aria} columns="grid-cols-1 sm:grid-cols-2"
            options={options.map((option, index) => ({ ...option, label: index === 0 ? `${option.label} (last week)` : option.label }))}
            onSelect={next => onChange(field.id, next)} />
          <ErrorText id={field.id} error={error} />
        </fieldset>
      )
    }

    case 'count':
    case 'money': {
      const notSure = value === UNKNOWN
      const currency = field.kind === 'money' ? answers[field.currencyFrom] : undefined
      return (
        <div className="space-y-2.5">
          <label htmlFor={field.id} className={labelClass}>{field.label}</label>
          <Hint field={field} />
          <div className="flex gap-2.5">
            <div className="relative min-w-0 flex-1">
              {currency && !notSure && (
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-muted-foreground" aria-hidden="true">
                  {currency === 'SATS' ? 'sats' : String(currency)}
                </span>
              )}
              <input {...common} type="text" inputMode={field.kind === 'money' ? 'decimal' : 'numeric'} autoComplete="off"
                value={notSure ? '' : text} disabled={notSure} placeholder={notSure ? 'Not sure' : '0'}
                onChange={event => onChange(field.id, event.target.value)}
                className={cn(inputClass, 'tabular-nums', currency && !notSure && 'pl-16', invalid && 'border-red-500')} />
            </div>
            <NotSureToggle active={notSure} onToggle={() => onChange(field.id, notSure ? '' : UNKNOWN)} />
          </div>
          <ErrorText id={field.id} error={error} />
        </div>
      )
    }

    case 'monthYear': {
      const never = value === NEVER
      const [year = '', month = ''] = !never && text ? text.split('-') : []
      const thisYear = Number(localToday().slice(0, 4))
      const years = Array.from({ length: thisYear - 2014 }, (_, index) => String(thisYear - index))
      // A half-chosen date is kept (e.g. "2024-") so the other select stays filled; validation asks for both.
      const update = (nextYear: string, nextMonth: string) => onChange(field.id, nextYear || nextMonth ? `${nextYear}-${nextMonth}` : '')
      return (
        <fieldset className="space-y-3" aria-describedby={aria}>
          <legend className={cn(labelClass, 'mb-3')}>{field.label}</legend>
          <Hint field={field} />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5">
            <select id={field.id} aria-label="Month" value={month} disabled={never} aria-invalid={invalid || undefined}
              onChange={event => update(year, event.target.value)} className={cn(inputClass, 'scheme-dark px-3', invalid && 'border-red-500')}>
              <option value="">Month</option>
              {MONTHS.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}
            </select>
            <select aria-label="Year" value={year} disabled={never} aria-invalid={invalid || undefined}
              onChange={event => update(event.target.value, month)} className={cn(inputClass, 'scheme-dark px-3', invalid && 'border-red-500')}>
              <option value="">Year</option>
              {years.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" aria-pressed={never} onClick={() => onChange(field.id, never ? '' : NEVER)}
              className={cn('rounded-2xl border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin',
                never ? 'border-bitcoin/70 bg-bitcoin/10 text-bitcoin-light' : 'border-border-soft text-muted-foreground hover:border-border-strong hover:text-foreground')}>
              Never
            </button>
          </div>
          <ErrorText id={field.id} error={error} />
        </fieldset>
      )
    }

    case 'ranked': {
      const ranked = Array.isArray(value) ? value : []
      const toggle = (option: string) => {
        if (ranked.includes(option)) onChange(field.id, ranked.filter(item => item !== option))
        else if (ranked.length < field.max) onChange(field.id, [...ranked, option])
      }
      return (
        <fieldset className="space-y-3" aria-describedby={aria}>
          <legend className={cn(labelClass, 'mb-1')}>{field.label}</legend>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {ranked.length === 0 ? 'Tap the most common first.' : ranked.length < field.max ? `${ranked.length} of ${field.max} chosen. Tap again to remove.` : `All ${field.max} chosen. Tap one to remove it.`}
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {field.options.map(option => {
              const rank = ranked.indexOf(option.value) + 1
              const full = !rank && ranked.length >= field.max
              return (
                <button key={option.value} type="button" aria-pressed={rank > 0} disabled={full} onClick={() => toggle(option.value)}
                  aria-label={rank ? `${option.label}, number ${rank}` : option.label}
                  className={cn(optionClass(rank > 0), 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin disabled:cursor-not-allowed disabled:opacity-40')}>
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border text-sm font-bold tabular-nums',
                    rank ? 'border-bitcoin bg-bitcoin text-black' : 'border-border-strong text-transparent')} aria-hidden="true">
                    {rank || '·'}
                  </span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
          <ErrorText id={field.id} error={error} />
        </fieldset>
      )
    }
  }
}
