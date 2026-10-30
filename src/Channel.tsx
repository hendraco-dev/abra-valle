import type { StreamSeries } from './types'

export function Channel({ series }: { series: StreamSeries }) {
  const xs = series.profileX
  const ys = series.profileY
  if (xs.length < 2 || ys.length !== xs.length) return null
  const width = 360
  const height = 180
  const pad = 16
  const bank = Math.max(...ys)
  const level = series.level
  const marks = [
    ['Seguro', series.safe],
    ['Precaución', series.caution],
    ['Menor', series.minor],
    ['Mayor', series.major],
  ].filter((item): item is [string, number] => typeof item[1] === 'number' && item[1] <= bank + 0.6)
  const yMax = Math.max(bank, level ?? bank, ...marks.map((item) => item[1])) + 0.12
  const yMin = Math.min(...ys, level ?? 0) - 0.08
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)

  const project = (x: number, y: number): [number, number] => {
    const px = ((x - xMin) / (xMax - xMin || 1)) * (width - pad * 2) + pad
    const py = ((yMax - y) / (yMax - yMin || 1)) * (height - pad * 2) + pad
    return [px, py]
  }

  const bed = xs.map((x, index) => project(x, ys[index]).join(',')).join(' ')
  let water = ''
  if (level != null) {
    const pts: [number, number][] = []
    for (let i = 0; i < xs.length; i++) {
      if (i > 0 && (ys[i - 1] - level) * (ys[i] - level) < 0) {
        const t = (level - ys[i - 1]) / (ys[i] - ys[i - 1])
        pts.push(project(xs[i - 1] + t * (xs[i] - xs[i - 1]), level))
      }
      if (ys[i] <= level) pts.push(project(xs[i], ys[i]))
    }
    if (pts.length >= 2) {
      const surface = project(0, level)[1]
      water = `M ${pts.map((point) => point.join(',')).join(' L ')} L ${pts[pts.length - 1][0]},${surface} L ${pts[0][0]},${surface} Z`
    }
  }

  return (
    <svg className="channel" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sección de la quebrada">
      {water && <path d={water} className="water" />}
      <polyline points={bed} className="bed" />
      {marks.map(([name, value]) => {
        const y = project(0, value)[1]
        return (
          <g key={name}>
            <line x1={pad} x2={width - pad} y1={y} y2={y} className="mark-line" />
            <text x={width - pad} y={y - 4} textAnchor="end">
              {name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
