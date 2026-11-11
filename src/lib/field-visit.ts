import { z } from 'zod'

// Shared definition of the field visit questionnaire. The browser and the API
// both validate against these fields, so a question only needs to change here.

export const FIELD_VISIT_FORM_VERSION = 1

export type FieldVisitType = 'new' | 'follow-up'
export type Answers = Record<string, string | string[] | undefined>
export type SectionId = 'visit' | 'business' | 'bitcoin' | 'partner'

export const SECTIONS: { id: SectionId | 'review'; label: string }[] = [
  { id: 'visit', label: 'Visit' },
  { id: 'business', label: 'Business' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'partner', label: 'Field partner' },
  { id: 'review', label: 'Review' },
]

export const UNKNOWN = 'unknown'
export const NEVER = 'never'

export const CURRENCIES = [
  { value: 'KES', label: 'KES - Kenyan shilling' },
  { value: 'UGX', label: 'UGX - Ugandan shilling' },
  { value: 'TZS', label: 'TZS - Tanzanian shilling' },
  { value: 'RWF', label: 'RWF - Rwandan franc' },
  { value: 'ETB', label: 'ETB - Ethiopian birr' },
  { value: 'NGN', label: 'NGN - Nigerian naira' },
  { value: 'GHS', label: 'GHS - Ghanaian cedi' },
  { value: 'ZAR', label: 'ZAR - South African rand' },
  { value: 'ZMW', label: 'ZMW - Zambian kwacha' },
  { value: 'MWK', label: 'MWK - Malawian kwacha' },
  { value: 'USD', label: 'USD - US dollar' },
  { value: 'SATS', label: 'sats - Bitcoin satoshis' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Local cash' },
  { value: 'mobile_money', label: 'Mobile money (e.g. M-Pesa)' },
  { value: 'bank_card', label: 'Bank or card' },
  { value: 'bitcoin', label: 'Bitcoin' },
  { value: 'stablecoins', label: 'Stablecoins' },
  { value: 'other', label: 'Other' },
]

type Option = { value: string; label: string }
type FieldBase = {
  id: string
  label: string
  /** Shorter label for the review screen and email. */
  short?: string
  hint?: string
  optional?: boolean
  showIf?: (answers: Answers) => boolean
}

export type Field =
  | (FieldBase & { kind: 'text'; placeholder?: string; maxLength: number; autoComplete?: string })
  | (FieldBase & { kind: 'textarea'; placeholder?: string; minLength?: number; maxLength: number })
  | (FieldBase & { kind: 'date' })
  | (FieldBase & { kind: 'choice'; options: Option[] })
  | (FieldBase & { kind: 'currency' })
  | (FieldBase & { kind: 'count' })
  | (FieldBase & { kind: 'money'; currencyFrom: string })
  | (FieldBase & { kind: 'monthYear' })
  | (FieldBase & { kind: 'week' })
  | (FieldBase & { kind: 'ranked'; options: Option[]; max: number })

export type Step = {
  id: string
  section: SectionId
  title: string
  intro?: string
  fields: Field[]
}

// ---------- Dates ----------

const isoDate = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate(value: string): Date | null {
  if (!isoDate.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = parseIsoDate(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

/** Today's date in the visitor's own time zone. */
export function localToday(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** Monday of the last fully completed Monday-Sunday week before the visit date. */
export function lastCompletedWeek(visitDate: string) {
  const date = parseIsoDate(visitDate)
  if (!date) return ''
  const sinceMonday = (date.getUTCDay() + 6) % 7
  return addDays(visitDate, -sinceMonday - 7)
}

/** The four most recent completed weeks, newest first. */
export function weekOptions(visitDate: string) {
  const latest = lastCompletedWeek(visitDate)
  if (!latest) return []
  return [0, 1, 2, 3].map(index => {
    const monday = addDays(latest, -7 * index)
    return { value: monday, label: formatWeek(monday) }
  })
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = parseIsoDate(value)
  return date ? date.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' }) : value
}

export function formatWeek(monday: string) {
  return `${formatDate(monday, { day: 'numeric', month: 'short' })} - ${formatDate(addDays(monday, 6))}`
}

// ---------- Questions ----------

const yesNoUnsure = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'unsure', label: 'Unsure' },
]

const acceptingOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'paused', label: 'Paused' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'never', label: 'Never' },
]

const acceptsSomeBitcoin = (answers: Answers) => !!answers.acceptingBitcoin && answers.acceptingBitcoin !== 'never'
const positiveCount = (id: string) => (answers: Answers) => {
  const value = answers[id]
  return typeof value === 'string' && value !== UNKNOWN && Number(value.replace(/[\s,]/g, '')) > 0
}

const visitStep = (followUp: boolean): Step => ({
  id: 'visit',
  section: 'visit',
  title: 'About this visit',
  intro: 'Fill this in with the business owner. It takes about 10 minutes.',
  fields: [
    { id: 'fieldPartner', kind: 'text', label: 'Field Partner (your name or organisation)', short: 'Field Partner', maxLength: 120, autoComplete: 'organization', placeholder: 'e.g. Afribit Kibera' },
    { id: 'visitDate', kind: 'date', label: 'Visit date' },
    ...(followUp
      ? [{
          id: 'followUpStage', kind: 'choice', label: 'Which follow-up is this?', short: 'Follow-up stage',
          options: [{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '9', label: '9 months' }],
        } satisfies Field]
      : []),
  ],
})

const businessStep: Step = {
  id: 'business',
  section: 'visit',
  title: 'The business',
  fields: [
    { id: 'businessName', kind: 'text', label: 'Business or beneficiary name', short: 'Business', maxLength: 160, placeholder: 'e.g. Mama Njeri Groceries' },
    { id: 'location', kind: 'text', label: 'Location', maxLength: 160, autoComplete: 'address-level2', placeholder: 'e.g. Olympic, Kibera, Nairobi' },
    { id: 'respondentName', kind: 'text', label: 'Who are you speaking with?', short: 'Respondent', hint: 'The person answering the questions.', maxLength: 120, autoComplete: 'off', placeholder: 'Full name' },
  ],
}

const reportingStep: Step = {
  id: 'reporting',
  section: 'business',
  title: 'Reporting week',
  intro: 'Sales, costs and Bitcoin payments use the last completed week, Monday to Sunday. Staff and stock use today. Estimates are fine.',
  fields: [
    { id: 'reportingWeek', kind: 'week', label: 'Which week are the figures for?', short: 'Reporting week', hint: 'We picked the last completed week for you.' },
    { id: 'currency', kind: 'currency', label: 'Local currency for the figures', short: 'Currency' },
  ],
}

const teamStep: Step = {
  id: 'team',
  section: 'business',
  title: 'Team today',
  intro: 'Paid employees working here today, not counting the owner.',
  fields: [
    { id: 'employeesFullTime', kind: 'count', label: 'Full-time employees', short: 'Full-time staff' },
    { id: 'employeesPartTime', kind: 'count', label: 'Part-time or casual employees', short: 'Part-time staff' },
  ],
}

const costsHint = 'Goods sold or materials used, plus running costs. Leave out new equipment and household spending.'

const tradingFields: Field[] = [
  { id: 'weeklySales', kind: 'money', currencyFrom: 'currency', label: 'Total sales last week, before expenses', short: 'Sales last week' },
  { id: 'weeklyCosts', kind: 'money', currencyFrom: 'currency', label: "Business costs for last week's sales", short: 'Costs last week', hint: costsHint },
]

const stockField: Field = { id: 'stockValue', kind: 'money', currencyFrom: 'currency', label: 'Stock value today, at purchase cost', short: 'Stock value' }

const bitcoinWeekStep: Step = {
  id: 'bitcoin-week',
  section: 'bitcoin',
  title: 'Bitcoin payments last week',
  fields: [
    { id: 'bitcoinPaymentCount', kind: 'count', label: 'How many Bitcoin payments did customers make?', short: 'Bitcoin payments', showIf: acceptsSomeBitcoin },
    { id: 'bitcoinPaymentValue', kind: 'money', currencyFrom: 'currency', label: 'Total value of those payments', short: 'Bitcoin payment value', showIf: acceptsSomeBitcoin },
  ],
}

const paymentMethodsStep: Step = {
  id: 'payment-methods',
  section: 'bitcoin',
  title: 'How customers pay',
  intro: 'Tap the three most-used ways of receiving payment, starting with the most common.',
  fields: [
    { id: 'paymentMethods', kind: 'ranked', options: PAYMENT_METHODS, max: 3, label: 'Most-used payment methods', short: 'Top payment methods' },
    {
      id: 'paymentMethodOther', kind: 'text', label: 'What is the other payment method?', short: 'Other payment method', maxLength: 120,
      showIf: answers => Array.isArray(answers.paymentMethods) && answers.paymentMethods.includes('other'),
    },
  ],
}

const NEW_STEPS: Step[] = [
  visitStep(false),
  businessStep,
  reportingStep,
  teamStep,
  { id: 'trading', section: 'business', title: "Last week's trading", fields: tradingFields },
  {
    id: 'stock-debt',
    section: 'business',
    title: 'Stock and debt',
    fields: [
      stockField,
      { id: 'hasDebt', kind: 'choice', options: yesNoUnsure, label: 'Is any business loan or supplier debt outstanding?', short: 'Outstanding debt', hint: 'Existing debt is flagged to Geyser for review.' },
    ],
  },
  {
    id: 'bitcoin-acceptance',
    section: 'bitcoin',
    title: 'Bitcoin acceptance',
    fields: [
      { id: 'firstAcceptedBitcoin', kind: 'monthYear', label: 'When did you first accept Bitcoin payments?', short: 'First accepted Bitcoin' },
      { id: 'acceptingBitcoin', kind: 'choice', options: acceptingOptions, label: 'Are you accepting Bitcoin payments now?', short: 'Accepting Bitcoin now' },
      { id: 'bitcoinCourse', kind: 'choice', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], label: 'Have you completed a Bitcoin course?', short: 'Bitcoin course' },
      {
        id: 'bitcoinCourseDetails', kind: 'text', label: 'Which course, and what year?', short: 'Course and year', maxLength: 160,
        placeholder: 'e.g. Afribit Bitcoin Basics, 2025', showIf: answers => answers.bitcoinCourse === 'yes',
      },
    ],
  },
  bitcoinWeekStep,
  paymentMethodsStep,
  {
    id: 'recommendation',
    section: 'partner',
    title: 'Why you back this merchant',
    intro: 'For the Field Partner only.',
    fields: [
      {
        id: 'recommendationReason', kind: 'textarea', minLength: 20, maxLength: 2000,
        label: 'Why are you recommending this merchant for a Circular Grant?', short: 'Recommendation',
        placeholder: 'What you know about them, how they serve the community and what the grant would change.',
      },
    ],
  },
]

const FOLLOW_UP_STEPS: Step[] = [
  visitStep(true),
  businessStep,
  {
    id: 'grant',
    section: 'business',
    title: 'The original grant',
    fields: [
      { id: 'grantCurrency', kind: 'currency', label: 'Grant currency' },
      { id: 'grantAmount', kind: 'money', currencyFrom: 'grantCurrency', label: 'Original grant amount', short: 'Grant amount' },
      { id: 'grantReceivedDate', kind: 'date', label: 'Date the grant was received', short: 'Grant received' },
    ],
  },
  {
    id: 'status',
    section: 'business',
    title: 'How the business is doing',
    fields: [
      {
        id: 'operatingStatus', kind: 'choice', label: 'Is the business operating normally, operating less, or closed?', short: 'Operating status',
        options: [{ value: 'normal', label: 'Normal' }, { value: 'reduced', label: 'Reduced' }, { value: 'closed', label: 'Closed' }],
      },
      {
        id: 'grantHelped', kind: 'choice', label: 'Overall, how much has the grant helped the business?', short: 'Grant helped',
        options: [{ value: 'not_at_all', label: 'Not at all' }, { value: 'a_little', label: 'A little' }, { value: 'quite_a_bit', label: 'Quite a bit' }, { value: 'a_lot', label: 'A lot' }],
      },
    ],
  },
  reportingStep,
  teamStep,
  { id: 'trading', section: 'business', title: 'Trading and stock', fields: [...tradingFields, stockField] },
  {
    id: 'bitcoin-acceptance',
    section: 'bitcoin',
    title: 'Bitcoin acceptance',
    fields: [
      { id: 'acceptingBitcoin', kind: 'choice', options: acceptingOptions, label: 'Are you accepting Bitcoin payments now?', short: 'Accepting Bitcoin now' },
      {
        id: 'pausedReason', kind: 'textarea', maxLength: 1000, label: 'Why did you pause or stop accepting Bitcoin?', short: 'Reason paused or stopped',
        showIf: answers => answers.acceptingBitcoin === 'paused' || answers.acceptingBitcoin === 'stopped',
      },
    ],
  },
  bitcoinWeekStep,
  {
    id: 'suppliers',
    section: 'bitcoin',
    title: 'Paying suppliers in Bitcoin',
    fields: [
      { id: 'supplierCount', kind: 'count', label: 'How many suppliers have you started paying in Bitcoin since the grant?', short: 'Suppliers paid in Bitcoin' },
      { id: 'supplierNames', kind: 'textarea', maxLength: 1000, optional: true, label: 'Supplier names', placeholder: 'One per line', showIf: positiveCount('supplierCount') },
    ],
  },
  paymentMethodsStep,
  {
    id: 'grant-use',
    section: 'partner',
    title: 'Grant use and forwarding',
    intro: 'For the Field Partner. Use Community Fund records; forwarding is voluntary.',
    fields: [
      {
        id: 'grantInUse', kind: 'choice', label: 'Is the improvement funded by the grant being used?', short: 'Funded improvement in use',
        options: [{ value: 'fully', label: 'Fully' }, { value: 'partly', label: 'Partly' }, { value: 'not_yet', label: 'Not yet' }, { value: 'no_longer', label: 'No longer' }],
      },
      { id: 'forwardedCurrency', kind: 'currency', label: 'Forwarding currency' },
      { id: 'forwardedAmount', kind: 'money', currencyFrom: 'forwardedCurrency', label: 'How much of the grant has been voluntarily forwarded so far?', short: 'Amount forwarded' },
    ],
  },
  {
    id: 'adoption',
    section: 'partner',
    title: 'Wider Bitcoin adoption',
    intro: 'Count each merchant once.',
    fields: [
      { id: 'merchantsHelped', kind: 'count', label: 'How many other merchants has this beneficiary helped start accepting Bitcoin since the grant?', short: 'Merchants helped' },
      { id: 'merchantsHelpedNames', kind: 'textarea', maxLength: 1000, label: 'Merchant names', placeholder: 'One per line', showIf: positiveCount('merchantsHelped') },
    ],
  },
]

export const FORMS: Record<FieldVisitType, { title: string; summary: string; steps: Step[] }> = {
  new: {
    title: 'New beneficiary',
    summary: 'Before launch. Records the baseline for a merchant being recommended for a Circular Grant.',
    steps: NEW_STEPS,
  },
  'follow-up': {
    title: 'Beneficiary follow-up',
    summary: 'At 3, 6 and 9 months. Records what has changed since the grant.',
    steps: FOLLOW_UP_STEPS,
  },
}

export function isFieldVisitType(value: unknown): value is FieldVisitType {
  return value === 'new' || value === 'follow-up'
}

export function visibleFields(step: Step, answers: Answers) {
  return step.fields.filter(field => !field.showIf || field.showIf(answers))
}

/** Steps that have at least one question to answer, given the answers so far. */
export function activeSteps(type: FieldVisitType, answers: Answers) {
  return FORMS[type].steps.filter(step => visibleFields(step, answers).length > 0)
}

export function initialAnswers(type: FieldVisitType, today = localToday()): Answers {
  const base: Answers = { visitDate: today, reportingWeek: lastCompletedWeek(today), currency: 'KES', paymentMethods: [] }
  return type === 'follow-up' ? { ...base, grantCurrency: 'KES', forwardedCurrency: 'KES' } : base
}

// ---------- Validation ----------

const cleanNumber = (value: string) => value.replace(/[\s,]/g, '')

function fieldSchema(field: Field, answers: Answers, today: string): z.ZodType {
  const required = 'Please answer this question'
  const line = (max: number) => z.string({ error: required }).trim().max(max, `Keep this under ${max} characters`).refine(value => !/[\r\n]/.test(value), 'Use a single line')

  switch (field.kind) {
    case 'text':
      return line(field.maxLength).pipe(field.optional ? z.string() : z.string().min(2, required))
    case 'textarea': {
      const min = field.optional ? 0 : field.minLength ?? 2
      return z.string({ error: required }).trim().max(field.maxLength, `Keep this under ${field.maxLength} characters`)
        .refine(value => value.length >= min, min > 2 ? `Please write at least ${min} characters` : required)
    }
    case 'date':
      return z.string({ error: required }).refine(value => !!parseIsoDate(value), 'Choose a date')
        .refine(value => value >= '2015-01-01' && value <= addDays(today, 1), 'Choose a date that is not in the future')
    case 'choice':
      return z.enum(field.options.map(option => option.value) as [string, ...string[]], { error: 'Choose one option' })
    case 'currency':
      return z.enum(CURRENCIES.map(currency => currency.value) as [string, ...string[]], { error: 'Choose a currency' })
    case 'count':
      return z.string({ error: required }).trim().refine(value => value === UNKNOWN || /^\d{1,7}$/.test(cleanNumber(value)), 'Enter a whole number, or choose Not sure')
        .transform(value => (value === UNKNOWN ? UNKNOWN : Number(cleanNumber(value))))
    case 'money':
      return z.string({ error: required }).trim().refine(value => value === UNKNOWN || /^\d{1,13}(\.\d{1,2})?$/.test(cleanNumber(value)), 'Enter an amount, or choose Not sure')
        .transform(value => (value === UNKNOWN ? UNKNOWN : Number(cleanNumber(value))))
    case 'monthYear':
      return z.string({ error: 'Choose a month and year, or Never' })
        .refine(value => value === NEVER || (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '2009-01' && value <= today.slice(0, 7)), 'Choose a month and year, or Never')
    case 'week': {
      const options = weekOptions(typeof answers.visitDate === 'string' ? answers.visitDate : '').map(option => option.value)
      return z.string({ error: 'Choose the reporting week' }).refine(value => options.includes(value), 'Choose the reporting week')
    }
    case 'ranked': {
      const values = field.options.map(option => option.value)
      return z.array(z.string()).min(1, 'Choose at least one').max(field.max, `Choose up to ${field.max}`)
        .refine(list => list.every(value => values.includes(value)) && new Set(list).size === list.length, 'Choose from the list')
    }
  }
}

export type ValidationResult = { values: Record<string, unknown>; errors: Record<string, string> }

/** Validates the visible questions in the given steps; hidden answers are dropped. */
export function validateSteps(steps: Step[], answers: Answers, today = localToday()): ValidationResult {
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const step of steps) {
    for (const field of visibleFields(step, answers)) {
      const raw = answers[field.id] ?? (field.optional ? '' : undefined)
      const result = fieldSchema(field, answers, today).safeParse(raw)
      if (result.success) values[field.id] = result.data
      else errors[field.id] = result.error.issues[0]?.message ?? 'Please check this answer'
    }
  }
  return { values, errors }
}

export function validateSubmission(type: FieldVisitType, answers: Answers, today = localToday()) {
  return validateSteps(activeSteps(type, answers), answers, today)
}

// ---------- Display ----------

function optionLabel(options: Option[], value: unknown) {
  return options.find(option => option.value === value)?.label ?? String(value ?? '')
}

const toNumber = (value: unknown) => Number(typeof value === 'string' ? cleanNumber(value) : value)

export function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Human-readable answer for the review screen and notification email. */
export function formatAnswer(field: Field, value: unknown, answers: Answers): string {
  if (value === undefined || value === null || value === '') return 'Not answered'
  if (value === UNKNOWN) return 'Not sure'
  switch (field.kind) {
    case 'date':
      return formatDate(String(value))
    case 'choice':
      return optionLabel(field.options, value)
    case 'currency':
      return value === 'SATS' ? 'sats' : String(value)
    case 'count':
      return formatNumber(toNumber(value))
    case 'money': {
      const currency = answers[field.currencyFrom]
      const amount = formatNumber(toNumber(value))
      return currency === 'SATS' ? `${amount} sats` : `${currency ?? ''} ${amount}`.trim()
    }
    case 'monthYear':
      return value === NEVER ? 'Never' : formatDate(`${value}-01`, { month: 'long', year: 'numeric' })
    case 'week':
      return formatWeek(String(value))
    case 'ranked':
      return Array.isArray(value) ? value.map((item, index) => `${index + 1}. ${optionLabel(field.options, item)}`).join('  ') : String(value)
    default:
      return String(value)
  }
}

export function fieldTitle(field: Field) {
  return field.short ?? field.label
}

/** Email subject in the format Geyser asks for, ready to forward. */
export function submissionSubject(type: FieldVisitType, values: Record<string, unknown>) {
  const parts = [values.fieldPartner, values.businessName, formatDate(String(values.visitDate ?? ''))].map(part => String(part ?? '').replace(/[\r\n]/g, ' '))
  return type === 'new'
    ? `Introduction - ${parts.join(' - ')}`
    : `Follow-up - ${parts.join(' - ')} - ${values.followUpStage} months`
}
