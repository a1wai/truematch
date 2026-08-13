import { CATEGORIES } from './analysis.js'
import { strings } from './languages.js'

/**
 * Offline "simplify" — the version that works with no API key.
 *
 * It never invents language: the bullets are the localised one-line gist for
 * each category plus the person's own words, so a reader who only speaks Roman
 * Urdu still gets something true and readable. When a model is configured,
 * ai.js#simplifyReport produces a better-written version of the same thing.
 */
export function buildPlainSummary({ report, language, targetName, messages }) {
  const s = strings(language)
  const rank = { high: 3, medium: 2, low: 1 }

  const top = [...report.flags]
    .sort((a, b) => rank[b.severity] - rank[a.severity] || b.ts - a.ts)
    .slice(0, 3)

  const points = top.map((flag) => {
    const msg = messages.find((m) => m.id === flag.messageId)
    const quote = (msg?.text || flag.highlights?.[0] || '').slice(0, 90)
    return {
      id: flag.id,
      category: flag.category,
      severity: flag.severity,
      label: s.categories[flag.category] || CATEGORIES[flag.category].short,
      gist: s.gist[flag.category] || '',
      quote,
      messageId: flag.messageId,
    }
  })

  const bandLabel = s.bands?.[report.band.key] || report.band.label
  const bottomLine = points.length ? `${targetName}: ${report.risk}% — ${bandLabel}` : s.nothing

  return {
    bottomLine,
    points,
    nextStep: report.suggestions[0]?.line || '',
    source: 'local',
  }
}
