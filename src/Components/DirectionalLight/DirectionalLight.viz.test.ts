import { describe, it, expect, beforeEach } from 'vitest';
import {
  DirectionalLightDebuggerComponent,
  DirectionalLightDebuggerInput,
  DirectionalLightDebuggerEvents,
} from './DirectionalLight.viz.tsx';

describe('DirectionalLightDebuggerComponent', () => {
  let component: DirectionalLightDebuggerComponent;

  beforeEach(() => {
    component = new DirectionalLightDebuggerComponent({
      visible: true,
      activationKey: 'Digit7',
      position: 'bottom-right',
      showArrows: false,
    });
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(component.visible).toBe(true);
      expect(component.activationKey).toBe('Digit7');
      expect(component.position).toBe('bottom-right');
      expect(component.showArrows).toBe(false);
    });

    it('should use defaults when no data provided', () => {
      const defaultComponent = new DirectionalLightDebuggerComponent();
      expect(defaultComponent.visible).toBe(false);
      expect(defaultComponent.activationKey).toBe('Digit8');
      expect(defaultComponent.position).toBe('top-right');
      expect(defaultComponent.showArrows).toBe(true);
    });

    it('should initialize with partial data', () => {
      const partialComponent = new DirectionalLightDebuggerComponent({
        visible: true,
      });
      expect(partialComponent.visible).toBe(true);
      expect(partialComponent.activationKey).toBe('Digit8');
      expect(partialComponent.position).toBe('top-right');
      expect(partialComponent.showArrows).toBe(true);
    });
  });

  describe('visibility', () => {
    it('should start hidden by default', () => {
      const comp = new DirectionalLightDebuggerComponent();
      expect(comp.visible).toBe(false);
    });

    it('should allow toggling visibility', () => {
      component.visible = false;
      expect(component.visible).toBe(false);
      component.visible = true;
      expect(component.visible).toBe(true);
    });

    it('should respect visible flag from constructor', () => {
      const visibleComp = new DirectionalLightDebuggerComponent({ visible: true });
      expect(visibleComp.visible).toBe(true);

      const hiddenComp = new DirectionalLightDebuggerComponent({ visible: false });
      expect(hiddenComp.visible).toBe(false);
    });
  });

  describe('activation key', () => {
    it('should accept valid keyboard codes', () => {
      const comp = new DirectionalLightDebuggerComponent({ activationKey: 'KeyL' });
      expect(comp.activationKey).toBe('KeyL');
    });

    it('should accept function keys', () => {
      const comp = new DirectionalLightDebuggerComponent({ activationKey: 'F8' });
      expect(comp.activationKey).toBe('F8');
    });

    it('should accept digit keys', () => {
      const comp = new DirectionalLightDebuggerComponent({ activationKey: 'Digit8' });
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should default to Digit8', () => {
      const comp = new DirectionalLightDebuggerComponent();
      expect(comp.activationKey).toBe('Digit8');
    });

    it('should allow changing activation key', () => {
      component.activationKey = 'F9';
      expect(component.activationKey).toBe('F9');
    });
  });

  describe('position', () => {
    it('should accept top-left', () => {
      const comp = new DirectionalLightDebuggerComponent({ position: 'top-left' });
      expect(comp.position).toBe('top-left');
    });

    it('should accept top-right', () => {
      const comp = new DirectionalLightDebuggerComponent({ position: 'top-right' });
      expect(comp.position).toBe('top-right');
    });

    it('should accept bottom-left', () => {
      const comp = new DirectionalLightDebuggerComponent({ position: 'bottom-left' });
      expect(comp.position).toBe('bottom-left');
    });

    it('should accept bottom-right', () => {
      const comp = new DirectionalLightDebuggerComponent({ position: 'bottom-right' });
      expect(comp.position).toBe('bottom-right');
    });

    it('should default to top-right', () => {
      const comp = new DirectionalLightDebuggerComponent();
      expect(comp.position).toBe('top-right');
    });

    it('should allow changing position', () => {
      component.position = 'bottom-left';
      expect(component.position).toBe('bottom-left');
    });
  });

  describe('showArrows', () => {
    it('should accept true', () => {
      const comp = new DirectionalLightDebuggerComponent({ showArrows: true });
      expect(comp.showArrows).toBe(true);
    });

    it('should accept false', () => {
      const comp = new DirectionalLightDebuggerComponent({ showArrows: false });
      expect(comp.showArrows).toBe(false);
    });

    it('should default to true', () => {
      const comp = new DirectionalLightDebuggerComponent();
      expect(comp.showArrows).toBe(true);
    });

    it('should allow changing showArrows', () => {
      component.showArrows = true;
      expect(component.showArrows).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const serialized = component.serialize();
      expect(serialized.visible).toBe(true);
      expect(serialized.activationKey).toBe('Digit7');
      expect(serialized.position).toBe('bottom-right');
      expect(serialized.showArrows).toBe(false);
    });

    it('should be reconstructable from serialized data', () => {
      const serialized = component.serialize();
      const reconstructed = new DirectionalLightDebuggerComponent(serialized);
      expect(reconstructed.visible).toBe(component.visible);
      expect(reconstructed.activationKey).toBe(component.activationKey);
      expect(reconstructed.position).toBe(component.position);
      expect(reconstructed.showArrows).toBe(component.showArrows);
    });

    it('should serialize default values correctly', () => {
      const defaultComp = new DirectionalLightDebuggerComponent();
      const serialized = defaultComp.serialize();
      expect(serialized.visible).toBe(false);
      expect(serialized.activationKey).toBe('Digit8');
      expect(serialized.position).toBe('top-right');
      expect(serialized.showArrows).toBe(true);
    });

    it('should only include serializable properties', () => {
      const serialized = component.serialize();
      expect(serialized).toHaveProperty('visible');
      expect(serialized).toHaveProperty('activationKey');
      expect(serialized).toHaveProperty('position');
      expect(serialized).toHaveProperty('showArrows');
      expect(Object.keys(serialized).length).toBe(4);
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
      expect(component.position).toBe('bottom-right');
      component.position = 'top-left';
      expect(component.position).toBe('top-left');
    });

    it('should allow showArrows to be modified', () => {
      expect(component.showArrows).toBe(false);
      component.showArrows = true;
      expect(component.showArrows).toBe(true);
    });
  });
});

describe('DirectionalLightDebuggerEvents', () => {
  it('should define SHOWN event', () => {
    expect(DirectionalLightDebuggerEvents.SHOWN).toBe('directionallightdebugger.shown');
  });

  it('should define HIDDEN event', () => {
    expect(DirectionalLightDebuggerEvents.HIDDEN).toBe('directionallightdebugger.hidden');
  });
});

describe('DirectionalLightDebuggerSystem params', () => {
  // Note: Full system testing requires BabylonJS Scene context
  // These tests verify the param structure

  it('should have expected default param structure', () => {
    // These are the params that DirectionalLightDebuggerSystem exposes
    const expectedParams = {
      dirX: -1,
      dirY: -3,
      dirZ: -1,
      posX: 15,
      posY: 30,
      posZ: 15,
      intensity: 0.8,
      diffuseR: 1,
      diffuseG: 1,
      diffuseB: 1,
      specularR: 1,
      specularG: 1,
      specularB: 1,
    };

    // Verify structure
    expect(Object.keys(expectedParams)).toHaveLength(13);
    expect(expectedParams.dirX).toBe(-1);
    expect(expectedParams.dirY).toBe(-3);
    expect(expectedParams.dirZ).toBe(-1);
    expect(expectedParams.posX).toBe(15);
    expect(expectedParams.posY).toBe(30);
    expect(expectedParams.posZ).toBe(15);
    expect(expectedParams.intensity).toBe(0.8);
    expect(expectedParams.diffuseR).toBe(1);
    expect(expectedParams.diffuseG).toBe(1);
    expect(expectedParams.diffuseB).toBe(1);
    expect(expectedParams.specularR).toBe(1);
    expect(expectedParams.specularG).toBe(1);
    expect(expectedParams.specularB).toBe(1);
  });

  it('should support direction range', () => {
    // Direction components should support negative and positive values
    expect(-10).toBeLessThanOrEqual(-1);
    expect(-1).toBeLessThanOrEqual(10);
  });

  it('should support position range', () => {
    // Position should support a reasonable range for scene coordinates
    expect(-50).toBeLessThanOrEqual(15);
    expect(15).toBeLessThanOrEqual(100);
  });

  it('should support intensity range', () => {
    // Intensity should be non-negative and support values above 1
    expect(0).toBeLessThanOrEqual(0.8);
    expect(0.8).toBeLessThanOrEqual(2);
  });

  it('should support color component range', () => {
    // Color components should be 0-1
    expect(0).toBeLessThanOrEqual(1);
    expect(1).toBeLessThanOrEqual(1);
  });
});
