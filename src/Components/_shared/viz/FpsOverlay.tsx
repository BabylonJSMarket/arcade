/**
 * FpsOverlay — always-visible FPS readout pinned to the top of the screen.
 * Lives outside the vizStore panel system on purpose: panels can be hidden,
 * dragged, closed; an FPS counter should be a fixed corner of the chrome
 * the developer is always looking at.
 *
 * Math: count rAF callbacks over a moving 500ms window. Stable enough to
 * read while frame times jitter, fast enough to catch a drop within ~1 s.
 */
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { render } from 'solid-js/web'

interface FpsOverlayProps {
  /** Lower bound for the green/yellow/red color scale. Default 30. */
  warnFps?: number
}

function FpsOverlay(props: FpsOverlayProps) {
  const [fps, setFps] = createSignal(0)
  let raf = 0
  let frames = 0
  let lastSample = 0

  const tick = (now: number) => {
    frames += 1
    if (lastSample === 0) lastSample = now
    const dt = now - lastSample
    if (dt >= 500) {
      setFps(Math.round((frames * 1000) / dt))
      frames = 0
      lastSample = now
    }
    raf = requestAnimationFrame(tick)
  }

  onMount(() => { raf = requestAnimationFrame(tick) })
  onCleanup(() => { cancelAnimationFrame(raf) })

  const warn = () => props.warnFps ?? 30
  const color = () => {
    const v = fps()
    if (v === 0) return '#999'
    if (v >= warn() * 2) return '#7fffa0' // healthy green
    if (v >= warn()) return '#ffd86b'      // amber
    return '#ff6b6b'                       // red
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        'z-index': 9999,
        'pointer-events': 'none',
        padding: '4px 10px',
        background: 'rgba(8, 8, 14, 0.7)',
        color: color(),
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
        'font-size': '12px',
        'font-weight': '600',
        'line-height': '1',
        'letter-spacing': '0.04em',
        border: '1px solid rgba(255,255,255,0.08)',
        'border-radius': '4px',
        'backdrop-filter': 'blur(4px)',
      }}
    >
      <Show when={fps() > 0} fallback={<span>— FPS</span>}>
        {fps()} FPS
      </Show>
    </div>
  )
}

export interface FpsOverlayHandle {
  dispose(): void
}

export function mountFpsOverlay(opts: FpsOverlayProps = {}): FpsOverlayHandle {
  if (typeof document === 'undefined') {
    return { dispose: () => {} }
  }
  const host = document.createElement('div')
  host.dataset.role = 'arcade-fps-overlay'
  document.body.appendChild(host)
  const dispose = render(() => <FpsOverlay warnFps={opts.warnFps} />, host)
  return {
    dispose() {
      dispose()
      host.remove()
    },
  }
}
