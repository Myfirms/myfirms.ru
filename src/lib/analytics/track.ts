/**
 * Conversion events → Яндекс.Метрика goals (reachGoal) and GA4 (gtag).
 * Both tags are optional (env-gated in BaseLayout); calls are no-ops when a
 * tag isn't loaded.
 */
declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    __YM_ID__?: number;
  }
}

export type GoalName = 'lead_submit' | 'lead_form_open' | 'youtube_click';

export function trackGoal(goal: GoalName, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  if (window.ym && window.__YM_ID__) window.ym(window.__YM_ID__, 'reachGoal', goal, params);
  window.gtag?.('event', goal, params);
}
