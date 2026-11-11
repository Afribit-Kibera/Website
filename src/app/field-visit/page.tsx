import type { Metadata } from 'next'
import { Container } from '@/components/layout/container'
import { FieldVisitForm } from '@/components/field-visit/FieldVisitForm'
import { generateMetadata as buildMetadata } from '@/lib/metadata'
import { isFieldVisitType } from '@/lib/field-visit'

export const metadata: Metadata = buildMetadata({
  title: 'Field Visit Questionnaire',
  description: 'Field Partner questionnaire for Circular Grant beneficiaries: new beneficiary visits and 3, 6 and 9 month follow-ups.',
  path: '/field-visit',
  noIndex: true,
})

export default async function FieldVisitPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams
  const initialType = isFieldVisitType(type) ? type : null

  return (
    <section className="relative overflow-hidden bg-bg-base pb-20 pt-24 sm:pb-24 sm:pt-32">
      <div className="absolute inset-0 bg-grid-lines opacity-20" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(247,147,26,0.12),transparent_26rem)]" aria-hidden />
      <Container className="relative z-10">
        <div className="mx-auto w-full max-w-2xl">
          <header className="mb-7 sm:mb-9">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bitcoin/90">Geyser Impact Fund · Circular Grants</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">Field visit questionnaire</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              For Field Partners visiting a beneficiary business. Answer together with the owner. Estimates are fine, and you can choose &ldquo;Not sure&rdquo; for any figure.
            </p>
          </header>
          <FieldVisitForm initialType={initialType} />
        </div>
      </Container>
    </section>
  )
}
