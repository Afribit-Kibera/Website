import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activeSteps,
  initialAnswers,
  lastCompletedWeek,
  submissionSubject,
  validateSubmission,
  weekOptions,
  type Answers,
} from '../../src/lib/field-visit'

const TODAY = '2026-11-11' // Wednesday

const newVisit = (): Answers => ({
  ...initialAnswers('new', TODAY),
  fieldPartner: 'Afribit Kibera',
  businessName: 'Mama Njeri Groceries',
  location: 'Olympic, Kibera',
  respondentName: 'Njeri Wanjiku',
  employeesFullTime: '1',
  employeesPartTime: '2',
  weeklySales: '12,500',
  weeklyCosts: '8000.50',
  stockValue: 'unknown',
  hasDebt: 'no',
  firstAcceptedBitcoin: '2024-05',
  acceptingBitcoin: 'yes',
  bitcoinCourse: 'no',
  bitcoinCourseDetails: 'should be dropped',
  bitcoinPaymentCount: '14',
  bitcoinPaymentValue: '3200',
  paymentMethods: ['mobile_money', 'cash', 'bitcoin'],
  recommendationReason: 'Trusted shop owner who already trains neighbours to use Bitcoin.',
})

const followUp = (): Answers => ({
  ...initialAnswers('follow-up', TODAY),
  fieldPartner: 'Afribit Kibera',
  followUpStage: '3',
  businessName: 'Mama Njeri Groceries',
  location: 'Olympic, Kibera',
  respondentName: 'Njeri Wanjiku',
  grantAmount: '500000',
  grantCurrency: 'SATS',
  grantReceivedDate: '2026-08-01',
  operatingStatus: 'normal',
  grantHelped: 'a_lot',
  employeesFullTime: '2',
  employeesPartTime: '0',
  weeklySales: '15000',
  weeklyCosts: '9000',
  stockValue: '40000',
  acceptingBitcoin: 'paused',
  pausedReason: 'Phone was stolen.',
  bitcoinPaymentCount: '0',
  bitcoinPaymentValue: '0',
  supplierCount: '0',
  paymentMethods: ['cash', 'other'],
  paymentMethodOther: 'Barter',
  grantInUse: 'fully',
  forwardedAmount: '50000',
  merchantsHelped: '2',
  merchantsHelpedNames: 'Otieno Shoes\nKibera Kinyozi',
})

test('reporting week is the last completed Monday-Sunday week', () => {
  assert.equal(lastCompletedWeek('2026-11-11'), '2026-11-02') // Wednesday
  assert.equal(lastCompletedWeek('2026-11-09'), '2026-11-02') // Monday
  assert.equal(lastCompletedWeek('2026-11-08'), '2026-10-26') // Sunday: current week not finished
  assert.deepEqual(weekOptions('2026-11-11').map(option => option.value), ['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12'])
  assert.equal(lastCompletedWeek('not-a-date'), '')
})

test('a complete new beneficiary questionnaire validates and is normalised', () => {
  const { values, errors } = validateSubmission('new', newVisit(), TODAY)
  assert.deepEqual(errors, {})
  assert.equal(values.weeklySales, 12500)
  assert.equal(values.weeklyCosts, 8000.5)
  assert.equal(values.stockValue, 'unknown')
  assert.equal(values.reportingWeek, '2026-11-02')
  assert.equal('bitcoinCourseDetails' in values, false, 'hidden answers are dropped')
  assert.equal('paymentMethodOther' in values, false)
})

test('merchants who never accepted Bitcoin skip the weekly Bitcoin screen', () => {
  const answers = { ...newVisit(), acceptingBitcoin: 'never', bitcoinPaymentCount: undefined, bitcoinPaymentValue: undefined }
  assert.equal(activeSteps('new', answers).some(step => step.id === 'bitcoin-week'), false)
  const { values, errors } = validateSubmission('new', answers, TODAY)
  assert.deepEqual(errors, {})
  assert.equal('bitcoinPaymentCount' in values, false)
})

test('screens stay short', () => {
  for (const type of ['new', 'follow-up'] as const) {
    for (const step of activeSteps(type, type === 'new' ? newVisit() : followUp())) {
      assert.ok(step.fields.length <= 4, `${type}/${step.id} has ${step.fields.length} questions`)
    }
  }
})

test('missing and malformed answers are reported per question', () => {
  const answers = { ...newVisit(), businessName: '', weeklySales: 'about 500', hasDebt: 'maybe', firstAcceptedBitcoin: '2024-', paymentMethods: [] }
  const { errors } = validateSubmission('new', answers, TODAY)
  assert.deepEqual(Object.keys(errors).sort(), ['businessName', 'firstAcceptedBitcoin', 'hasDebt', 'paymentMethods', 'weeklySales'])
})

test('dates in the future and weeks outside the visit window are rejected', () => {
  assert.ok(validateSubmission('new', { ...newVisit(), visitDate: '2026-12-25' }, TODAY).errors.visitDate)
  assert.ok(validateSubmission('new', { ...newVisit(), reportingWeek: '2026-11-09' }, TODAY).errors.reportingWeek)
  assert.ok(validateSubmission('new', { ...newVisit(), firstAcceptedBitcoin: '2027-01' }, TODAY).errors.firstAcceptedBitcoin)
})

test('a follow-up asks why Bitcoin was paused and records helped merchants', () => {
  const ok = validateSubmission('follow-up', followUp(), TODAY)
  assert.deepEqual(ok.errors, {})
  assert.equal(ok.values.merchantsHelped, 2)
  assert.equal(ok.values.paymentMethodOther, 'Barter')
  assert.equal('supplierNames' in ok.values, false)

  const missingReason = validateSubmission('follow-up', { ...followUp(), pausedReason: '' }, TODAY)
  assert.ok(missingReason.errors.pausedReason)
  const missingOther = validateSubmission('follow-up', { ...followUp(), paymentMethodOther: '' }, TODAY)
  assert.ok(missingOther.errors.paymentMethodOther)
})

test('ranked payment methods must be unique, known and at most three', () => {
  assert.ok(validateSubmission('new', { ...newVisit(), paymentMethods: ['cash', 'cash'] }, TODAY).errors.paymentMethods)
  assert.ok(validateSubmission('new', { ...newVisit(), paymentMethods: ['cash', 'bitcoin', 'bank_card', 'stablecoins'] }, TODAY).errors.paymentMethods)
  assert.ok(validateSubmission('new', { ...newVisit(), paymentMethods: ['gold'] }, TODAY).errors.paymentMethods)
})

test('notification subject follows the Geyser email format', () => {
  const values = validateSubmission('follow-up', followUp(), TODAY).values
  assert.equal(submissionSubject('follow-up', values), 'Follow-up - Afribit Kibera - Mama Njeri Groceries - 11 Nov 2026 - 3 months')
  assert.equal(submissionSubject('new', validateSubmission('new', newVisit(), TODAY).values), 'Introduction - Afribit Kibera - Mama Njeri Groceries - 11 Nov 2026')
})
