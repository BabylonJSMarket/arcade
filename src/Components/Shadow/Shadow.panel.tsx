import { Component } from 'solid-js';
import { Slider, ResetButton } from '../_shared/ui';

export interface ShadowParams {
  darkness: number;
  bias: number;
  normalBias: number;
  filteringQuality: number;
  castShadowsGlobal: number;
  receiveShadowsGlobal: number;
}

export interface ShadowPanelProps {
  params: ShadowParams;
  setParam: (key: keyof ShadowParams, value: number) => void;
  onReset: () => void;
}

export const ShadowPanel: Component<ShadowPanelProps> = (props) => {
  const formatFilterQuality = (value: number): string => {
    const qualities = ['None', 'Low', 'Medium', 'High'];
    return qualities[Math.round(value)] || 'High';
  };

  const formatToggle = (value: number): string => {
    return value > 0.5 ? 'On' : 'Off';
  };

  return (
    <>
      <Slider
        label="Darkness"
        value={props.params.darkness}
        min={0}
        max={1}
        step={0.05}
        color="#ffa500"
        onChange={(v) => props.setParam('darkness', v)}
      />
      <Slider
        label="Bias"
        value={props.params.bias}
        min={0}
        max={0.1}
        step={0.001}
        formatValue={(v) => v.toFixed(3)}
        color="#ffa500"
        onChange={(v) => props.setParam('bias', v)}
      />
      <Slider
        label="Normal Bias"
        value={props.params.normalBias}
        min={0}
        max={10}
        step={0.1}
        color="#ffa500"
        onChange={(v) => props.setParam('normalBias', v)}
      />
      <Slider
        label="Filter Quality"
        value={props.params.filteringQuality}
        min={0}
        max={3}
        step={1}
        color="#ffa500"
        formatValue={formatFilterQuality}
        onChange={(v) => props.setParam('filteringQuality', v)}
      />
      <Slider
        label="Cast Shadows"
        value={props.params.castShadowsGlobal}
        min={0}
        max={1}
        step={1}
        color="#ffa500"
        formatValue={formatToggle}
        onChange={(v) => props.setParam('castShadowsGlobal', v)}
      />
      <Slider
        label="Receive Shadows"
        value={props.params.receiveShadowsGlobal}
        min={0}
        max={1}
        step={1}
        color="#ffa500"
        formatValue={formatToggle}
        onChange={(v) => props.setParam('receiveShadowsGlobal', v)}
      />
      <ResetButton onClick={props.onReset} />
    </>
  );
};
