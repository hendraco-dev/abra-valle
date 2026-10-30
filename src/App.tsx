import { useCallback, useEffect, useMemo, useState } from 'react'
import { Atmosphere } from './Atmosphere'
import { useSnapshot } from './useSnapshot'
import { buildBoard, statusLine } from './reading'
import { lenses, nearestPlace, placeById, placeLabel, spinePlaces } from './places'
import { ago } from './format'
import { Ahora, Aire, Lluvia, Quebradas, Valle } from './views'

const VIEWS = [
  { id: 'ahora', label: 'Ahora', short: 'Ahora' },
  { id: 'valle', label: 'Valle', short: 'Valle' },
  { id: 'lluvia', label: 'Lluvia', short: 'Lluvia' },
  { id: 'aire', label: 'Aire', short: 'Aire' },
  { id: 'quebradas', label: 'Quebradas', short: 'Nivel' },
] as const

type View = (typeof VIEWS)[number]['id']

const MOTION = '(min-width: 900px) and (prefers-reduced-motion: no-preference)'

export function App() {
  const { snapshot, error, pending, stale, reload } = useSnapshot()
  const [view, setView] = useState<View>('ahora')
  const [placeId, setPlaceId] = useState('med-cen')
  const [rainId, setRainId] = useState<number | null>(null)
  const [airId, setAirId] = useState<number | null>(null)
  const [streamId, setStreamId] = useState<number | null>(null)
  const [extras, setExtras] = useState(false)
  const [allStreams, setAllStreams] = useState(false)
  const [locating, setLocating] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [motion, setMotion] = useState(false)
  const [mapKept, setMapKept] = useState(false)

  const board = useMemo(() => (snapshot ? buildBoard(snapshot) : null), [snapshot])
  const reading = board?.byId.get(placeId) ?? null
  const place = placeById(placeId)
  const rainFraction = snapshot ? Math.min(1, snapshot.rain.filter((station) => station.raining).length / 70) : 0.15
  const haze = Math.min(1, (reading?.air.worst?.ica ?? 0) / 220)

  useEffect(() => {
    const query = window.matchMedia(MOTION)
    const sync = () => setMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (view === 'lluvia') setMapKept(true)
  }, [view])

  const choosePlace = useCallback((id: string) => {
    setPlaceId(id)
    setRainId(null)
    setAirId(null)
    setStreamId(null)
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        choosePlace(nearestPlace(position.coords.latitude, position.coords.longitude).id)
        setLocating(false)
        setPlaceOpen(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [choosePlace])

  const tone = reading?.tone ?? 'mute'

  return (
    <>
      {motion && view !== 'lluvia' && <Atmosphere rain={rainFraction} haze={haze} />}
      <div className="shell">
        <header className="top">
          <div className="brand">
            <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 22c4-8 8-8 12 0s8 8 12 0" />
              <path d="M8 22c3-5 6-5 8 0" />
            </svg>
            <div className="brand-copy">
              <strong>Abra</strong>
              <small>Valle de Aburrá</small>
            </div>
          </div>
          <button
            className="place-chip"
            aria-haspopup="dialog"
            aria-expanded={placeOpen}
            onClick={() => setPlaceOpen(true)}
          >
            <i className={`tick tone-${tone}`} />
            <span>
              <strong>{placeLabel(place)}</strong>
              <small>{place.lensNote ?? 'Toca para cambiar'}</small>
            </span>
          </button>
          <nav className="desktop-nav" aria-label="Secciones">
            {VIEWS.map((item) => (
              <button key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
          <button className="icon-btn" onClick={locate} aria-label={locating ? 'Buscando ubicación' : 'Cerca de mí'}>
            <Crosshair />
          </button>
          <button
            className={stale ? 'live stale' : 'live'}
            onClick={reload}
            aria-label="Actualizar lecturas"
          >
            <i className="live-dot" />
            <span className="live-label">
              {snapshot ? (stale ? 'sin red' : pending ? 'leyendo' : ago(snapshot.fetchedAt)) : 'conectando'}
            </span>
          </button>
          {snapshot && snapshot.alerts.length > 0 && (
            <div className="alerts">
              {snapshot.alerts.map((alert) => (
                <p key={alert.title}>
                  <strong>{alert.title}.</strong> {alert.body}
                </p>
              ))}
            </div>
          )}
        </header>

        <aside className="spine">
          <p className="spine-end">Norte</p>
          {spinePlaces().map((item) => {
            const row = board?.spine.find((entry) => entry.place.id === item.id)
            const active = item.key === 'medellin' ? place.key === 'medellin' : placeId === item.id
            return (
              <div key={item.id} className="spine-block">
                <button
                  className={active ? 'spine-item active' : 'spine-item'}
                  onClick={() => choosePlace(item.id)}
                  aria-pressed={active}
                >
                  <i className={`tick tone-${row?.tone ?? 'mute'}`} />
                  <span>{item.name}</span>
                </button>
                {active && item.key === 'medellin' && (
                  <div className="lenses compact">
                    {lenses().map((lens) => (
                      <button
                        key={lens.id}
                        className={placeId === lens.id ? 'lens active' : 'lens'}
                        onClick={() => choosePlace(lens.id)}
                      >
                        {lens.lens}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <p className="spine-end">Sur</p>
        </aside>

        <main className={view === 'lluvia' ? 'stage stage-map' : 'stage'}>
          {!snapshot && error && (
            <div className="gate">
              <h1>No alcancé la red de SIATA.</h1>
              <p>{error}</p>
              <button onClick={reload}>Reintentar</button>
            </div>
          )}
          {!snapshot && !error && (
            <div className="gate">
              <p className="kicker">Abra</p>
              <h1>Leyendo la red del valle.</h1>
            </div>
          )}
          {snapshot && reading && view === 'ahora' && (
            <Ahora reading={reading} snapshot={snapshot} onOpen={setView} />
          )}
          {snapshot && board && view === 'valle' && <Valle board={board} placeId={placeId} onPlace={choosePlace} />}
          {snapshot && reading && view === 'aire' && (
            <Aire
              reading={reading}
              snapshot={snapshot}
              extras={extras}
              onExtras={setExtras}
              selected={airId}
              onSelect={setAirId}
            />
          )}
          {snapshot && reading && view === 'quebradas' && (
            <Quebradas
              reading={reading}
              snapshot={snapshot}
              valley={allStreams}
              onValley={setAllStreams}
              selected={streamId}
              onSelect={setStreamId}
            />
          )}
        </main>

        {snapshot && reading && mapKept && (
          <div className={view === 'lluvia' ? 'rain-keep on' : 'rain-keep'} inert={view !== 'lluvia'}>
            <Lluvia
              reading={reading}
              snapshot={snapshot}
              selected={rainId}
              onSelect={setRainId}
              active={view === 'lluvia'}
            />
          </div>
        )}

        <nav className="bottom-nav" aria-label="Secciones">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              aria-current={view === item.id ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => setView(item.id)}
            >
              <NavIcon name={item.id} />
              {item.short}
            </button>
          ))}
        </nav>

        {placeOpen && (
          <PlaceSheet
            placeId={placeId}
            toneFor={(id) =>
              (board?.spine.find((entry) => entry.place.id === id) ?? board?.byId.get(id))?.tone ?? 'mute'
            }
            lineFor={(id) => {
              const row = board?.spine.find((entry) => entry.place.id === id) ?? board?.byId.get(id)
              return row ? statusLine(row) : ''
            }}
            locating={locating}
            onLocate={locate}
            onChoose={(id) => {
              choosePlace(id)
              if (placeById(id).key !== 'medellin') setPlaceOpen(false)
            }}
            onLens={(id) => {
              choosePlace(id)
              setPlaceOpen(false)
            }}
            onClose={() => setPlaceOpen(false)}
          />
        )}
      </div>
    </>
  )
}

function PlaceSheet({
  placeId,
  toneFor,
  lineFor,
  locating,
  onLocate,
  onChoose,
  onLens,
  onClose,
}: {
  placeId: string
  toneFor: (id: string) => string
  lineFor: (id: string) => string
  locating: boolean
  onLocate: () => void
  onChoose: (id: string) => void
  onLens: (id: string) => void
  onClose: () => void
}) {
  const place = placeById(placeId)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir lugar"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-bar">
          <h2>El valle</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <div className="sheet-body">
          <button className="place-row locate-row" onClick={onLocate}>
            <Crosshair />
            <span>
              <strong>{locating ? 'Buscando…' : 'Cerca de mí'}</strong>
              <small>Usa la ubicación de este teléfono</small>
            </span>
          </button>
          <p className="spine-end">Norte</p>
          {spinePlaces().map((item) => {
            const active = item.key === 'medellin' ? place.key === 'medellin' : placeId === item.id
            return (
              <div key={item.id}>
                <button className={active ? 'place-row active' : 'place-row'} onClick={() => onChoose(item.id)}>
                  <i className={`tick tone-${toneFor(item.id)}`} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{lineFor(item.id)}</small>
                  </span>
                </button>
                {active && item.key === 'medellin' && (
                  <div className="lens-grid">
                    {lenses().map((lens) => (
                      <button
                        key={lens.id}
                        className={placeId === lens.id ? 'lens active' : 'lens'}
                        onClick={() => onLens(lens.id)}
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
          <p className="spine-end">Sur</p>
        </div>
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: View }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'ahora' && (
        <>
          <circle cx="12" cy="12" r="3.2" {...common} />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" {...common} />
        </>
      )}
      {name === 'valle' && <path d="M3 16c3.2-6 6-6 9 0s5.8 6 9 0" {...common} />}
      {name === 'lluvia' && (
        <>
          <path d="M12 4v8" {...common} />
          <path d="M8 13c0 2.4 1.8 4 4 4s4-1.6 4-4" {...common} />
          <path d="M7 18.5h10" {...common} />
        </>
      )}
      {name === 'aire' && <path d="M4 9h11a3 3 0 1 0-3-3M4 14h14a3 3 0 1 1-3 3M4 14h8" {...common} />}
      {name === 'quebradas' && <path d="M4 7c2 3 3 3 5 0s3-3 5 0 3 3 6 0M4 13c2 3 3 3 5 0s3-3 5 0 3 3 6 0" {...common} />}
    </svg>
  )
}

function Crosshair() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
