# Pool
One generic, blueprint-driven entity factory. Mark a scene entity with a `Pool` component and its other components become the template for a pre-allocated, recycled slot set — no `BulletPool`/`EnemyPool`/`MissilePool` subclasses, and the pooled entity's Systems register for free.

## What it does
A `Pool` component turns the entity it sits on into a **blueprint**: PoolSystem reads that entity's OTHER components as the template for one pooled instance, pre-allocates `size` parked copies via the framework pool, then consumes the blueprint entity. Spawners bring a slot into play with `world.acquire(name)` (returns the entity) or by firing a `pool.spawn` event; parking a slot back is `world.removeEntity(entity)` (pool-owned entities are recycled, not destroyed) or a `pool.release` event.

The point of putting the template **in the scene** — rather than in a nested config — is registration: because the blueprint's `Bullet` / `Transform6DOF` / `Renderable` / `Lifetime` are ordinary top-level component keys, the loader registers their Systems the same way it does for any authored entity. So a pooled bullet's impact System, or a pooled missile's guidance System, runs with no extra wiring even though you never hand-place a bullet.

On acquire the slot is reset: its tags snap back to exactly the blueprint's, each declared component's config is re-applied (so HP/speed/lifetime return to the blueprint values), a declared `MeshPrimitive` proxy is moved to the spawn `{x,y,z}`, and `pool.acquired` fires so the spawner can set per-spawn pose/velocity/owner on the returned entity.

## Use it in a scene
Declare the pool as a blueprint entity — the `Pool` marker plus the components each instance carries:

```json
{
  "Bullets": {
    "components": {
      "Pool": { "size": 256 },
      "Transform6DOF": {},
      "Velocity6DOF": {},
      "Bullet": { "damage": 1 },
      "Renderable": { "shape": "bullet" },
      "Lifetime": { "remaining": 15 }
    }
  }
}
```

A gun then fires without ever allocating:

```ts
const b = world.acquire("Bullets");          // un-parks a slot, config reset
if (b) {
  const t = b.get(Transform6DOFComponent)!;  // spawner sets per-shot pose…
  t.x = muzzleX; t.y = muzzleY; t.z = muzzleZ;
  b.get(Velocity6DOFComponent)!.vz = speed;
  b.get(BulletComponent)!.ownerEntityId = shipId;
}
```

Or, fully decoupled, `eventBus.emit(PoolInputEvents.SPAWN, { pool: "Bullets", x, y, z })` and read `pool.spawned` for the new entity id.

## Props
- `size` (number, default `16`) — slots to pre-allocate. Caps concurrent live instances; when every slot is live, `acquire` recycles the oldest.
- `name` (string, default = the blueprint entity's id) — the name spawners pass to `world.acquire(name)`. Only set it to decouple the pool name from the entity id.

## Events
- Emits `pool.ready` (`PoolEvents.READY`) once a pool finishes pre-allocating — `{ pool, size }`.
- Emits `pool.acquired` (`PoolEvents.ACQUIRED`) during reset — `{ pool, entityId, data }` — the hook for per-spawn dynamics.
- Emits `pool.spawned` / `pool.released` / `pool.exhausted` for the event-driven spawn/release path.
- Listens for `pool.spawn` / `pool.release` (`PoolInputEvents`) — the decoupled way to acquire/park a slot without a direct `world.acquire` call.

## Dependencies
- `MeshPrimitive` — the optional collision/position proxy the pool repositions on spawn for classic (non-6-DOF) games. A blueprint whose instances position via `Transform6DOF` instead just sets it on the acquired entity and needs no MeshPrimitive.

## Notes
- **The blueprint entity is consumed, not left live.** Once PoolSystem has captured the template and seeded the slots (on the first frame the renderer is ready), it removes the blueprint — its only jobs were to seed the slots and, by appearing in the scene, register the instance Systems.
- **`removeEntity` recycles a pool slot, it doesn't destroy it.** A pooled entity's death code can keep calling `world.removeEntity(e)`; the framework parks it back for reuse.
- **One pool, any instance shape.** A bullet, an enemy ship, a debris chunk are all just a `Pool` marker beside different components — there is no per-type pool class to write.
