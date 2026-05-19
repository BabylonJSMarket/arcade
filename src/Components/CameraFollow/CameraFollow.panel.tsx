/**
 * Renderer-free Solid panel for live-tuning CameraFollow params.
 * Binds to the pure core. No imports from @babylonjs or three.
 */

import { Component as SolidComponent } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  DEFAULT_CAMERA_FOLLOW_PARAMS,
  type CameraFollowInstance,
  type CameraFollowParams,
} from './CameraFollow.core';

export interface CameraFollowPanelProps {
  core: CameraFollowInstance;
}

export const CameraFollowPanel: SolidComponent<CameraFollowPanelProps> = (props) => {
  const [params, setParams] = createStore<CameraFollowParams>({ ...props.core.getParams() });

  const push = <K extends keyof CameraFollowParams>(key: K, value: CameraFollowParams[K]) => {
    setParams(key, value);
    props.core.setParams({ [key]: value } as Partial<CameraFollowParams>);
  };

  const reset = () => {
    setParams({ ...DEFAULT_CAMERA_FOLLOW_PARAMS });
    props.core.setParams(DEFAULT_CAMERA_FOLLOW_PARAMS);
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '240px' }}>
      <Section title="Smoothing">
        <Slider
          label="smoothing (1/sec)"
          value={params.smoothing}
          min={0}
          max={30}
          step={0.1}
          onChange={(v) => push('smoothing', v)}
        />
        <div style={{ 'font-size': '11px', color: '#8b949e', 'margin-top': '4px' }}>
          0 = locked · 6 = natural · 20+ = snappy
        </div>
      </Section>

      <Section title="Look-at offset">
        <Slider
          label="offsetY (up/down)"
          value={params.offsetY}
          min={-3}
          max={4}
          step={0.05}
          onChange={(v) => push('offsetY', v)}
        />
        <Slider
          label="offsetX (left/right)"
          value={params.offsetX}
          min={-4}
          max={4}
          step={0.05}
          onChange={(v) => push('offsetX', v)}
        />
        <Slider
          label="offsetZ (forward/back)"
          value={params.offsetZ}
          min={-4}
          max={4}
          step={0.05}
          onChange={(v) => push('offsetZ', v)}
        />
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
