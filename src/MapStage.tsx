import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type ImageSource, type Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Radar, RainStation } from './types'

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function MapStage({
  stations,
  city,
  radar,
  frame,
  showRadar,
  selectedId,
  onSelect,
  focus,
  active,
}: {
  stations: RainStation[]
  city: string
  radar: Radar | null
  frame: number
  showRadar: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  focus: { lat: number; lon: number }
  active: boolean
}) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const [ready, setReady] = useState(false)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!node.current) return
    let cancelled = false
    const map = new maplibregl.Map({
      container: node.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [focus.lon, focus.lat],
      zoom: 11.2,
      cooperativeGestures: false,
      pitchWithRotate: false,
      dragRotate: false,
      fadeDuration: 0,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      if (cancelled) return
      map.addSource('rain', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'rain',
        type: 'circle',
        source: 'rain',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 14, 8],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.92,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#10211b',
        },
      })
      map.on('click', 'rain', (event) => {
        const id = event.features?.[0]?.properties?.id
        if (id != null) selectRef.current(Number(id))
      })
      map.on('mouseenter', 'rain', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'rain', () => {
        map.getCanvas().style.cursor = ''
      })
      setReady(true)
    })
    mapRef.current = map
    const observed = node.current
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (map.getCanvas().clientWidth === 0 || map.getCanvas().clientHeight === 0) return
        map.resize()
      })
    })
    observer.observe(observed)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getSource('rain')) return
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: stations.map((station) => ({
        type: 'Feature',
        properties: {
          id: station.id,
          key: station.key,
          color: station.color,
          name: station.name,
        },
        geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
      })),
    }
    ;(map.getSource('rain') as GeoJSONSource).setData(data)
  }, [stations, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('rain')) return
    map.setPaintProperty('rain', 'circle-opacity', ['case', ['==', ['get', 'key'], city], 0.95, 0.3])
    map.setPaintProperty('rain', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? -1], 2.5, 1])
    map.setPaintProperty('rain', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedId ?? -1],
      '#f4fff8',
      '#10211b',
    ])
  }, [city, selectedId, stations, ready])

  useEffect(() => {
    if (!active) return
    mapRef.current?.resize()
  }, [active])

  const skipFocus = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (skipFocus.current) {
      skipFocus.current = false
      return
    }
    map.easeTo({ center: [focus.lon, focus.lat], duration: 420 })
  }, [focus.lat, focus.lon])

  useEffect(() => {
    const map = mapRef.current
    const shot = radar?.frames[frame]
    if (!map || !ready || !radar || !shot) return
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [radar.west, radar.north],
      [radar.east, radar.north],
      [radar.east, radar.south],
      [radar.west, radar.south],
    ]
    const existing = map.getSource('radar') as ImageSource | undefined
    if (!existing) {
      map.addSource('radar', { type: 'image', url: shot.url, coordinates })
      map.addLayer({ id: 'radar', type: 'raster', source: 'radar', paint: { 'raster-opacity': showRadar ? 0.72 : 0 } }, 'rain')
      return
    }
    existing.updateImage({ url: shot.url, coordinates })
    if (map.getLayer('radar')) map.setPaintProperty('radar', 'raster-opacity', showRadar ? 0.72 : 0)
  }, [radar, frame, showRadar, ready])

  return <div ref={node} className="map" />
}
