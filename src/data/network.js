// ---------------------------------------------------------------------------
// Network data model.
//
// This is where you'd eventually swap in a real data source (REST/GraphQL
// call, WebSocket feed, etc.) instead of the hardcoded demo values below.
// Everything downstream (forecast math, map, panels) only depends on the
// shapes defined here, so replacing `freshHospitals()` with a fetch is the
// main integration point.
// ---------------------------------------------------------------------------

export const DRONE_SPEED_KMH = 80
export const PIXEL_TO_KM = 0.115
export const TICK_MS = 3200

// External upstream suppliers, positioned in South Wollo / Amhara region.
export const externals = {
  bloodBank: { id: 'bloodBank', name: 'Dessie Regional Blood Bank', kind: 'bank', lat: 11.1300, lng: 39.6333 },
  externalA: { id: 'externalA', name: 'Borena General Hospital', kind: 'external', lat: 10.7000, lng: 38.7500 },
  externalB: { id: 'externalB', name: 'Kombolcha General Hospital', kind: 'external', lat: 11.0833, lng: 39.7333 },
}

// Map default center (Mekane Selam, Amhara, Ethiopia)
export const MAP_CENTER = [10.7500, 38.7500]
export const MAP_ZOOM = 10

// Returns a fresh copy of the four remote hospitals with real geographic coordinates
// centered around Mekane Selam & surrounding area in Amhara, Ethiopia.
export function freshHospitals() {
  return [
    {
      id: 'h1',
      name: 'Mekane Selam General Hospital',
      lat: 10.7512,
      lng: 38.7524,
      bloodType: 'O+',
      patients: 30,
      baselinePatients: 28,
      expectedIncoming: 5,
      maternity: 10,
      pph: 0,
      available: 42,
      needed: 15,
      dailyConsumption: 6,
      emergencyDemand: 9,
      history: [40, 41, 43, 42, 41, 42],
    },
    {
      id: 'h2',
      name: 'Gishen Hospital (Borena)',
      lat: 10.7850,
      lng: 38.8320,
      bloodType: 'A+',
      patients: 35,
      baselinePatients: 30,
      expectedIncoming: 6,
      maternity: 14,
      pph: 0,
      available: 20,
      needed: 24,
      dailyConsumption: 6,
      emergencyDemand: 10,
      history: [24, 23, 22, 21, 21, 20],
    },
    {
      id: 'h3',
      name: 'Sayint Health Center',
      lat: 10.6650,
      lng: 38.6950,
      bloodType: 'O+',
      patients: 42,
      baselinePatients: 36,
      expectedIncoming: 8,
      maternity: 17,
      pph: 0,
      available: 24,
      needed: 31,
      dailyConsumption: 7,
      emergencyDemand: 12,
      history: [29, 28, 27, 26, 25, 24],
    },
    {
      id: 'h4',
      name: 'Kelala Primary Hospital',
      lat: 10.8400,
      lng: 38.7120,
      bloodType: 'B+',
      patients: 25,
      baselinePatients: 26,
      expectedIncoming: 3,
      maternity: 8,
      pph: 0,
      available: 16,
      needed: 10,
      dailyConsumption: 5,
      emergencyDemand: 8,
      history: [17, 17, 16, 17, 16, 16],
    },
  ]
}

// The local blood-sharing mesh: every remote hospital can transfer to every
// other remote hospital.
export const meshPairs = [
  ['h1', 'h2'],
  ['h1', 'h3'],
  ['h1', 'h4'],
  ['h2', 'h3'],
  ['h2', 'h4'],
  ['h3', 'h4'],
]

// Escalation paths from the remote network up to external suppliers —
// drawn as dashed lines on the map, only used when the mesh can't cover a
// shortage on its own.
export const escalationPairs = [
  ['h4', 'externalA'],
  ['h4', 'externalB'],
  ['externalA', 'bloodBank'],
  ['externalB', 'bloodBank'],
]
