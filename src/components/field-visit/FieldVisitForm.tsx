'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type ReactNode } from 'react'
import Image from 'next/image'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, ClipboardCheck, Loader2, Pencil, Repeat, RotateCcw, Send, X } from 'lucide-react'
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
const KEPT_ON_PHONE = 'Your answers are kept on this phone until you send them.'

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

/* ---------- Full-screen shell ---------- */

// Moving to the next question with the phone keyboard can land behind a bar,
// or behind the keyboard itself; bring the focused question back into view.
function keepFocusedInView(event: FocusEvent<HTMLDivElement>) {
  const target = event.target
  if (!(target instanceof HTMLElement) || target.closest('header, [data-action-bar]') || target.tabIndex < 0) return
  const reveal = () => {
    if (document.activeElement !== target) return
    const rect = target.getBoundingClientRect()
    const viewport = window.visualViewport
    const visibleBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 88
    // Instant, because the site's smooth scrolling can be interrupted by typing.
    if (rect.bottom > visibleBottom || rect.top < 80) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  }
  requestAnimationFrame(reveal)
  // Check again once the phone keyboard has finished opening.
  window.setTimeout(reveal, 350)
}

// Top and bottom bars are fixed to the viewport (the site clips sideways overflow
// on html and body, which stops sticky positioning), so the content is padded to match.
function Shell({ top, children, actions, withProgress = false }: { top: ReactNode; children: ReactNode; actions?: ReactNode; withProgress?: boolean }) {
  return (
    <div data-field-visit onFocus={keepFocusedInView} className={cn(
      'flex min-h-dvh flex-col overflow-x-clip bg-bg-base',
      withProgress ? 'pt-[calc(4.375rem+env(safe-area-inset-top))]' : 'pt-[calc(3.5rem+env(safe-area-inset-top))]',
      actions && 'pb-[calc(4.5rem+1px+env(safe-area-inset-bottom))]',
    )}>
      {top}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-8 pt-7 sm:pt-10">{children}</div>
      {actions && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-soft bg-bg-base pb-[env(safe-area-inset-bottom)]" data-action-bar>
          <div className="mx-auto flex h-18 w-full max-w-xl items-center gap-3 px-5">{actions}</div>
        </div>
      )}
    </div>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <Image src="/Logo/Full logo png transparent.png" alt="" width={28} height={28} className="size-7 object-contain" priority />
      <span className="font-display text-base font-semibold tracking-tight text-foreground">Afribit</span>
    </span>
  )
}

const headingClass = 'font-display font-bold text-foreground outline-none focus-visible:outline-none'

export function FieldVisitForm({ initialType }: { initialType: FieldVisitType | null }) {
  // Drafts live in browser storage, so the form renders only in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!mounted) {
    return (
      <Shell top={<TopBar />}>
        <div aria-busy="true" aria-label="Loading">
          <div className="h-8 w-2/3 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
          <div className="mt-8 h-32 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
          <div className="mt-3 h-32 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
        </div>
      </Shell>
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
  const pendingFocus = useRef<string | null>(null)
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY

  // Each page heading carries its key. After moving on, the view returns to the
  // top and focus moves to the new heading so keyboard and screen reader users
  // follow along; with the slide animation the heading mounts slightly later.
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
    window.scrollTo({ top: 0, behavior: 'auto' })
    const heading = document.querySelector<HTMLElement>(`[data-screen="${CSS.escape(screenKey)}"]`)
    if (heading) heading.focus({ preventScroll: true })
    else pendingFocus.current = screenKey
  }, [screenKey])

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
    setSubmitted(null)
    setErrors({})
    setReturnToReview(false)
    setTypeInUrl(null)
  }

  /* ---------- Sent ---------- */
  if (submitted) {
    return (
      <Shell top={<TopBar />}>
        <div className="my-auto py-10 text-center">
          <CheckCircle className="mx-auto size-16 text-panafrican-green" aria-hidden="true" />
          <h1 ref={headingRef} data-screen={screenKey} tabIndex={-1} className={cn(headingClass, 'pt-6 text-3xl')}>
            Questionnaire sent
          </h1>
          <p className="pt-3 text-base leading-7 text-muted-foreground">
            Thank you. The Afribit team has received this {FORMS[submitted.type].title.toLowerCase()} questionnaire.
          </p>
          <p className="pt-5 text-sm text-text-faint">
            Reference <span className="font-mono text-text-soft">{submitted.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <div className="mt-10 flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => choose(submitted.type)}>
              <Repeat className="size-4" aria-hidden="true" />
              Start another visit
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={backToChooser}>
              Back to start
            </Button>
          </div>
        </div>
      </Shell>
    )
  }

  /* ---------- Choose a questionnaire ---------- */
  if (!session) {
    return (
      <Shell top={<TopBar />}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin/90">Geyser Impact Fund · Circular Grants</p>
        <h1 ref={headingRef} data-screen={screenKey} tabIndex={-1} className={cn(headingClass, 'pt-3 text-3xl leading-tight sm:text-4xl')}>
          Field visit questionnaire
        </h1>
        <p className="pt-3 text-base leading-7 text-muted-foreground">
          Answer together with the business owner. Estimates are fine, and you can choose &ldquo;Not sure&rdquo; for any figure.
        </p>

        <h2 className="pt-9 text-sm font-semibold text-text-soft">Which visit is this?</h2>
        <div className="mt-3 grid gap-3">
          {(Object.keys(FORMS) as FieldVisitType[]).map(type => {
            const draft = readDraft(type)
            return (
              <button key={type} type="button" onClick={() => choose(type)}
                className="group flex flex-col gap-3 rounded-3xl border border-border-soft bg-bg-surface/70 p-5 text-left transition-colors hover:border-bitcoin/50 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin active:bg-bg-elevated">
                <span className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-bitcoin/10 text-bitcoin">
                    {type === 'new' ? <ClipboardCheck className="size-5" aria-hidden="true" /> : <Repeat className="size-5" aria-hidden="true" />}
                  </span>
                  <span className="font-display text-lg font-bold leading-snug text-foreground">{FORMS[type].title}</span>
                </span>
                <span className="text-sm leading-6 text-muted-foreground">{FORMS[type].summary}</span>
                <span className="flex items-center justify-between gap-3 border-t border-border-soft pt-3 text-xs font-medium text-text-soft">
                  {draft
                    ? <span className="rounded-full border border-panafrican-green/40 bg-panafrican-green/10 px-2.5 py-1 text-panafrican-green">In progress</span>
                    : <span>About 10 minutes</span>}
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-bitcoin">
                    {draft ? 'Continue' : 'Start'}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-auto pt-10"><p className="text-xs leading-5 text-text-faint">Use one questionnaire per business. {KEPT_ON_PHONE}</p></div>
      </Shell>
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
  const sectionLabel = SECTIONS[sectionIndex]?.label ?? ''

  // Progress is shown per section, without counting pages.
  const segments = SECTIONS.map((section, index) => {
    if (index < sectionIndex) return 1
    if (index > sectionIndex) return 0
    if (section.id === REVIEW) return 1
    const inSection = steps.filter(item => item.section === section.id)
    const position = inSection.findIndex(item => item.id === step?.id)
    return inSection.length ? (position + 1) / inSection.length : 1
  })
  const overall = Math.round((segments.reduce((sum, value) => sum + value, 0) / SECTIONS.length) * 100)

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
      wrapper?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea, button:not([disabled])')?.focus({ preventScroll: true })
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
      setSubmitError(data.error || 'Something went wrong while sending. Your answers are still here, so please try again.')
    } catch {
      setSubmitError('No internet connection. Your answers are kept on this phone, so try again when you are back online.')
    } finally {
      captchaRef.current?.resetCaptcha()
      setCaptchaToken('')
      setSubmitting(false)
    }
  }

  const motionProps = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.2, ease: 'easeOut' as const } }

  const top = (
    <TopBar
      title={FORMS[type].title}
      section={sectionLabel}
      onClose={backToChooser}
      progress={
        <div className="flex h-3.5 items-start gap-1 px-5" role="progressbar" aria-label="Questionnaire progress"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={overall} aria-valuetext={sectionLabel}>
          {segments.map((value, index) => (
            <span key={SECTIONS[index].id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-bitcoin transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value * 100}%` }} />
            </span>
          ))}
        </div>
      }
    />
  )

  const restored = session.restoredAt && (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-panafrican-green/30 bg-panafrican-green/10 p-4 text-sm" role="status">
      <p className="text-text-soft">
        Welcome back. We kept your answers from {new Date(session.restoredAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.
      </p>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={startOver}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Start again
      </Button>
    </div>
  )

  const backButton = (
    <Button type="button" variant="outline" size="lg" className="px-4" onClick={back} disabled={submitting} aria-label="Back">
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Button>
  )

  /* ---------- Question pages ---------- */
  if (step) {
    return (
      <form noValidate onSubmit={event => { event.preventDefault(); next() }} aria-labelledby="field-visit-step-title">
        <Shell top={top} withProgress actions={
          <>
            {backButton}
            <Button type="submit" size="lg" className="flex-1">
              {returnToReview ? 'Save and review' : stepIndex + 1 === steps.length ? 'Review answers' : 'Continue'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </>
        }>
          {restored}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={session.stepId} {...motionProps}>
              <h1 id="field-visit-step-title" ref={headingRef} data-screen={screenKey} tabIndex={-1} className={cn(headingClass, 'text-[1.75rem] leading-tight sm:text-3xl')}>
                {step.title}
              </h1>
              {step.intro && <p className="pt-2 text-base leading-7 text-muted-foreground">{step.intro}</p>}
              <div className="mt-7 space-y-7">
                {visibleFields(step, answers).map(field => (
                  <div key={field.id} data-field={field.id} className="scroll-mt-28 scroll-mb-28">
                    <FieldInput field={field} answers={answers} error={errors[field.id]} onChange={update} />
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </Shell>
      </form>
    )
  }

  /* ---------- Review and send ---------- */
  const blocked = submitting || (!!sitekey && !captchaToken)
  return (
    <Shell top={top} withProgress actions={
      <>
        {backButton}
        <Button type="button" size="lg" className="flex-1" onClick={submit} disabled={blocked} aria-disabled={blocked}>
          {submitting ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {submitting ? 'Sending...' : 'Send questionnaire'}
        </Button>
      </>
    }>
      {restored}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={REVIEW} {...motionProps}>
          <h1 id="field-visit-step-title" ref={headingRef} data-screen={screenKey} tabIndex={-1} className={cn(headingClass, 'text-[1.75rem] leading-tight sm:text-3xl')}>
            Check and send
          </h1>
          <p className="pt-2 text-base leading-7 text-muted-foreground">Read through the answers with the business owner, then send.</p>

          <div className="mt-7 space-y-6">
            {SECTIONS.filter(section => section.id !== REVIEW).map(section => {
              const sectionSteps = steps.filter(item => item.section === section.id)
              if (!sectionSteps.length) return null
              return (
                <section key={section.id} aria-labelledby={`review-${section.id}`}>
                  <h2 id={`review-${section.id}`} className="pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin/90">{section.label}</h2>
                  <div className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-bg-surface/50">
                    {sectionSteps.map(item => (
                      <div key={item.id} className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                          <button type="button" onClick={() => { setReturnToReview(true); goTo(item.id) }}
                            className="-mr-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-bitcoin hover:bg-bitcoin/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin"
                            aria-label={`Edit ${item.title}`}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </button>
                        </div>
                        <dl className="space-y-2.5 text-sm">
                          {visibleFields(item, answers).map(field => (
                            <div key={field.id} className="grid gap-0.5">
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
            <div className="mt-8">
              <p className="pb-3 text-sm text-text-soft">Tick the box below, then send.</p>
              <div className="min-h-36">
                <HCaptcha ref={captchaRef} sitekey={sitekey} size="compact" theme="dark"
                  onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')}
                  onError={() => { setCaptchaToken(''); setSubmitError('The check box could not load. Check your internet connection and try again.') }} />
              </div>
            </div>
          )}

          {submitError && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" aria-hidden="true" />
              <p className="text-sm text-foreground">{submitError}</p>
            </div>
          )}
          <p className="pt-6 text-xs leading-5 text-text-faint">{KEPT_ON_PHONE}</p>
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}

function TopBar({ title, section, onClose, progress }: { title?: string; section?: string; onClose?: () => void; progress?: ReactNode }) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border-soft bg-bg-base pt-[env(safe-area-inset-top)]">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-5">
          {title ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              {section && <p className="truncate text-xs font-medium text-bitcoin">{section}</p>}
            </div>
          ) : <Brand />}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close questionnaire. Your answers are kept."
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin">
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {progress}
      </div>
    </header>
  )
}
