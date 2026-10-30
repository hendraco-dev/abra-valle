import type {
  AirSeries,
  AirStation,
  AlertItem,
  Camera,
  Forecast,
  ForecastDay,
  MeteoStation,
  Radar,
  RainSeries,
  RainStation,
  Snapshot,
  StreamSeries,
  StreamStation,
  TempSeries,
  Tone,
} from './types'
import { band, cityKey, finite, parseLocal } from './format'

type FeatureCollection = {
  type: string
  features?: Array<{
    geometry?: { coordinates?: number[] } | null
    properties?: Record<string, unknown>
  }>
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20000)
  const res = await fetch(url, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return (await res.json()) as T
}

function coord(feature: { geometry?: { coordinates?: number[] } | null }): [number, number] | null {
  const pair = feature.geometry?.coordinates
  if (!pair || pair.length < 2) return null
  const lon = pair[0]
  const lat = pair[1]
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

function streamTone(color: string | null): { tone: Tone; status: string } {
  const value = (color ?? '').toLowerCase()
  if (value === '#fc3a3a') return { tone: 'critical', status: 'Nivel crítico' }
  if (value === '#f29436') return { tone: 'alert', status: 'Precaución alta' }
  if (value === '#f9da41') return { tone: 'watch', status: 'Atención' }
  if (value === '#79c454') return { tone: 'ok', status: 'Estable' }
  if (value === '#707070') return { tone: 'mute', status: 'Dato rezagado' }
  return { tone: 'mute', status: 'Sin dato' }
}

function parseRain(raw: FeatureCollection): RainStation[] {
  const stations: RainStation[] = []
  for (const feature of raw.features ?? []) {
    const at = coord(feature)
    const p = feature.properties
    if (!at || !p) continue
    const id = finite(p.codigo, 0, 100000)
    const mm = finite(p.acumulado_15min, 0, 500)
    if (id == null) continue
    const city = String(p.ubicacion ?? '')
    stations.push({
      id,
      name: String(p.nombre ?? `Sensor ${id}`),
      city,
      key: cityKey(city),
      lat: at[1],
      lon: at[0],
      updated: parseLocal(p.fecha_ultima_actualizacion),
      mm15: mm ?? 0,
      raining: String(p.flag_precipitacion).toLowerCase() === 'yes' || (mm ?? 0) >= 0.2,
      color: typeof p.color_icono === 'string' ? p.color_icono : '#ffffff',
    })
  }
  return stations
}

function parseMeteo(raw: FeatureCollection): MeteoStation[] {
  const stations: MeteoStation[] = []
  for (const feature of raw.features ?? []) {
    const at = coord(feature)
    const p = feature.properties
    if (!at || !p) continue
    const id = finite(p.Codigo, 0, 100000)
    if (id == null) continue
    stations.push({
      id,
      name: String(p.NombreEstacion ?? `Estación ${id}`),
      lat: at[1],
      lon: at[0],
      updated: parseLocal(p.FechaUltimaModificacion),
      tempC: finite(p.Temperatura, -5, 45),
      windMs: finite(p.Magnitud_viento, 0, 60),
      windCardinal: typeof p.Direccion_viento_cardinal === 'string' ? p.Direccion_viento_cardinal : null,
      pressureHpa: finite(p.Presion_atmosferica, 600, 1100),
      humidity: finite(p.Humedad_relativa, 1, 100),
    })
  }
  return stations
}

function parseAir(raw: FeatureCollection, reference: boolean): AirStation[] {
  const stations: AirStation[] = []
  for (const feature of raw.features ?? []) {
    const at = coord(feature)
    const p = feature.properties
    if (!at || !p) continue
    const id = finite(p.codigo, 0, 100000)
    if (id == null) continue
    const city = String(p.Municipio ?? '')
    const ica = finite(p.ICA_24H_prom, 0, 500)
    stations.push({
      id,
      code: String(p.estacion ?? id),
      name: String(p.nombreEstacion ?? `Estación ${id}`),
      city,
      key: cityKey(city),
      lat: at[1],
      lon: at[0],
      pm25: finite(p.PM25_24H_prom, 0, 1000),
      ica,
      color: typeof p.color === 'string' ? p.color : '#91D23E',
      from: typeof p.fechaInicio === 'string' ? p.fechaInicio : null,
      to: typeof p.fechaFin === 'string' ? p.fechaFin : null,
      reference,
    })
  }
  return stations
}

function parseStreams(raw: FeatureCollection): StreamStation[] {
  const stations: StreamStation[] = []
  for (const feature of raw.features ?? []) {
    const at = coord(feature)
    const p = feature.properties
    if (!at || !p) continue
    const id = finite(p.codigo, 0, 100000)
    if (id == null) continue
    const city = String(p.municipio ?? '')
    const color = typeof p.color === 'string' ? p.color : null
    const state = streamTone(color)
    stations.push({
      id,
      name: String(p.nombreEstacion ?? `Nivel ${id}`),
      city,
      key: cityKey(city),
      lat: at[1],
      lon: at[0],
      updated: parseLocal(p.fechaUltimoDato),
      level: finite(p.nivelActual, 0, 5000),
      safe: finite(p.nivelSeguro, 0, 5000),
      caution: finite(p.nivelPrecaucion, 0, 5000),
      minor: finite(p.inundacionMenor, 0, 5000),
      major: finite(p.inundacionMayor, 0, 8000),
      color,
      tone: state.tone,
      status: state.status,
    })
  }
  return stations
}

function parseCameras(raw: FeatureCollection): Camera[] {
  const cameras: Camera[] = []
  for (const feature of raw.features ?? []) {
    const at = coord(feature)
    const p = feature.properties
    if (!at || !p || typeof p.url !== 'string') continue
    const kind = String(p.tipo_key ?? p.tipo ?? '')
    cameras.push({
      id: String(p.codigo ?? p.url),
      name: String(p.short_name ?? p.nombre ?? 'Cámara'),
      lat: at[1],
      lon: at[0],
      url: p.url,
      kind,
      sky: kind.toLowerCase().includes('cielo'),
    })
  }
  return cameras
}

function parseAlerts(raw: unknown): AlertItem[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const alerts: AlertItem[] = []
  for (const item of list) {
    if (typeof item === 'string' && item.trim()) {
      alerts.push({ title: 'Aviso oficial', body: item.trim() })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const text = (key: string) => (typeof record[key] === 'string' ? String(record[key]).trim() : '')
    const title = text('titulo') || text('title') || text('nombre') || text('tipo') || 'Aviso oficial'
    const body = text('mensaje') || text('descripcion') || text('description') || text('detalle') || text('message')
    if (title === 'Aviso oficial' && !body) continue
    alerts.push({ title, body })
  }
  return alerts
}

function parseForecast(raw: unknown): Forecast | null {
  const record = raw as { features?: Array<{ properties?: Record<string, unknown> }>; date?: unknown; pronostico?: unknown }
  const props = record.features?.[0]?.properties ?? record
  const daysRaw = (props as { pronostico?: unknown }).pronostico
  if (!Array.isArray(daysRaw)) return null
  const days: ForecastDay[] = daysRaw.map((day) => {
    const item = day as Record<string, unknown>
    return {
      date: String(item.fecha ?? ''),
      tmax: finite(item.temperatura_maxima, -5, 45),
      tmin: finite(item.temperatura_minima, -5, 45),
      madrugada: band(item.lluvia_madrugada),
      mannana: band(item.lluvia_mannana),
      tarde: band(item.lluvia_tarde),
      noche: band(item.lluvia_noche),
    }
  })
  return { issued: parseLocal((props as { date?: unknown }).date), days }
}

function parseRadar(raw: unknown): Radar | null {
  const record = raw as {
    west?: number
    south?: number
    east?: number
    north?: number
    urls?: Array<{ time?: string; image?: string }>
  }
  if (!record.urls || record.west == null || record.north == null) return null
  const frames = record.urls
    .filter((frame) => typeof frame.image === 'string')
    .map((frame) => ({
      time: parseLocal(frame.time),
      label: String(frame.time ?? ''),
      url: String(frame.image).replace('https://siata.gov.co', '/legacy').replace('http://siata.gov.co', '/legacy'),
    }))
    .sort((a, b) => (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0))
  return {
    west: record.west,
    south: record.south ?? 5.1,
    east: record.east ?? -74.3,
    north: record.north,
    frames,
  }
}

const FORECASTS = [
  'wrfbarbosa',
  'wrfgirardota',
  'wrfcopacabana',
  'wrfbello',
  'wrfmedCentro',
  'wrfmedOccidente',
  'wrfmedOriente',
  'wrfpalmitas',
  'wrfitagui',
  'wrfenvigado',
  'wrflaestrella',
  'wrfsabaneta',
  'wrfcaldas',
]

const FORECAST_TTL = 15 * 60 * 1000
let forecastCache: { at: number; data: Record<string, Forecast | null> } | null = null

async function loadForecasts(signal?: AbortSignal): Promise<Record<string, Forecast | null>> {
  if (forecastCache && Date.now() - forecastCache.at < FORECAST_TTL) return forecastCache.data
  const rows = await Promise.all(FORECASTS.map(async (file) => [file, await loadForecast(file, signal)] as const))
  const data = Object.fromEntries(rows)
  if (!signal?.aborted) forecastCache = { at: Date.now(), data }
  return data
}

async function loadForecast(file: string, signal?: AbortSignal): Promise<Forecast | null> {
  try {
    const fresh = await getJson<unknown>(`/legacy/data/siata_app/${file}.json`, signal)
    const parsed = parseForecast(fresh)
    if (parsed) return parsed
  } catch {
    /* el archivo legado a veces se atrasa; el geoportal es el respaldo */
  }
  try {
    const portal = await getJson<unknown>(`/geo/fastgeoapi/geodata/geodataJson/2/${file}`, signal)
    return parseForecast(portal)
  } catch {
    return null
  }
}

export async function loadSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const [rain, meteo, air, extra, streams, cameras, alerts, radar, forecasts] = await Promise.all([
    getJson<FeatureCollection>('/geo/fastgeoapi/geodata/geodataJson/3/pluvios_v2', signal),
    getJson<FeatureCollection>('/geo/fastgeoapi/geodata/geodataJson/3/tempVient', signal),
    getJson<FeatureCollection>('/geo/fastgeoapi/geodata/geodataJson/1/pm25_minio', signal),
    getJson<FeatureCollection>('/geo/fastgeoapi/geodata/geodataJson/1/pm25No_Poeca', signal).catch(
      () => ({ type: 'FeatureCollection', features: [] }) satisfies FeatureCollection,
    ),
    getJson<FeatureCollection>('/geo/fastgeoapi/geodata/geodataJson/2/niveles', signal),
    getJson<FeatureCollection>('/geo/fastgeoapi/cameras/', signal).catch(
      () => ({ type: 'FeatureCollection', features: [] }) satisfies FeatureCollection,
    ),
    getJson<unknown>('/geo/fastgeoapi/alerts/active/citizen', signal).catch(() => []),
    getJson<unknown>('/legacy/data/siata_app/animacion_radar.json', signal).catch(() => null),
    loadForecasts(signal),
  ])

  const reference = parseAir(air, true)
  const seen = new Set(reference.map((station) => station.id))
  const complement = parseAir(extra, false).filter((station) => !seen.has(station.id))

  return {
    fetchedAt: new Date(),
    rain: parseRain(rain),
    meteo: parseMeteo(meteo),
    air: [...reference, ...complement],
    streams: parseStreams(streams),
    cameras: parseCameras(cameras),
    alerts: parseAlerts(alerts),
    radar: radar ? parseRadar(radar) : null,
    forecasts,
  }
}

export async function loadRainSeries(id: number, signal?: AbortSignal): Promise<RainSeries> {
  const raw = await getJson<{ info: Record<string, unknown> }>(
    `/geo/fastgeoapi/geodata/geographJson/2/pluvio_3h/${id}`,
    signal,
  )
  const info = raw.info
  return {
    name: String(info.NombreEstacion ?? ''),
    city: String(info.Ciudad ?? ''),
    subbasin: typeof info.Subcuenca === 'string' ? info.Subcuenca : null,
    times: Array.isArray(info.Tiempo) ? info.Tiempo.map(String) : [],
    rate: nums(info.pluvio_1),
    total: nums(info.Ptt_Total_Acum_P1),
  }
}

export async function loadAirSeries(id: number, signal?: AbortSignal): Promise<AirSeries> {
  const raw = await getJson<{ info: Record<string, unknown> }>(
    `/geo/fastgeoapi/geodata/geographJson/1/pm25/${id}`,
    signal,
  )
  return {
    name: String(raw.info.NombreEstacion ?? ''),
    hours: nums(raw.info.PM25_72H),
  }
}

export async function loadTempSeries(id: number, signal?: AbortSignal): Promise<TempSeries> {
  const raw = await getJson<{ info: Record<string, unknown> }>(
    `/geo/fastgeoapi/geodata/geographJson/2/temperatura_1h/${id}`,
    signal,
  )
  const values = nums(raw.info.Temperatura).filter((value): value is number => value != null)
  return {
    name: String(raw.info.NombreEstacion ?? ''),
    mean: finite(raw.info.ValorMedio1h, -5, 45),
    values,
  }
}

export async function loadStreamSeries(id: number, signal?: AbortSignal): Promise<StreamSeries> {
  const raw = await getJson<{ info: Record<string, unknown> }>(
    `/geo/fastgeoapi/geodata/geographJson/3/nivel/${id}`,
    signal,
  )
  const info = raw.info
  const profile = (info.perfilNivel ?? {}) as { x?: unknown; y?: unknown }
  const series = (info.nivelUltimosDatos ?? {}) as { y?: unknown }
  return {
    name: String(info.nombreEstacion ?? ''),
    municipality: typeof info.municipio === 'string' ? info.municipio : null,
    subbasin: typeof info.subcuenca === 'string' ? info.subcuenca : null,
    level: finite(info.nivelActual, -2, 30),
    safe: finite(info.nivelSeguro, -2, 30),
    caution: finite(info.nivelPrecaucion, -2, 30),
    minor: finite(info.inundacionMenor, -2, 40),
    major: finite(info.inundacionMayor, -2, 40),
    mean: finite(info.nivelMedio, -2, 30),
    max: finite(info.nivelMaximo, -2, 30),
    profileX: plain(profile.x),
    profileY: plain(profile.y),
    levels: plain(series.y),
  }
}

function nums(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return []
  return value.map((item) => finite(item, -5, 2000))
}

function plain(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => finite(item, -20, 5000)).filter((item): item is number => item != null)
}
