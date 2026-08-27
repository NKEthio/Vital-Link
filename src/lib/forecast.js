// ---------------------------------------------------------------------------
// Decision-support logic: 48-hour forecasting, risk classification, "why is
// this hospital at risk" reasoning, and the neighbor-search algorithm used
// during an emergency. Pure functions only — no DOM, no React — so this is
// easy to unit test or swap out later.
// ---------------------------------------------------------------------------

import { DRONE_SPEED_KMH, PIXEL_TO_KM } from '../data/network.js'

export function dist(a, b) {
  if (a.lat !== undefined && a.lng !== undefined && b.lat !== undefined && b.lng !== undefined) {
    // Haversine formula to compute geodesic distance in km between lat/lng coordinates
    const R = 6371
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const lat1 = (a.lat * Math.PI) / 180
    const lat2 = (b.lat * Math.PI) / 180

    const sinDLat = Math.sin(dLat / 2)
    const sinDLng = Math.sin(dLng / 2)
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
    return R * c
  }
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy) * PIXEL_TO_KM
}

export function transferMinutes(km) {
  return Math.max(4, Math.round((km / DRONE_SPEED_KMH) * 60))
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/**
 * 48-hour forecast for a single hospital.
 * requirement48 = current unmet need + one day's average consumption,
 * plus the hospital's emergency demand if a PPH case is active.
 */
export function computeForecast(h) {
  const requirement48 = h.needed + h.dailyConsumption + (h.pph ? h.emergencyDemand : 0)
  const shortage = Math.max(0, requirement48 - h.available)
  const hoursToShortage = shortage > 0 ? Math.round((h.available / requirement48) * 48) : null
  const surplus = h.available - requirement48 // negative if short
  let risk = 'stable'
  if (shortage > 6) risk = 'at-risk'
  else if (shortage > 0) risk = 'watch'
  return { requirement48, shortage, hoursToShortage, surplus, risk }
}

export function patientLoadPct(h) {
  return Math.round(((h.patients - h.baselinePatients) / h.baselinePatients) * 100)
}

export function maternityShare(h) {
  return Math.round((h.maternity / h.patients) * 100)
}

export function riskColor(risk) {
  return risk === 'at-risk' ? 'var(--red)' : risk === 'watch' ? 'var(--amber)' : 'var(--green)'
}

export function riskColorHex(risk) {
  return risk === 'at-risk' ? '#d9383a' : risk === 'watch' ? '#d97706' : '#059669'
}

/**
 * Ranks other hospitals by surplus (nearest first) as candidate blood
 * sources for `h`. `hospitals` is the full current hospital list.
 */
export function bestSurplusNeighbor(h, hospitals, excludeIds = []) {
  return hospitals
    .filter((o) => o.id !== h.id && !excludeIds.includes(o.id))
    .map((o) => {
      const f = computeForecast(o)
      return { hospital: o, surplus: Math.max(0, f.surplus), distance: dist(h, o) }
    })
    .filter((c) => c.surplus > 0)
    .sort((a, b) => a.distance - b.distance)
}

export function generateReasons(h, hospitals) {
  const f = computeForecast(h)
  const reasons = []

  if (f.shortage > 0) {
    reasons.push({
      level: 'crit',
      text: `Current stock is below projected 48-hour demand (short ${f.shortage} unit${f.shortage === 1 ? '' : 's'}).`,
    })
  } else {
    reasons.push({
      level: 'ok',
      text: `Current stock covers projected 48-hour demand with ${Math.abs(f.surplus)} unit${Math.abs(f.surplus) === 1 ? '' : 's'} to spare.`,
    })
  }

  const loadPct = patientLoadPct(h)
  if (loadPct >= 10) {
    reasons.push({ level: 'warn', text: `Patient volume is ${loadPct}% above baseline.` })
  }

  const matShare = maternityShare(h)
  if (matShare >= 30) {
    reasons.push({ level: 'warn', text: `Maternity admissions make up ${matShare}% of active patients.` })
  }

  if (h.pph) {
    reasons.push({ level: 'crit', text: 'Active PPH (postpartum haemorrhage) case is driving emergency blood demand.' })
  }

  const neighbors = bestSurplusNeighbor(h, hospitals)
  if (neighbors.length) {
    const n = neighbors[0]
    reasons.push({
      level: 'ok',
      text: `Nearby ${n.hospital.name} has sufficient surplus (${n.surplus} units, ${Math.round(n.distance)} km away).`,
    })
  } else if (f.shortage > 0) {
    reasons.push({
      level: 'crit',
      text: 'No neighboring hospital currently holds surplus stock — escalation to external supply is likely.',
    })
  }

  return reasons
}

export function recommendationText(h, hospitals) {
  const f = computeForecast(h)
  if (f.shortage <= 0) {
    return `No transfer needed. ${h.name} is projected to remain within safe supply for the next 48 hours.`
  }
  const neighbors = bestSurplusNeighbor(h, hospitals)
  if (neighbors.length) {
    const n = neighbors[0]
    const covered = Math.min(n.surplus, f.shortage)
    return `Prepare a ${covered}-unit transfer from <b>${n.hospital.name}</b> (${Math.round(n.distance)} km, ~${transferMinutes(n.distance)} min by drone).`
  }
  return `Escalate to external supply — no neighboring hospital can cover the ${f.shortage}-unit gap.`
}

export function lineKey(a, b) {
  return [a, b].sort().join('|')
}
