/**
 * Renderer-free Solid panel for the Animation core. Binds directly to the
 * instance and can be mounted over either the Babylon or Three.js demo.
 * Zero imports from @babylonjs or three (including type-only).
 */

import { Component as SolidComponent, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_ANIMATION_PARAMS,
  type AnimationInstance,
  type AnimationParams,
} from './Animation.core';

export interface AnimationPanelProps {
  /** The live core instance for the demo target. */
  core: AnimationInstance;
  /** Drives the demo speed. If omitted the panel writes directly into core. */
  onSpeed?: (speed: number) => void;
}

export const AnimationPanel: SolidComponent<AnimationPanelProps> = (props) => {
  const [params, setParams] = createStore<AnimationParams>({ ...props.core.getParams() });
  const [state, setState] = createSignal(props.core.getState());
  const [demoSpeed, setDemoSpeed] = createSignal(0);

  // Poll the live state so the bars tick along with the world clock without
  // needing to thread a per-frame signal in from the caller.
  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => setState(props.core.getState()), 60);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const push = <K extends keyof AnimationParams>(key: K, value: AnimationParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<AnimationParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_ANIMATION_PARAMS });
    props.core.setParams(DEFAULT_ANIMATION_PARAMS);
    props.core.reset();
    setDemoSpeed(0);
    if (props.onSpeed) props.onSpeed(0);
  };

  const applySpeed = (v: number) => {
    setDemoSpeed(v);
    if (props.onSpeed) props.onSpeed(v);
  };

  const bar = (label: string, weight: number, color: string) => (
    <div style={{ 'margin-bottom': '4px' }}>
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'font-size': '10px',
          color: '#aaa',
        }}
      >
        <span>{label}</span>
        <span>{weight.toFixed(2)}</span>
      </div>
      <div
        style={{
          height: '6px',
          background: '#222',
          'border-radius': '3px',
          overflow: 'hidden',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(1, weight)) * 100}%`,
            background: color,
            transition: 'width 60ms linear',
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '260px' }}>
      <Section title="Blend">
        {bar('idle', state().idleWeight, '#66ccff')}
        {bar('walk', state().walkWeight, '#66cc55')}
        {bar('run', state().runWeight, '#ff9933')}
        <div style={{ color: '#888', 'font-size': '10px', 'margin-top': '4px' }}>
          state: <span style={{ color: '#fff' }}>{state().state}</span>
          <span style={{ 'margin-left': '8px' }}>
            speedRatio: {state().speedRatio.toFixed(2)}
          </span>
        </div>
      </Section>

      <Section title="Drive">
        <Slider
          label="demo speed"
          value={demoSpeed()}
          min={0}
          max={12}
          step={0.1}
          onChange={applySpeed}
        />
      </Section>

      <Section title="Tuning">
        <Slider
          label="walkSpeed"
          value={params.walkSpeed}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(v) => push('walkSpeed', v)}
        />
        <Slider
          label="runSpeed"
          value={params.runSpeed}
          min={0.1}
          max={20}
          step={0.1}
          onChange={(v) => push('runSpeed', v)}
        />
        <Slider
          label="blendSpeed"
          value={params.blendSpeed}
          min={0.1}
          max={30}
          step={0.1}
          onChange={(v) => push('blendSpeed', v)}
        />
        <Slider
          label="speedSmoothRate"
          value={params.speedSmoothRate}
          min={0.1}
          max={30}
          step={0.1}
          onChange={(v) => push('speedSmoothRate', v)}
        />
        <Slider
          label="speedThreshold"
          value={params.speedThreshold}
          min={0}
          max={3}
          step={0.05}
          onChange={(v) => push('speedThreshold', v)}
        />
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
