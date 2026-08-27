import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computeForecast, riskColorHex, lineKey, dist, transferMinutes } from '../lib/forecast.js'
import { MAP_CENTER, MAP_ZOOM } from '../data/network.js'

/**
 * Renders an interactive Leaflet map using OpenStreetMap tiles centered on Mekane Selam, Ethiopia.
 * Displays interactive custom HTML markers for hospitals and suppliers, mesh/escalation connections,
 * and imperatively manages real-time drone flight dispatch animations with smooth coordinate interpolation.
 */
const NetworkMap = forwardRef(function NetworkMap(
  { hospitals, externals, meshPairs, escalationPairs, selectedId, onSelect, activeTransferKeys },
  ref
) {
  const mapContainerRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markersRef = useRef({})
  const polylinesRef = useRef({})
  const bannerRef = useRef(null)
  const activeAnimRef = useRef(null)

  function byId(id) {
    return hospitals.find((h) => h.id === id) || externals[id]
  }

  // Initialize Leaflet Map once & setup ResizeObserver for map resizing
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    leafletMapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  // Update Polylines (mesh and escalation connections)
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    // Clean up old polylines
    Object.values(polylinesRef.current).forEach((p) => map.removeLayer(p))
    polylinesRef.current = {}

    // Escalation lines (dashed line to external suppliers)
    escalationPairs.forEach(([a, b]) => {
      const A = byId(a)
      const B = byId(b)
      if (A && B && A.lat && B.lat) {
        const polyline = L.polyline(
          [
            [A.lat, A.lng],
            [B.lat, B.lng],
          ],
          {
            color: '#94a3b8',
            weight: 2,
            dashArray: '5, 7',
            opacity: 0.7,
          }
        ).addTo(map)
        polylinesRef.current[`esc-${a}-${b}`] = polyline
      }
    })

    // Mesh network lines
    meshPairs.forEach(([a, b]) => {
      const A = byId(a)
      const B = byId(b)
      if (A && B && A.lat && B.lat) {
        const key = lineKey(a, b)
        const active = activeTransferKeys.has(key)
        const polyline = L.polyline(
          [
            [A.lat, A.lng],
            [B.lat, B.lng],
          ],
          {
            color: active ? '#2563eb' : '#94a3b8',
            weight: active ? 4 : 2,
            opacity: active ? 0.9 : 0.45,
            dashArray: active ? '8, 8' : undefined,
          }
        ).addTo(map)
        polylinesRef.current[key] = polyline
      }
    })
  }, [hospitals, externals, meshPairs, escalationPairs, activeTransferKeys])

  // Update Markers (External suppliers & Remote Hospitals)
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    // Render external supplier markers
    Object.values(externals).forEach((node) => {
      if (!node.lat || !node.lng) return
      let marker = markersRef.current[node.id]

      const iconHtml = `
        <div class="leaflet-external-node ${node.kind === 'bank' ? 'bank' : 'external'}">
          <div class="ext-badge">${node.kind === 'bank' ? '🏥 Regional Supplier' : '🏥 Hospital'}</div>
          <div class="ext-name">${node.name}</div>
        </div>
      `

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker-ext',
        html: iconHtml,
        iconSize: [140, 40],
        iconAnchor: [70, 20],
      })

      if (marker) {
        marker.setIcon(customIcon)
        marker.setLatLng([node.lat, node.lng])
      } else {
        marker = L.marker([node.lat, node.lng], { icon: customIcon }).addTo(map)
        markersRef.current[node.id] = marker
      }
    })

    // Render hospital markers
    hospitals.forEach((h) => {
      if (!h.lat || !h.lng) return
      const f = computeForecast(h)
      const colorHex = riskColorHex(f.risk)
      const isSelected = h.id === selectedId

      const markerHtml = `
        <div class="leaflet-hospital-node ${isSelected ? 'selected' : ''} ${h.pph > 0 ? 'pph-alert' : ''}">
          ${h.pph > 0 ? '<div class="pulse-ring" style="border-color:' + colorHex + '"></div>' : ''}
          <div class="node-icon-circle" style="border-color: ${colorHex};">
            <svg viewBox="0 0 14 14" width="14" height="14">
              <rect x="5" y="0" width="4" height="14" rx="1" fill="${colorHex}" />
              <rect x="0" y="5" width="14" height="4" rx="1" fill="${colorHex}" />
            </svg>
          </div>
          <div class="node-label-box">
            <span class="hosp-title">${h.name}</span>
            <span class="hosp-meta">${h.available} u · ${h.bloodType} · <strong style="color:${colorHex}">${f.risk.toUpperCase()}</strong></span>
          </div>
        </div>
      `

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: markerHtml,
        iconSize: [160, 50],
        iconAnchor: [80, 25],
      })

      let marker = markersRef.current[h.id]
      if (marker) {
        marker.setIcon(customIcon)
        marker.setLatLng([h.lat, h.lng])
      } else {
        marker = L.marker([h.lat, h.lng], { icon: customIcon }).addTo(map)
        marker.on('click', () => onSelect(h.id))
        markersRef.current[h.id] = marker
      }
    })
  }, [hospitals, externals, selectedId, onSelect])

  // Expose imperative animateDrone function and invalidateSize helper
  useImperativeHandle(ref, () => ({
    invalidateSize() {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize()
      }
    },
    animateDrone(fromNode, toNode, units, durationMs) {
      return new Promise((resolve) => {
        const map = leafletMapRef.current
        if (!map) {
          resolve()
          return
        }

        const fromLat = fromNode.lat
        const fromLng = fromNode.lng
        const toLat = toNode.lat
        const toLng = toNode.lng

        // Flight Polyline Trail
        const trailPolyline = L.polyline([[fromLat, fromLng], [fromLat, fromLng]], {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          dashArray: '4, 4',
        }).addTo(map)

        // Custom Drone Icon
        const droneIcon = L.divIcon({
          className: 'leaflet-drone-marker',
          html: `
            <div class="drone-container">
              <div class="drone-glow"></div>
              <div class="drone-body-graphic">
                <span class="rotor r-tl"></span>
                <span class="rotor r-tr"></span>
                <span class="rotor r-bl"></span>
                <span class="rotor r-br"></span>
                <div class="core"></div>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const droneMarker = L.marker([fromLat, fromLng], { icon: droneIcon, zIndexOffset: 1000 }).addTo(map)

        const totalKm = dist(fromNode, toNode)
        const totalMin = transferMinutes(totalKm)
        const start = performance.now()

        function frame(now) {
          const t = Math.min(1, (now - start) / durationMs)
          const currentLat = fromLat + (toLat - fromLat) * t
          const currentLng = fromLng + (toLng - fromLng) * t

          droneMarker.setLatLng([currentLat, currentLng])
          trailPolyline.setLatLngs([[fromLat, fromLng], [currentLat, currentLng]])

          if (bannerRef.current) {
            const remainingTotalMin = totalMin * (1 - t)
            const mm = String(Math.floor(remainingTotalMin)).padStart(2, '0')
            const ss = String(Math.round((remainingTotalMin - Math.floor(remainingTotalMin)) * 60)).padStart(2, '0')
            bannerRef.current.innerHTML = `<span class="tag">🚁 ${fromNode.name} → ${toNode.name}</span> · ${units} units <span class="eta">ETA ${mm}:${ss}</span>`
            bannerRef.current.className = 'dispatch-banner show'
          }

          if (t < 1) {
            activeAnimRef.current = requestAnimationFrame(frame)
          } else {
            if (bannerRef.current) {
              bannerRef.current.innerHTML = `<span class="delivered">✓ Delivered</span> — ${units} units at ${toNode.name}`
            }
            setTimeout(() => {
              if (map) {
                map.removeLayer(trailPolyline)
                map.removeLayer(droneMarker)
              }
              if (bannerRef.current) bannerRef.current.classList.remove('show')
              resolve()
            }, 900)
          }
        }
        activeAnimRef.current = requestAnimationFrame(frame)
      })
    },
  }))

  return (
    <div className="map-frame leaflet-map-frame">
      <div className="dispatch-banner" ref={bannerRef}></div>
      <div ref={mapContainerRef} className="leaflet-container-view" style={{ width: '100%', height: '560px' }} />
    </div>
  )
})

export default NetworkMap
