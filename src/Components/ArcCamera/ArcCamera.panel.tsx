import { Component } from 'solid-js';
import { Slider } from '../_shared/ui';

/** Live, user-facing camera controls (zoom / pan / follow). */
export interface CameraControlParams {
  /** Camera distance (radius). */
  zoom: number;
  /** Pan offset along world X (shifts the framing; works while following too). */
  panX: number;
  /** Pan offset along world Z (shifts the framing; works while following too). */
  panZ: number;
  /** Keep the target (player / ball) centred. */
  follow: boolean;
}

export interface CameraControlPanelProps {
  params: CameraControlParams;
  setZoom: (v: number) => void;
  setPanX: (v: number) => void;
  setPanZ: (v: number) => void;
  setFollow: (v: boolean) => void;
  onCenter: () => void;
}

const buttonStyle = {
  width: '100%',
  padding: '8px',
  'margin-top': '8px',
  border: '1px solid var(--viz-button-border, transparent)',
  color: 'var(--viz-button-fg, white)',
  'border-radius': 'var(--viz-radius-sm, 4px)',
  cursor: 'pointer',
  'font-family': 'var(--viz-font, monospace)',
  'font-size': '11px',
} as const;

export const CameraControlPanel: Component<CameraControlPanelProps> = (props) => {
  return (
    <>
      <button
        onClick={() => props.setFollow(!props.params.follow)}
        style={{
          ...buttonStyle,
          'margin-top': '0',
          background: props.params.follow ? 'var(--viz-accent, #2a8f5a)' : '#555',
        }}
      >
        {props.params.follow ? '● Following target' : '○ Free camera'}
      </button>

      <Slider
        label="Zoom"
        value={props.params.zoom}
        min={5}
        max={120}
        step={1}
        color="#66ccff"
        onChange={props.setZoom}
      />

      {/* Pan offsets the framing in both modes — following + pan = track the
          target but off-centre; free + pan = slide the held view around. */}
      <Slider
        label="Pan X"
        value={props.params.panX}
        min={-40}
        max={40}
        step={0.5}
        color="#66ccff"
        onChange={props.setPanX}
      />
      <Slider
        label="Pan Z"
        value={props.params.panZ}
        min={-40}
        max={40}
        step={0.5}
        color="#66ccff"
        onChange={props.setPanZ}
      />

      <button onClick={props.onCenter} style={buttonStyle}>
        Center pan
      </button>
    </>
  );
};
