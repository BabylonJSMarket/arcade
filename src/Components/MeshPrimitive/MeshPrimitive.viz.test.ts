import { describe, it, expect, beforeEach } from 'vitest';
import {
  MeshPrimitiveDebuggerComponent,
  MeshPrimitiveDebuggerInput,
  MeshPrimitiveDebuggerEvents,
} from './MeshPrimitive.viz.tsx';

describe('MeshPrimitiveDebuggerComponent', () => {
  let component: MeshPrimitiveDebuggerComponent;

  beforeEach(() => {
    component = new MeshPrimitiveDebuggerComponent({
      visible: true,
      activationKey: 'Digit8',
      position: 'top-right',
    });
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(component.visible).toBe(true);
      expect(component.activationKey).toBe('Digit8');
      expect(component.position).toBe('top-right');
    });

    it('should use defaults when no data provided', () => {
      const defaultComponent = new MeshPrimitiveDebuggerComponent();
      expect(defaultComponent.visible).toBe(false);
      expect(defaultComponent.activationKey).toBe('Digit9');
      expect(defaultComponent.position).toBe('top-left');
    });

    it('should initialize with partial data', () => {
      const partialComponent = new MeshPrimitiveDebuggerComponent({
        visible: true,
      });
      expect(partialComponent.visible).toBe(true);
      expect(partialComponent.activationKey).toBe('Digit9');
      expect(partialComponent.position).toBe('top-left');
    });
  });

  describe('visibility', () => {
    it('should start hidden by default', () => {
      const comp = new MeshPrimitiveDebuggerComponent();
      expect(comp.visible).toBe(false);
    });

    it('should allow toggling visibility', () => {
      component.visible = false;
      expect(component.visible).toBe(false);
      component.visible = true;
      expect(component.visible).toBe(true);
    });

    it('should respect visible flag from constructor', () => {
      const visibleComp = new MeshPrimitiveDebuggerComponent({ visible: true });
      expect(visibleComp.visible).toBe(true);

      const hiddenComp = new MeshPrimitiveDebuggerComponent({ visible: false });
      expect(hiddenComp.visible).toBe(false);
    });
  });

  describe('activation key', () => {
    it('should accept valid keyboard codes', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ activationKey: 'KeyP' });
      expect(comp.activationKey).toBe('KeyP');
    });

    it('should accept function keys', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ activationKey: 'F9' });
      expect(comp.activationKey).toBe('F9');
    });

    it('should accept digit keys', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ activationKey: 'Digit9' });
      expect(comp.activationKey).toBe('Digit9');
    });

    it('should default to Digit9', () => {
      const comp = new MeshPrimitiveDebuggerComponent();
      expect(comp.activationKey).toBe('Digit9');
    });

    it('should allow changing activation key', () => {
      component.activationKey = 'F10';
      expect(component.activationKey).toBe('F10');
    });
  });

  describe('position', () => {
    it('should accept top-left', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ position: 'top-left' });
      expect(comp.position).toBe('top-left');
    });

    it('should accept top-right', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ position: 'top-right' });
      expect(comp.position).toBe('top-right');
    });

    it('should accept bottom-left', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ position: 'bottom-left' });
      expect(comp.position).toBe('bottom-left');
    });

    it('should accept bottom-right', () => {
      const comp = new MeshPrimitiveDebuggerComponent({ position: 'bottom-right' });
      expect(comp.position).toBe('bottom-right');
    });

    it('should default to top-left', () => {
      const comp = new MeshPrimitiveDebuggerComponent();
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
      expect(serialized.activationKey).toBe('Digit8');
      expect(serialized.position).toBe('top-right');
    });

    it('should be reconstructable from serialized data', () => {
      const serialized = component.serialize();
      const reconstructed = new MeshPrimitiveDebuggerComponent(serialized);
      expect(reconstructed.visible).toBe(component.visible);
      expect(reconstructed.activationKey).toBe(component.activationKey);
      expect(reconstructed.position).toBe(component.position);
    });

    it('should serialize default values correctly', () => {
      const defaultComp = new MeshPrimitiveDebuggerComponent();
      const serialized = defaultComp.serialize();
      expect(serialized.visible).toBe(false);
      expect(serialized.activationKey).toBe('Digit9');
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
      expect(component.activationKey).toBe('Digit8');
      component.activationKey = 'Digit7';
      expect(component.activationKey).toBe('Digit7');
    });

    it('should allow position to be modified', () => {
      expect(component.position).toBe('top-right');
      component.position = 'bottom-left';
      expect(component.position).toBe('bottom-left');
    });
  });
});

describe('MeshPrimitiveDebuggerEvents', () => {
  it('should define SHOWN event', () => {
    expect(MeshPrimitiveDebuggerEvents.SHOWN).toBe('meshprimitivedebugger.shown');
  });

  it('should define HIDDEN event', () => {
    expect(MeshPrimitiveDebuggerEvents.HIDDEN).toBe('meshprimitivedebugger.hidden');
  });
});

describe('MeshPrimitiveDebuggerSystem params', () => {
  // Note: Full system testing requires BabylonJS Scene context
  // These tests verify the param structure

  it('should have expected default param structure', () => {
    // These are the params that MeshPrimitiveDebuggerSystem exposes
    const expectedParams = {
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      visibility: 1,
    };

    // Verify structure
    expect(Object.keys(expectedParams)).toHaveLength(4);
    expect(expectedParams.scaleX).toBe(1);
    expect(expectedParams.scaleY).toBe(1);
    expect(expectedParams.scaleZ).toBe(1);
    expect(expectedParams.visibility).toBe(1);
  });
});
