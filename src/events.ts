/**
 * SHARED EVENT DICTIONARY — event names that no single component owns.
 *
 * Arcade ships no components any more (0.13.0): the core set — meshes, lights,
 * cameras, input, physics, scoring — lives in CodeLibrary with its names beside
 * each one, in `Components/<Name>/<Name>.events.ts`, and arrives in a project
 * through `npx arcade core` / `bjs download`. A listener imports the emitter's
 * `.events.ts`, never its System; `bjs download` hands that file out free.
 *
 * What stays here is the short list that downloaded components still import
 * from `@babylonjsmarket/arcade` and that has no `.events.ts` owner yet. The
 * keyboard and mouse names live beside this file, in inputEvents.ts.
 * `npm run audit:events` fails on a group here that nothing imports from
 * arcade, or one a CodeLibrary `.events.ts` already declares.
 */

// ── Heard across many downloaded components ──
// Bullet hits feed damage, score and AI (TwinStickEnemy, the shooter kits), and
// SkeletonAnimator is driven by several AI components. Their bundles never got
// an `.events.ts`, so the names stay here until they do.
/** Bullet impact observer (damage itself routes through HealthSystem). */
export const BulletEvents = {
  HIT: 'bullet.hit',
} as const;

/** Skeletal-animation drive + completion (premium SkeletonAnimator). */
export const SkeletonAnimatorInputEvents = {
  SET_LOOP: 'skeletonAnimator.setLoop',
  PLAY_ONCE: 'skeletonAnimator.playOnce',
} as const;
export const SkeletonAnimatorEvents = {
  COMPLETED: 'skeletonAnimator.completed',
} as const;
