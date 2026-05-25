import { describe, it, expect } from 'vitest';
import { FlashComponent } from './Flash.core';

describe('FlashComponent', () => {
  it('applies defaults', () => {
    const c = new FlashComponent();
    expect(c.lifetime).toBe(0.08);
  });

  it('merges input on top of defaults', () => {
    const c = new FlashComponent({ lifetime: 0.25 });
    expect(c.lifetime).toBe(0.25);
  });

  it('serialize round-trips', () => {
    const a = new FlashComponent({ lifetime: 0.12 });
    const b = new FlashComponent(a.serialize());
    expect(b.lifetime).toBe(a.lifetime);
    expect(b.serialize()).toEqual(a.serialize());
  });
});
