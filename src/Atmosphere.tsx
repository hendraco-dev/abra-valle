import { useEffect, useRef } from 'react'

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uRain;
uniform float uHaze;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float drift = sin(uv.x * 2.4 + uTime * 0.07) * 0.035 * (0.35 + uRain);
  vec3 deep = vec3(0.027, 0.055, 0.047);
  vec3 mist = vec3(0.09, 0.16, 0.14);
  vec3 warm = vec3(0.28, 0.14, 0.07);
  float lift = smoothstep(0.0, 1.0, uv.y + drift);
  vec3 col = mix(deep, mist, lift);
  col = mix(col, warm, uHaze * (1.0 - uv.y) * 0.55);
  float veil = uRain * (0.08 + 0.05 * sin(uv.y * 36.0 - uTime * 0.9 + uv.x * 8.0));
  col += vec3(0.04, 0.11, 0.09) * veil * (1.0 - uv.y);
  float vign = smoothstep(1.15, 0.25, length(uv - vec2(0.5, 0.45)));
  col *= 0.62 + 0.38 * vign;
  gl_FragColor = vec4(col, 1.0);
}
`

const SKIP = '(max-width: 899px), (prefers-reduced-motion: reduce)'

export function Atmosphere({ rain, haze }: { rain: number; haze: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uniforms = useRef({ rain, haze })
  uniforms.current = { rain, haze }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gate = window.matchMedia(SKIP)
    let stop = () => {}

    const sync = () => {
      stop()
      stop = () => {}
      if (!gate.matches) stop = start(canvas, uniforms)
    }
    sync()
    gate.addEventListener('change', sync)
    return () => {
      gate.removeEventListener('change', sync)
      stop()
    }
  }, [])

  return <canvas ref={canvasRef} className="atmosphere" aria-hidden="true" />
}

function start(canvas: HTMLCanvasElement, uniforms: { current: { rain: number; haze: number } }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
  if (!gl) return () => {}

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
  }

  const program = gl.createProgram()
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!program || !vs || !fs) return () => {}
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(program, 'uRes')
  const uTime = gl.getUniformLocation(program, 'uTime')
  const uRain = gl.getUniformLocation(program, 'uRain')
  const uHaze = gl.getUniformLocation(program, 'uHaze')

  let frame = 0
  let alive = true
  let last = 0
  const startAt = performance.now()

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    const width = Math.floor(canvas.clientWidth * dpr)
    const height = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  const draw = (now: number) => {
    if (!alive) return
    if (document.hidden) {
      frame = 0
      return
    }
    frame = requestAnimationFrame(draw)
    if (now - last < 48) return
    last = now
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform1f(uTime, (now - startAt) / 1000)
    gl.uniform1f(uRain, uniforms.current.rain)
    gl.uniform1f(uHaze, uniforms.current.haze)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const onVis = () => {
    if (!document.hidden && alive && frame === 0) frame = requestAnimationFrame(draw)
  }
  document.addEventListener('visibilitychange', onVis)
  frame = requestAnimationFrame(draw)

  return () => {
    alive = false
    cancelAnimationFrame(frame)
    frame = 0
    document.removeEventListener('visibilitychange', onVis)
    observer.disconnect()
    gl.deleteProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    gl.deleteBuffer(buffer)
  }
}
