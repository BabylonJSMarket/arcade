import { JumpEvents, JumpInputEvents } from '../../events';
import { describe, it, expect, beforeEach } from 'vitest';
import { JumpComponent, JumpSystem } from './Jump';
import { MeshPrimitiveComponent } from '../MeshPrimitive/MeshPrimitive.core';
import { MeshComponent } from '../Mesh/Mesh';
import { EventBus, World, MockRendererAdapter } from '@babylonjsmarket/ecs';

describe('Jump', () => {
  describe('component', () => {
    it('applies defaults', () => {
      const j = new JumpComponent();
      expect(j.key).toBe('Space');
      expect(j.height).toBe(1.6);
      expect(j.duration).toBe(0.7);
      expect(j.hang).toBe(0.35);
      expect(j.airborne).toBe(false);
    });

    it('clamps hang to [0, 0.9] and round-trips config', () => {
      expect(new JumpComponent({ hang: 5 }).hang).toBe(0.9);
      expect(new JumpComponent({ hang: -1 }).hang).toBe(0);
      const j = new JumpComponent({ key: 'KeyJ', height: 2, duration: 1, hang: 0.5 });
      expect(j.serialize()).toEqual({ key: 'KeyJ', height: 2, duration: 1, hang: 0.5 });
    });

    it('arc is 0 at the ends, 1 at the apex, and symmetric', () => {
      const j = new JumpComponent({ hang: 0.4 });
      expect(j.arc(0)).toBeCloseTo(0, 6);
      expect(j.arc(1)).toBeCloseTo(0, 6);
      expect(j.arc(0.5)).toBeCloseTo(1, 6);
      expect(j.arc(0.25)).toBeCloseTo(j.arc(0.75), 6); // mirror
    });
  });

  describe('system', () => {
    let eventBus: EventBus;
    let world: World;

    beforeEach(() => {
      eventBus = new EventBus();
      world = new World({ eventBus, renderer: new MockRendererAdapter() });
      world.addSystem(new JumpSystem(eventBus));
      world.initialize();
    });

    const makeJumper = (data: Record<string, unknown> = {}) => {
      const e = world.createEntity('Player');
      e.add(new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0, 0] }));
      e.add(new JumpComponent({ duration: 1, height: 2, hang: 0, ...data }));
      return e;
    };

    it('leaves the ground on the jump key', () => {
      const e = makeJumper();
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      expect(e.get(JumpComponent)!.airborne).toBe(true);
    });

    it('does not jump on a different key', () => {
      const e = makeJumper();
      eventBus.emitImmediate('keyboard.keydown', { code: 'KeyX' });
      expect(e.get(JumpComponent)!.airborne).toBe(false);
    });

    it('drives Y to the apex then back to ground and lands', () => {
      const e = makeJumper(); // duration 1, height 2, hang 0 → arc(0.5)=1
      const mp = e.get(MeshPrimitiveComponent)!;
      let landed = 0;
      eventBus.on(JumpEvents.LANDED, () => landed++);

      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      world.update(0.5); // p = 0.5 → y = height * 1 = 2
      expect(mp.position[1]).toBeCloseTo(2, 3);

      world.update(0.5); // p = 1 → land, restore ground
      expect(e.get(JumpComponent)!.airborne).toBe(false);
      expect(mp.position[1]).toBeCloseTo(0, 6);

      world.update(0); // flush the queued LANDED
      expect(landed).toBe(1);
    });

    it('restores the ground offset it started from (not hard 0)', () => {
      const e = world.createEntity('P2');
      const mp = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0.9, 0] });
      e.add(mp);
      e.add(new JumpComponent({ duration: 1, height: 2, hang: 0 }));
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      world.update(0.5);
      expect(mp.position[1]).toBeCloseTo(0.9 + 2, 3); // apex above the starting height
      world.update(0.5);
      expect(mp.position[1]).toBeCloseTo(0.9, 6); // back to where it started
    });

    it('ignores a second press while airborne (no double-jump)', () => {
      const e = makeJumper();
      let starts = 0;
      eventBus.on(JumpEvents.STARTED, () => starts++);
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      world.update(0.3);
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' }); // mid-air — ignored
      world.update(0); // flush queued STARTED(s)
      expect(starts).toBe(1);
      expect(e.get(JumpComponent)!.airborne).toBe(true);
    });

    it('jump.request triggers a jump too', () => {
      const e = makeJumper();
      eventBus.emitImmediate(JumpInputEvents.JUMP, { entityId: 'Player' });
      expect(e.get(JumpComponent)!.airborne).toBe(true);
    });

    it('drives a followed Mesh via params.position[1], preferring it over the proxy', () => {
      const e = world.createEntity('Figure');
      const mesh = new MeshComponent({ src: 'x.glb', position: [0, 0, 0], follow: true, autoLoad: false });
      e.add(mesh);
      const mp = new MeshPrimitiveComponent({ primitive: 'capsule', position: [0, 0.5, 0] });
      e.add(mp);
      e.add(new JumpComponent({ duration: 1, height: 2, hang: 0 }));

      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      world.update(0.5); // apex

      expect(mesh.params.position[1]).toBeCloseTo(2, 3); // the Mesh Y (what follow reads) rose
      expect(mp.position[1]).toBe(0.5); // the proxy (camera anchor) stayed grounded
      world.update(0.5);
      expect(mesh.params.position[1]).toBeCloseTo(0, 6); // restored
    });

    it('cleans up per-entity state when the entity leaves', () => {
      const e = makeJumper();
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      world.removeEntity(e);
      expect(() => world.update(0.1)).not.toThrow();
    });

    it('a keyed jumper with no mesh or proxy runs without throwing', () => {
      const e = world.createEntity('Bare');
      e.add(new JumpComponent({ duration: 1 }));
      eventBus.emitImmediate('keyboard.keydown', { code: 'Space' });
      expect(() => world.update(0.5)).not.toThrow();
      expect(e.get(JumpComponent)!.airborne).toBe(true);
    });

    it('jump.request without an entityId jumps nobody', () => {
      const e = makeJumper();
      eventBus.emitImmediate(JumpInputEvents.JUMP, {});
      expect(e.get(JumpComponent)!.airborne).toBe(false);
    });
  });
});
