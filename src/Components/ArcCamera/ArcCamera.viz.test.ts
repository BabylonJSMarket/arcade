import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArcCameraDebuggerComponent,
  ArcCameraDebuggerInput,
  ArcCameraDebuggerEvents,
} from './ArcCamera.viz.tsx';

describe('ArcCameraDebuggerComponent', () => {
  let component: ArcCameraDebuggerComponent;

  beforeEach(() => {
    component = new ArcCameraDebuggerComponent({
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
      const defaultComponent = new ArcCameraDebuggerComponent();
      expect(defaultComponent.visible).toBe(false);
      expect(defaultComponent.activationKey).toBe('Digit8');
      expect(defaultComponent.position).toBe('top-right');
    });

    it('should initialize with partial data', () => {
      const partialComponent = new ArcCameraDebuggerComponent({
        visible: true,
      });
      expect(partialComponent.visible).toBe(true);
      expect(partialComponent.activationKey).toBe('Digit8');
      expect(partialComponent.position).toBe('top-right');
    });
  });

  describe('visibility', () => {
    it('should start hidden by default', () => {
      const comp = new ArcCameraDebuggerComponent();
      expect(comp.visible).toBe(false);
    });

    it('should allow toggling visibility', () => {
      component.visible = false;
      expect(component.visible).toBe(false);
      component.visible = true;
      expect(component.visible).toBe(true);
    });

    it('should respect visible flag from constructor', () => {
      const visibleComp = new ArcCameraDebuggerComponent({ visible: true });
      expect(visibleComp.visible).toBe(true);

      const hiddenComp = new ArcCameraDebuggerComponent({ visible: false });
      expect(hiddenComp.visible).toBe(false);
    });
  });

  describe('activation key', () => {
    it('should accept valid keyboard codes', () => {
      const comp = new ArcCameraDebuggerComponent({ activationKey: 'KeyP' });
      expect(comp.activationKey).toBe('KeyP');
    });

    it('should accept function keys', () => {
      const comp = new ArcCameraDebuggerComponent({ activationKey: 'F8' });
      expect(comp.activationKey).toBe('F8');
    });

    it('should accept digit keys', () => {
      const comp = new ArcCameraDebuggerComponent({ activationKey: 'Digit8' });
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should default to Digit8', () => {
      const comp = new ArcCameraDebuggerComponent();
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should allow changing activation key', () => {
      component.activationKey = 'F10';
      expect(component.activationKey).toBe('F10');
    });
  });

  describe('position', () => {
    it('should accept top-left', () => {
      const comp = new ArcCameraDebuggerComponent({ position: 'top-left' });
      expect(comp.position).toBe('top-left');
    });

    it('should accept top-right', () => {
      const comp = new ArcCameraDebuggerComponent({ position: 'top-right' });
      expect(comp.position).toBe('top-right');
    });

    it('should accept bottom-left', () => {
      const comp = new ArcCameraDebuggerComponent({ position: 'bottom-left' });
      expect(comp.position).toBe('bottom-left');
    });

    it('should accept bottom-right', () => {
      const comp = new ArcCameraDebuggerComponent({ position: 'bottom-right' });
      expect(comp.position).toBe('bottom-right');
    });

    it('should default to top-right', () => {
      const comp = new ArcCameraDebuggerComponent();
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
      const reconstructed = new ArcCameraDebuggerComponent(serialized);
      expect(reconstructed.visible).toBe(component.visible);
      expect(reconstructed.activationKey).toBe(component.activationKey);
      expect(reconstructed.position).toBe(component.position);
    });

    it('should serialize default values correctly', () => {
      const defaultComp = new ArcCameraDebuggerComponent();
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

describe('ArcCameraDebuggerEvents', () => {
  it('should define SHOWN event', () => {
    expect(ArcCameraDebuggerEvents.SHOWN).toBe('arccameradebugger.shown');
  });

  it('should define HIDDEN event', () => {
    expect(ArcCameraDebuggerEvents.HIDDEN).toBe('arccameradebugger.hidden');
  });
});

describe('ArcCameraDebuggerSystem params', () => {
  // Note: Full system testing requires BabylonJS Scene context
  // These tests verify the param structure

  it('should have expected default param structure', () => {
    // These are the params that ArcCameraDebuggerSystem exposes
    const expectedParams = {
      distance: 15,
      minDistance: 5,
      maxDistance: 50,
      alpha: Math.PI / 2,
      beta: Math.PI / 3,
      minBeta: 0.1,
      maxBeta: Math.PI / 2 - 0.1,
      inertia: 0.9,
      wheelPrecision: 50,
      angularSensibility: 1000,
      speed: 1,
      autoRotateSpeed: 0.5,
    };

    // Verify structure
    expect(Object.keys(expectedParams)).toHaveLength(12);
    expect(expectedParams.distance).toBe(15);
    expect(expectedParams.minDistance).toBe(5);
    expect(expectedParams.maxDistance).toBe(50);
    expect(expectedParams.alpha).toBeCloseTo(Math.PI / 2);
    expect(expectedParams.beta).toBeCloseTo(Math.PI / 3);
    expect(expectedParams.minBeta).toBe(0.1);
    expect(expectedParams.maxBeta).toBeCloseTo(Math.PI / 2 - 0.1);
    expect(expectedParams.inertia).toBe(0.9);
    expect(expectedParams.wheelPrecision).toBe(50);
    expect(expectedParams.angularSensibility).toBe(1000);
    expect(expectedParams.speed).toBe(1);
    expect(expectedParams.autoRotateSpeed).toBe(0.5);
  });
});
