import type { Lapse, RainBand, Tone } from './types'

export function cityKey(raw: string | null | undefined): string {
  if (!raw) return ''
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (n.startsWith('medellin')) return 'medellin'
  if (n.startsWith('itagui')) return 'itagui'
  if (n.includes('estrella')) return 'la estrella'
  return n
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

export function parseLocal(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? '00'}-05:00`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function finite(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

export function lapseOf(date = new Date()): Lapse {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'America/Bogota',
    }).format(date),
  )
  if (hour <= 5) return 'madrugada'
  if (hour <= 11) return 'mannana'
  if (hour <= 17) return 'tarde'
  return 'noche'
}

export function lapseLabel(lapse: Lapse): string {
  if (lapse === 'madrugada') return 'Madrugada'
  if (lapse === 'mannana') return 'Mañana'
  if (lapse === 'tarde') return 'Tarde'
  return 'Noche'
}

export function band(value: unknown): RainBand {
  const text = String(value ?? '').toUpperCase()
  if (text === 'ALTA') return 'ALTA'
  if (text === 'MEDIA') return 'MEDIA'
  return 'BAJA'
}

export function clock(date: Date | null): string {
  if (!date) return 'sin hora'
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(date)
}

export function ago(date: Date | null, now = new Date()): string {
  if (!date) return 'sin hora'
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000)
  if (minutes < 2) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `hace ${hours} h`
  return clock(date)
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = parseLocal(`${iso} 12:00:00`)
  if (!date) return iso
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)
  const tomorrowDate = new Date(now.getTime() + 86400000)
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(tomorrowDate)
  if (iso === today) return 'Hoy'
  if (iso === tomorrow) {
    const dayNum = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'America/Bogota' }).format(date)
    return `Mañana ${dayNum}`
  }
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'America/Bogota',
  }).format(date)
}

export function formatTemp(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}

export function formatMm(value: number): string {
  if (value >= 10) return `${value.toFixed(0)} mm`
  return `${value.toFixed(1)} mm`
}

export function formatWind(ms: number | null, cardinal: string | null): string {
  if (ms == null) return 'viento sin dato'
  const kmh = Math.round(ms * 3.6)
  return cardinal ? `${kmh} km/h del ${cardinal}` : `${kmh} km/h`
}

export function icaCategory(ica: number | null): string {
  if (ica == null) return 'Sin dato'
  if (ica <= 50) return 'Buena'
  if (ica <= 100) return 'Aceptable'
  if (ica <= 150) return 'Dañina para grupos sensibles'
  if (ica <= 200) return 'Dañina para la salud'
  if (ica <= 300) return 'Muy dañina'
  return 'Peligrosa'
}

export function icaAdvice(ica: number | null): string {
  if (ica == null) return 'Esta estación no tiene un promedio válido de 24 horas.'
  if (ica <= 50) return 'La contaminación representa poco o ningún riesgo. Buen momento para estar al aire libre.'
  if (ica <= 100) return 'La calidad es aceptable para la mayoría. Los grupos sensibles pueden notar alguna molestia.'
  if (ica <= 150) return 'Niños, personas mayores y quienes tienen asma o corazón deberían acortar el esfuerzo al aire libre.'
  if (ica <= 200) return 'Conviene limitar el tiempo al aire libre. Toda la población puede sentir efectos.'
  if (ica <= 300) return 'Mejor permanecer en interiores y evitar el ejercicio afuera.'
  return 'Emergencia sanitaria. Hay que reducir la exposición al mínimo.'
}

export function airTone(ica: number | null): Tone {
  if (ica == null) return 'mute'
  if (ica > 200) return 'critical'
  if (ica > 150) return 'alert'
  if (ica > 100) return 'watch'
  return 'ok'
}

export function rainTone(mm: number): Tone {
  if (mm >= 16) return 'critical'
  if (mm >= 8) return 'alert'
  if (mm >= 2) return 'watch'
  return 'ok'
}

export function rainWord(mm: number, raining: boolean): string {
  if (!raining && mm < 0.2) return 'Sin lluvia'
  if (mm < 1) return 'Llovizna'
  if (mm < 4) return 'Lluvia'
  if (mm < 8) return 'Lluvia moderada'
  if (mm < 16) return 'Lluvia fuerte'
  return 'Lluvia torrencial'
}

const RANK: Record<Tone, number> = { mute: 0, ok: 1, watch: 2, alert: 3, critical: 4 }

export function dominant(tones: Tone[]): Tone {
  if (!tones.length) return 'mute'
  return tones.reduce((best, tone) => (RANK[tone] > RANK[best] ? tone : best))
}

export function toneRank(tone: Tone): number {
  return RANK[tone]
}
