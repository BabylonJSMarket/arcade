/**
 * Movement — renderer-free Solid panel. Binds directly to the pure core and
 * works over either the Babylon or the Three.js demo. No @babylonjs/three
 * imports (including type-only).
 */

import { Component as SolidComponent, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_MOVEMENT_PARAMS,
  type MovementInstance,
  type MovementParams,
} from './Movement.core';

export interface MovementPanelProps {
  /** The live core instance. Panel reads/writes its params directly. */
  core: MovementInstance;
  /** Optional: called when the user hits the "Jump" button. */
  onJump?: () => void;
}

export const MovementPanel: SolidComponent<MovementPanelProps> = (props) => {
  const [params, setParams] = createStore<MovementParams>({ ...props.core.getParams() });
  const [isGrounded, setIsGrounded] = createSignal(props.core.getState().isGrounded);
  const [isMoving, setIsMoving] = createSignal(props.core.getState().isMoving);
  const [velY, setVelY] = createSignal(props.core.getState().velY);

  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => {
      const s = props.core.getState();
      setIsGrounded(s.isGrounded);
      setIsMoving(s.isMoving);
      setVelY(s.velY);
    }, 80);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const push = <K extends keyof MovementParams>(key: K, value: MovementParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<MovementParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_MOVEMENT_PARAMS });
    props.core.setParams(DEFAULT_MOVEMENT_PARAMS);
    props.core.reset();
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '240px' }}>
      <Section title="State">
        <button
          onClick={() => props.onJump?.()}
          style={{
            width: '100%',
            padding: '6px',
            background: '#222',
            color: '#7fe5a0',
            border: '1px solid #7fe5a0',
            cursor: 'pointer',
          }}
        >
          Trigger jump
        </button>
        <div style={{ 'margin-top': '6px', color: '#888', 'font-size': '10px' }}>
          {isGrounded() ? 'Grounded' : 'Airborne'} · {isMoving() ? 'moving' : 'still'} · velY {velY().toFixed(2)}
        </div>
      </Section>

      <Section title="Locomotion">
        <Slider
          label="speed (units / s)"
          value={params.speed}
          min={0}
          max={20}
          step={0.1}
          onChange={(v) => push('speed', v)}
        />
        <Slider
          label="rotationSpeed (rad / s)"
          value={params.rotationSpeed}
          min={0}
          max={Math.PI * 4}
          step={0.1}
          onChange={(v) => push('rotationSpeed', v)}
        />
        <label
          style={{
            display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px',
            'margin-top': '4px',
          }}
        >
          <input
            type="checkbox"
            checked={params.faceMotion}
            onChange={(e) => push('faceMotion', e.currentTarget.checked)}
          />
          <span>Face direction of motion</span>
        </label>
      </Section>

      <Section title="Jump & gravity">
        <Slider
          label="jumpForce"
          value={params.jumpForce}
          min={0}
          max={25}
          step={0.5}
          onChange={(v) => push('jumpForce', v)}
        />
        <Slider
          label="gravity"
          value={params.gravity}
          min={0}
          max={60}
          step={0.5}
          onChange={(v) => push('gravity', v)}
        />
        <Slider
          label="maxFallSpeed (0 = uncapped)"
          value={params.maxFallSpeed}
          min={0}
          max={100}
          step={1}
          onChange={(v) => push('maxFallSpeed', v)}
        />
      </Section>

      <Section title="Body">
        <Slider
          label="feetOffset (capsule half-height)"
          value={params.feetOffset}
          min={0}
          max={4}
          step={0.05}
          onChange={(v) => push('feetOffset', v)}
        />
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
