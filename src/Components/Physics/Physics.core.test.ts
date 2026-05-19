import { describe, it, expect } from 'vitest';
import {
  createPhysics,
  DEFAULT_PHYSICS_WORLD_PARAMS,
} from './Physics.core';

describe('Physics core', () => {
  it('starts with no bodies and defaults exposed via getParams', () => {
    const sim = createPhysics();
    expect(sim.bodies().length).toBe(0);
    expect(sim.getParams()).toEqual(DEFAULT_PHYSICS_WORLD_PARAMS);
  });

  it('createBody registers a body that getBody and bodies() can read', () => {
    const sim = createPhysics();
    const body = sim.createBody('ball', {
      shapeType: 'sphere',
      motionType: 'dynamic',
      mass: 1,
      friction: 0.5,
      restitution: 0.5,
      lockRotation: false,
      posY: 10,
    });
    expect(body.posY).toBe(10);
    expect(sim.bodies().length).toBe(1);
    expect(sim.getBody('ball')?.shapeType).toBe('sphere');
  });

  it('destroyBody removes the body and getBody returns undefined afterwards', () => {
    const sim = createPhysics();
    sim.createBody('a', {
      shapeType: 'box', motionType: 'dynamic', mass: 1,
      friction: 0.2, restitution: 0.2, lockRotation: false,
    });
    sim.destroyBody('a');
    expect(sim.getBody('a')).toBeUndefined();
    expect(sim.bodies().length).toBe(0);
  });

  it('applies gravity to dynamic bodies each step', () => {
    const sim = createPhysics({ gravityY: -10, groundY: -100, linearDamping: 1 });
    sim.createBody('ball', {
      shapeType: 'sphere', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
      posY: 50,
    });
    // dt is clamped to 0.1 internally so a stutter can't throw the world apart.
    sim.step(0.1);
    const body = sim.getBody('ball')!;
    expect(body.velY).toBeCloseTo(-1, 5);
    // velY was added at the start of step: 50 + (-1 * 0.1) = 49.9
    expect(body.posY).toBeCloseTo(49.9, 5);
  });

  it('static bodies do not fall under gravity', () => {
    const sim = createPhysics({ gravityY: -30, groundY: -100 });
    sim.createBody('floor', {
      shapeType: 'box', motionType: 'static', mass: 0,
      friction: 0.5, restitution: 0, lockRotation: false,
      posY: 0,
    });
    sim.step(0.1);
    expect(sim.getBody('floor')!.posY).toBe(0);
    expect(sim.getBody('floor')!.velY).toBe(0);
  });

  it('kinematic bodies do not receive gravity but still integrate via setBodyVelocity', () => {
    const sim = createPhysics({ gravityY: -30, groundY: -100, linearDamping: 1 });
    sim.createBody('kin', {
      shapeType: 'capsule', motionType: 'kinematic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
    });
    sim.setBodyVelocity('kin', 3, 0, 0);
    sim.step(0.1);
    expect(sim.getBody('kin')!.velY).toBe(0);
    expect(sim.getBody('kin')!.posX).toBeCloseTo(0.3, 5);
  });

  it('bodies rest on the ground plane and bounce with restitution * groundBounce', () => {
    const sim = createPhysics({
      gravityY: 0, // isolate bounce response
      groundY: 0,
      groundBounce: 0.5,
      linearDamping: 1,
    });
    sim.createBody('ball', {
      shapeType: 'sphere', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0.8, lockRotation: false,
      posY: 0,
    });
    sim.setBodyVelocity('ball', 0, -10, 0);
    sim.step(1);
    const body = sim.getBody('ball')!;
    expect(body.posY).toBeGreaterThanOrEqual(0);
    // |velY| * restitution * groundBounce = 10 * 0.8 * 0.5 = 4
    expect(body.velY).toBeCloseTo(4, 5);
  });

  it('horizontal damping attenuates velX/velZ each step', () => {
    const sim = createPhysics({ gravityY: 0, groundY: -100, linearDamping: 0.5 });
    sim.createBody('slide', {
      shapeType: 'box', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
    });
    sim.setBodyVelocity('slide', 10, 0, 10);
    sim.step(1 / 60);
    expect(sim.getBody('slide')!.velX).toBeCloseTo(5, 5);
    expect(sim.getBody('slide')!.velZ).toBeCloseTo(5, 5);
  });

  it('setParams updates world behavior on the next step', () => {
    const sim = createPhysics({ gravityY: 0, groundY: -100, linearDamping: 1 });
    sim.createBody('ball', {
      shapeType: 'sphere', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
      posY: 10,
    });
    sim.step(0.1);
    expect(sim.getBody('ball')!.velY).toBe(0);
    sim.setParams({ gravityY: -20 });
    sim.step(0.1);
    expect(sim.getBody('ball')!.velY).toBeCloseTo(-2, 5);
  });

  it('reset clears all bodies but leaves params intact', () => {
    const sim = createPhysics({ gravityY: -20 });
    sim.createBody('a', {
      shapeType: 'sphere', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
    });
    sim.reset();
    expect(sim.bodies().length).toBe(0);
    expect(sim.getParams().gravityY).toBe(-20);
  });

  it('createBody with a duplicate meshId replaces the existing body', () => {
    const sim = createPhysics();
    sim.createBody('ball', {
      shapeType: 'sphere', motionType: 'dynamic', mass: 1,
      friction: 0, restitution: 0, lockRotation: false,
      posX: 1,
    });
    sim.createBody('ball', {
      shapeType: 'box', motionType: 'dynamic', mass: 5,
      friction: 0, restitution: 0, lockRotation: false,
      posX: 7,
    });
    expect(sim.bodies().length).toBe(1);
    expect(sim.getBody('ball')!.shapeType).toBe('box');
    expect(sim.getBody('ball')!.posX).toBe(7);
  });
});
