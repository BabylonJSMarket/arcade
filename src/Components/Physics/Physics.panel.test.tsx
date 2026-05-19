// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { PhysicsPanel } from './Physics.panel';
import { PhysicsComponent } from './Physics';

describe('PhysicsPanel', () => {
  it('mounts without a renderer and shows the Material section', () => {
    const component = new PhysicsComponent();
    const { container } = render(() => <PhysicsPanel component={component} />);
    expect(container.textContent).toContain('Material');
    expect(container.textContent).toContain('mass');
  });

  it('moving the mass slider writes the new value to the component', () => {
    const component = new PhysicsComponent({ mass: 1 });
    const { getAllByRole } = render(() => <PhysicsPanel component={component} />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    // First slider in Material section is mass.
    fireEvent.input(sliders[0], { target: { value: '3.5' } });
    expect(component.mass).toBe(3.5);
  });

  it('clicking the Kick button invokes onKick with a +Y velocity', () => {
    const component = new PhysicsComponent();
    const onKick = vi.fn();
    const { getByText } = render(() => <PhysicsPanel component={component} onKick={onKick} />);
    fireEvent.click(getByText(/Apply \+Y velocity/));
    expect(onKick).toHaveBeenCalledWith(0, 10, 0);
  });

  it('the Reset button returns the component to defaults', () => {
    const component = new PhysicsComponent({
      shapeType: 'box',
      mass: 5,
      friction: 0.9,
      restitution: 0.1,
      lockRotation: true,
    });
    const { getByText } = render(() => <PhysicsPanel component={component} />);
    fireEvent.click(getByText(/reset/i));
    expect(component.shapeType).toBe('sphere');
    expect(component.mass).toBe(1);
    expect(component.friction).toBe(0.5);
    expect(component.lockRotation).toBe(false);
  });
});
