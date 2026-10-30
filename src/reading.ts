import type { Reading, Snapshot, Tone } from './types'
import { lenses, placeLabel, spinePlaces } from './places'
import {
  dominant,
  haversine,
  icaAdvice,
  icaCategory,
  lapseLabel,
  lapseOf,
  rainTone,
  formatMm,
  rainWord,
  toneRank,
  airTone,
} from './format'
import type { AirStation, AirSummary, MeteoStation, Place, RainStation, RainSummary, StreamStation, StreamSummary } from './types'

const LOCAL_KM = 6

export type Board = {
  spine: Reading[]
  byId: Map<string, Reading>
  focus: Reading | null
}

function within<T extends { lat: number; lon: number }>(items: T[], place: Place, km: number): T[] {
  return items.filter((item) => haversine(place.lat, place.lon, item.lat, item.lon) <= km)
}

function inCity<T extends { key: string }>(items: T[], key: string): T[] {
  return items.filter((item) => item.key === key)
}

function summarizeRain(stations: RainStation[], scope: RainSummary['scope']): RainSummary {
  const max = stations.reduce<RainStation | null>(
    (best, station) => (!best || station.mm15 > best.mm15 ? station : best),
    null,
  )
  return {
    scope,
    stations,
    raining: stations.filter((station) => station.raining).length,
    max: max && max.mm15 > 0 ? max : null,
    tone: rainTone(max?.mm15 ?? 0),
  }
}

function summarizeAir(stations: AirStation[], scope: AirSummary['scope']): AirSummary {
  const valid = stations.filter((station) => station.ica != null)
  const worst = valid.reduce<AirStation | null>(
    (best, station) => (!best || (station.ica ?? 0) > (best.ica ?? 0) ? station : best),
    null,
  )
  const mean = valid.length ? valid.reduce((sum, station) => sum + (station.ica ?? 0), 0) / valid.length : null
  return {
    scope,
    stations,
    worst,
    mean,
    tone: airTone(worst?.ica ?? null),
    category: icaCategory(worst?.ica ?? null),
  }
}

function ratio(station: StreamStation): number {
  if (station.level == null || !station.major) return 0
  return station.level / station.major
}

function summarizeStreams(stations: StreamStation[], scope: StreamSummary['scope']): StreamSummary {
  const ranked = [...stations].sort((a, b) => toneRank(b.tone) - toneRank(a.tone) || ratio(b) - ratio(a))
  return {
    scope,
    stations: ranked,
    worst: ranked.find((station) => station.tone !== 'mute') ?? null,
    critical: stations.filter((station) => station.tone === 'critical').length,
    alert: stations.filter((station) => station.tone === 'alert').length,
    watch: stations.filter((station) => station.tone === 'watch').length,
    tone: activeTone(stations),
  }
}

function activeTone(stations: StreamStation[]): Tone {
  const active = stations.map((station) => station.tone).filter((tone) => tone !== 'mute')
  return active.length ? dominant(active) : 'mute'
}

function nearestMeteo(snapshot: Snapshot, place: Place) {
  let best: (MeteoStation & { distanceKm: number }) | null = null
  for (const station of snapshot.meteo) {
    if (station.tempC == null) continue
    const distanceKm = haversine(place.lat, place.lon, station.lat, station.lon)
    if (!best || distanceKm < best.distanceKm) best = { ...station, distanceKm }
  }
  return best
}

function assemble(snapshot: Snapshot, place: Place, local: boolean): Reading {
  const cityRain = inCity(snapshot.rain, place.key)
  const cityAir = inCity(
    snapshot.air.filter((station) => station.reference),
    place.key,
  )
  const cityStreams = inCity(snapshot.streams, place.key)
  const rain =
    local && within(cityRain, place, LOCAL_KM).length >= 3
      ? summarizeRain(within(cityRain, place, LOCAL_KM), 'cerca')
      : summarizeRain(cityRain, 'municipio')
  const nearAir = within(cityAir, place, 8)
  const air = local && nearAir.length ? summarizeAir(nearAir, 'cerca') : summarizeAir(cityAir, 'municipio')
  const nearStreams = within(cityStreams, place, LOCAL_KM)
  const stream =
    local && nearStreams.length >= 2
      ? summarizeStreams(nearStreams, 'cerca')
      : summarizeStreams(cityStreams, 'municipio')
  return {
    place,
    meteo: nearestMeteo(snapshot, place),
    rain,
    air,
    stream,
    forecast: snapshot.forecasts[place.forecast] ?? null,
    tone: dominant([rain.tone, air.tone, stream.tone === 'mute' ? 'ok' : stream.tone]),
    sentence: '',
  }
}

function compose(reading: Reading, focus: Reading | null, citywide: Reading | null): string {
  const where = placeLabel(reading.place)
  const scope = reading.stream.scope === 'cerca' ? 'cerca de aquí' : `en ${reading.place.name}`
  const critical = reading.stream.stations.find((station) => station.tone === 'critical')
  if (critical) return `${critical.name} está en el nivel crítico del semáforo de SIATA, ${scope}.`
  const raised = reading.stream.stations.find((station) => station.tone === 'alert')
  if (raised) return `${raised.name} está en precaución alta ${scope}.`
  const max = reading.rain.max
  if (max && max.mm15 >= 8) {
    const reach = reading.rain.scope === 'cerca' ? 'en esta zona' : `en ${reading.place.name}`
    return `Llueve fuerte ${reach}: ${max.mm15.toFixed(1)} mm en 15 minutos en ${max.name}.`
  }
  if ((reading.air.worst?.ica ?? 0) >= 151) {
    return `El aire en ${where} está en categoría ${reading.air.category.toLowerCase()}. ${icaAdvice(reading.air.worst?.ica ?? null)}`
  }
  if ((reading.air.worst?.ica ?? 0) >= 101) {
    return `El aire es desfavorable para grupos sensibles en ${where}.`
  }
  if (
    citywide &&
    toneRank(citywide.tone) > toneRank(reading.tone) &&
    (citywide.stream.critical > 0 || citywide.stream.alert > 0)
  ) {
    const stream = citywide.stream.stations.find((station) => station.tone === 'critical' || station.tone === 'alert')
    if (stream) {
      return `Cerca de ${where} la señal es menor. En el municipio, ${stream.name} marca ${stream.status.toLowerCase()}.`
    }
  }
  if (reading.stream.watch > 0) {
    const noun = reading.stream.watch === 1 ? 'quebrada está' : 'quebradas están'
    return `${reading.stream.watch} ${noun} en atención ${scope}, sin un nivel crítico.`
  }
  const today = reading.forecast?.days[0]
  const chance = today ? today[lapseOf()] : null
  if (chance === 'ALTA' && reading.rain.raining > 0) {
    const reach = reading.rain.scope === 'cerca' ? 'cerca' : `en ${reading.place.name}`
    return `${lapseLabel(lapseOf())} con probabilidad alta de lluvia y ${reading.rain.raining} sensores ya activos ${reach}.`
  }
  if (reading.rain.raining > 0 && max) {
    const reach = reading.rain.scope === 'cerca' ? 'cerca de este punto' : `en ${reading.place.name}`
    return `${rainWord(max.mm15, true)} ${reach}. El sensor más intenso es ${max.name}.`
  }
  if (focus && focus.place.key !== reading.place.key && toneRank(focus.tone) >= toneRank('alert')) {
    return `En ${where} no hay una señal crítica. La atención del valle está en ${placeLabel(focus.place)}.`
  }
  const air = reading.air.worst ? `aire ${reading.air.category.toLowerCase()}` : 'sin una lectura vigente de aire'
  return `Condiciones tranquilas en ${where}: sin lluvia fuerte y ${air}.`
}

export function buildBoard(snapshot: Snapshot): Board {
  const spine = spinePlaces().map((place) => assemble(snapshot, place, false))
  const focus =
    [...spine].sort((a, b) => toneRank(b.tone) - toneRank(a.tone)).find((reading) => toneRank(reading.tone) >= 2) ??
    null
  const cityOf = new Map(spine.map((reading) => [reading.place.key, reading]))
  for (const reading of spine) reading.sentence = compose(reading, focus, null)

  const byId = new Map<string, Reading>()
  for (const place of [...spinePlaces(), ...lenses()]) {
    const local = place.lens ? assemble(snapshot, place, true) : cityOf.get(place.key)!
    if (place.lens) local.sentence = compose(local, focus, cityOf.get(place.key) ?? null)
    byId.set(place.id, place.lens ? local : cityOf.get(place.key)!)
  }
  return { spine, byId, focus }
}

export function statusLine(reading: Reading): string {
  const parts: string[] = []
  if (reading.stream.critical) parts.push(reading.stream.critical === 1 ? '1 quebrada crítica' : `${reading.stream.critical} quebradas críticas`)
  else if (reading.stream.alert) parts.push(reading.stream.alert === 1 ? '1 en precaución alta' : `${reading.stream.alert} en precaución alta`)
  else if (reading.stream.watch) parts.push(reading.stream.watch === 1 ? '1 en atención' : `${reading.stream.watch} en atención`)
  if ((reading.rain.max?.mm15 ?? 0) >= 2 && reading.rain.max) parts.push(`lluvia ${formatMm(reading.rain.max.mm15)}`)
  if ((reading.air.worst?.ica ?? 0) > 100 && reading.air.worst?.ica != null) {
    parts.push(`ICA ${Math.round(reading.air.worst.ica)}`)
  }
  return parts.length ? parts.join(' · ') : 'Sin señales críticas'
}

export function toneWord(tone: Tone): string {
  if (tone === 'critical') return 'crítica'
  if (tone === 'alert') return 'alta'
  if (tone === 'watch') return 'atención'
  if (tone === 'ok') return 'estable'
  return 'sin dato'
}
