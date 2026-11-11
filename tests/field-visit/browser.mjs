// End-to-end check of the field visit questionnaire.
// Usage: node tests/field-visit/browser.mjs <path-to-playwright> <base-url> [screenshot-dir]
// Run against a dev server started with hCaptcha test keys and SMTP disabled:
//   NEXT_PUBLIC_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
//   HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000 SMTP_USER= SMTP_PASSWORD=
// Submitted rows use the business name prefix "E2E TEST" so they can be removed afterwards.
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

const loadModule = createRequire(import.meta.url)
const { chromium } = loadModule(process.argv[2] || 'playwright')
const base = process.argv[3] || 'http://localhost:3000'
const shots = process.argv[4] || os.tmpdir()
const stamp = Date.now().toString(36)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' && /hydrat|didn't match|server rendered/i.test(message.text())) errors.push(message.text()) })

let shot = 0
const snap = async name => page.screenshot({ path: path.join(shots, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true })
const heading = () => page.locator('#field-visit-step-title')
const next = async () => {
  await page.getByRole('button', { name: /^(Continue|Review answers|Save and review)/ }).click()
}
const expectScreen = async title => {
  await assert.doesNotReject(heading().filter({ hasText: title }).waitFor({ timeout: 5000 }), `expected screen "${title}"`)
  await page.waitForFunction(text => document.activeElement?.textContent?.trim() === text, title, { timeout: 3000 })
}
const fill = (id, value) => page.locator(`#${id}`).fill(value)
const choose = (id, label) => page.locator(`[data-field="${id}"] label`).filter({ hasText: new RegExp(`^${label}$`) }).click()
const tap = (id, label) => page.locator(`[data-field="${id}"] button`).filter({ hasText: label }).click()

async function noOverflow(label) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
    await page.waitForTimeout(100)
    const { inner, scroll } = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }))
    assert.ok(scroll <= inner, `${label} overflows at ${width}px: ${scroll}`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

async function solveCaptchaAndSend() {
  const frame = page.frameLocator('iframe[title*="checkbox"]')
  await frame.locator('#checkbox').click({ timeout: 20000 })
  const send = page.getByRole('button', { name: 'Send questionnaire' })
  await assert.doesNotReject(page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Send questionnaire'))
    return button && !button.disabled
  }, null, { timeout: 15000 }), 'captcha did not enable sending')
  await send.click()
  await page.getByRole('heading', { name: 'Questionnaire submitted' }).waitFor({ timeout: 20000 })
  return (await page.locator('.font-mono').textContent())?.trim()
}

try {
  // Landing
  const response = await page.goto(`${base}/field-visit`, { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200)
  assert.equal(await page.locator('h1').count(), 1)
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
  await page.getByRole('button', { name: /New beneficiary/ }).waitFor()
  await noOverflow('chooser')
  await snap('chooser')
  console.log('PASS landing page, noindex, responsive chooser')

  // ---------- New beneficiary ----------
  await page.getByRole('button', { name: /New beneficiary/ }).click()
  await expectScreen('About this visit')
  assert.match(page.url(), /type=new/)
  await next()
  assert.ok(await page.locator('#fieldPartner-error').isVisible(), 'empty required field shows an error')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'fieldPartner', 'focus moves to the first invalid question')
  await snap('new-visit-error')
  await fill('fieldPartner', 'E2E TEST Partner')
  await next()

  await expectScreen('The business')
  await fill('businessName', `E2E TEST New ${stamp}`)
  await fill('location', 'Olympic, Kibera')
  await fill('respondentName', 'Test Respondent')
  await next()

  await expectScreen('Reporting week')
  assert.equal(await page.locator('[data-field="reportingWeek"] input:checked').count(), 1, 'last completed week is preselected')
  assert.equal(await page.locator('#currency').inputValue(), 'KES')
  await snap('new-reporting-week')
  await next()

  await expectScreen('Team today')
  await fill('employeesFullTime', '1')
  await fill('employeesPartTime', '2')
  await next()

  await expectScreen("Last week's trading")
  await fill('weeklySales', '12,500')
  await fill('weeklyCosts', 'lots')
  await next()
  assert.ok(await page.locator('#weeklyCosts-error').isVisible(), 'non-numeric amount is rejected')
  await fill('weeklyCosts', '8000')
  await next()

  await expectScreen('Stock and debt')
  await tap('stockValue', 'Not sure')
  assert.ok(await page.locator('#stockValue').isDisabled())
  await choose('hasDebt', 'Yes')
  await snap('new-stock-debt')
  await next()

  await expectScreen('Bitcoin acceptance')
  assert.equal(await page.locator('#bitcoinCourseDetails').count(), 0, 'course details hidden until Yes')
  await page.locator('[data-field="firstAcceptedBitcoin"] select').nth(0).selectOption('05')
  await page.locator('[data-field="firstAcceptedBitcoin"] select').nth(1).selectOption('2024')
  await choose('acceptingBitcoin', 'Never')
  await choose('bitcoinCourse', 'Yes')
  await fill('bitcoinCourseDetails', 'Afribit Bitcoin Basics, 2025')
  await snap('new-bitcoin')
  await next()

  // "Never" accepting skips the weekly Bitcoin payments screen
  await expectScreen('How customers pay')
  await tap('paymentMethods', 'Mobile money')
  await tap('paymentMethods', 'Local cash')
  assert.equal(await page.locator('[data-field="paymentMethods"] button[aria-pressed="true"]').count(), 2)
  assert.equal(await page.locator('#paymentMethodOther').count(), 0)
  await snap('new-payment-methods')
  await next()

  await expectScreen('Why you back this merchant')
  await fill('recommendationReason', 'Too short')
  await next()
  assert.ok(await page.locator('#recommendationReason-error').isVisible(), 'short recommendation is rejected')
  await fill('recommendationReason', 'A trusted shop owner who already helps neighbours learn to receive Bitcoin.')
  await next()

  await expectScreen('Check and send')
  const review = await page.locator('dl').allInnerTexts()
  assert.ok(review.join('\n').includes('Not sure'))
  assert.ok(review.join('\n').includes('KES 12,500'))
  assert.ok(!review.join('\n').includes('Bitcoin payments'), 'skipped questions are not reviewed')
  console.log('PASS new beneficiary: validation, focus, conditional questions and skipped screen')

  // Draft survives a reload
  await page.reload({ waitUntil: 'networkidle' })
  await heading().filter({ hasText: 'Check and send' }).waitFor()
  assert.ok(await page.getByText(/We restored your unsent answers/).isVisible())
  console.log('PASS draft restored after reload')

  // Edit from review returns to review
  await page.getByRole('button', { name: 'Edit Team today' }).click()
  await expectScreen('Team today')
  await fill('employeesFullTime', '3')
  await page.getByRole('button', { name: /Save and review/ }).click()
  await expectScreen('Check and send')
  assert.ok((await page.locator('dl').allInnerTexts()).join('\n').match(/Full-time staff\s+3/))
  await snap('new-review')
  await noOverflow('review')

  const newRef = await solveCaptchaAndSend()
  assert.match(newRef, /^[0-9A-F]{8}$/)
  assert.equal(await page.evaluate(() => localStorage.getItem('afribit:field-visit:v1:new')), null, 'draft cleared after sending')
  await snap('new-submitted')
  console.log(`PASS new beneficiary submitted (${newRef})`)

  // ---------- Follow-up ----------
  await page.getByRole('button', { name: 'Choose a different form' }).click()
  await page.getByRole('button', { name: /Beneficiary follow-up/ }).click()
  await expectScreen('About this visit')
  await fill('fieldPartner', 'E2E TEST Partner')
  await choose('followUpStage', '6 months')
  await next()
  await expectScreen('The business')
  await fill('businessName', `E2E TEST Follow-up ${stamp}`)
  await fill('location', 'Olympic, Kibera')
  await fill('respondentName', 'Test Respondent')
  await next()
  await expectScreen('The original grant')
  await page.locator('#grantCurrency').selectOption('SATS')
  await fill('grantAmount', '500000')
  await fill('grantReceivedDate', '2026-05-01')
  await snap('follow-grant')
  await next()
  await expectScreen('How the business is doing')
  await choose('operatingStatus', 'Normal')
  await choose('grantHelped', 'A lot')
  await next()
  await expectScreen('Reporting week')
  await next()
  await expectScreen('Team today')
  await fill('employeesFullTime', '2')
  await fill('employeesPartTime', '0')
  await next()
  await expectScreen('Trading and stock')
  await fill('weeklySales', '15000')
  await fill('weeklyCosts', '9000')
  await fill('stockValue', '40000')
  await next()
  await expectScreen('Bitcoin acceptance')
  await choose('acceptingBitcoin', 'Paused')
  await fill('pausedReason', 'Phone was stolen; waiting for a replacement.')
  await next()
  await expectScreen('Bitcoin payments last week')
  await fill('bitcoinPaymentCount', '0')
  await fill('bitcoinPaymentValue', '0')
  await next()
  await expectScreen('Paying suppliers in Bitcoin')
  await fill('supplierCount', '0')
  assert.equal(await page.locator('#supplierNames').count(), 0)
  await next()
  await expectScreen('How customers pay')
  await tap('paymentMethods', 'Local cash')
  await tap('paymentMethods', 'Other')
  await fill('paymentMethodOther', 'Barter')
  await next()
  await expectScreen('Grant use and forwarding')
  await choose('grantInUse', 'Fully')
  await page.locator('#forwardedCurrency').selectOption('SATS')
  await fill('forwardedAmount', '50000')
  await next()
  await expectScreen('Wider Bitcoin adoption')
  await fill('merchantsHelped', '2')
  await fill('merchantsHelpedNames', 'Otieno Shoes\nKibera Kinyozi')
  await snap('follow-adoption')
  await next()
  await expectScreen('Check and send')
  assert.ok((await page.locator('dl').allInnerTexts()).join('\n').includes('500,000 sats'))
  await snap('follow-review')
  const followRef = await solveCaptchaAndSend()
  console.log(`PASS follow-up submitted (${followRef})`)

  // ---------- API guards ----------
  const api = await page.evaluate(async () => {
    const post = body => fetch('/api/field-visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(async res => ({ status: res.status, body: await res.json() }))
    return {
      invalid: await post({ type: 'new', answers: { businessName: 'x' } }),
      badType: await post({ type: 'other', answers: {} }),
    }
  })
  assert.equal(api.invalid.status, 400)
  assert.ok(api.invalid.body.errors.fieldPartner)
  assert.equal(api.badType.status, 400)
  console.log('PASS API rejects incomplete and malformed questionnaires')

  assert.deepEqual(errors, [])
  console.log(`PASS no page errors. Screenshots in ${shots}`)
  console.log(JSON.stringify({ newRef, followRef, stamp }))
} finally {
  await browser.close()
}
