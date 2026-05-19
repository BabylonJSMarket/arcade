// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { PhysicsPanel } from './Physics.panel';
import { PhysicsComponent } from './Physics';

describe('PhysicsPanel (renderer-free mount)', () => {
  it('mounts without a renderer and exposes the shape + motion + kick controls', () => {
    const component = new PhysicsComponent();
    const { container } = render(() => <PhysicsPanel component={component} />);
    expect(container.textContent).toContain('Apply +Y velocity');
    expect(container.textContent).toContain('sphere');
    expect(container.textContent).toContain('dynamic');
  });

  it('toggling a shape button writes the shape to the component', () => {
    const component = new PhysicsComponent({ shapeType: 'sphere' });
    const { getByText } = render(() => <PhysicsPanel component={component} />);
    fireEvent.click(getByText('box'));
    expect(component.shapeType).toBe('box');
  });

  it('clicking the Kick button fires onKick with +Y velocity when supplied', () => {
    const component = new PhysicsComponent();
    const onKick = vi.fn();
    const { getByText } = render(() => <PhysicsPanel component={component} onKick={onKick} />);
    fireEvent.click(getByText('Apply +Y velocity'));
    expect(onKick).toHaveBeenCalledWith(0, 10, 0);
  });
});
