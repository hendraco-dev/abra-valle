import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react'
import type { AirSeries, RainSeries, Reading, Snapshot, StreamSeries, TempSeries } from './types'
import { placeLabel, lenses } from './places'
import { loadAirSeries, loadRainSeries, loadStreamSeries, loadTempSeries } from './api'
import {
  ago,
  clock,
  dayLabel,
  formatMm,
  formatTemp,
  formatWind,
  haversine,
  icaAdvice,
  icaCategory,
  lapseLabel,
  lapseOf,
  rainWord,
} from './format'
import { statusLine, type Board } from './reading'
import { Sparkline } from './Sparkline'
import { Channel } from './Channel'

const MapStage = lazy(() => import('./MapStage').then((mod) => ({ default: mod.MapStage })))

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function Ahora({
  reading,
  snapshot,
  onOpen,
}: {
  reading: Reading
  snapshot: Snapshot
  onOpen: (view: 'lluvia' | 'aire' | 'quebradas') => void
}) {
  const lapse = lapseOf()
  const cameras = useMemo(
    () =>
      [...snapshot.cameras]
        .filter((camera) => camera.sky)
        .map((camera) => ({ camera, distance: haversine(reading.place.lat, reading.place.lon, camera.lat, camera.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5),
    [snapshot.cameras, reading.place.lat, reading.place.lon],
  )

  return (
    <div className="ahora">
      <div>
        <p className="kicker">
          {placeLabel(reading.place)}
          {reading.place.lensNote ? ` · ${reading.place.lensNote}` : ''} · {lapseLabel(lapse).toLowerCase()}
        </p>
        <h1>{reading.sentence}</h1>
        <div className="temp-block">
          <p className="temp">
            {formatTemp(reading.meteo?.tempC ?? null)}
            <span>°C</span>
          </p>
          <ul className="meta-list">
            <li>Humedad {reading.meteo?.humidity != null ? `${Math.round(reading.meteo.humidity)}%` : 'sin dato'}</li>
            <li>{formatWind(reading.meteo?.windMs ?? null, reading.meteo?.windCardinal ?? null)}</li>
            <li>{reading.meteo?.pressureHpa != null ? `${Math.round(reading.meteo.pressureHpa)} hPa` : 'Presión sin dato'}</li>
            <li>
              {reading.meteo ? `${reading.meteo.name} · ${reading.meteo.distanceKm.toFixed(1)} km · ${ago(reading.meteo.updated)}` : 'Sin estación meteorológica cercana'}
            </li>
          </ul>
        </div>
        <div className="signals">
          <Signal
            kicker="Lluvia"
            value={rainWord(reading.rain.max?.mm15 ?? 0, reading.rain.raining > 0)}
            detail={
              reading.rain.max
                ? `${formatMm(reading.rain.max.mm15)} en 15 min · ${reading.rain.raining} sensores`
                : 'Ningún sensor con acumulación'
            }
            note={reading.rain.scope === 'cerca' ? 'En un radio de 6 km' : `En ${reading.place.name}`}
            tone={reading.rain.tone}
            onOpen={() => onOpen('lluvia')}
          />
          <Signal
            kicker="Aire"
            value={reading.air.worst?.ica != null ? `ICA ${Math.round(reading.air.worst.ica)}` : 'Sin ICA'}
            detail={reading.air.category}
            note={
              reading.air.worst
                ? `${reading.air.worst.name}${reading.air.mean != null ? ` · promedio ${Math.round(reading.air.mean)}` : ''}`
                : 'Sin estación de referencia'
            }
            tone={reading.air.tone}
            onOpen={() => onOpen('aire')}
          />
          <Signal
            kicker="Nivel"
            value={reading.stream.worst?.status ?? 'Sin dato'}
            detail={reading.stream.worst?.name ?? 'No hay sensores en este recorte'}
            note={
              reading.stream.critical + reading.stream.alert + reading.stream.watch > 0
                ? `${reading.stream.critical} críticas · ${reading.stream.alert} altas · ${reading.stream.watch} en atención`
                : 'Ninguna por encima del rango estable'
            }
            tone={reading.stream.tone}
            onOpen={() => onOpen('quebradas')}
          />
        </div>
        <ForecastStrip reading={reading} />
        {cameras.length > 0 && (
          <section className="film-block">
            <h2>Cielo ahora</h2>
            <div className="film">
              {cameras.map(({ camera }) => (
                <figure key={camera.id} className="shot">
                  <img
                    src={camera.url}
                    alt={`Cielo en ${camera.name}`}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width={220}
                    height={132}
                  />
                  <figcaption>{camera.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
      <aside className="dossier">
        <TempDossier id={reading.meteo?.id ?? null} />
        <p>{icaAdvice(reading.air.worst?.ica ?? null)}</p>
        <p className="muted">
          El semáforo de las quebradas es el de SIATA. La frase de arriba resume el riesgo más alto de este recorte, no un aviso de evacuación.
        </p>
        <Colophon />
      </aside>
    </div>
  )
}

export function Valle({ board, placeId, onPlace }: { board: Board; placeId: string; onPlace: (id: string) => void }) {
  const active = board.byId.get(placeId)
  return (
    <div className="valley">
      <header>
        <p className="kicker">De Barbosa a Caldas</p>
        <h1>El valle, en una sola lectura.</h1>
        <p className="lead">
          {board.focus
            ? `La señal más alta está en ${board.focus.place.name}: ${board.focus.sentence}`
            : 'Ningún municipio tiene una señal crítica en este momento.'}
        </p>
      </header>
      <div className="valley-list">
        {board.spine.map((reading) => {
          const selected = active?.place.key === reading.place.key
          return (
            <div key={reading.place.id} className="valley-stop">
              <button
                className={selected ? 'valley-row active' : 'valley-row'}
                onClick={() => onPlace(reading.place.id)}
              >
                <i className={`tick tone-${reading.tone}`} />
                <span>
                  <strong>{reading.place.name}</strong>
                  <small>{statusLine(reading)}</small>
                </span>
                <em>{reading.meteo ? `${formatTemp(reading.meteo.tempC)}°` : '—'}</em>
                <em>{reading.air.worst?.ica != null ? Math.round(reading.air.worst.ica) : '—'}</em>
              </button>
              {selected && <p className="valley-note">{reading.sentence}</p>}
              {selected && reading.place.key === 'medellin' && (
                <div className="lenses">
                  {lenses().map((lens) => (
                    <button
                      key={lens.id}
                      className={placeId === lens.id ? 'lens active' : 'lens'}
                      onClick={() => onPlace(lens.id)}
                    >
                      {lens.lens}
                      <small>{lens.lensNote}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="axis-note">Temperatura del sensor más cercano al centro del municipio. ICA de la estación de referencia más alta.</p>
    </div>
  )
}

export function Lluvia({
  reading,
  snapshot,
  selected,
  onSelect,
  active,
}: {
  reading: Reading
  snapshot: Snapshot
  selected: number | null
  onSelect: (id: number | null) => void
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const city = useMemo(
    () => snapshot.rain.filter((station) => station.key === reading.place.key).sort((a, b) => b.mm15 - a.mm15),
    [snapshot.rain, reading.place.key],
  )
  const intense = useMemo(
    () => [...snapshot.rain].filter((station) => station.raining).sort((a, b) => b.mm15 - a.mm15).slice(0, 6),
    [snapshot.rain],
  )
  const raining = city.filter((station) => station.raining)
  const chosen = snapshot.rain.find((station) => station.id === selected) ?? null
  const focus = chosen ?? reading.place
  const summary = raining[0]
    ? `${raining.length} con lluvia · ${formatMm(raining[0].mm15)}`
    : `Sin lluvia en ${reading.place.name}`

  function pick(id: number) {
    onSelect(selected === id ? null : id)
    setOpen(true)
  }

  return (
    <div className="rain-view">
      <RainMap
        stations={snapshot.rain}
        city={reading.place.key}
        radar={snapshot.radar}
        selectedId={selected}
        onSelect={pick}
        lat={focus.lat}
        lon={focus.lon}
        active={active}
      />
      <aside className={open ? 'side-list open' : 'side-list'}>
        <button className="sheet-handle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <i className="grip" />
          <span>{summary}</span>
        </button>
        {chosen && <RainDetail id={chosen.id} />}
        <h2>{reading.place.name}</h2>
        {raining.slice(0, 12).map((station) => (
          <button
            key={station.id}
            className={selected === station.id ? 'station active' : 'station'}
            onClick={() => pick(station.id)}
          >
            <i style={{ background: station.color }} />
            <span>
              <strong>{station.name}</strong>
              <small>{ago(station.updated)}</small>
            </span>
            <em>{formatMm(station.mm15)}</em>
          </button>
        ))}
        {raining.length === 0 && <p className="muted">Sin lluvia en los sensores de este municipio.</p>}
        {intense.length > 0 && <h2>Lo más intenso del valle</h2>}
        {intense.map((station) => (
          <button
            key={`v-${station.id}`}
            className={selected === station.id ? 'station active' : 'station'}
            onClick={() => pick(station.id)}
          >
            <i style={{ background: station.color }} />
            <span>
              <strong>{station.name}</strong>
              <small>{station.city}</small>
            </span>
            <em>{formatMm(station.mm15)}</em>
          </button>
        ))}
      </aside>
    </div>
  )
}

const RainMap = memo(function RainMap({
  stations,
  city,
  radar,
  selectedId,
  onSelect,
  lat,
  lon,
  active,
}: {
  stations: Snapshot['rain']
  city: string
  radar: Snapshot['radar']
  selectedId: number | null
  onSelect: (id: number) => void
  lat: number
  lon: number
  active: boolean
}) {
  const frames = radar?.frames ?? []
  const [frame, setFrame] = useState(0)
  const [play, setPlay] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [radarOn, setRadarOn] = useState(true)
  const index = frames.length ? frame % frames.length : 0
  const colors = useMemo(() => legend(stations), [stations])

  useEffect(() => {
    if (!active || !play || frames.length < 2) return
    const timer = window.setInterval(() => setFrame((current) => current + 1), 900)
    return () => window.clearInterval(timer)
  }, [active, play, frames.length])

  return (
    <div className="map-wrap">
      <Suspense fallback={<div className="map" />}>
        <MapStage
          stations={stations}
          city={city}
          radar={radar}
          frame={index}
          showRadar={radarOn}
          selectedId={selectedId}
          onSelect={onSelect}
          focus={{ lat, lon }}
          active={active}
        />
      </Suspense>
      <div className="map-hud">
        <div className="row-actions">
          <button onClick={() => setPlay((value) => !value)}>{play ? 'Pausar' : 'Animar'}</button>
          <button onClick={() => setRadarOn((value) => !value)}>{radarOn ? 'Ocultar radar' : 'Ver radar'}</button>
        </div>
        <p>{frames[index] ? clock(frames[index].time) : 'Radar sin imagen'}</p>
      </div>
      <ul className="legend map-legend">
        {colors.map((item) => (
          <li key={item.color}>
            <i style={{ background: item.color }} />
            {formatMm(item.max)}
          </li>
        ))}
      </ul>
    </div>
  )
})

function legend(stations: import('./types').RainStation[]) {
  const groups = new Map<string, number>()
  for (const station of stations) {
    groups.set(station.color, Math.max(groups.get(station.color) ?? 0, station.mm15))
  }
  return [...groups.entries()]
    .map(([color, max]) => ({ color, max }))
    .sort((a, b) => a.max - b.max)
    .slice(0, 6)
}

function RainDetail({ id }: { id: number }) {
  const [series, setSeries] = useState<RainSeries | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setSeries(null)
    loadRainSeries(id, controller.signal)
      .then(setSeries)
      .catch((error) => {
        if (!isAbort(error)) setSeries(null)
      })
    return () => controller.abort()
  }, [id])
  if (!series) return <p className="muted">Cargando los últimos minutos.</p>
  const total = [...series.total].reverse().find((value) => value != null)
  return (
    <div className="detail">
      <p>
        {series.name}
        {series.subbasin ? ` · ${series.subbasin}` : ''}
      </p>
      <Sparkline values={series.rate} label="Lluvia minuto a minuto" />
      <p className="muted">Acumulado de la ventana: {total != null ? formatMm(total) : 'sin dato'}.</p>
    </div>
  )
}

export function Aire({
  reading,
  snapshot,
  extras,
  onExtras,
  selected,
  onSelect,
}: {
  reading: Reading
  snapshot: Snapshot
  extras: boolean
  onExtras: (value: boolean) => void
  selected: number | null
  onSelect: (id: number | null) => void
}) {
  const stations = snapshot.air
    .filter((station) => station.key === reading.place.key && (extras || station.reference))
    .sort((a, b) => (b.ica ?? -1) - (a.ica ?? -1))
  const ica = reading.air.worst?.ica ?? null
  return (
    <div className="split air">
      <p className="kicker">Calidad del aire · {reading.air.scope === 'cerca' ? 'estaciones cercanas' : reading.place.name}</p>
      <h1>{ica != null ? icaCategory(ica) : 'Sin promedio vigente'}</h1>
      <p className="ica-num">{ica != null ? Math.round(ica) : '—'}</p>
      <div className="side-list">
        <button className={extras ? 'chip active' : 'chip'} onClick={() => onExtras(!extras)}>
          {extras ? 'Solo referencia' : 'Ver complementarias'}
        </button>
        {stations.map((station) => {
          const on = selected === station.id
          return (
            <div key={`${station.reference ? 'r' : 'x'}-${station.id}`}>
              <button className={on ? 'station active' : 'station'} onClick={() => onSelect(on ? null : station.id)}>
                <i style={{ background: station.color }} />
                <span>
                  <strong>{station.name}</strong>
                  <small>
                    {station.reference ? 'Referencia' : 'Complementaria'}
                    {station.pm25 != null ? ` · PM2.5 ${Math.round(station.pm25)} µg/m³` : ''}
                  </small>
                </span>
                <em>{station.ica != null ? Math.round(station.ica) : '—'}</em>
              </button>
              {on && <AirDetail id={station.id} />}
            </div>
          )
        })}
      </div>
      <div className="air-rest">
        <div className="scale" aria-hidden="true">
          <i style={{ left: `${Math.min(100, ((ica ?? 0) / 300) * 100)}%` }} />
        </div>
        <ol className="scale-legend">
          <li>0 Buena</li>
          <li>51 Aceptable</li>
          <li>101 Sensibles</li>
          <li>151 Dañina</li>
          <li>201 Muy dañina</li>
        </ol>
        <p>{icaAdvice(ica)}</p>
        <p className="muted">
          {`El número grande es la estación más alta${
            reading.air.mean != null ? `, no el promedio del recorte (${Math.round(reading.air.mean)})` : ''
          }. El ICA es el promedio de 24 h de PM2.5.`}
        </p>
      </div>
    </div>
  )
}

export function Quebradas({
  reading,
  snapshot,
  valley,
  onValley,
  selected,
  onSelect,
}: {
  reading: Reading
  snapshot: Snapshot
  valley: boolean
  onValley: (value: boolean) => void
  selected: number | null
  onSelect: (id: number | null) => void
}) {
  const source = valley ? snapshot.streams : snapshot.streams.filter((station) => station.key === reading.place.key)
  const flagged = source.filter((station) => station.tone === 'critical' || station.tone === 'alert' || station.tone === 'watch')
  const calm = source.filter((station) => station.tone === 'ok').length
  const silent = source.filter((station) => station.tone === 'mute').length
  const chosen = source.find((station) => station.id === selected) ?? null
  return (
    <div className="split streams">
      <div>
        <p className="kicker">Niveles · {valley ? 'todo el valle' : reading.place.name}</p>
        <h1>{flagged.length ? `${flagged.length} por encima del rango estable` : 'Quebradas en rango estable'}</h1>
        <p className="lead">
          El color es el semáforo de SIATA. Toca una quebrada para ver su sección en metros.
        </p>
        <div className="row-actions">
          <button className={!valley ? 'chip active' : 'chip'} onClick={() => onValley(false)}>
            Este municipio
          </button>
          <button className={valley ? 'chip active' : 'chip'} onClick={() => onValley(true)}>
            Todo el valle
          </button>
        </div>
        <ul className="stream-list">
          {flagged.map((station) => (
            <li key={station.id}>
              <button
                className={selected === station.id ? 'station active' : 'station'}
                onClick={() => onSelect(selected === station.id ? null : station.id)}
              >
                <i className={`tick tone-${station.tone}`} />
                <span>
                  <strong>{station.name}</strong>
                  <small>
                    {station.city} · {station.status} · {ago(station.updated)}
                  </small>
                </span>
              </button>
              <Threshold station={station} />
            </li>
          ))}
        </ul>
        {flagged.length === 0 && <p>No hay quebradas en atención en este recorte.</p>}
        <p className="muted">
          {calm} estables y {silent} sin dato quedan fuera de la lista para que lo urgente se lea primero.
        </p>
      </div>
      <aside className={chosen ? 'dossier dock' : 'dossier dock quiet'}>
        {chosen ? (
          <>
            <div className="dock-bar">
              <div>
                <p className="kicker">{chosen.status}</p>
                <h2>{chosen.name}</h2>
              </div>
              <button className="icon-btn" aria-label="Cerrar detalle" onClick={() => onSelect(null)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="muted">{chosen.city}</p>
            <StreamDetail id={chosen.id} />
          </>
        ) : (
          <p className="muted">Elige una quebrada para ver su sección y la serie en metros.</p>
        )}
      </aside>
    </div>
  )
}

function Signal({
  kicker,
  value,
  detail,
  note,
  tone,
  onOpen,
}: {
  kicker: string
  value: string
  detail: string
  note: string
  tone: string
  onOpen: () => void
}) {
  return (
    <button type="button" className={`signal tone-${tone}`} onClick={onOpen}>
      <header>
        <span>{kicker}</span>
        <strong>{value}</strong>
      </header>
      <p>{detail}</p>
      <small>{note}</small>
      <span className="signal-go">Ver</span>
    </button>
  )
}

function ForecastStrip({ reading }: { reading: Reading }) {
  const forecast = reading.forecast
  const lapse = lapseOf()
  if (!forecast) return <p className="muted">Pronóstico no disponible para esta zona.</p>
  return (
    <section className="forecast">
      <h2>
        Pronóstico
        <small>{forecast.issued ? `emitido ${clock(forecast.issued)}` : ''}</small>
      </h2>
      <div className="days">
        {forecast.days.map((day) => (
          <article key={day.date} className="day">
            <header>
              <strong>{dayLabel(day.date)}</strong>
              <span>
                {day.tmin ?? '—'}° / {day.tmax ?? '—'}°
              </span>
            </header>
            <div className="bands">
              {(['madrugada', 'mannana', 'tarde', 'noche'] as const).map((key) => (
                <span key={key} className={key === lapse && dayLabel(day.date) === 'Hoy' ? 'band now' : 'band'} data-level={day[key]}>
                  {lapseLabel(key)}
                  <b>{day[key].toLowerCase()}</b>
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Threshold({ station }: { station: import('./types').StreamStation }) {
  if (station.level == null || station.major == null) return null
  const max = Math.max(station.major, station.level, station.safe ?? 0, station.caution ?? 0, station.minor ?? 0) * 1.05
  const at = (value: number | null) => (value == null ? null : `${Math.min(100, (value / max) * 100)}%`)
  return (
    <div className="threshold" aria-hidden="true">
      <i className="fill" style={{ width: at(station.level) ?? '0%' }} />
      {station.safe != null && <i className="hair" style={{ left: at(station.safe) ?? 0 }} />}
      {station.caution != null && <i className="hair" style={{ left: at(station.caution) ?? 0 }} />}
      {station.minor != null && <i className="hair" style={{ left: at(station.minor) ?? 0 }} />}
    </div>
  )
}

function TempDossier({ id }: { id: number | null }) {
  const [series, setSeries] = useState<TempSeries | null>(null)
  useEffect(() => {
    if (id == null) return
    const controller = new AbortController()
    setSeries(null)
    loadTempSeries(id, controller.signal)
      .then(setSeries)
      .catch((error) => {
        if (!isAbort(error)) setSeries(null)
      })
    return () => controller.abort()
  }, [id])
  if (id == null) return null
  return (
    <section>
      <h2>Última hora</h2>
      {series ? (
        <>
          <Sparkline values={series.values} label="Temperatura de la última hora" />
          <p className="muted">{series.mean != null ? `Media ${series.mean.toFixed(1)} °C` : series.name}</p>
        </>
      ) : (
        <p className="muted">Cargando la serie de temperatura.</p>
      )}
    </section>
  )
}

function AirDetail({ id }: { id: number }) {
  const [series, setSeries] = useState<AirSeries | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setSeries(null)
    loadAirSeries(id, controller.signal)
      .then(setSeries)
      .catch((error) => {
        if (!isAbort(error)) setSeries(null)
      })
    return () => controller.abort()
  }, [id])
  if (!series) return <p className="muted">Cargando 72 horas.</p>
  return (
    <div className="detail">
      <Sparkline values={series.hours} color="#e7c36a" label="PM2.5 de las últimas 72 horas" />
      <p className="muted">PM2.5 horario, últimas 72 horas, en µg/m³.</p>
    </div>
  )
}

function StreamDetail({ id }: { id: number }) {
  const [series, setSeries] = useState<StreamSeries | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setSeries(null)
    setFailed(false)
    loadStreamSeries(id, controller.signal)
      .then(setSeries)
      .catch((error) => {
        if (!isAbort(error)) setFailed(true)
      })
    return () => controller.abort()
  }, [id])
  if (failed) return <p className="muted">La serie en metros no respondió para esta estación.</p>
  if (!series) return <p className="muted">Cargando la sección.</p>
  return (
    <div className="detail">
      {series.subbasin && <p className="muted">{series.subbasin}</p>}
      <Channel series={series} />
      <p>
        Nivel {series.level != null ? `${series.level.toFixed(2)} m` : 'sin dato'}
        {series.max != null ? ` · máximo reciente ${series.max.toFixed(2)} m` : ''}
      </p>
      <Sparkline values={series.levels} color="#8ec8e8" label="Nivel de las últimas horas" />
      <p className="muted">La sección y la serie vienen calibradas en metros. Los umbrales del listado usan la escala del mapa.</p>
    </div>
  )
}

export function Colophon() {
  return (
    <p className="colophon">
      Datos públicos de SIATA, Área Metropolitana del Valle de Aburrá. Abra no sustituye un aviso oficial.
    </p>
  )
}

