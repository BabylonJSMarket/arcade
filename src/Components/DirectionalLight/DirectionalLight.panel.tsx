import { Component } from 'solid-js';
import { Slider, ResetButton, Section } from '../_shared/ui';

export interface DirectionalLightParams {
  dirX: number;
  dirY: number;
  dirZ: number;
  posX: number;
  posY: number;
  posZ: number;
  intensity: number;
  diffuseR: number;
  diffuseG: number;
  diffuseB: number;
  specularR: number;
  specularG: number;
  specularB: number;
}

export interface DirectionalLightPanelProps {
  params: DirectionalLightParams;
  setParam: (key: keyof DirectionalLightParams, value: number) => void;
  onReset: () => void;
}

export const DirectionalLightPanel: Component<DirectionalLightPanelProps> = (props) => {
  return (
    <>
      <Section title="Direction" color="#ffa500">
        <Slider
          label="Dir X"
          value={props.params.dirX}
          min={-10}
          max={10}
          step={0.1}
          color="#ffa500"
          onChange={(v) => props.setParam('dirX', v)}
        />
        <Slider
          label="Dir Y"
          value={props.params.dirY}
          min={-10}
          max={10}
          step={0.1}
          color="#ffa500"
          onChange={(v) => props.setParam('dirY', v)}
        />
        <Slider
          label="Dir Z"
          value={props.params.dirZ}
          min={-10}
          max={10}
          step={0.1}
          color="#ffa500"
          onChange={(v) => props.setParam('dirZ', v)}
        />
      </Section>

      <Section title="Position" color="#ffa500">
        <Slider
          label="Pos X"
          value={props.params.posX}
          min={-50}
          max={50}
          step={1}
          color="#ffa500"
          onChange={(v) => props.setParam('posX', v)}
        />
        <Slider
          label="Pos Y"
          value={props.params.posY}
          min={0}
          max={100}
          step={1}
          color="#ffa500"
          onChange={(v) => props.setParam('posY', v)}
        />
        <Slider
          label="Pos Z"
          value={props.params.posZ}
          min={-50}
          max={50}
          step={1}
          color="#ffa500"
          onChange={(v) => props.setParam('posZ', v)}
        />
      </Section>

      <Section title="Intensity" color="#ffa500">
        <Slider
          label="Intensity"
          value={props.params.intensity}
          min={0}
          max={2}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('intensity', v)}
        />
      </Section>

      <Section title="Diffuse Color" color="#ffa500">
        <Slider
          label="Diffuse R"
          value={props.params.diffuseR}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('diffuseR', v)}
        />
        <Slider
          label="Diffuse G"
          value={props.params.diffuseG}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('diffuseG', v)}
        />
        <Slider
          label="Diffuse B"
          value={props.params.diffuseB}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('diffuseB', v)}
        />
      </Section>

      <Section title="Specular Color" color="#ffa500">
        <Slider
          label="Specular R"
          value={props.params.specularR}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('specularR', v)}
        />
        <Slider
          label="Specular G"
          value={props.params.specularG}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('specularG', v)}
        />
        <Slider
          label="Specular B"
          value={props.params.specularB}
          min={0}
          max={1}
          step={0.05}
          color="#ffa500"
          onChange={(v) => props.setParam('specularB', v)}
        />
      </Section>

      <ResetButton onClick={props.onReset} />
    </>
  );
};
