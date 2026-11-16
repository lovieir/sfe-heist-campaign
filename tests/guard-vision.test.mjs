import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createGuardSystem } from '../core/guards.js';
import { createSecurityCameraSystem } from '../core/cameras.js';
import { FLOORS } from '../core/layout.js';

globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }),
};

const floorY = FLOORS[0].y;
const wall = (minX, maxX, minZ, maxZ) => ({
    min: [minX, floorY, minZ], max: [maxX, floorY + 3, maxZ], enabled: true,
});

function setup(colliders = []) {
    const parent = new THREE.Group();
    const guards = createGuardSystem({ parent, colliders, supports: [] });
    const [guard, other] = guards.patrols;
    other.position.set(30, floorY, 30);
    function pose(yaw = 0) {
        guard.position.set(0, floorY, 0);
        guard.group.rotation.y = yaw;
        Object.assign(guard, { pause: { angle: 0, duration: 10, elapsed: 0 }, look: 0, exposure: 0, tracking: false });
        guards.update(0);
        parent.updateMatrixWorld(true);
    }
    function redAt(x, z) {
        const down = new THREE.Raycaster(new THREE.Vector3(x, floorY + .5, z), new THREE.Vector3(0, -1, 0));
        return down.intersectObject(guard.vision).length > 0;
    }
    function sees(x, z) {
        pose();
        guards.update(.05, { position: new THREE.Vector3(x, floorY, z) });
        return Boolean(guards.alert);
    }
    pose();
    return { pose, redAt, sees };
}

test('the red view stops on the correct side of a wall and follows the guard as it turns', () => {
    const door = wall(.05, 1.25, -1.65, -1.5);
    const { pose, redAt, sees } = setup([door]);
    assert(redAt(.2, -1), 'the floor in front of the door is visible');
    assert(!redAt(.6, -3), 'no red floor behind the closed door');
    assert(redAt(-.6, -3), 'the other side of the corridor is clear');
    assert(!sees(.6, -3), 'the closed door also blocks player detection');
    pose(-.15);
    assert(!redAt(.6, -3), 'a turn does not drag the red mesh through the door');
    door.enabled = false;
    pose();
    assert(redAt(.6, -3) && sees(.6, -3), 'an open door admits vision');
});

test('a thin blocker between ray samples cannot leave a red streak behind it', () => {
    const x = Math.tan(THREE.MathUtils.degToRad(5.2)) * 2;
    const { redAt } = setup([wall(x - .003, x + .003, -2.003, -1.997)]);
    assert(redAt(x * .5, -1));
    assert(!redAt(x * 1.5, -3));
});

test('both the red view and player detection use the same range and angle', () => {
    const { redAt, sees } = setup();
    assert(redAt(0, -5.2) && sees(0, -5.2));
    assert(!redAt(0, -5.6) && !sees(0, -5.6));
    assert(!redAt(1.3, -3) && !sees(1.3, -3));
});

test('the blue view and its warning agree when a doorway opens', () => {
    const door = wall(-19.6, -19.4, -1.5, 1.5);
    const parent = new THREE.Group();
    const cameras = createSecurityCameraSystem({ parent, colliders: [door], floors: FLOORS });
    const cone = cameras.root.getObjectByName('Blue line of sight · West service hall');
    const player = { position: new THREE.Vector3(-17.7, floorY, .45) };
    const ray = new THREE.Raycaster(new THREE.Vector3(-17.7, floorY + .5, .45), new THREE.Vector3(0, -1, 0));
    const seesFloor = () => {
        parent.updateMatrixWorld(true);
        return ray.intersectObject(cone).length > 0;
    };
    assert.equal(cameras.update(.05, player), null);
    assert(!seesFloor());
    door.enabled = false;
    const warning = cameras.update(.05, player);
    assert(warning && !warning.failed);
    assert(seesFloor());
    player.position.set(0, floorY, 18);
    assert.equal(cameras.update(.05, player), null);
});
