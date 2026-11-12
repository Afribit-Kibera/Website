import type { Metadata, Viewport } from 'next'
import { FieldVisitForm } from '@/components/field-visit/FieldVisitForm'
import { generateMetadata as buildMetadata } from '@/lib/metadata'
import { isFieldVisitType } from '@/lib/field-visit'

export const metadata: Metadata = buildMetadata({
  title: 'Field Visit Questionnaire',
  description: 'Field Partner questionnaire for Circular Grant beneficiaries: new beneficiary visits and 3, 6 and 9 month follow-ups.',
  path: '/field-visit',
  noIndex: true,
})

// The questionnaire runs full screen on phones, edge to edge under the notch.
export const viewport: Viewport = {
  themeColor: '#070807',
  viewportFit: 'cover',
}

export default async function FieldVisitPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams
  return <FieldVisitForm initialType={isFieldVisitType(type) ? type : null} />
}
