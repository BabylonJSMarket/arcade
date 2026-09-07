/**
 * Physics — headless plugin.
 *
 * The scriptable-query seam that used to live on MockRendererAdapter as
 * `physicsQueries`. A test that wants a cast to land supplies the function; the
 * default is no queries at all, which is what an engine without scene casts
 * reports, so `canQuery` stays honest.
 *
 * Every call is recorded, so a test can assert that a System asked for a cast —
 * or that it did NOT, because it checked `canQuery` first and took its geometry
 * fallback instead. That distinction is the whole reason these tests exist.
 */

import type { PhysicsExtension, PhysicsQueryHit } from '../Physics.defs';

export interface RecordedCall {
  method: 'raycast' | 'sphereCast' | 'resizeBoxBody' | 'setBodyAngularVelocity' | 'setBodyDrivenByMesh';
  args: unknown[];
}

export interface ScriptedQueries {
  raycast?: (from: readonly number[], to: readonly number[]) => PhysicsQueryHit | null;
  sphereCast?: (from: readonly number[], to: readonly number[], radius: number) => PhysicsQueryHit | null;
}

export interface MockPhysicsExtension extends PhysicsExtension {
  readonly calls: RecordedCall[];
  /** Null (the default) reports no query support the way Three and Lite do. */
  queries: ScriptedQueries | null;
}

export function createMockExtension(queries: ScriptedQueries | null = null): MockPhysicsExtension {
  const calls: RecordedCall[] = [];
  return {
    calls,
    queries,
    canQuery(): boolean {
      return this.queries !== null;
    },
    raycast(from: readonly number[], to: readonly number[]): PhysicsQueryHit | null {
      calls.push({ method: 'raycast', args: [from, to] });
      return this.queries?.raycast?.(from, to) ?? null;
    },
    sphereCast(from: readonly number[], to: readonly number[], radius: number): PhysicsQueryHit | null {
      calls.push({ method: 'sphereCast', args: [from, to, radius] });
      return this.queries?.sphereCast?.(from, to, radius) ?? null;
    },
    resizeBoxBody(meshId: string, halfExtents: readonly number[]): void {
      calls.push({ method: 'resizeBoxBody', args: [meshId, halfExtents] });
    },
    setBodyAngularVelocity(meshId: string, vx: number, vy: number, vz: number): void {
      calls.push({ method: 'setBodyAngularVelocity', args: [meshId, vx, vy, vz] });
    },
    setBodyDrivenByMesh(meshId: string, drivenByMesh: boolean): void {
      calls.push({ method: 'setBodyDrivenByMesh', args: [meshId, drivenByMesh] });
    },
  };
}
