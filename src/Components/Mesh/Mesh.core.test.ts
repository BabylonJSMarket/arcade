import { describe, it, expect } from 'vitest';
import { createMesh, DEFAULT_MESH_PARAMS } from './Mesh.core';

describe('Mesh core', () => {
  it('starts in the idle state with no mesh id and no animations', () => {
    const m = createMesh({ src: '/models/x.glb' });
    const s = m.getState();
    expect(s.state).toBe('idle');
    expect(s.meshId).toBeNull();
    expect(s.animationNames).toEqual([]);
    expect(s.errorMessage).toBeNull();
  });

  it('beginLoad transitions idle to loading and is idempotent', () => {
    const m = createMesh({ src: '/x.glb' });
    expect(m.beginLoad()).toBe(true);
    expect(m.getState().state).toBe('loading');
    // Second call while still in-flight is a no-op.
    expect(m.beginLoad()).toBe(false);
  });

  it('completeLoad records the mesh id and animation names', () => {
    const m = createMesh({ src: '/x.glb' });
    m.beginLoad();
    m.completeLoad('player', ['idle', 'walk', 'run']);
    const s = m.getState();
    expect(s.state).toBe('loaded');
    expect(s.meshId).toBe('player');
    expect(s.animationNames).toEqual(['idle', 'walk', 'run']);
    expect(s.errorMessage).toBeNull();
  });

  it('failLoad transitions to error and records the message', () => {
    const m = createMesh({ src: '/missing.glb' });
    m.beginLoad();
    m.failLoad('file not found');
    const s = m.getState();
    expect(s.state).toBe('error');
    expect(s.errorMessage).toBe('file not found');
    expect(s.meshId).toBeNull();
  });

  it('getResolvedUrl prepends assetServerUrl to src', () => {
    const m = createMesh({
      src: '/characters/hero.glb',
      assetServerUrl: 'https://cdn.example.com',
    });
    expect(m.getResolvedUrl()).toBe('https://cdn.example.com/characters/hero.glb');
  });

  it('stateChanged fires exactly once per transition and clears on read', () => {
    const m = createMesh({ src: '/x.glb' });
    // Read initial state: stateChanged should be false (no prior transition).
    expect(m.getState().stateChanged).toBe(false);
    m.beginLoad();
    // First read after transition is true.
    expect(m.getState().stateChanged).toBe(true);
    // Second read with no further transition is false.
    expect(m.getState().stateChanged).toBe(false);
  });

  it('beginLoad after loaded is a no-op — load once per session', () => {
    const m = createMesh({ src: '/x.glb' });
    m.beginLoad();
    m.completeLoad('e1', []);
    expect(m.beginLoad()).toBe(false);
    expect(m.getState().state).toBe('loaded');
  });

  it('reset returns the state to idle and forgets the mesh id', () => {
    const m = createMesh({ src: '/x.glb' });
    m.beginLoad();
    m.completeLoad('e1', ['clip']);
    m.reset();
    const s = m.getState();
    expect(s.state).toBe('idle');
    expect(s.meshId).toBeNull();
    expect(s.animationNames).toEqual([]);
  });

  it('defaults match DEFAULT_MESH_PARAMS', () => {
    const m = createMesh();
    expect(m.getParams()).toEqual(DEFAULT_MESH_PARAMS);
  });

  it('setParams updates the resolved URL on the next read', () => {
    const m = createMesh({ src: '/a.glb' });
    expect(m.getResolvedUrl()).toBe('/a.glb');
    m.setParams({ src: '/b.glb', assetServerUrl: 'https://cdn/' });
    expect(m.getResolvedUrl()).toBe('https://cdn//b.glb');
  });
});
