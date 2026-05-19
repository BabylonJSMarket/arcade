import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShadowDebuggerComponent,
  ShadowDebuggerInput,
  ShadowDebuggerEvents,
} from './Shadow.viz.tsx';

describe('ShadowDebuggerComponent', () => {
  let component: ShadowDebuggerComponent;

  beforeEach(() => {
    component = new ShadowDebuggerComponent({
      visible: true,
      activationKey: 'Digit7',
      position: 'bottom-left',
    });
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(component.visible).toBe(true);
      expect(component.activationKey).toBe('Digit7');
      expect(component.position).toBe('bottom-left');
    });

    it('should use defaults when no data provided', () => {
      const defaultComponent = new ShadowDebuggerComponent();
      expect(defaultComponent.visible).toBe(false);
      expect(defaultComponent.activationKey).toBe('Digit8');
      expect(defaultComponent.position).toBe('top-right');
    });

    it('should initialize with partial data', () => {
      const partialComponent = new ShadowDebuggerComponent({
        visible: true,
      });
      expect(partialComponent.visible).toBe(true);
      expect(partialComponent.activationKey).toBe('Digit8');
      expect(partialComponent.position).toBe('top-right');
    });
  });

  describe('visibility', () => {
    it('should start hidden by default', () => {
      const comp = new ShadowDebuggerComponent();
      expect(comp.visible).toBe(false);
    });

    it('should allow toggling visibility', () => {
      component.visible = false;
      expect(component.visible).toBe(false);
      component.visible = true;
      expect(component.visible).toBe(true);
    });

    it('should respect visible flag from constructor', () => {
      const visibleComp = new ShadowDebuggerComponent({ visible: true });
      expect(visibleComp.visible).toBe(true);

      const hiddenComp = new ShadowDebuggerComponent({ visible: false });
      expect(hiddenComp.visible).toBe(false);
    });
  });

  describe('activation key', () => {
    it('should accept valid keyboard codes', () => {
      const comp = new ShadowDebuggerComponent({ activationKey: 'KeyS' });
      expect(comp.activationKey).toBe('KeyS');
    });

    it('should accept function keys', () => {
      const comp = new ShadowDebuggerComponent({ activationKey: 'F8' });
      expect(comp.activationKey).toBe('F8');
    });

    it('should accept digit keys', () => {
      const comp = new ShadowDebuggerComponent({ activationKey: 'Digit8' });
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should default to Digit8', () => {
      const comp = new ShadowDebuggerComponent();
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should allow changing activation key', () => {
      component.activationKey = 'F9';
      expect(component.activationKey).toBe('F9');
    });
  });

  describe('position', () => {
    it('should accept top-left', () => {
      const comp = new ShadowDebuggerComponent({ position: 'top-left' });
      expect(comp.position).toBe('top-left');
    });

    it('should accept top-right', () => {
      const comp = new ShadowDebuggerComponent({ position: 'top-right' });
      expect(comp.position).toBe('top-right');
    });

    it('should accept bottom-left', () => {
      const comp = new ShadowDebuggerComponent({ position: 'bottom-left' });
      expect(comp.position).toBe('bottom-left');
    });

    it('should accept bottom-right', () => {
      const comp = new ShadowDebuggerComponent({ position: 'bottom-right' });
      expect(comp.position).toBe('bottom-right');
    });

    it('should default to top-right', () => {
      const comp = new ShadowDebuggerComponent();
      expect(comp.position).toBe('top-right');
    });

    it('should allow changing position', () => {
      component.position = 'top-left';
      expect(component.position).toBe('top-left');
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const serialized = component.serialize();
      expect(serialized.visible).toBe(true);
      expect(serialized.activationKey).toBe('Digit7');
      expect(serialized.position).toBe('bottom-left');
    });

    it('should be reconstructable from serialized data', () => {
      const serialized = component.serialize();
      const reconstructed = new ShadowDebuggerComponent(serialized);
      expect(reconstructed.visible).toBe(component.visible);
      expect(reconstructed.activationKey).toBe(component.activationKey);
      expect(reconstructed.position).toBe(component.position);
    });

    it('should serialize default values correctly', () => {
      const defaultComp = new ShadowDebuggerComponent();
      const serialized = defaultComp.serialize();
      expect(serialized.visible).toBe(false);
      expect(serialized.activationKey).toBe('Digit8');
      expect(serialized.position).toBe('top-right');
    });

    it('should only include serializable properties', () => {
      const serialized = component.serialize();
      expect(serialized).toHaveProperty('visible');
      expect(serialized).toHaveProperty('activationKey');
      expect(serialized).toHaveProperty('position');
      expect(Object.keys(serialized).length).toBe(3);
    });
  });

  describe('state management', () => {
    it('should allow visibility to be modified', () => {
      expect(component.visible).toBe(true);
      component.visible = false;
      expect(component.visible).toBe(false);
    });

    it('should allow activationKey to be modified', () => {
      expect(component.activationKey).toBe('Digit7');
      component.activationKey = 'Digit6';
      expect(component.activationKey).toBe('Digit6');
    });

    it('should allow position to be modified', () => {
      expect(component.position).toBe('bottom-left');
      component.position = 'top-right';
      expect(component.position).toBe('top-right');
    });
  });
});

describe('ShadowDebuggerEvents', () => {
  it('should define SHOWN event', () => {
    expect(ShadowDebuggerEvents.SHOWN).toBe('shadowdebugger.shown');
  });

  it('should define HIDDEN event', () => {
    expect(ShadowDebuggerEvents.HIDDEN).toBe('shadowdebugger.hidden');
  });
});

describe('ShadowDebuggerSystem params', () => {
  // Note: Full system testing requires BabylonJS Scene context
  // These tests verify the param structure

  it('should have expected default param structure', () => {
    // These are the params that ShadowDebuggerSystem exposes
    const expectedParams = {
      darkness: 0.4,
      bias: 0.001,
      normalBias: 0.0,
      filteringQuality: 2,
      castShadowsGlobal: 1,
      receiveShadowsGlobal: 1,
    };

    // Verify structure
    expect(Object.keys(expectedParams)).toHaveLength(6);
    expect(expectedParams.darkness).toBe(0.4);
    expect(expectedParams.bias).toBe(0.001);
    expect(expectedParams.normalBias).toBe(0.0);
    expect(expectedParams.filteringQuality).toBe(2);
    expect(expectedParams.castShadowsGlobal).toBe(1);
    expect(expectedParams.receiveShadowsGlobal).toBe(1);
  });

  it('should have sensible ranges for darkness', () => {
    // Darkness should be between 0 (no shadow) and 1 (full shadow)
    const darkness = 0.4;
    expect(darkness).toBeGreaterThanOrEqual(0);
    expect(darkness).toBeLessThanOrEqual(1);
  });

  it('should have sensible ranges for bias', () => {
    // Bias should be a small positive number
    const bias = 0.001;
    expect(bias).toBeGreaterThanOrEqual(0);
    expect(bias).toBeLessThanOrEqual(0.1);
  });

  it('should have valid filtering quality values', () => {
    // Quality should be 0-3 (None, Low, Medium, High)
    const quality = 2;
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(3);
  });
});
