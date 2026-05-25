/**
 * EntityListPanel — starter viz panel that lists every live entity in the
 * world along with its tags and the names of its components. Each row is
 * clickable to expand and show the component class names.
 *
 * Reactivity: a parent (mountArcadeViz) subscribes to `world.entity.created`
 * and `world.entity.removed` and replaces the `entities` accessor; this panel
 * just reads whatever is current.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Component as SolidComponent } from 'solid-js';

export interface EntityListRow {
  id: string;
  tags: string[];
  components: string[];
}

export interface EntityListPanelProps {
  sceneName: () => string;
  rows: () => EntityListRow[];
}

export const EntityListPanel: SolidComponent<EntityListPanelProps> = (props) => {
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
  const rowCount = createMemo(() => props.rows().length);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'baseline',
          color: 'var(--viz-fg-soft, #aab)',
          'font-size': '10px',
          'text-transform': 'uppercase',
          'letter-spacing': '0.06em',
          'padding-bottom': '4px',
          'border-bottom': '1px solid var(--viz-border, #2a2d36)',
        }}
      >
        <span>{props.sceneName()}</span>
        <span>
          {rowCount()} {rowCount() === 1 ? 'entity' : 'entities'}
        </span>
      </div>

      <Show
        when={rowCount() > 0}
        fallback={
          <div style={{ color: 'var(--viz-fg-muted, #666)', 'padding-top': '6px' }}>
            (no entities — scene is empty)
          </div>
        }
      >
        <For each={props.rows()}>
          {(row) => (
            <div
              style={{
                background: 'var(--viz-bg-inset, #15171c)',
                'border-radius': 'var(--viz-radius-sm, 4px)',
                padding: '6px 8px',
              }}
            >
              <div
                onClick={() => toggle(row.id)}
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'center',
                  cursor: 'pointer',
                  'user-select': 'none',
                }}
              >
                <span style={{ color: 'var(--viz-fg, #cde)', 'font-weight': 'bold' }}>
                  {row.id}
                </span>
                <span style={{ color: 'var(--viz-fg-muted, #557)', 'font-size': '10px' }}>
                  {row.components.length}c · {row.tags.length}t
                </span>
              </div>

              <Show when={row.tags.length > 0}>
                <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '3px', 'margin-top': '4px' }}>
                  <For each={row.tags}>
                    {(tag) => (
                      <span
                        style={{
                          background: 'color-mix(in srgb, var(--viz-accent, #7df) 22%, transparent)',
                          color: 'var(--viz-accent, #7df)',
                          padding: '1px 6px',
                          'border-radius': '3px',
                          'font-size': '10px',
                        }}
                      >
                        {tag}
                      </span>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={expanded()[row.id]}>
                <div
                  style={{
                    'margin-top': '6px',
                    'padding-top': '6px',
                    'border-top': '1px solid var(--viz-border, #232630)',
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '2px',
                  }}
                >
                  <For each={row.components}>
                    {(name) => (
                      <div style={{ color: 'var(--viz-accent, #9bf)', 'font-size': '11px' }}>
                        · {name}
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};
