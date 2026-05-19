/**
 * PlayerInput panel — renderer-free Solid component.
 *
 * Shows which actions are currently active, the derived move vector, and the
 * input source. Binds directly to the core; no @babylonjs/three imports.
 */

import { Component as SolidComponent, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_PLAYER_INPUT_PARAMS,
  type PlayerInputInstance,
} from './PlayerInput.core';

export interface PlayerInputPanelProps {
  core: PlayerInputInstance;
}

export const PlayerInputPanel: SolidComponent<PlayerInputPanelProps> = (props) => {
  const [deadzone, setDeadzone] = createSignal(props.core.getParams().deadzone);
  const [active, setActive] = createSignal<string[]>([]);
  const [moveX, setMoveX] = createSignal(0);
  const [moveZ, setMoveZ] = createSignal(0);
  const [source, setSource] = createSignal('none');
  const [bindings, setBindings] = createSignal<Array<[string, string[]]>>(
    Object.entries(props.core.getParams().keyBindings),
  );

  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => {
      // Peek at the core's state without consuming; we call consume() then
      // re-surface the snapshot. Safe: the System's own consume() runs on the
      // game loop and this panel polls at 10 Hz, so a missed justPressed here
      // is just a display skip.
      const params = props.core.getParams();
      setDeadzone(params.deadzone);
      setBindings(Object.entries(params.keyBindings));

      const snap = props.core.consume();
      // Re-apply: the System consumes each frame anyway, so the panel's tap
      // only shows current state.
      setActive([...snap.active].sort());
      setMoveX(snap.moveX);
      setMoveZ(snap.moveZ);
      setSource(snap.source);
    }, 100);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const pushDeadzone = (v: number) => {
    setDeadzone(v);
    props.core.setParams({ deadzone: v });
  };

  const reset = () => {
    pushDeadzone(DEFAULT_PLAYER_INPUT_PARAMS.deadzone);
    props.core.setParams({
      keyBindings: DEFAULT_PLAYER_INPUT_PARAMS.keyBindings,
      gamepadBindings: DEFAULT_PLAYER_INPUT_PARAMS.gamepadBindings,
    });
  };

  const sourceColor = () => {
    const s = source();
    if (s === 'keyboard') return '#66ccff';
    if (s === 'gamepad') return '#ff9966';
    return '#888';
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '240px' }}>
      <Section title="Active actions">
        <Show
          when={active().length > 0}
          fallback={
            <div style={{ color: '#666', 'font-size': '11px' }}>(press a mapped key)</div>
          }
        >
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}>
            <For each={active()}>
              {(a) => (
                <span
                  style={{
                    padding: '2px 6px',
                    background: '#1a3a1a',
                    color: '#66ff66',
                    'border-radius': '3px',
                    'font-size': '10px',
                    'font-family': 'monospace',
                  }}
                >
                  {a}
                </span>
              )}
            </For>
          </div>
        </Show>
      </Section>

      <Section title="Move vector">
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'font-family': 'monospace',
            'font-size': '11px',
          }}
        >
          <span>x: {moveX().toFixed(2)}</span>
          <span>z: {moveZ().toFixed(2)}</span>
          <span style={{ color: sourceColor() }}>{source()}</span>
        </div>
      </Section>

      <Section title="Gamepad">
        <Slider
          label="deadzone"
          value={deadzone()}
          min={0}
          max={0.5}
          step={0.01}
          onChange={pushDeadzone}
        />
        <div style={{ color: '#8b949e', 'font-size': '10px', 'line-height': 1.4 }}>
          Filters tiny stick drift. Raise if a resting stick triggers motion.
        </div>
      </Section>

      <Section title="Key bindings">
        <div style={{ 'font-size': '10px', 'font-family': 'monospace', 'line-height': 1.6 }}>
          <For each={bindings()}>
            {([action, codes]) => (
              <div style={{ display: 'flex', 'justify-content': 'space-between' }}>
                <span style={{ color: '#aaa' }}>{action}</span>
                <span style={{ color: '#66ccff' }}>{codes.join(' / ')}</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
