/**
 * KeyboardMover panel — renderer-free Solid component. Binds directly to the
 * component instance's fields. No @babylonjs/three imports.
 */

import { Component as SolidComponent, createSignal, onCleanup, onMount } from 'solid-js';
import { Slider, ResetButton, Section } from '../_shared/ui';
import { KeyboardMoverComponent } from './KeyboardMover';

export interface KeyboardMoverPanelProps {
  component: KeyboardMoverComponent;
}

const DEFAULTS = { speed: 4, faceMotion: true };

export const KeyboardMoverPanel: SolidComponent<KeyboardMoverPanelProps> = (props) => {
  const [speed, setSpeed] = createSignal(props.component.speed);
  const [faceMotion, setFaceMotion] = createSignal(props.component.faceMotion);

  // Poll so the readout reflects anything else mutating the component.
  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => {
      setSpeed(props.component.speed);
      setFaceMotion(props.component.faceMotion);
    }, 120);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const pushSpeed = (v: number) => {
    props.component.speed = v;
    setSpeed(v);
  };
  const pushFace = (v: boolean) => {
    props.component.faceMotion = v;
    setFaceMotion(v);
  };
  const reset = () => {
    pushSpeed(DEFAULTS.speed);
    pushFace(DEFAULTS.faceMotion);
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '220px' }}>
      <Section title="Motion">
        <Slider
          label="speed (world units / s)"
          value={speed()}
          min={0}
          max={15}
          step={0.1}
          onChange={pushSpeed}
        />
        <label style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px' }}>
          <input
            type="checkbox"
            checked={faceMotion()}
            onChange={(e) => pushFace(e.currentTarget.checked)}
          />
          <span>Face direction of motion</span>
        </label>
      </Section>

      <Section title="Controls">
        <div style={{ color: '#8b949e', 'font-size': '11px', 'line-height': 1.5 }}>
          W/A/S/D or arrow keys. Camera-relative — forward is always "where the camera is looking".
        </div>
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
