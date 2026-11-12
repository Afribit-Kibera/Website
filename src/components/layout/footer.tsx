'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Twitter, Instagram, Youtube, ExternalLink, Bitcoin } from 'lucide-react'
import { Container } from './container'
import { usePathname } from 'next/navigation'

const QUICK_LINKS = [
  { href: '/about', label: 'About Afribit' },
  { href: '/programs/merchants', label: 'Merchant Program' },
  { href: '/merchants', label: 'Merchants', external: false },
  { href: '/builders', label: 'Afribit Builders' },
  { href: '/studio', label: 'Afribit Studio' },
  { href: '/donate', label: 'Donate' },
  { href: '/contact', label: 'Contact' },
]

const COMMUNITY_LINKS = [
  { href: '/community', label: 'Join Community' },
  { href: 'https://btcmap.org/community/afribit-kibera', label: 'BTC Map', external: true },
]

const RESOURCE_LINKS = [
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Use' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
  { href: 'https://bitcoinconfederation.org/hub/afribit-kibera/', label: 'Bitcoin Confederation', external: true },
]

const SOCIALS = [
  { href: 'https://x.com/afribitkibera', label: 'X (Twitter)', icon: Twitter },
  { href: 'https://www.instagram.com/afribit_africa/', label: 'Instagram', icon: Instagram },
  { href: 'https://youtube.com/@afribitafrica', label: 'YouTube', icon: Youtube },
]

export function Footer() {
  const pathname = usePathname()
  if (pathname === '/education' || pathname === '/studio' || pathname.startsWith('/studio/') || pathname === '/field-visit') return null
  const isHome = pathname === '/'
  const bgClass = isHome
    ? 'bg-grid-lines glow-green bg-bg-surface/50 mt-0'
    : 'border-t border-white/8 bg-bg-base mt-0'

  return (
    <footer className={bgClass}>
      <Container>
        <div className="py-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image
                src="/Logo/Full logo png transparent.png"
                alt="Afribit"
                width={28}
                height={28}
                className="size-7 object-contain"
              />
              <span className="font-display text-base font-semibold text-foreground">Afribit</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Building circular Bitcoin economies in Kibera, Nairobi — one transaction at a time.
            </p>
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Community
            </h3>
            <ul className="space-y-2.5">
              {COMMUNITY_LINKS.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Afribit Africa. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Built with <Bitcoin className="size-3 text-bitcoin" /> in Nairobi
            <a
              href="https://bitcoin.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-bitcoin transition-colors"
            >
              <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      </Container>
    </footer>
  )
}
