'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle, ClipboardCheck, Loader2, Pencil, Repeat, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReducedMotionPreference } from '@/lib/use-reduced-motion'
import {
  FORMS,
  SECTIONS,
  activeSteps,
  fieldTitle,
  formatAnswer,
  initialAnswers,
  lastCompletedWeek,
  validateSteps,
  validateSubmission,
  visibleFields,
  weekOptions,
  type Answers,
  type FieldVisitType,
} from '@/lib/field-visit'
import { FieldInput } from './fields'

const REVIEW = 'review'
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000
const draftKey = (type: FieldVisitType) => `afribit:field-visit:v1:${type}`

type Session = { type: FieldVisitType; answers: Answers; stepId: string; restoredAt?: number }

// Drafts keep answers on the device so a dropped connection or closed tab
// does not lose a visit. Storage can be unavailable, so every access is guarded.
function readDraft(type: FieldVisitType): { answers: Answers; stepId: string; savedAt: number } | null {
  try {
    const draft: unknown = JSON.parse(localStorage.getItem(draftKey(type)) ?? 'null')
    if (!draft || typeof draft !== 'object' || !('answers' in draft) || !('stepId' in draft) || !('savedAt' in draft)) return null
    const { answers, stepId, savedAt } = draft
    if (!answers || typeof answers !== 'object' || typeof stepId !== 'string' || typeof savedAt !== 'number') return null
    if (Date.now() - savedAt > DRAFT_MAX_AGE) return null
    return { answers: answers as Answers, stepId, savedAt }
  } catch {
    return null
  }
}

function writeDraft(session: Session) {
  try {
    localStorage.setItem(draftKey(session.type), JSON.stringify({ answers: session.answers, stepId: session.stepId, savedAt: Date.now() }))
  } catch { /* Storage is optional. */ }
}

function clearDraft(type: FieldVisitType) {
  try { localStorage.removeItem(draftKey(type)) } catch { /* Storage is optional. */ }
}

function startSession(type: FieldVisitType, useDraft = true): Session {
  const draft = useDraft ? readDraft(type) : null
  if (draft) return { type, answers: { ...initialAnswers(type), ...draft.answers }, stepId: draft.stepId, restoredAt: draft.savedAt }
  return { type, answers: initialAnswers(type), stepId: FORMS[type].steps[0].id }
}

function setTypeInUrl(type: FieldVisitType | null) {
  const url = new URL(window.location.href)
  if (type) url.searchParams.set('type', type)
  else url.searchParams.delete('type')
  window.history.replaceState(window.history.state, '', url)
}

const noopSubscribe = () => () => {}

export function FieldVisitForm({ initialType }: { initialType: FieldVisitType | null }) {
  // Drafts live in browser storage, so the form renders only in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!mounted) {
    return (
      <div className="section-panel p-6 sm:p-8" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        <div className="mt-5 h-8 w-2/3 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
          <div className="h-36 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
        </div>
      </div>
    )
  }
  return <Wizard initialType={initialType} />
}

function Wizard({ initialType }: { initialType: FieldVisitType | null }) {
  const reducedMotion = useReducedMotionPreference()
  const [session, setSession] = useState<Session | null>(() => (initialType ? startSession(initialType) : null))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [website, setWebsite] = useState('')
  const [submitted, setSubmitted] = useState<{ id: string; type: FieldVisitType } | null>(null)
  const captchaRef = useRef<HCaptcha>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY

  // Each screen heading carries its screen key. After navigation, focus moves to
  // the new heading so keyboard and screen reader users follow along; with the
  // slide animation that heading mounts slightly later, so the ref finishes the job.
  const screenKey = submitted ? 'done' : session ? `${session.type}:${session.stepId}` : 'choose'
  const lastScreen = useRef(screenKey)
  const headingRef = (node: HTMLHeadingElement | null) => {
    if (node && pendingFocus.current === node.dataset.screen) {
      pendingFocus.current = null
      node.focus({ preventScroll: true })
    }
  }
  useEffect(() => {
    if (lastScreen.current === screenKey) return
    lastScreen.current = screenKey
    topRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
    const heading = topRef.current?.querySelector<HTMLElement>(`[data-screen="${CSS.escape(screenKey)}"]`)
    if (heading) heading.focus({ preventScroll: true })
    else pendingFocus.current = screenKey
  }, [screenKey, reducedMotion])

  const commit = (next: Session) => {
    setSession(next)
    writeDraft(next)
  }

  const choose = (type: FieldVisitType) => {
    setSubmitted(null)
    setErrors({})
    setSubmitError('')
    setSession(startSession(type))
    setTypeInUrl(type)
  }

  const backToChooser = () => {
    setSession(null)
    setErrors({})
    setReturnToReview(false)
    setTypeInUrl(null)
  }

  if (submitted) {
    return (
      <div ref={topRef} className="section-panel scroll-mt-24 p-6 text-center sm:p-10">
        <CheckCircle className="mx-auto size-14 text-panafrican-green" aria-hidden="true" />
        <h2 ref={headingRef} data-screen={screenKey} tabIndex={-1} className="mt-5 font-display text-3xl font-bold text-foreground outline-none focus-visible:outline-none">
          Questionnaire submitted
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
          Thank you. The Afribit team has received this {FORMS[submitted.type].title.toLowerCase()} questionnaire.
        </p>
        <p className="mt-4 text-sm text-text-faint">
          Reference <span className="font-mono text-text-soft">{submitted.id.slice(0, 8).toUpperCase()}</span>
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => choose(submitted.type)}>
            <Repeat className="size-4" aria-hidden="true" />
            Fill in another
          </Button>
          <Button size="lg" variant="outline" onClick={() => { setSubmitted(null); backToChooser() }}>
            Choose a different form
          </Button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div ref={topRef} className="section-panel scroll-mt-24 p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin/90">Start here</p>
        <h2 ref={headingRef} data-screen={screenKey} tabIndex={-1} className="mt-3 font-display text-2xl font-bold text-foreground outline-none focus-visible:outline-none sm:text-3xl">
          Which visit is this?
        </h2>
        <p className="mt-2 text-base leading-7 text-muted-foreground">Use one questionnaire per business.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {(Object.keys(FORMS) as FieldVisitType[]).map(type => {
            const draft = readDraft(type)
            const screens = activeSteps(type, initialAnswers(type)).length + 1
            return (
              <button key={type} type="button" onClick={() => choose(type)}
                className="group flex flex-col items-start gap-3 rounded-3xl border border-border-soft bg-bg-surface/70 p-5 text-left transition-colors hover:border-bitcoin/50 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin sm:p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-bitcoin/10 text-bitcoin">
                  {type === 'new' ? <ClipboardCheck className="size-5" aria-hidden="true" /> : <Repeat className="size-5" aria-hidden="true" />}
                </span>
                <span className="font-display text-xl font-bold text-foreground">{FORMS[type].title}</span>
                <span className="text-sm leading-6 text-muted-foreground">{FORMS[type].summary}</span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs font-medium text-text-soft">
                  <span>About 10 minutes · {screens} short screens</span>
                  {draft && <span className="rounded-full border border-panafrican-green/40 bg-panafrican-green/10 px-2.5 py-1 text-panafrican-green">Unsent answers saved</span>}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-bitcoin">
                  {draft ? 'Continue' : 'Start'}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const { type, answers } = session
  const steps = activeSteps(type, answers)
  const onReview = session.stepId === REVIEW
  const foundIndex = steps.findIndex(step => step.id === session.stepId)
  const stepIndex = onReview ? steps.length : Math.max(foundIndex, 0)
  const step = onReview ? null : steps[stepIndex]
  const currentSection = step?.section ?? REVIEW
  const sectionIndex = SECTIONS.findIndex(section => section.id === currentSection)
  const total = steps.length + 1
  const progress = ((stepIndex + 1) / total) * 100

  const update = (id: string, value: string | string[]) => {
    const nextAnswers = { ...answers, [id]: value }
    if (id === 'visitDate' && typeof value === 'string') {
      const current = typeof answers.reportingWeek === 'string' ? answers.reportingWeek : ''
      if (!weekOptions(value).some(option => option.value === current)) nextAnswers.reportingWeek = lastCompletedWeek(value)
    }
    if (errors[id]) setErrors(current => {
      const rest = { ...current }
      delete rest[id]
      return rest
    })
    commit({ ...session, answers: nextAnswers })
  }

  const goTo = (stepId: string) => {
    setErrors({})
    setSubmitError('')
    commit({ ...session, stepId, restoredAt: undefined })
  }

  const focusField = (id: string) => {
    requestAnimationFrame(() => {
      const wrapper = document.querySelector<HTMLElement>(`[data-field="${id}"]`)
      wrapper?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea, button:not([disabled])')?.focus()
      wrapper?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
    })
  }

  const next = () => {
    if (!step) return
    const result = validateSteps([step], answers)
    const invalid = Object.keys(result.errors)
    if (invalid.length) {
      setErrors(result.errors)
      focusField(invalid[0])
      return
    }
    if (returnToReview) {
      setReturnToReview(false)
      goTo(REVIEW)
      return
    }
    goTo(steps[stepIndex + 1]?.id ?? REVIEW)
  }

  const back = () => {
    setReturnToReview(false)
    if (stepIndex > 0) goTo(steps[stepIndex - 1].id)
    else backToChooser()
  }

  const startOver = () => {
    clearDraft(type)
    setErrors({})
    setReturnToReview(false)
    setSession(startSession(type, false))
  }

  const showStepErrors = (stepErrors: Record<string, string>) => {
    const target = steps.find(item => visibleFields(item, answers).some(field => stepErrors[field.id]))
    if (!target) return false
    setReturnToReview(true)
    commit({ ...session, stepId: target.id, restoredAt: undefined })
    setErrors(stepErrors)
    return true
  }

  const submit = async () => {
    setSubmitError('')
    const result = validateSubmission(type, answers)
    if (showStepErrors(result.errors)) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/field-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, answers, website, captchaToken }),
      })
      const payload: unknown = await response.json().catch(() => null)
      const data = (payload && typeof payload === 'object' ? payload : {}) as { success?: boolean; error?: string; errors?: Record<string, string>; data?: { id?: string } }
      if (response.ok && data.success) {
        clearDraft(type)
        setTypeInUrl(type)
        setSubmitted({ id: data.data?.id ?? '', type })
        setSession(null)
        return
      }
      if (data.errors && showStepErrors(data.errors)) return
      setSubmitError(data.error || 'Something went wrong. Your answers are saved on this device; please try again.')
    } catch {
      setSubmitError('No connection. Your answers are saved on this device; please try again when you are back online.')
    } finally {
      captchaRef.current?.resetCaptcha()
      setCaptchaToken('')
      setSubmitting(false)
    }
  }

  const motionProps = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.22, ease: 'easeOut' as const } }

  return (
    <div ref={topRef} className="section-panel scroll-mt-24 p-5 sm:p-8">
      {/* Progress */}
      <div className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-medium">
          <span className="font-semibold uppercase tracking-[0.16em] text-bitcoin/90">{FORMS[type].title}</span>
          <span className="tabular-nums text-muted-foreground">Screen {stepIndex + 1} of {total}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label="Questionnaire progress"
          aria-valuemin={1} aria-valuemax={total} aria-valuenow={stepIndex + 1}>
          <div className="h-full rounded-full bg-bitcoin transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Sections">
          {SECTIONS.map((section, index) => {
            const done = index < sectionIndex
            const current = index === sectionIndex
            return (
              <li key={section.id} aria-current={current ? 'step' : undefined}
                className={cn('flex items-center gap-1.5', current ? 'font-semibold text-foreground' : done ? 'text-panafrican-green' : 'text-text-faint')}>
                {done ? <Check className="size-3.5" aria-hidden="true" /> : <span className={cn('size-1.5 rounded-full', current ? 'bg-bitcoin' : 'bg-current')} aria-hidden="true" />}
                {section.label}
              </li>
            )
          })}
        </ol>
      </div>

      {session.restoredAt && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-panafrican-green/30 bg-panafrican-green/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="text-text-soft">
            We restored your unsent answers from {new Date(session.restoredAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={startOver}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Start over
          </Button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={session.stepId} {...motionProps}>
          {step ? (
            <form noValidate onSubmit={event => { event.preventDefault(); next() }} aria-labelledby="field-visit-step-title">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {SECTIONS[sectionIndex]?.label}
              </p>
              <h2 id="field-visit-step-title" ref={headingRef} data-screen={screenKey} tabIndex={-1} className="mt-2 font-display text-2xl font-bold text-foreground outline-none focus-visible:outline-none sm:text-3xl">
                {step.title}
              </h2>
              {step.intro && <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">{step.intro}</p>}

              <div className="mt-7 space-y-7">
                {visibleFields(step, answers).map(field => (
                  <div key={field.id} data-field={field.id}>
                    <FieldInput field={field} answers={answers} error={errors[field.id]} onChange={update} />
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-col-reverse gap-3 border-t border-border-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" size="lg" onClick={back}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button type="submit" size="lg" className="sm:min-w-44">
                  {returnToReview ? 'Save and review' : stepIndex + 1 === steps.length ? 'Review answers' : 'Continue'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Review</p>
              <h2 id="field-visit-step-title" ref={headingRef} data-screen={screenKey} tabIndex={-1} className="mt-2 font-display text-2xl font-bold text-foreground outline-none focus-visible:outline-none sm:text-3xl">
                Check and send
              </h2>
              <p className="mt-2 text-base leading-7 text-muted-foreground">Read through the answers with the business owner, then send.</p>

              <div className="mt-7 space-y-6">
                {SECTIONS.filter(section => section.id !== REVIEW).map(section => {
                  const sectionSteps = steps.filter(item => item.section === section.id)
                  if (!sectionSteps.length) return null
                  return (
                    <section key={section.id} aria-labelledby={`review-${section.id}`}>
                      <h3 id={`review-${section.id}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin/90">{section.label}</h3>
                      <div className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-bg-surface/50">
                        {sectionSteps.map(item => (
                          <div key={item.id} className="p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                              <button type="button" onClick={() => { setReturnToReview(true); goTo(item.id) }}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-bitcoin hover:bg-bitcoin/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin"
                                aria-label={`Edit ${item.title}`}>
                                <Pencil className="size-3.5" aria-hidden="true" />
                                Edit
                              </button>
                            </div>
                            <dl className="space-y-2 text-sm">
                              {visibleFields(item, answers).map(field => (
                                <div key={field.id} className="grid gap-0.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                                  <dt className="text-muted-foreground">{fieldTitle(field)}</dt>
                                  <dd className="whitespace-pre-line break-words text-text-soft">{formatAnswer(field, answers[field.id], answers)}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>

              <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
                <label htmlFor="field-visit-website">Website</label>
                <input id="field-visit-website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
              </div>

              {sitekey && (
                <div className="mt-7 min-h-36">
                  <HCaptcha ref={captchaRef} sitekey={sitekey} size="compact" theme="dark"
                    onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')}
                    onError={() => { setCaptchaToken(''); setSubmitError('Verification could not load. Check your connection and try again.') }} />
                </div>
              )}

              {submitError && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" aria-hidden="true" />
                  <p className="text-sm text-foreground">{submitError}</p>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" size="lg" onClick={back} disabled={submitting}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button type="button" size="lg" className="sm:min-w-44" onClick={submit}
                  disabled={submitting || (!!sitekey && !captchaToken)} aria-disabled={submitting || (!!sitekey && !captchaToken)}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  {submitting ? 'Sending...' : 'Send questionnaire'}
                </Button>
              </div>
              <p className="mt-4 text-xs leading-5 text-text-faint">Answers stay saved on this device until they are sent.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
