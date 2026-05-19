import { Component } from 'solid-js';
import { Slider, ResetButton } from '../_shared/ui';

export interface ArcCameraParams {
  distance: number;
  minDistance: number;
  maxDistance: number;
  alpha: number;
  beta: number;
  minBeta: number;
  maxBeta: number;
  inertia: number;
  wheelPrecision: number;
  angularSensibility: number;
  speed: number;
  autoRotateSpeed: number;
}

export interface ArcCameraPanelProps {
  params: ArcCameraParams;
  setParam: (key: keyof ArcCameraParams, value: number) => void;
  onReset: () => void;
}

export const ArcCameraPanel: Component<ArcCameraPanelProps> = (props) => {
  return (
    <>
      <Slider
        label="Distance"
        value={props.params.distance}
        min={1}
        max={100}
        step={1}
        color="#66ccff"
        onChange={(v) => props.setParam('distance', v)}
      />
      <Slider
        label="Min Distance"
        value={props.params.minDistance}
        min={1}
        max={50}
        step={1}
        color="#66ccff"
        onChange={(v) => props.setParam('minDistance', v)}
      />
      <Slider
        label="Max Distance"
        value={props.params.maxDistance}
        min={10}
        max={200}
        step={5}
        color="#66ccff"
        onChange={(v) => props.setParam('maxDistance', v)}
      />
      <Slider
        label="Alpha (H)"
        value={props.params.alpha}
        min={0}
        max={Math.PI * 2}
        step={0.1}
        color="#66ccff"
        onChange={(v) => props.setParam('alpha', v)}
      />
      <Slider
        label="Beta (V)"
        value={props.params.beta}
        min={0}
        max={Math.PI}
        step={0.05}
        color="#66ccff"
        onChange={(v) => props.setParam('beta', v)}
      />
      <Slider
        label="Min Beta"
        value={props.params.minBeta}
        min={0}
        max={Math.PI / 2}
        step={0.05}
        color="#66ccff"
        onChange={(v) => props.setParam('minBeta', v)}
      />
      <Slider
        label="Max Beta"
        value={props.params.maxBeta}
        min={0}
        max={Math.PI}
        step={0.05}
        color="#66ccff"
        onChange={(v) => props.setParam('maxBeta', v)}
      />
      <Slider
        label="Inertia"
        value={props.params.inertia}
        min={0}
        max={1}
        step={0.05}
        color="#66ccff"
        onChange={(v) => props.setParam('inertia', v)}
      />
      <Slider
        label="Wheel Prec"
        value={props.params.wheelPrecision}
        min={10}
        max={200}
        step={10}
        color="#66ccff"
        onChange={(v) => props.setParam('wheelPrecision', v)}
      />
      <Slider
        label="Ang Sens"
        value={props.params.angularSensibility}
        min={100}
        max={3000}
        step={100}
        color="#66ccff"
        onChange={(v) => props.setParam('angularSensibility', v)}
      />
      <Slider
        label="Speed"
        value={props.params.speed}
        min={0.1}
        max={5}
        step={0.1}
        color="#66ccff"
        onChange={(v) => props.setParam('speed', v)}
      />
      <Slider
        label="Auto Rotate"
        value={props.params.autoRotateSpeed}
        min={0}
        max={5}
        step={0.1}
        color="#66ccff"
        onChange={(v) => props.setParam('autoRotateSpeed', v)}
      />
      <ResetButton onClick={props.onReset} />
    </>
  );
};
