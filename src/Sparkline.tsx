export function Sparkline({
  values,
  color = '#9be7d2',
  label,
}: {
  values: Array<number | null>
  color?: string
  label: string
}) {
  const width = 320
  const height = 78
  const nums = values.filter((value): value is number => value != null)
  if (nums.length < 2) return <p className="muted">Serie no disponible.</p>
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  let path = ''
  let pen = false
  values.forEach((value, index) => {
    if (value == null) {
      pen = false
      return
    }
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - 8 - ((value - min) / span) * (height - 16)
    path += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
    pen = true
  })
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path.trim()} fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}
