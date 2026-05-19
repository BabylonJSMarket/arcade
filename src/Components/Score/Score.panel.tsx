/**
 * Renderer-free Solid panel for the Score core. Binds directly to the
 * instance and can be mounted over either the Babylon or the Three.js demo.
 * Zero imports from @babylonjs or three (including type-only).
 */

import { Component as SolidComponent, createSignal, For, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_SCORE_PARAMS,
  type ScoreInstance,
  type ScoreParams,
} from './Score.core';

export interface ScorePanelProps {
  /** The live core instance for the scoreboard target. */
  core: ScoreInstance;
  /** Optional — called when an "Award" button is pressed. */
  onAward?: (ownerEntity: string, points: number) => void;
  /** Optional — called when the "Reset scores" button is pressed. */
  onResetScores?: () => void;
  /** Players to show Award buttons for. Defaults to player1/player2 when empty. */
  players?: string[];
}

export const ScorePanel: SolidComponent<ScorePanelProps> = (props) => {
  const [params, setParams] = createStore<ScoreParams>({ ...props.core.getParams() });
  const [scores, setScores] = createSignal<Record<string, number>>(props.core.getAllScores());

  // Poll the snapshot so a HUD ticks along without having to thread a
  // per-frame signal from the framework. Core reads are cheap.
  let pollId: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    pollId = setInterval(() => setScores(props.core.getAllScores()), 80);
  });
  onCleanup(() => {
    if (pollId) clearInterval(pollId);
  });

  const push = <K extends keyof ScoreParams>(key: K, value: ScoreParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<ScoreParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_SCORE_PARAMS });
    props.core.reset();
    setScores(props.core.getAllScores());
  };

  const award = (ownerEntity: string) => {
    const amt = params.defaultPoints;
    if (props.onAward) {
      props.onAward(ownerEntity, amt);
    } else {
      props.core.addScore(ownerEntity, amt);
    }
    setScores(props.core.getAllScores());
  };

  const resetScores = () => {
    if (props.onResetScores) {
      props.onResetScores();
    } else {
      props.core.resetScores();
    }
    setScores(props.core.getAllScores());
  };

  const defaultPlayers = () => {
    const live = Object.keys(scores());
    if (live.length > 0) return live.sort();
    const provided = props.players ?? [];
    if (provided.length > 0) return provided;
    return ['player1', 'player2'];
  };

  const totalPoints = () =>
    Object.values(scores()).reduce((sum, n) => sum + n, 0);

  const leader = () => {
    const entries = Object.entries(scores());
    if (entries.length === 0) return null;
    return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  };

  const btn = (label: string, color: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        flex: '1',
        padding: '6px',
        background: '#222',
        color,
        border: `1px solid ${color}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '260px' }}>
      <Section title="Scoreboard">
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            gap: '4px',
            'max-height': '160px',
            'overflow-y': 'auto',
          }}
        >
          <For each={Object.entries(scores()).sort((a, b) => b[1] - a[1])}>
            {([id, value]) => (
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  padding: '4px 0',
                  'border-bottom': '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ color: '#fbbf24' }}>{id}</span>
                <span style={{ color: '#fff', 'font-weight': 'bold' }}>{value}</span>
              </div>
            )}
          </For>
          {Object.keys(scores()).length === 0 && (
            <div style={{ color: '#666', 'font-size': '11px' }}>No scores yet</div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            color: '#888',
            'font-size': '10px',
            'margin-top': '6px',
          }}
        >
          <span>Total: {totalPoints()}</span>
          <span>
            {leader() ? `Leader: ${leader()![0]} (${leader()![1]})` : 'Leader: —'}
          </span>
        </div>
      </Section>

      <Section title="Award points">
        <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
          <For each={defaultPlayers()}>
            {(id) => btn(`+${params.defaultPoints} ${id}`, '#66cc55', () => award(id))}
          </For>
        </div>
        <div style={{ 'margin-top': '6px' }}>
          {btn('Reset scores', '#e05555', resetScores)}
        </div>
      </Section>

      <Section title="Tuning">
        <Slider
          label="defaultPoints"
          value={params.defaultPoints}
          min={-10}
          max={100}
          step={1}
          onChange={(v) => push('defaultPoints', v)}
        />
        <Slider
          label="minScore (0 = no clamp)"
          value={params.minScore ?? 0}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => push('minScore', v === 0 ? null : v)}
        />
        <Slider
          label="maxScore (0 = no clamp)"
          value={params.maxScore ?? 0}
          min={0}
          max={1000}
          step={1}
          onChange={(v) => push('maxScore', v === 0 ? null : v)}
        />
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
