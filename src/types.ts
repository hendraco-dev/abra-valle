export type Tone = 'ok' | 'watch' | 'alert' | 'critical' | 'mute'

export type RainBand = 'BAJA' | 'MEDIA' | 'ALTA'

export type Lapse = 'madrugada' | 'mannana' | 'tarde' | 'noche'

export type Place = {
  id: string
  name: string
  key: string
  lat: number
  lon: number
  forecast: string
  lens?: string
  lensNote?: string
}

export type RainStation = {
  id: number
  name: string
  city: string
  key: string
  lat: number
  lon: number
  updated: Date | null
  mm15: number
  raining: boolean
  color: string
}

export type MeteoStation = {
  id: number
  name: string
  lat: number
  lon: number
  updated: Date | null
  tempC: number | null
  windMs: number | null
  windCardinal: string | null
  pressureHpa: number | null
  humidity: number | null
}

export type AirStation = {
  id: number
  code: string
  name: string
  city: string
  key: string
  lat: number
  lon: number
  pm25: number | null
  ica: number | null
  color: string
  from: string | null
  to: string | null
  reference: boolean
}

export type StreamStation = {
  id: number
  name: string
  city: string
  key: string
  lat: number
  lon: number
  updated: Date | null
  level: number | null
  safe: number | null
  caution: number | null
  minor: number | null
  major: number | null
  color: string | null
  tone: Tone
  status: string
}

export type Camera = {
  id: string
  name: string
  lat: number
  lon: number
  url: string
  kind: string
  sky: boolean
}

export type AlertItem = {
  title: string
  body: string
}

export type ForecastDay = {
  date: string
  tmax: number | null
  tmin: number | null
  madrugada: RainBand
  mannana: RainBand
  tarde: RainBand
  noche: RainBand
}

export type Forecast = {
  issued: Date | null
  days: ForecastDay[]
}

export type RadarFrame = {
  time: Date | null
  label: string
  url: string
}

export type Radar = {
  west: number
  south: number
  east: number
  north: number
  frames: RadarFrame[]
}

export type Snapshot = {
  fetchedAt: Date
  rain: RainStation[]
  meteo: MeteoStation[]
  air: AirStation[]
  streams: StreamStation[]
  cameras: Camera[]
  alerts: AlertItem[]
  radar: Radar | null
  forecasts: Record<string, Forecast | null>
}

export type RainSummary = {
  scope: 'cerca' | 'municipio'
  stations: RainStation[]
  raining: number
  max: RainStation | null
  tone: Tone
}

export type AirSummary = {
  scope: 'cerca' | 'municipio'
  stations: AirStation[]
  worst: AirStation | null
  mean: number | null
  tone: Tone
  category: string
}

export type StreamSummary = {
  scope: 'cerca' | 'municipio'
  stations: StreamStation[]
  worst: StreamStation | null
  critical: number
  alert: number
  watch: number
  tone: Tone
}

export type Reading = {
  place: Place
  meteo: (MeteoStation & { distanceKm: number }) | null
  rain: RainSummary
  air: AirSummary
  stream: StreamSummary
  forecast: Forecast | null
  tone: Tone
  sentence: string
}

export type RainSeries = {
  name: string
  city: string
  subbasin: string | null
  times: string[]
  rate: Array<number | null>
  total: Array<number | null>
}

export type AirSeries = {
  name: string
  hours: Array<number | null>
}

export type TempSeries = {
  name: string
  mean: number | null
  values: number[]
}

export type StreamSeries = {
  name: string
  municipality: string | null
  subbasin: string | null
  level: number | null
  safe: number | null
  caution: number | null
  minor: number | null
  major: number | null
  mean: number | null
  max: number | null
  profileX: number[]
  profileY: number[]
  levels: number[]
}
