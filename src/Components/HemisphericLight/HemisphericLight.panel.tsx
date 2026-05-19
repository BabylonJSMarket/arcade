import { Component } from 'solid-js';
import { Slider, ResetButton, ColorControl } from '../_shared/ui';

export interface HemisphericLightParams {
  intensity: number;
  directionX: number;
  directionY: number;
  directionZ: number;
  diffuseR: number;
  diffuseG: number;
  diffuseB: number;
  groundR: number;
  groundG: number;
  groundB: number;
  specularR: number;
  specularG: number;
  specularB: number;
}

export interface HemisphericLightPanelProps {
  params: HemisphericLightParams;
  setParam: (key: keyof HemisphericLightParams, value: number) => void;
  onReset: () => void;
}

export const HemisphericLightPanel: Component<HemisphericLightPanelProps> = (props) => {
  return (
    <>
      <Slider
        label="Intensity"
        value={props.params.intensity}
        min={0}
        max={2}
        step={0.05}
        color="#ffcc00"
        onChange={(v) => props.setParam('intensity', v)}
      />
      <Slider
        label="Direction X"
        value={props.params.directionX}
        min={-1}
        max={1}
        step={0.1}
        color="#ffcc00"
        onChange={(v) => props.setParam('directionX', v)}
      />
      <Slider
        label="Direction Y"
        value={props.params.directionY}
        min={-1}
        max={1}
        step={0.1}
        color="#ffcc00"
        onChange={(v) => props.setParam('directionY', v)}
      />
      <Slider
        label="Direction Z"
        value={props.params.directionZ}
        min={-1}
        max={1}
        step={0.1}
        color="#ffcc00"
        onChange={(v) => props.setParam('directionZ', v)}
      />
      <ColorControl
        label="Diffuse (Sky)"
        r={props.params.diffuseR}
        g={props.params.diffuseG}
        b={props.params.diffuseB}
        onChange={(r, g, b) => {
          props.setParam('diffuseR', r);
          props.setParam('diffuseG', g);
          props.setParam('diffuseB', b);
        }}
      />
      <ColorControl
        label="Ground"
        r={props.params.groundR}
        g={props.params.groundG}
        b={props.params.groundB}
        onChange={(r, g, b) => {
          props.setParam('groundR', r);
          props.setParam('groundG', g);
          props.setParam('groundB', b);
        }}
      />
      <ColorControl
        label="Specular"
        r={props.params.specularR}
        g={props.params.specularG}
        b={props.params.specularB}
        onChange={(r, g, b) => {
          props.setParam('specularR', r);
          props.setParam('specularG', g);
          props.setParam('specularB', b);
        }}
      />
      <ResetButton onClick={props.onReset} />
    </>
  );
};
