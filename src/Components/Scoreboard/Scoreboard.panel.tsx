/**
 * Renderer-free Solid panel for the Scoreboard core. Binds directly to the
 * live core instance and polls its snapshot so the overlay preview ticks
 * along with the game clock. Zero imports from `@babylonjs` or `three`
 * (including type-only).
 *
 * The preview block inside this panel IS the scoreboard — the same markup
 * would render in a standalone overlay. Keeping it here means the panel
 * doubles as the live HUD when pinned open, which is exactly what the ref
 * Scoreboard does (its "UI" was an absolute-positioned HTML div).
 */

import { Component as SolidComponent, createSignal, onCleanup, onMount, For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_SCOREBOARD_PARAMS,
  type ScoreboardInstance,
  type ScoreboardParams,
  type ScoreboardPosition,
  type ScoreboardSnapshot,
} from './Scoreboard.core';

export interface ScoreboardPanelProps {
  core: ScoreboardInstance;
  /** Optional — fired when the user hits "Add +1" on a player row. */
  onAddScore?: (entityId: string, points: number) => void;
  /** Optional — fired when the user hits "Reset all". */
  onReset?: () => void;
}

const POSITIONS: ScoreboardPosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

export const ScoreboardPanel: SolidComponent<ScoreboardPanelProps> = (props) => {
  const [params, setParams] = createStore<ScoreboardParams>({ ...props.core.getParams() });
  const [snapshot, setSnapshot] = createSignal<ScoreboardSnapshot>(props.core.getSnapshot());

  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => setSnapshot(props.core.getSnapshot()), 80);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const push = <K extends keyof ScoreboardParams>(key: K, value: ScoreboardParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<ScoreboardParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_SCOREBOARD_PARAMS });
    props.core.setParams(DEFAULT_SCOREBOARD_PARAMS);
    props.core.reset();
    if (props.onReset) props.onReset();
  };

  const bump = (entityId: string) => {
    if (props.onAddScore) props.onAddScore(entityId, 1);
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '260px' }}>
      <Section title="Live overlay">
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px 14px',
            'border-radius': '8px',
            'font-size': `${snapshot().fontSize}px`,
          }}
        >
          <div
            style={{
              'font-weight': 'bold',
              'font-size': `${snapshot().fontSize + 2}px`,
              'margin-bottom': '8px',
              'text-align': 'center',
              'border-bottom': '1px solid rgba(255,255,255,0.3)',
              'padding-bottom': '6px',
            }}
          >
            {snapshot().title}
          </div>
          <For each={snapshot().rows}>
            {(row) => (
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  margin: '6px 0',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    background: row.colorCss,
                    'border-radius': '3px',
                    'flex-shrink': 0,
                  }}
                />
                <span style={{ 'flex-grow': 1 }}>{row.name}</span>
                <span style={{ 'font-weight': 'bold', 'min-width': '24px', 'text-align': 'right' }}>
                  {row.scoreText}
                </span>
                <button
                  onClick={() => bump(row.entityId)}
                  style={{
                    padding: '2px 6px',
                    background: '#222',
                    color: '#66ccff',
                    border: '1px solid #66ccff',
                    'border-radius': '3px',
                    cursor: 'pointer',
                    'font-size': '10px',
                  }}
                >
                  +1
                </button>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Appearance">
        <Slider
          label="fontSize (px)"
          value={params.fontSize}
          min={10}
          max={32}
          step={1}
          onChange={(v) => push('fontSize', v)}
        />
        <div style={{ 'margin-top': '8px' }}>
          <div style={{ color: '#aaa', 'font-size': '10px', 'margin-bottom': '4px' }}>
            Position
          </div>
          <select
            value={params.position}
            onChange={(e) => push('position', e.currentTarget.value as ScoreboardPosition)}
            style={{
              width: '100%',
              padding: '6px',
              background: '#222',
              color: '#ddd',
              border: '1px solid #444',
              'border-radius': '4px',
              cursor: 'pointer',
            }}
          >
            <For each={POSITIONS}>
              {(p) => <option value={p}>{p}</option>}
            </For>
          </select>
        </div>
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
