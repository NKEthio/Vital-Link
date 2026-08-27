import { describe, it, expect } from 'vitest'
import {
  dist,
  transferMinutes,
  clamp,
  computeForecast,
  patientLoadPct,
  maternityShare,
  riskColor,
  riskColorHex,
  bestSurplusNeighbor,
  generateReasons,
  recommendationText,
  lineKey,
} from './forecast.js'

describe('forecast library pure functions', () => {
  describe('dist and transferMinutes', () => {
    it('calculates Euclidean distance in km using PIXEL_TO_KM conversion', () => {
      const a = { x: 0, y: 0 }
      const b = { x: 30, y: 40 }
      // sqrt(30^2 + 40^2) = 50. 50 * 0.115 = 5.75
      expect(dist(a, b)).toBeCloseTo(5.75)
    })

    it('calculates transfer minutes accurately with a minimum floor of 4 minutes', () => {
      // 80 km/h speed: 80 km in 60 mins -> 1 km in 0.75 mins
      // 40 km -> 30 mins
      expect(transferMinutes(40)).toBe(30)
      // 2 km -> 1.5 mins, clamped to min 4 mins
      expect(transferMinutes(2)).toBe(4)
    })
  })

  describe('clamp', () => {
    it('clamps values within lower and upper bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('computeForecast', () => {
    it('computes 48-hour forecast without PPH', () => {
      const hospital = {
        needed: 5,
        dailyConsumption: 10,
        available: 20,
        pph: 0,
        emergencyDemand: 8,
      }
      // requirement48 = 5 + 10 + 0 = 15
      // shortage = max(0, 15 - 20) = 0
      // surplus = 20 - 15 = 5
      // risk = 'stable'
      const f = computeForecast(hospital)
      expect(f.requirement48).toBe(15)
      expect(f.shortage).toBe(0)
      expect(f.hoursToShortage).toBeNull()
      expect(f.surplus).toBe(5)
      expect(f.risk).toBe('stable')
    })

    it('computes watch risk level when shortage is between 1 and 6', () => {
      const hospital = {
        needed: 10,
        dailyConsumption: 10,
        available: 15,
        pph: 0,
        emergencyDemand: 8,
      }
      // requirement48 = 20
      // shortage = 5
      // hoursToShortage = round((15 / 20) * 48) = 36
      const f = computeForecast(hospital)
      expect(f.requirement48).toBe(20)
      expect(f.shortage).toBe(5)
      expect(f.hoursToShortage).toBe(36)
      expect(f.surplus).toBe(-5)
      expect(f.risk).toBe('watch')
    })

    it('computes at-risk level when shortage is greater than 6', () => {
      const hospital = {
        needed: 10,
        dailyConsumption: 10,
        available: 25,
        pph: 1,
        emergencyDemand: 10,
      }
      // requirement48 = 10 + 10 + 10 = 30
      // available = 20 -> shortage = 10 (>6 -> at-risk)
      hospital.available = 20
      const f = computeForecast(hospital)
      expect(f.requirement48).toBe(30)
      expect(f.shortage).toBe(10)
      expect(f.risk).toBe('at-risk')
    })
  })

  describe('patientLoadPct and maternityShare', () => {
    it('calculates percentage deviation from baseline patients', () => {
      const h = { patients: 33, baselinePatients: 30 }
      expect(patientLoadPct(h)).toBe(10)
    })

    it('calculates maternity share percentage of active patients', () => {
      const h = { patients: 40, maternity: 12 }
      expect(maternityShare(h)).toBe(30)
    })
  })

  describe('riskColor and riskColorHex', () => {
    it('returns appropriate color variables and hex codes for risk levels', () => {
      expect(riskColor('at-risk')).toBe('var(--red)')
      expect(riskColor('watch')).toBe('var(--amber)')
      expect(riskColor('stable')).toBe('var(--green)')

      expect(riskColorHex('at-risk')).toBe('#f0534a')
      expect(riskColorHex('watch')).toBe('#eca83e')
      expect(riskColorHex('stable')).toBe('#3ecf8e')
    })
  })

  describe('bestSurplusNeighbor', () => {
    const hospitals = [
      {
        id: 'h1',
        name: 'Hospital 1',
        x: 0,
        y: 0,
        available: 10,
        needed: 15,
        dailyConsumption: 5,
        pph: 0,
      }, // shortage 10 -> surplus -10
      {
        id: 'h2',
        name: 'Hospital 2',
        x: 10,
        y: 0,
        available: 30,
        needed: 5,
        dailyConsumption: 5,
        pph: 0,
      }, // req 10 -> surplus 20
      {
        id: 'h3',
        name: 'Hospital 3',
        x: 50,
        y: 0,
        available: 40,
        needed: 5,
        dailyConsumption: 5,
        pph: 0,
      }, // req 10 -> surplus 30
      {
        id: 'h4',
        name: 'Hospital 4',
        x: 5,
        y: 0,
        available: 10,
        needed: 10,
        dailyConsumption: 5,
        pph: 0,
      }, // req 15 -> surplus -5
    ]

    it('ranks neighbors with surplus by distance (nearest first)', () => {
      const target = hospitals[0]
      const results = bestSurplusNeighbor(target, hospitals)
      expect(results.length).toBe(2)
      expect(results[0].hospital.id).toBe('h2')
      expect(results[1].hospital.id).toBe('h3')
    })

    it('excludes specified hospital IDs', () => {
      const target = hospitals[0]
      const results = bestSurplusNeighbor(target, hospitals, ['h2'])
      expect(results.length).toBe(1)
      expect(results[0].hospital.id).toBe('h3')
    })
  })

  describe('generateReasons and recommendationText', () => {
    const hospitals = [
      {
        id: 'h1',
        name: 'Hospital 1',
        x: 0,
        y: 0,
        available: 10,
        needed: 15,
        dailyConsumption: 5,
        patients: 33,
        baselinePatients: 30,
        maternity: 12,
        pph: 1,
        emergencyDemand: 8,
      },
      {
        id: 'h2',
        name: 'Hospital 2',
        x: 10,
        y: 0,
        available: 40,
        needed: 5,
        dailyConsumption: 5,
        pph: 0,
      },
    ]

    it('generates expected reasons list for an at-risk hospital', () => {
      const target = hospitals[0]
      const reasons = generateReasons(target, hospitals)

      expect(reasons.some((r) => r.level === 'crit' && r.text.includes('Current stock is below projected 48-hour demand'))).toBe(true)
      expect(reasons.some((r) => r.level === 'warn' && r.text.includes('Patient volume is 10% above baseline'))).toBe(true)
      expect(reasons.some((r) => r.level === 'warn' && r.text.includes('Maternity admissions make up 36% of active patients'))).toBe(true)
      expect(reasons.some((r) => r.level === 'crit' && r.text.includes('Active PPH (postpartum haemorrhage) case'))).toBe(true)
      expect(reasons.some((r) => r.level === 'ok' && r.text.includes('Nearby Hospital 2 has sufficient surplus'))).toBe(true)
    })

    it('generates accurate recommendation text when surplus neighbor is available', () => {
      const target = hospitals[0]
      const rec = recommendationText(target, hospitals)
      expect(rec).toContain('Prepare a 18-unit transfer from <b>Hospital 2</b>')
    })

    it('recommends external escalation when no surplus neighbors exist', () => {
      const isolatedTarget = {
        id: 'h1',
        name: 'Hospital 1',
        x: 0,
        y: 0,
        available: 5,
        needed: 10,
        dailyConsumption: 5,
        pph: 0,
      }
      const emptyNeighbors = [isolatedTarget]
      const rec = recommendationText(isolatedTarget, emptyNeighbors)
      expect(rec).toContain('Escalate to external supply')
    })

    it('returns lineKey sorted correctly', () => {
      expect(lineKey('h2', 'h1')).toBe('h1|h2')
    })
  })
})
