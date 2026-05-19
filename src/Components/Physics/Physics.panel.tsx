/**
 * Physics — renderer-free Solid panel. Binds directly to a PhysicsComponent
 * (plain data — no @babylonjs / three imports, including type-only) and can
 * be mounted over either the Babylon or the Three.js demo.
 *
 * The panel is intentionally read/mutate-the-component rather than poking an
 * adapter: param changes become live once the body is re-created on reload,
 * and the "Kick" button emits a SET_VELOCITY input event which the System
 * forwards to `world.renderer.physicsSetBodyVelocity` without the panel ever
 * seeing the adapter.
 */

import { Component as SolidComponent, createSignal } from 'solid-js';
import { Slider, ResetButton, Section } from '../_shared/ui';
import {
  PhysicsComponent,
  type PhysicsMotionTypeName,
  type PhysicsShapeTypeName,
} from './Physics';

export interface PhysicsPanelProps {
  /** Live PhysicsComponent instance. The panel reads/writes its fields. */
  component: PhysicsComponent;
  /** Optional: called when the user hits the "Kick" button. */
  onKick?: (vx: number, vy: number, vz: number) => void;
}

const SHAPES: PhysicsShapeTypeName[] = ['sphere', 'box', 'capsule'];
const MOTIONS: PhysicsMotionTypeName[] = ['dynamic', 'static', 'kinematic'];

export const PhysicsPanel: SolidComponent<PhysicsPanelProps> = (props) => {
  const [shape, setShape] = createSignal(props.component.shapeType);
  const [motion, setMotion] = createSignal(props.component.motionType);
  const [mass, setMass] = createSignal(props.component.mass);
  const [friction, setFriction] = createSignal(props.component.friction);
  const [restitution, setRestitution] = createSignal(props.component.restitution);
  const [lockRotation, setLockRotation] = createSignal(props.component.lockRotation);

  const writeShape = (s: PhysicsShapeTypeName) => {
    setShape(s);
    props.component.shapeType = s;
  };
  const writeMotion = (m: PhysicsMotionTypeName) => {
    setMotion(m);
    props.component.motionType = m;
  };
  const writeMass = (v: number) => {
    setMass(v);
    props.component.mass = v;
  };
  const writeFriction = (v: number) => {
    setFriction(v);
    props.component.friction = v;
  };
  const writeRestitution = (v: number) => {
    setRestitution(v);
    props.component.restitution = v;
  };
  const writeLockRotation = (v: boolean) => {
    setLockRotation(v);
    props.component.lockRotation = v;
  };

  const reset = () => {
    writeShape('sphere');
    writeMotion('dynamic');
    writeMass(1);
    writeFriction(0.5);
    writeRestitution(0.5);
    writeLockRotation(false);
  };

  const kick = () => {
    props.onKick?.(0, 10, 0);
  };

  return (
    <div style={{ 'font-family': 'system-ui, sans-serif', color: '#ddd', 'min-width': '240px' }}>
      <Section title="Kick">
        <button
          onClick={kick}
          style={{
            width: '100%',
            padding: '6px',
            background: '#222',
            color: '#66ccff',
            border: '1px solid #66ccff',
            cursor: 'pointer',
          }}
        >
          Apply +Y velocity
        </button>
      </Section>

      <Section title="Shape">
        <div style={{ display: 'flex', gap: '4px' }}>
          {SHAPES.map((s) => (
            <button
              onClick={() => writeShape(s)}
              style={{
                flex: 1,
                padding: '4px',
                background: shape() === s ? '#66ccff' : '#222',
                color: shape() === s ? '#000' : '#ddd',
                border: '1px solid #66ccff',
                cursor: 'pointer',
                'font-size': '10px',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <div style={{ display: 'flex', gap: '4px' }}>
          {MOTIONS.map((m) => (
            <button
              onClick={() => writeMotion(m)}
              style={{
                flex: 1,
                padding: '4px',
                background: motion() === m ? '#66ccff' : '#222',
                color: motion() === m ? '#000' : '#ddd',
                border: '1px solid #66ccff',
                cursor: 'pointer',
                'font-size': '10px',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Material">
        <Slider label="mass" value={mass()} min={0} max={20} step={0.1} onChange={writeMass} />
        <Slider
          label="friction"
          value={friction()}
          min={0}
          max={2}
          step={0.05}
          onChange={writeFriction}
        />
        <Slider
          label="restitution"
          value={restitution()}
          min={0}
          max={1}
          step={0.05}
          onChange={writeRestitution}
        />
      </Section>

      <Section title="Rotation">
        <label
          style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'font-size': '11px' }}
        >
          <input
            type="checkbox"
            checked={lockRotation()}
            onChange={(e) => writeLockRotation(e.currentTarget.checked)}
          />
          Lock rotation (X/Z)
        </label>
      </Section>

      <ResetButton onClick={reset} />
    </div>
  );
};
