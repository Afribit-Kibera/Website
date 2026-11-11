import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { fieldVisitNotification } from '@/lib/email-templates'
import { captchaSchema } from '@/lib/form-validation'
import { assertFormOrigin, readFormJson, limitFormRequests, verifyFormCaptcha, FormRequestError } from '@/lib/public-form-security'
import {
  FIELD_VISIT_FORM_VERSION,
  FORMS,
  SECTIONS,
  activeSteps,
  fieldTitle,
  formatAnswer,
  submissionSubject,
  validateSubmission,
  visibleFields,
  type Answers,
} from '@/lib/field-visit'

const NOTIFICATION_RECIPIENTS = ['connect@afribit.africa', 'ronnie@afribit.africa']

const answerValue = z.union([z.string().max(4000), z.array(z.string().max(40)).max(10)])
const bodySchema = z.object({
  type: z.enum(['new', 'follow-up']),
  answers: z.record(z.string().max(60), answerValue),
  website: z.string().max(200).optional(),
})

function reviewFlags(values: Record<string, unknown>) {
  const flags: string[] = []
  if (values.hasDebt === 'yes') flags.push('Outstanding business loan or supplier debt reported.')
  if (values.hasDebt === 'unsure') flags.push('Unsure whether business debt is outstanding.')
  if (values.operatingStatus === 'closed') flags.push('Business reported as closed.')
  if (values.acceptingBitcoin === 'paused' || values.acceptingBitcoin === 'stopped') flags.push(`Bitcoin acceptance ${values.acceptingBitcoin}.`)
  if (values.grantInUse === 'no_longer') flags.push('Funded improvement is no longer in use.')
  return flags
}

export async function POST(request: NextRequest) {
  try {
    assertFormOrigin(request)
    await limitFormRequests(request, 'field-visit')
    const raw = await readFormJson(request)
    const body = bodySchema.parse(raw)
    if (body.website) return NextResponse.json({ success: true, message: 'Thank you. The questionnaire was received.' })

    const answers: Answers = body.answers
    const { values, errors } = validateSubmission(body.type, answers, new Date().toISOString().slice(0, 10))
    if (Object.keys(errors).length) {
      return NextResponse.json({ success: false, error: 'Some answers need checking.', errors }, { status: 400 })
    }
    await verifyFormCaptcha(captchaSchema.parse(raw).captchaToken)

    const submission = await prisma.fieldVisitSubmission.create({
      data: {
        formType: body.type === 'new' ? 'NEW_BENEFICIARY' : 'FOLLOW_UP',
        formVersion: FIELD_VISIT_FORM_VERSION,
        followUpStage: body.type === 'follow-up' ? Number(values.followUpStage) : null,
        fieldPartner: String(values.fieldPartner),
        businessName: String(values.businessName),
        location: String(values.location),
        respondentName: String(values.respondentName),
        visitDate: new Date(`${values.visitDate}T00:00:00Z`),
        currency: String(values.currency),
        answers: values as Record<string, string | number | string[]>,
      },
    })

    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      const steps = activeSteps(body.type, answers)
      const sections = SECTIONS.filter(section => section.id !== 'review').map(section => ({
        title: section.label,
        rows: steps.filter(step => step.section === section.id).flatMap(step =>
          visibleFields(step, answers).map(field => ({ label: fieldTitle(field), value: formatAnswer(field, values[field.id], answers) })),
        ),
      })).filter(section => section.rows.length)

      const email = fieldVisitNotification({
        subject: submissionSubject(body.type, values),
        formTitle: FORMS[body.type].title,
        sections,
        flags: reviewFlags(values),
        submittedAt: submission.createdAt,
      })
      await sendEmail({ to: NOTIFICATION_RECIPIENTS, subject: email.subject, html: email.html }).catch(error => {
        console.error('Failed to send field visit notification:', error)
      })
    }

    return NextResponse.json({ success: true, message: 'Thank you. The questionnaire was received.', data: { id: submission.id } })
  } catch (error) {
    if (error instanceof FormRequestError) return NextResponse.json({ success: false, error: error.message }, {
      status: error.status, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
    })
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'The questionnaire could not be read. Please refresh and try again.' }, { status: 400 })
    }
    console.error('Field visit submission error:', error)
    return NextResponse.json({ success: false, error: 'Something went wrong. Your answers are saved on this device; please try again.' }, { status: 500 })
  }
}
