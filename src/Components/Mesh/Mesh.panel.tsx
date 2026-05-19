/**
 * Renderer-free Solid panel for the Mesh core. Binds directly to the loader
 * instance and can be mounted over either the Babylon or Three.js demo.
 * Zero imports from @babylonjs or three (including type-only).
 */

import { Component as SolidComponent, createSignal, onCleanup, onMount } from 'solid-js';
import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_MESH_PARAMS,
  type MeshInstance,
  type MeshLoadState,
  type MeshParams,
} from './Mesh.core';

export interface MeshPanelProps {
  /** The live core instance for the demo target. */
  core: MeshInstance;
  /** Fired when the user clicks "Reload" — the System should dispatch a load. */
  onReload?: (src: string) => void;
}

const STATE_COLORS: Record<MeshLoadState, string> = {
  idle: '#888',
  loading: '#ffb74d',
  loaded: '#66cc55',
  error: '#f66',
};

export const MeshPanel: SolidComponent<MeshPanelProps> = (props) => {
  const [params, setParams] = createStore<MeshParams>({ ...props.core.getParams() });
  const [state, setState] = createSignal(props.core.getState());

  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => setState(props.core.getState()), 100);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const push = <K extends keyof MeshParams>(key: K, value: MeshParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<MeshParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_MESH_PARAMS });
    props.core.setParams(DEFAULT_MESH_PARAMS);
    props.core.reset();
  };

  const reload = () => {
    if (props.onReload) props.onReload(params.src);
  };

  const stateBadge = () => {
    const s = state();
    return (
      <span
        style={{
          color: STATE_COLORS[s.state],
          'font-weight': 'bold',
          'text-transform': 'uppercase',
          'font-size': '10px',
        }}
      >
        {s.state}
      </span>
    );
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '260px' }}>
      <Section title="Status">
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '11px' }}>
          <span>state:</span>
          {stateBadge()}
        </div>
        <div style={{ color: '#888', 'font-size': '10px', 'margin-top': '4px' }}>
          meshId: <span style={{ color: '#fff' }}>{state().meshId ?? '—'}</span>
        </div>
        <div style={{ color: '#888', 'font-size': '10px', 'margin-top': '2px' }}>
          animations: {state().animationNames.length}
        </div>
        {state().errorMessage && (
          <div style={{ color: '#f66', 'font-size': '10px', 'margin-top': '4px' }}>
            {state().errorMessage}
          </div>
        )}
      </Section>

      <Section title="Animations">
        {state().animationNames.length === 0 ? (
          <div style={{ color: '#666', 'font-size': '10px' }}>(none)</div>
        ) : (
          <ul style={{ 'padding-left': '16px', margin: '0', 'font-size': '10px' }}>
            <For each={state().animationNames}>
              {(name) => <li style={{ color: '#ccc' }}>{name}</li>}
            </For>
          </ul>
        )}
      </Section>

      <Section title="Source">
        <div style={{ 'font-size': '10px', color: '#aaa', 'margin-bottom': '4px' }}>
          src
        </div>
        <input
          type="text"
          value={params.src}
          onInput={(e) => push('src', e.currentTarget.value)}
          style={{
            width: '100%',
            background: '#111',
            border: '1px solid #333',
            color: '#ddd',
            padding: '4px',
            'font-size': '10px',
            'margin-bottom': '6px',
          }}
        />
        <button
          onClick={reload}
          style={{
            width: '100%',
            padding: '6px',
            background: '#222',
            color: '#66ccff',
            border: '1px solid #66ccff',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </Section>

      <Section title="Transform">
        <Slider
          label="scale"
          value={params.scale}
          min={0.05}
          max={5}
          step={0.05}
          onChange={(v) => push('scale', v)}
        />
        <Slider
          label="position.x"
          value={params.position[0]}
          min={-10}
          max={10}
          step={0.1}
          onChange={(v) => push('position', [v, params.position[1], params.position[2]])}
        />
        <Slider
          label="position.y"
          value={params.position[1]}
          min={-10}
          max={10}
          step={0.1}
          onChange={(v) => push('position', [params.position[0], v, params.position[2]])}
        />
        <Slider
          label="position.z"
          value={params.position[2]}
          min={-10}
          max={10}
          step={0.1}
          onChange={(v) => push('position', [params.position[0], params.position[1], v])}
        />
        <Slider
          label="rotation.y (rad)"
          value={params.rotation[1]}
          min={-Math.PI}
          max={Math.PI}
          step={0.05}
          onChange={(v) => push('rotation', [params.rotation[0], v, params.rotation[2]])}
        />
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
