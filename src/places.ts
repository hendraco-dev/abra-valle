import type { Place } from './types'
import { haversine } from './format'

export const PLACES: Place[] = [
  {
    id: 'barbosa',
    name: 'Barbosa',
    key: 'barbosa',
    lat: 6.438,
    lon: -75.332,
    forecast: 'wrfbarbosa',
  },
  {
    id: 'girardota',
    name: 'Girardota',
    key: 'girardota',
    lat: 6.377,
    lon: -75.448,
    forecast: 'wrfgirardota',
  },
  {
    id: 'copacabana',
    name: 'Copacabana',
    key: 'copacabana',
    lat: 6.348,
    lon: -75.508,
    forecast: 'wrfcopacabana',
  },
  {
    id: 'bello',
    name: 'Bello',
    key: 'bello',
    lat: 6.338,
    lon: -75.558,
    forecast: 'wrfbello',
  },
  {
    id: 'med-cen',
    name: 'Medellín',
    key: 'medellin',
    lat: 6.247,
    lon: -75.565,
    forecast: 'wrfmedCentro',
    lens: 'Centro',
    lensNote: 'Fondo del valle',
  },
  {
    id: 'med-occ',
    name: 'Medellín',
    key: 'medellin',
    lat: 6.256,
    lon: -75.615,
    forecast: 'wrfmedOccidente',
    lens: 'Occidente',
    lensNote: 'Ladera occidental',
  },
  {
    id: 'med-ori',
    name: 'Medellín',
    key: 'medellin',
    lat: 6.21,
    lon: -75.5,
    forecast: 'wrfmedOriente',
    lens: 'Oriente',
    lensNote: 'Ladera oriental',
  },
  {
    id: 'med-pal',
    name: 'Palmitas',
    key: 'medellin',
    lat: 6.345,
    lon: -75.69,
    forecast: 'wrfpalmitas',
    lens: 'Palmitas',
    lensNote: 'Corregimiento de Palmitas',
  },
  {
    id: 'itagui',
    name: 'Itagüí',
    key: 'itagui',
    lat: 6.171,
    lon: -75.614,
    forecast: 'wrfitagui',
  },
  {
    id: 'envigado',
    name: 'Envigado',
    key: 'envigado',
    lat: 6.176,
    lon: -75.591,
    forecast: 'wrfenvigado',
  },
  {
    id: 'estrella',
    name: 'La Estrella',
    key: 'la estrella',
    lat: 6.158,
    lon: -75.643,
    forecast: 'wrflaestrella',
  },
  {
    id: 'sabaneta',
    name: 'Sabaneta',
    key: 'sabaneta',
    lat: 6.151,
    lon: -75.616,
    forecast: 'wrfsabaneta',
  },
  {
    id: 'caldas',
    name: 'Caldas',
    key: 'caldas',
    lat: 6.091,
    lon: -75.636,
    forecast: 'wrfcaldas',
  },
]

export const SPINE_IDS = [
  'barbosa',
  'girardota',
  'copacabana',
  'bello',
  'med-cen',
  'itagui',
  'envigado',
  'estrella',
  'sabaneta',
  'caldas',
]

export const LENS_IDS = ['med-cen', 'med-occ', 'med-ori', 'med-pal']

const byId = new Map(PLACES.map((place) => [place.id, place]))

export function placeById(id: string): Place {
  return byId.get(id) ?? PLACES[4]
}

export function spinePlaces(): Place[] {
  return SPINE_IDS.map((id) => placeById(id))
}

export function lenses(): Place[] {
  return LENS_IDS.map((id) => placeById(id))
}

export function nearestPlace(lat: number, lon: number): Place {
  let best = PLACES[4]
  let bestD = Infinity
  for (const place of PLACES) {
    const distance = haversine(lat, lon, place.lat, place.lon)
    if (distance < bestD) {
      best = place
      bestD = distance
    }
  }
  return best
}

export function placeLabel(place: Place): string {
  if (place.id === 'med-pal') return 'Palmitas'
  if (place.lens) return `Medellín ${place.lens.toLowerCase()}`
  return place.name
}
