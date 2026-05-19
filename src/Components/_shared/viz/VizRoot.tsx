import { Component, For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { vizStore } from './vizStore';
import { VizPanel } from './VizPanel';

export const VizRoot: Component = () => {
  return (
    <For each={Object.values(vizStore.panels)}>
      {(panel) => (
        <Show when={panel.visible}>
          <VizPanel panel={panel} />
        </Show>
      )}
    </For>
  );
};

let mounted = false;
let disposeRoot: (() => void) | null = null;

export function mountVizRoot(): void {
  if (mounted) return;

  const container = document.createElement('div');
  container.id = 'viz-root';
  document.body.appendChild(container);

  disposeRoot = render(() => <VizRoot />, container);
  mounted = true;
}

export function unmountVizRoot(): void {
  if (!mounted || !disposeRoot) return;

  disposeRoot();
  const container = document.getElementById('viz-root');
  if (container) {
    container.remove();
  }

  disposeRoot = null;
  mounted = false;
}
