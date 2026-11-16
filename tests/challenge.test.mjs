import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createWorld } from '../core/world.js';
import { EAST_VAULT, FLOORS } from '../core/layout.js';
import { PLAYER } from '../core/controller.js';

globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }),
};

function setup(t) {
    const world = createWorld(new THREE.Scene());
    t.after(() => world.dispose());
    const at = (x, y, z) => new THREE.Vector3(x, y, z);
    const east = at(1, 0, 0);
    const interact = (x, y, z) => world.challenge.interact(at(x, y, z), east);
    return { world, at, east, interact };
}

test('East Reserve requires both jobs, the sentry takedown, live camera cover, and both credentials', t => {
    const { world, at, interact } = setup(t);
    const door = world.doors.get(EAST_VAULT.doorId);
    const decoy = world.doors.get('B1-vault-door');
    assert.equal(decoy.setOpen(true), true);
    assert.equal(door.setOpen(true), false);
    assert.match(interact(4.3, 0, -5.6), /card acquired/);
    world.update(0, 0);
    assert.equal(door.setOpen(true), false);
    assert.match(interact(11.4, 4.4, 8.55), /code noted/);
    const code = world.challenge.copiedCode;
    assert.match(code, /^[A-Za-z]+[!#@-]\d{3}[!#@-][A-Za-z]+$/);
    for (const z of [-6.8, -7.7]) world.tripwire.update(.03, { position: at(0, -4.4, z) });
    assert.equal(world.tripwire.active, false, 'the decoy approach no longer has the live tripwire');
    for (const z of [-6.8, -7.7]) world.tripwire.update(.03, { position: at(12.2, -3.25, z) });
    assert(world.tripwire.active, 'jumping across the marked line still triggers the alarm');
    assert(world.tripwire.interact(at(12.5, -4.4, -8.05)));
    assert.equal(world.tripwire.enterCode(`${code}!`).ok, false);
    assert(world.tripwire.enterCode(code).ok);
    world.update(0, 0);
    assert.equal(door.setOpen(true), false, 'credentials alone cannot open the vault');
    interact(-6.35, 0, 16.4);
    interact(14.55, 0, 14.7);
    interact(-6.35, 0, 16.4);
    interact(-5.65, 4.4, 3.1);
    world.challenge.interact(at(8.95, 4.4, 13.03), at(0, 0, 1));
    interact(-5.65, 4.4, 3.1);
    assert(world.challenge.gearQuestsComplete);
    world.update(0, 0);
    assert.equal(door.setOpen(true), false, 'owning both items is insufficient');
    const camera = world.cameras.root.getObjectByName(`B1 camera · ${EAST_VAULT.watchCamera}`);
    const lens = camera.getObjectByName('Blue camera lens');
    const paintFrom = at(10.1, FLOORS[0].y, -6.35);
    const paintWatch = () => world.challenge.use(3, paintFrom,
        lens.getWorldPosition(at(0, 0, 0)).sub(at(paintFrom.x, paintFrom.y + PLAYER.eyeHeight, paintFrom.z)).normalize());
    assert.match(paintWatch(), /Vault Watch covered/);
    world.update(0, 0);
    assert.equal(door.setOpen(true), false, 'the live sentry still blocks access');
    world.cameras.update(18.01);
    assert.match(world.challenge.use(4, at(11.7, FLOORS[0].y, -6.67), at(0, 0, -1)), /Vault Sentry quietly taken down/);
    world.update(0, 0);
    assert.equal(door.setOpen(true), false, 'expired paint does not unlock the vault');
    assert.match(paintWatch(), /Vault Watch covered/);
    world.update(0, 0);
    assert.equal(door.setOpen(true), true);
    world.update(.05, .05);
    world.cameras.update(18.01);
    world.update(0, .05);
    assert.equal(door.locked, false, 'after first opening, the camera cannot trap the player');
    world.guards.failMission();
    world.update(.02, .02);
    assert.equal(world.challenge.copiedCode, '');
    assert.equal(world.challenge.keycard, false);
    assert.equal(world.challenge.gearQuestsComplete, false);
    assert.notEqual(world.tripwire.readCode(), code);
    assert.equal(door.setOpen(true), false);
});

test('Maya awards two sprays, and a successful spray disables and restores a camera', t => {
    const { world, at, interact } = setup(t);
    assert.equal(interact(14.55, 0, 14.7), '', 'a quest pickup stays unavailable until accepted');
    assert.match(interact(-6.35, 0, 16.4), /spare air filter/);
    assert.match(interact(14.55, 0, 14.7), /Found the filter/);
    assert.match(interact(-6.35, 0, 16.4), /Two sprays/);
    assert.equal(world.challenge.paint, 2);
    const mount = world.cameras.root.getObjectByName('B1 camera · West service hall');
    const lens = mount.getObjectByName('Blue camera lens');
    const cone = world.cameras.root.getObjectByName('Blue line of sight · West service hall');
    const position = at(-19.6, FLOORS[0].y, 0);
    const direction = lens.getWorldPosition(at(0, 0, 0)).sub(at(position.x, position.y + PLAYER.eyeHeight, position.z)).normalize();
    assert.match(world.challenge.use(3, position, direction), /Camera covered/);
    assert.equal(world.challenge.paint, 1);
    assert.equal(cone.visible, false);
    world.cameras.update(18.01);
    assert.equal(cone.visible, true);
});

test('Eli awards a one-use blade, which only works behind an unaware guard', t => {
    const { world, at, east, interact } = setup(t);
    assert.match(interact(-5.65, 4.4, 3.1), /dropped my badge/);
    assert.match(world.challenge.interact(at(8.95, 4.4, 13.03), at(0, 0, 1)), /Found the badge/);
    assert.match(interact(-5.65, 4.4, 3.1), /One quiet takedown/);
    const [guard] = world.guards.patrols;
    assert.match(world.challenge.use(4, at(guard.position.x + 1, guard.floorY, guard.position.z), at(-1, 0, 0)), /Get close behind/);
    assert(world.challenge.knife);
    assert.match(world.challenge.use(4, at(guard.position.x - 1, guard.floorY, guard.position.z), east), /quietly taken down/);
    assert.equal(world.challenge.knife, false);
    assert(guard.down);
    assert.equal(guard.vision.visible, false);
});
