import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { FORMS, activeSteps, fieldTitle, formatAnswer, formatDate, visibleFields, type Answers } from '@/lib/field-visit'

export const dynamic = 'force-dynamic'

export default async function FieldVisitSubmissionsPage() {
  const submissions = await prisma.fieldVisitSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin">Field visits</p>
          <h2 className="text-3xl font-bold">Questionnaire submissions</h2>
          <p className="mt-2 text-sm text-muted-foreground">Latest {submissions.length} submissions. Share the form at <Link href="/field-visit" className="text-bitcoin underline underline-offset-4">/field-visit</Link>.</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-bitcoin">Back to admin</Link>
      </div>

      {submissions.length === 0 && (
        <p className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-muted-foreground">No questionnaires have been submitted yet.</p>
      )}

      {submissions.map(submission => {
        const type = submission.formType === 'NEW_BENEFICIARY' ? 'new' : 'follow-up'
        const answers = (submission.answers ?? {}) as Answers
        const display = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, typeof value === 'number' ? String(value) : value]))
        return (
          <details key={submission.id} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block text-lg font-semibold text-white">{submission.businessName}</span>
                <span className="text-sm text-muted-foreground">
                  {FORMS[type].title}{submission.followUpStage ? ` · ${submission.followUpStage} months` : ''} · {submission.fieldPartner} · visited {formatDate(submission.visitDate.toISOString().slice(0, 10))}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">Sent {submission.createdAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' })}</span>
            </summary>
            <dl className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-sm">
              {activeSteps(type, display).flatMap(step => visibleFields(step, display)).map(field => (
                <div key={field.id} className="grid gap-1 sm:grid-cols-[2fr_3fr] sm:gap-4">
                  <dt className="text-muted-foreground">{fieldTitle(field)}</dt>
                  <dd className="whitespace-pre-line break-words">{formatAnswer(field, display[field.id], display)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )
      })}
    </div>
  )
}
