import { useState, FormEvent } from 'react'
import {
    Bot,
    FlaskConical,
    Palette,
    CreditCard,
    BarChart3,
    Wrench,
    Check,
    ArrowRight,
    Sparkles,
    Zap,
    ShieldCheck
} from 'lucide-react'

interface LandingPageProps {
    mode: 'waitlist' | 'launch'
    appName?: string
    tagline?: string
    description?: string
    screenshotUrl?: string
    iosUrl?: string
    androidUrl?: string
}

type BentoTile = {
    title: string
    description: string
    icon: React.ElementType
    accent: string
    pill?: string
    span?: string
    points?: string[]
    metric?: {
        label: string
        value: string
    }
}

type AiTool = {
    name: string
    url: string
    domain: string
    logoText: string
    logoGradient: string
    tagline: string
}

type ChangelogItem = {
    date: string
    version: string
    title: string
    highlights: string[]
}

const aiTools: AiTool[] = [
    {
        name: 'GitHub Copilot',
        url: 'https://github.com',
        domain: 'github.com',
        logoText: 'CP',
        logoGradient: 'from-[#0C163D] via-[#0F4C75] to-[#2DD4BF]',
        tagline: 'Context packs tuned for Copilot chat and inline completions.',
    },
    {
        name: 'Cursor',
        url: 'https://cursor.com',
        domain: 'cursor.com',
        logoText: 'Cu',
        logoGradient: 'from-[#0B1021] via-[#1E293B] to-[#38BDF8]',
        tagline: 'Vibecoding prompts that keep Cursor on the happy path.',
    },
    {
        name: 'Windsurf',
        url: 'https://windsurf.com',
        domain: 'windsurf.com',
        logoText: 'Ws',
        logoGradient: 'from-[#0EA5E9] via-[#1FB7AE] to-[#34D399]',
        tagline: 'Pair-programming ready with sandbox-friendly instructions.',
    },
    {
        name: 'Google Antigravity',
        url: 'https://antigravity.google',
        domain: 'antigravity.google',
        logoText: 'G',
        logoGradient: 'from-[#4285F4] via-[#EA4335] to-[#34A853]',
        tagline: 'Google AI setup notes baked into the context files.',
    },
    {
        name: 'Claude Code',
        url: 'https://code.claude.com',
        domain: 'code.claude.com',
        logoText: 'Cl',
        logoGradient: 'from-[#F59E0B] via-[#FB923C] to-[#8B5CF6]',
        tagline: 'Anthropic-specific guidance so Claude writes with your style.',
    },
    {
        name: 'Replit Agent',
        url: 'https://replit.com',
        domain: 'replit.com',
        logoText: 'Rp',
        logoGradient: 'from-[#FF7A18] via-[#F97316] to-[#FB923C]',
        tagline: 'Ready-to-run agent prompts for quick scaffolds and fixes.',
    },
    {
        name: 'Trae',
        url: 'https://trae.ai',
        domain: 'trae.ai',
        logoText: 'Tr',
        logoGradient: 'from-[#7C3AED] via-[#EC4899] to-[#14B8A6]',
        tagline: 'Tailored guardrails keep Trae aligned with Shipnative patterns.',
    },
]

const bentoTiles: BentoTile[] = [
    {
        title: 'AI-first architecture',
        description: 'Context packs tuned for Cursor and Claude so the AI pair codes with your conventions.',
        icon: Bot,
        pill: 'AI native',
        accent: 'from-emerald-50 via-white to-cyan-50',
        span: 'lg:col-span-2',
        points: [
            'vibe/ docs and .cursorrules keep AI assistants on-rails',
            'Auth, payments, analytics, and notifications are pre-wired',
        ],
    },
    {
        title: 'Mock mode, zero blockers',
        description: 'Ship flows without any API keys using drop-in mocks for every service.',
        icon: FlaskConical,
        accent: 'from-amber-50 via-white to-rose-50',
        points: [
            'Supabase, RevenueCat, PostHog, and Sentry all mocked',
            'Flip one flag in the dev dashboard to switch modes',
        ],
    },
    {
        title: 'Design that already feels premium',
        description: 'Unistyles-driven tokens, gradients, and glass ready to reuse.',
        icon: Palette,
        pill: 'UI kit',
        accent: 'from-sky-50 via-white to-indigo-50',
        span: 'lg:row-span-2',
        points: [
            'Unistyles 3.0 tokens for spacing, typography, and shadows',
            'Dark and light themes tuned for mobile',
            'Component showcase with 14+ examples to copy',
        ],
    },
    {
        title: 'Monetization wired in',
        description: 'RevenueCat + Lemon Squeezy with paywall and management screens.',
        icon: CreditCard,
        pill: 'Ready to sell',
        accent: 'from-cyan-50 via-white to-emerald-50',
        span: 'lg:col-span-2',
        points: [
            'Subscription tiers and freemium logic ready out of the box',
            'Mock payments so you can design flows before going live',
        ],
        metric: {
            label: 'to launch a paywall',
            value: '< 1 hr',
        },
    },
    {
        title: 'Analytics & reliability',
        description: 'PostHog tracking, feature flags, and Sentry hooks baked in.',
        icon: BarChart3,
        accent: 'from-slate-50 via-white to-gray-50',
        points: [
            'Screen + event tracking helpers with sensible defaults',
            'Performance and crash monitoring configured for prod',
        ],
    },
    {
        title: 'Dev loop optimized',
        description: 'Turbo repo with generators for screens, stores, hooks, and APIs.',
        icon: Wrench,
        accent: 'from-orange-50 via-white to-yellow-50',
        points: [
            'Generate components and screens in seconds',
            'E2E-ready with Jest and Maestro samples',
        ],
    },
]

const changelogItems: ChangelogItem[] = [
    {
        date: 'February 17, 2026',
        version: 'v0.9.6',
        title: 'Audit hardening release',
        highlights: [
            'Hardened OAuth callback handling with explicit state validation',
            'Improved secure token/session handling behavior for web auth flows',
            'Added stricter external URL allowlisting for browser link helpers',
        ],
    },
    {
        date: 'February 17, 2026',
        version: 'v0.9.5',
        title: 'Auth logic and stability fixes',
        highlights: [
            'Fixed Convex + Supabase auth initialization conflict in unified auth mode',
            'Aligned auth imports across screens to use the unified auth entrypoint',
            'Cleaned up auth-related hook dependencies to prevent state edge cases',
        ],
    },
    {
        date: 'February 17, 2026',
        version: 'v0.9.4',
        title: 'Performance improvements',
        highlights: [
            'Memoized list rows and stabilized callbacks in data demo flows',
            'Reduced avoidable rerenders in navigation-heavy UI paths',
            'Removed non-essential debug logs from render-sensitive areas',
        ],
    },
]

export function LandingPage({
    mode,
    appName = import.meta.env.VITE_APP_NAME || 'Shipnative',
    tagline = 'Ship your mobile app in days, not months',
    description = mode === 'waitlist'
        ? 'Join the waitlist to get early access and exclusive launch benefits.'
        : 'Download now and start building your mobile app today.',
    screenshotUrl = import.meta.env.VITE_APP_SCREENSHOT_URL || '/app-screenshot.png',
    iosUrl = import.meta.env.VITE_IOS_APP_URL,
    androidUrl = import.meta.env.VITE_ANDROID_APP_URL,
}: LandingPageProps) {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!validateEmail(email)) {
            setStatus('error')
            setErrorMessage('Please enter a valid email address')
            return
        }

        setStatus('loading')
        setErrorMessage('')

        try {
            const apiEndpoint = import.meta.env.VITE_WAITLIST_API_ENDPOINT

            if (apiEndpoint) {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                })

                if (!response.ok) throw new Error('Submission failed')
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000))
                if (import.meta.env.DEV) {
                    console.log('Waitlist signup (demo):', email)
                }
            }

            setStatus('success')
            setEmail('')
        } catch (error) {
            setStatus('error')
            setErrorMessage('Something went wrong. Please try again.')
            if (import.meta.env.DEV) {
                console.error('Waitlist error:', error)
            }
        }
    }

    const isWaitlist = mode === 'waitlist'

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans selection:bg-slate-900 selection:text-white overflow-x-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-gradient-to-br from-blue-100/40 to-purple-100/40 blur-[120px] rounded-full mix-blend-multiply opacity-70" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vw] bg-gradient-to-tr from-emerald-100/40 to-teal-100/40 blur-[120px] rounded-full mix-blend-multiply opacity-70" />
            </div>

            <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
                    {/* Left Column - Content */}
                    <div className="space-y-10 text-center lg:text-left">
                        {/* Badge + Heading + Tagline Group */}
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mx-auto lg:mx-0">
                                <Sparkles className={`w-4 h-4 ${isWaitlist ? 'text-amber-500 fill-amber-500' : 'text-emerald-500 fill-emerald-500'}`} />
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    {isWaitlist ? 'Coming Soon' : 'Now Available'}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                                    {appName}
                                </h1>
                                <p className="text-lg sm:text-xl text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                                    {tagline}
                                </p>
                            </div>
                        </div>

                        {/* Description + CTA Group */}
                        <div className="space-y-6">
                            <p className="text-base text-slate-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
                                {description}
                            </p>

                            {isWaitlist ? (
                                /* Waitlist Form */
                                <div className="max-w-md mx-auto lg:mx-0">
                                    {status === 'success' ? (
                                        <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                    <Check className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-lg font-bold text-slate-900">You're on the list!</h3>
                                                    <p className="text-sm text-slate-600">We'll be in touch soon.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setStatus('idle')}
                                                className="mt-4 text-sm text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors"
                                            >
                                                Register another email
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="relative group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Enter your email address"
                                                    className="w-full h-16 pl-6 pr-36 bg-white border border-slate-200 rounded-2xl text-lg outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all placeholder:text-slate-400 shadow-sm group-hover:shadow-md"
                                                    disabled={status === 'loading'}
                                                />
                                                <div className="absolute right-2 top-2 bottom-2">
                                                    <button
                                                        type="submit"
                                                        disabled={status === 'loading'}
                                                        className="h-full px-6 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20"
                                                    >
                                                        {status === 'loading' ? (
                                                            <span className="animate-pulse">Joining...</span>
                                                        ) : (
                                                            <>
                                                                Join
                                                                <ArrowRight className="w-4 h-4" />
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            {status === 'error' && (
                                                <p className="absolute -bottom-8 left-6 text-sm font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                                                    {errorMessage}
                                                </p>
                                            )}
                                        </form>
                                    )}
                                    <p className="mt-4 text-xs font-medium text-slate-400 uppercase tracking-wide text-center lg:text-left">
                                        No spam • Unsubscribe anytime
                                    </p>
                                </div>
                            ) : (
                                /* Store Buttons */
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                        {iosUrl ? (
                                            <a
                                                href={iosUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="transition-transform hover:scale-105 active:scale-95"
                                            >
                                                <img
                                                    src="/app-store-badge.svg"
                                                    alt="Download on the App Store"
                                                    className="h-14"
                                                />
                                            </a>
                                        ) : (
                                            <div className="opacity-40">
                                                <img
                                                    src="/app-store-badge.svg"
                                                    alt="App Store - Coming Soon"
                                                    className="h-14"
                                                />
                                            </div>
                                        )}

                                        {androidUrl ? (
                                            <a
                                                href={androidUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="transition-transform hover:scale-105 active:scale-95"
                                            >
                                                <img
                                                    src="/google-play-badge.svg"
                                                    alt="Get it on Google Play"
                                                    className="h-14"
                                                />
                                            </a>
                                        ) : (
                                            <div className="opacity-40">
                                                <img
                                                    src="/google-play-badge.svg"
                                                    alt="Google Play - Coming Soon"
                                                    className="h-14"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {(!iosUrl && !androidUrl) && (
                                        <p className="text-xs text-slate-400 text-center lg:text-left">
                                            Store links coming soon
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Visual */}
                    <div className="relative lg:h-[800px] flex items-center justify-center lg:justify-end">
                        <div className="relative w-[420px] hover:scale-[1.02] transition-transform duration-700 ease-out">
                            {/* Glow */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-[100px] -z-10" />

                            {/* Screenshot */}
                            <img
                                src={screenshotUrl}
                                alt="App Interface"
                                className="w-full h-auto"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="650"%3E%3Crect width="300" height="650" fill="%23f8fafc"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="18" fill="%2394a3b8"%3EApp Preview%3C/text%3E%3C/svg%3E'
                                }}
                            />

                            {/* Floating Elements */}
                            <div className="absolute -right-8 top-24 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 animate-float-slow">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <Zap className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Performance</p>
                                        <p className="text-sm font-bold text-slate-900">Lightning Fast</p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -left-8 bottom-32 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 animate-float-slower">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Security</p>
                                        <p className="text-sm font-bold text-slate-900">Enterprise Grade</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Section */}
                <section className="mt-24 space-y-10">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">
                            Optimized for your AI workflow
                        </h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Shipnative ships with context packs and guardrails for the most popular AI coding assistants.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {aiTools.map((tool) => (
                            <a
                                key={tool.name}
                                href={tool.url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${tool.logoGradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity`} />
                                <div className="relative space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${tool.logoGradient} flex items-center justify-center text-white font-bold shadow-lg`}>
                                            {tool.logoText}
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600">
                                            {tool.domain}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{tool.name}</h3>
                                        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                            {tool.tagline}
                                        </p>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* Features Grid */}
                <section className="mt-24 space-y-10">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">
                            Everything you need to ship
                        </h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Production-ready components and integrations, pre-configured and documented.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[minmax(240px,auto)]">
                        {bentoTiles.map((tile, i) => (
                            <div
                                key={i}
                                className={`group relative overflow-hidden bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 ${tile.span || ''}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${tile.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                <div className="relative h-full p-8 flex flex-col">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 group-hover:scale-110 transition-transform duration-300">
                                            <tile.icon className="w-6 h-6 text-slate-900" />
                                        </div>
                                        {tile.pill && (
                                            <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                                                {tile.pill}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                                        {tile.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-6">
                                        {tile.description}
                                    </p>

                                    {tile.points && (
                                        <ul className="mt-auto space-y-2">
                                            {tile.points.map((point, j) => (
                                                <li key={j} className="flex items-start gap-2 text-xs font-medium text-slate-500">
                                                    <div className="mt-1 w-1 h-1 rounded-full bg-slate-400" />
                                                    {point}
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {tile.metric && (
                                        <div className="mt-auto pt-4 border-t border-slate-100">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-bold text-slate-900">{tile.metric.value}</span>
                                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{tile.metric.label}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Changelog */}
                <section className="mt-24 space-y-10">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">
                            Latest changelog
                        </h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            The most recent shipping updates to security, logic, and performance.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {changelogItems.map((entry) => (
                            <article
                                key={`${entry.version}-${entry.title}`}
                                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
                            >
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        {entry.date}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wide">
                                        {entry.version}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">{entry.title}</h3>
                                <ul className="space-y-2">
                                    {entry.highlights.map((highlight) => (
                                        <li
                                            key={highlight}
                                            className="text-sm text-slate-600 leading-relaxed flex items-start gap-2"
                                        >
                                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                                            <span>{highlight}</span>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </section>

                <footer className="mt-32 py-12 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-400 font-medium">
                        © {new Date().getFullYear()} {appName}. All rights reserved.
                    </p>
                </footer>
            </main>
        </div>
    )
}

// Export legacy component names for backwards compatibility
export const WaitlistMode = (props: Omit<LandingPageProps, 'mode'>) => (
    <LandingPage {...props} mode="waitlist" />
)

export const LaunchMode = (props: Omit<LandingPageProps, 'mode'>) => (
    <LandingPage {...props} mode="launch" />
)
