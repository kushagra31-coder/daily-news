import type { EngagementData } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGAGEMENT_KEY = 'dvn_engagement'
const CLICKS_THRESHOLD = 3
const TIME_THRESHOLD = 30   // seconds

// ─── Engagement tracking ──────────────────────────────────────────────────────

function readEngagement(): EngagementData {
  if (typeof window === 'undefined') return { clicks: 0, timeSpent: 0 }
  try {
    const raw = localStorage.getItem(ENGAGEMENT_KEY)
    return raw ? JSON.parse(raw) : { clicks: 0, timeSpent: 0 }
  } catch {
    return { clicks: 0, timeSpent: 0 }
  }
}

function writeEngagement(data: EngagementData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(data))
  } catch {
    // storage quota exceeded or private mode — ignore
  }
}

/**
 * Track a user engagement event.
 * Triggers a push-permission request once engagement thresholds are met.
 *
 * @param type - 'click' (each article click) | 'time' (call every 10s)
 */
export function trackEngagement(type: 'time' | 'click'): void {
  if (typeof window === 'undefined') return

  const data = readEngagement()

  if (type === 'click')  data.clicks    += 1
  if (type === 'time')   data.timeSpent += 10   // called on 10-second intervals

  writeEngagement(data)

  const shouldAsk =
    data.clicks >= CLICKS_THRESHOLD || data.timeSpent >= TIME_THRESHOLD

  if (shouldAsk && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    // Delay slightly so it does not feel jarring
    setTimeout(() => requestPushPermission(), 1000)
  }
}

// ─── Push permission ──────────────────────────────────────────────────────────

/**
 * Request browser push notification permission (only when status is 'default').
 * Subscribes to OneSignal if granted.
 */
export async function requestPushPermission(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      await subscribeToOneSignal()
    }
  } catch (err) {
    console.warn('[DVN] Push permission request failed:', err)
  }
}

// ─── OneSignal subscription ───────────────────────────────────────────────────

async function subscribeToOneSignal(): Promise<void> {
  try {
    // OneSignal SDK is loaded via next/script in layout.tsx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OneSignal = (window as any).OneSignal
    if (!OneSignal) return

    await OneSignal.push(() => {
      OneSignal.registerForPushNotifications()
    })
  } catch (err) {
    console.warn('[DVN] OneSignal subscription failed:', err)
  }
}

// ─── IST Peak Hours detection (enhancement #8) ───────────────────────────────

/**
 * IST peak windows: 7–9 AM, 12–2 PM, 7–10 PM
 * Returns true if current IST time falls within any peak window.
 */
export function isISTPeakHour(): boolean {
  const now = new Date()
  // IST = UTC+5:30
  const istOffset = 5 * 60 + 30
  const localOffset = -now.getTimezoneOffset()
  const diffMinutes = istOffset - localOffset
  const istDate = new Date(now.getTime() + diffMinutes * 60 * 1000)

  const h = istDate.getUTCHours()
  const m = istDate.getUTCMinutes()
  const hDec = h + m / 60  // decimal hour in IST

  return (
    (hDec >= 7  && hDec < 9)  ||   // Morning rush
    (hDec >= 12 && hDec < 14) ||   // Lunch break
    (hDec >= 19 && hDec < 22)      // Prime time
  )
}
