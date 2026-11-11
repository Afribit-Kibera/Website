import { createHash } from 'node:crypto'
import { RateLimiterMemory } from 'rate-limiter-flexible'

export class FormRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfter?: number) { super(message) }
}

// Submissions allowed per IP every 15 minutes. Field visits are higher because
// partners often send several from one office or a shared mobile-network IP.
const formLimits = { contact: 5, newsletter: 5, 'field-visit': 20 } as const
const limiters = new Map<number, RateLimiterMemory>()
const maxBodyBytes = 32 * 1024
const incrementWithExpiry = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"

export function assertFormOrigin(request: Request) {
  const allowed = new Set(['https://www.afribit.africa', 'https://afribit.africa'])
  if (process.env.NODE_ENV !== 'production') allowed.add(new URL(request.url).origin)
  const origin = request.headers.get('origin')
  if (!origin || !allowed.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new FormRequestError('Please submit this form from the Afribit website.', 403)
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new FormRequestError('Use JSON for this request.', 415)
}

export async function readFormJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) throw new FormRequestError('Your message is too large.', 413)
  if (!request.body) throw new FormRequestError('A form is required.', 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > maxBodyBytes) {
        await reader.cancel()
        throw new FormRequestError('Your message is too large.', 413)
      }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  catch { throw new FormRequestError('The form could not be read.', 400) }
}

export async function limitFormRequests(request: Request, form: keyof typeof formLimits) {
  const points = formLimits[form]
  // Vercel overwrites X-Forwarded-For. Other deployments need a trusted proxy.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `afribit:forms:${form}:${createHash('sha256').update(ip).digest('hex')}`
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const distributed = process.env.PUBLIC_FORM_REDIS_ENABLED === 'true'
  if (distributed && url && token) {
    let count: unknown
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', incrementWithExpiry, '1', key, '900']),
        signal: AbortSignal.timeout(3000), cache: 'no-store',
      })
      const payload: unknown = await response.json()
      if (!response.ok || !payload || typeof payload !== 'object' || !('result' in payload)) throw new Error('Unavailable')
      count = payload.result
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) throw new Error('Invalid result')
    } catch { throw new FormRequestError('Please try again shortly, or email connect@afribit.africa.', 503) }
    if ((count as number) > points) throw new FormRequestError('Please wait before sending another message.', 429, 900)
    return
  }
  if (distributed) throw new FormRequestError('Please email connect@afribit.africa while the form is unavailable.', 503)
  let limiter = limiters.get(points)
  if (!limiter) limiters.set(points, limiter = new RateLimiterMemory({ points, duration: 900 }))
  try { await limiter.consume(key) }
  catch { throw new FormRequestError('Please wait before sending another message.', 429, 900) }
}

export async function verifyFormCaptcha(token: string | undefined) {
  const secret = process.env.HCAPTCHA_SECRET_KEY
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
  if (!secret && !sitekey) return
  if (!secret || !sitekey) throw new FormRequestError('Please email connect@afribit.africa while the form is unavailable.', 503)
  if (!token) throw new FormRequestError('Please complete the human verification.', 400)
  let valid = false
  try {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, sitekey, response: token }),
      signal: AbortSignal.timeout(5000), cache: 'no-store',
    })
    const result: unknown = await response.json()
    valid = response.ok && !!result && typeof result === 'object' && 'success' in result && result.success === true
  } catch { throw new FormRequestError('Verification is temporarily unavailable. Please try again.', 503) }
  if (!valid) throw new FormRequestError('Verification expired. Please try again.', 400)
}
