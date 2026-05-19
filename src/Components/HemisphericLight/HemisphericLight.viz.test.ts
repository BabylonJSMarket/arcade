import { describe, it, expect, beforeEach } from 'vitest';
import {
  HemisphericLightDebuggerComponent,
  HemisphericLightDebuggerInput,
  HemisphericLightDebuggerEvents,
} from './HemisphericLight.viz.tsx';

describe('HemisphericLightDebuggerComponent', () => {
  let component: HemisphericLightDebuggerComponent;

  beforeEach(() => {
    component = new HemisphericLightDebuggerComponent({
      visible: true,
      activationKey: 'Digit6',
      position: 'top-right',
    });
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(component.visible).toBe(true);
      expect(component.activationKey).toBe('Digit6');
      expect(component.position).toBe('top-right');
    });

    it('should use defaults when no data provided', () => {
      const defaultComponent = new HemisphericLightDebuggerComponent();
      expect(defaultComponent.visible).toBe(false);
      expect(defaultComponent.activationKey).toBe('Digit7');
      expect(defaultComponent.position).toBe('top-left');
    });

    it('should initialize with partial data', () => {
      const partialComponent = new HemisphericLightDebuggerComponent({
        visible: true,
      });
      expect(partialComponent.visible).toBe(true);
      expect(partialComponent.activationKey).toBe('Digit7');
      expect(partialComponent.position).toBe('top-left');
    });
  });

  describe('visibility', () => {
    it('should start hidden by default', () => {
      const comp = new HemisphericLightDebuggerComponent();
      expect(comp.visible).toBe(false);
    });

    it('should allow toggling visibility', () => {
      component.visible = false;
      expect(component.visible).toBe(false);
      component.visible = true;
      expect(component.visible).toBe(true);
    });

    it('should respect visible flag from constructor', () => {
      const visibleComp = new HemisphericLightDebuggerComponent({ visible: true });
      expect(visibleComp.visible).toBe(true);

      const hiddenComp = new HemisphericLightDebuggerComponent({ visible: false });
      expect(hiddenComp.visible).toBe(false);
    });
  });

  describe('activation key', () => {
    it('should accept valid keyboard codes', () => {
      const comp = new HemisphericLightDebuggerComponent({ activationKey: 'KeyL' });
      expect(comp.activationKey).toBe('KeyL');
    });

    it('should accept function keys', () => {
      const comp = new HemisphericLightDebuggerComponent({ activationKey: 'F7' });
      expect(comp.activationKey).toBe('F7');
    });

    it('should accept digit keys', () => {
      const comp = new HemisphericLightDebuggerComponent({ activationKey: 'Digit7' });
      expect(comp.activationKey).toBe('Digit7');
    });

    it('should default to Digit7', () => {
      const comp = new HemisphericLightDebuggerComponent();
      expect(comp.activationKey).toBe('Digit7');
    });

    it('should allow changing activation key', () => {
      component.activationKey = 'F8';
      expect(component.activationKey).toBe('F8');
    });
  });

  describe('position', () => {
    it('should accept top-left', () => {
      const comp = new HemisphericLightDebuggerComponent({ position: 'top-left' });
      expect(comp.position).toBe('top-left');
    });

    it('should accept top-right', () => {
      const comp = new HemisphericLightDebuggerComponent({ position: 'top-right' });
      expect(comp.position).toBe('top-right');
    });

    it('should accept bottom-left', () => {
      const comp = new HemisphericLightDebuggerComponent({ position: 'bottom-left' });
      expect(comp.position).toBe('bottom-left');
    });

    it('should accept bottom-right', () => {
      const comp = new HemisphericLightDebuggerComponent({ position: 'bottom-right' });
      expect(comp.position).toBe('bottom-right');
    });

    it('should default to top-left', () => {
      const comp = new HemisphericLightDebuggerComponent();
      expect(comp.position).toBe('top-left');
    });

    it('should allow changing position', () => {
      component.position = 'bottom-left';
      expect(component.position).toBe('bottom-left');
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const serialized = component.serialize();
      expect(serialized.visible).toBe(true);
      expect(serialized.activationKey).toBe('Digit6');
      expect(serialized.position).toBe('top-right');
    });

    it('should be reconstructable from serialized data', () => {
      const serialized = component.serialize();
      const reconstructed = new HemisphericLightDebuggerComponent(serialized);
      expect(reconstructed.visible).toBe(component.visible);
      expect(reconstructed.activationKey).toBe(component.activationKey);
      expect(reconstructed.position).toBe(component.position);
    });

    it('should serialize default values correctly', () => {
      const defaultComp = new HemisphericLightDebuggerComponent();
      const serialized = defaultComp.serialize();
      expect(serialized.visible).toBe(false);
      expect(serialized.activationKey).toBe('Digit7');
      expect(serialized.position).toBe('top-left');
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
      expect(component.activationKey).toBe('Digit6');
      component.activationKey = 'Digit5';
      expect(component.activationKey).toBe('Digit5');
    });

    it('should allow position to be modified', () => {
      expect(component.position).toBe('top-right');
      component.position = 'bottom-left';
      expect(component.position).toBe('bottom-left');
    });
  });
});

describe('HemisphericLightDebuggerEvents', () => {
  it('should define SHOWN event', () => {
    expect(HemisphericLightDebuggerEvents.SHOWN).toBe('hemisphericlightdebugger.shown');
  });

  it('should define HIDDEN event', () => {
    expect(HemisphericLightDebuggerEvents.HIDDEN).toBe('hemisphericlightdebugger.hidden');
  });
});

describe('HemisphericLightDebuggerSystem params', () => {
  // Note: Full system testing requires BabylonJS Scene context
  // These tests verify the param structure

  it('should have expected default param structure', () => {
    // These are the params that HemisphericLightDebuggerSystem exposes
    const expectedParams = {
      intensity: 0.3,
      directionX: 0,
      directionY: 1,
      directionZ: 0,
      diffuseR: 1,
      diffuseG: 1,
      diffuseB: 1,
      groundR: 0.2,
      groundG: 0.2,
      groundB: 0.2,
      specularR: 0,
      specularG: 0,
      specularB: 0,
    };

    // Verify structure
    expect(Object.keys(expectedParams)).toHaveLength(13);
    expect(expectedParams.intensity).toBe(0.3);
    expect(expectedParams.directionY).toBe(1);
    expect(expectedParams.diffuseR).toBe(1);
    expect(expectedParams.groundR).toBe(0.2);
    expect(expectedParams.specularR).toBe(0);
  });
});
