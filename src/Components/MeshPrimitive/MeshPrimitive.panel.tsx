import { Component } from 'solid-js';
import { Slider, ResetButton } from '../_shared/ui';

export interface MeshPrimitiveParams {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  visibility: number;
}

export interface MeshPrimitivePanelProps {
  params: MeshPrimitiveParams;
  setParam: (key: keyof MeshPrimitiveParams, value: number) => void;
  onReset: () => void;
}

export const MeshPrimitivePanel: Component<MeshPrimitivePanelProps> = (props) => {
  return (
    <>
      <Slider
        label="Scale X"
        value={props.params.scaleX}
        min={0.1}
        max={5}
        step={0.1}
        color="#9f4aff"
        onChange={(v) => props.setParam('scaleX', v)}
      />
      <Slider
        label="Scale Y"
        value={props.params.scaleY}
        min={0.1}
        max={5}
        step={0.1}
        color="#9f4aff"
        onChange={(v) => props.setParam('scaleY', v)}
      />
      <Slider
        label="Scale Z"
        value={props.params.scaleZ}
        min={0.1}
        max={5}
        step={0.1}
        color="#9f4aff"
        onChange={(v) => props.setParam('scaleZ', v)}
      />
      <Slider
        label="Visibility"
        value={props.params.visibility}
        min={0}
        max={1}
        step={0.05}
        color="#9f4aff"
        onChange={(v) => props.setParam('visibility', v)}
      />
      <ResetButton onClick={props.onReset} />
    </>
  );
};
