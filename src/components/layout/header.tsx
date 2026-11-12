'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Menu, X, Compass, Layers, MapPin, Users, MessageSquare,
  Twitter, Instagram, Youtube, ExternalLink, ArrowRight, Code2, Headphones,
} from 'lucide-react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Container } from './container'
import { Button } from '@/components/ui/button'
import { MaintenanceBanner } from './maintenance-banner'

const DESKTOP_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/programs', label: 'Programs' },
  { href: '/merchants', label: 'Merchants' },
  { href: '/builders', label: 'Builders' },
  { href: '/studio', label: 'Studio', icon: Headphones },
  { href: '/community', label: 'Community' },
  { href: '/contact', label: 'Contact' },
]

const MOBILE_CARDS = [
  {
    href: '/studio',
    label: 'Afribit Studio',
    desc: 'Bitcoin education, at your pace',
    icon: Headphones,
    span: 'half' as const,
    iconBg: 'bg-bitcoin/10',
    iconColor: 'text-bitcoin',
    border: 'border-bitcoin/20',
    glow: 'bg-bitcoin/10',
  },
  {
    href: '/about',
    label: 'About',
    desc: 'Our story & mission',
    icon: Compass,
    span: 'half' as const,
    iconBg: 'bg-bitcoin/10',
    iconColor: 'text-bitcoin',
    border: 'border-bitcoin/20',
    glow: 'bg-bitcoin/10',
  },
  {
    href: '/programs',
    label: 'Programs',
    desc: 'Community programs in Kibera',
    icon: Layers,
    span: 'half' as const,
    iconBg: 'bg-panafrican-green/10',
    iconColor: 'text-panafrican-green',
    border: 'border-panafrican-green/15',
    glow: 'bg-panafrican-green/8',
  },
  {
    href: '/merchants',
    label: 'Merchants',
    desc: 'Browse local business profiles',
    icon: MapPin,
    span: 'full' as const,
    iconBg: 'bg-panafrican-gold/10',
    iconColor: 'text-panafrican-gold',
    border: 'border-panafrican-gold/15',
    glow: 'bg-panafrican-gold/8',
    external: false,
  },
  {
    href: '/builders',
    label: 'Afribit Builders',
    desc: 'The people & projects behind the tech',
    icon: Code2,
    span: 'half' as const,
    iconBg: 'bg-bitcoin/10',
    iconColor: 'text-bitcoin',
    border: 'border-bitcoin/20',
    glow: 'bg-bitcoin/10',
  },
  {
    href: '/community',
    label: 'Community',
    desc: 'Join our Fedi hub',
    icon: Users,
    span: 'half' as const,
    iconBg: 'bg-panafrican-green/10',
    iconColor: 'text-panafrican-green',
    border: 'border-panafrican-green/15',
    glow: 'bg-panafrican-green/8',
  },
  {
    href: '/contact',
    label: 'Contact',
    desc: 'Get in touch',
    icon: MessageSquare,
    span: 'half' as const,
    iconBg: 'bg-white/5',
    iconColor: 'text-muted-foreground',
    border: 'border-white/8',
    glow: '',
  },
]

const SOCIALS = [
  { href: 'https://x.com/afribitkibera', icon: Twitter, label: 'X (Twitter)' },
  { href: 'https://www.instagram.com/afribit_africa/', icon: Instagram, label: 'Instagram' },
  { href: 'https://youtube.com/@afribitafrica', icon: Youtube, label: 'YouTube' },
]

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
}

export function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const close = () => setMobileOpen(false)

  if (pathname === '/education' || pathname === '/studio' || pathname.startsWith('/studio/') || pathname === '/field-visit') return null

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50',
        )}
      >
        <div
          className={cn(
            'transition-all duration-300',
          scrolled
              ? 'bg-bg-base/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.04)]'
              : 'bg-bg-base/72 backdrop-blur-lg'
          )}
        >
          <MaintenanceBanner />
          <div className="border-b border-white/8">
            <Container>
              <div className="flex h-16 items-center justify-between gap-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={close}>
                  <Image
                    src="/Logo/Full logo png transparent.png"
                    alt="Afribit"
                    width={32}
                    height={32}
                    className="size-8 object-contain"
                    priority
                  />
                  <span className="font-display text-lg font-semibold tracking-tight text-foreground">
                    Afribit
                  </span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden lg:flex items-center gap-1">
                  {DESKTOP_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn('px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5 flex items-center gap-1.5', link.href === '/studio' && 'text-bitcoin bg-bitcoin/8 border border-bitcoin/20')}
                    >
                      {link.icon && <link.icon className="size-3.5" />}{link.label}
                    </Link>
                  ))}
                </nav>

                {/* Desktop CTA */}
                <div className="hidden lg:flex items-center gap-3">
                  <Button asChild size="default">
                    <Link href="/donate">Fuel BCE ₿</Link>
                  </Button>
                </div>

                {/* Mobile toggle */}
                <button
                  className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileOpen}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {mobileOpen ? (
                      <motion.span
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="block"
                      >
                        <X className="size-5" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="block"
                      >
                        <Menu className="size-5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </Container>
          </div>
        </div>
      </header>

      {/* Mobile full-screen nav overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-nav"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[60] lg:hidden bg-bg-base/98 backdrop-blur-2xl flex flex-col overflow-y-auto"
          >
            {/* Top bar */}
            <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-white/8">
              <Link href="/" className="flex items-center gap-2.5" onClick={close}>
                <Image
                  src="/Logo/Full logo png transparent.png"
                  alt="Afribit"
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                />
                <span className="font-display text-base font-semibold text-foreground">Afribit</span>
              </Link>
              <button
                onClick={close}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Bento card grid */}
            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 p-4 flex-1"
            >
              {MOBILE_CARDS.map((card) => {
                const Icon = card.icon
                const isFullWidth = card.span === 'full'

                const cardInner = (
                  <div
                    className={cn(
                      'relative rounded-2xl border bg-bg-surface p-5 flex flex-col gap-4 h-full overflow-hidden',
                      'active:scale-[0.97] transition-transform',
                      card.border,
                    )}
                  >
                    {/* Ambient glow */}
                    {card.glow && (
                      <div className={cn('absolute -top-10 -right-10 size-28 rounded-full blur-2xl pointer-events-none', card.glow)} />
                    )}

                    <div className="relative flex items-start justify-between gap-3">
                      <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                        <Icon className={cn('size-4', card.iconColor)} />
                      </div>
                      {card.external ? (
                        <ExternalLink className="size-3.5 text-muted-foreground mt-1 shrink-0" />
                      ) : isFullWidth ? (
                        <ArrowRight className="size-3.5 text-muted-foreground mt-1 shrink-0" />
                      ) : null}
                    </div>

                    <div className="relative">
                      <p className="font-display font-bold text-foreground text-base leading-tight">
                        {card.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                )

                return (
                  <motion.div
                    key={card.href}
                    variants={cardVariants}
                    className={isFullWidth ? 'col-span-2' : 'col-span-1'}
                  >
                    {card.external ? (
                      <a
                        href={card.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={close}
                        className="block h-full"
                      >
                        {cardInner}
                      </a>
                    ) : (
                      <Link href={card.href} onClick={close} className="block h-full">
                        {cardInner}
                      </Link>
                    )}
                  </motion.div>
                )
              })}

              {/* Donate CTA card */}
              <motion.div variants={cardVariants} className="col-span-2">
                <Link href="/donate" onClick={close} className="block">
                  <div className="relative rounded-2xl bg-gradient-to-br from-bitcoin via-bitcoin to-[#d97c0e] p-5 flex items-center justify-between overflow-hidden active:scale-[0.97] transition-transform">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)] pointer-events-none" />
                    <div className="relative">
                      <p className="font-display font-bold text-bg-base text-lg">Fuel BCE ₿</p>
                      <p className="text-bg-base/70 text-xs mt-0.5">Support Bitcoin in Kibera</p>
                    </div>
                    <div className="relative size-10 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
                      <ArrowRight className="size-5 text-bg-base" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </motion.div>

            {/* Footer: socials */}
            <div className="shrink-0 px-4 py-6 border-t border-white/8 flex items-center justify-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors border border-white/8"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
