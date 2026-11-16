import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three.module.js';
import { createController, overlapsCollider, PLAYER } from '../core/controller.js';

const floor = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, y: 0 };

function setup(t, { colliders = [], ceilings = [] } = {}) {
    globalThis.document = new EventTarget();
    globalThis.window = new EventTarget();
    const camera = new THREE.PerspectiveCamera();
    const player = createController({ camera, domElement: new EventTarget(), colliders, ceilings, supports: [floor] });
    player.setPosition([0, 0, 0]);
    player.setEnabled(true);
    t.after(() => player.dispose());
    const key = (type, repeat = false) => document.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code: 'Space', repeat }));
    return { player, camera, key };
}

test('holding Space starts a new jump only on landing and release stops the chain', t => {
    const { player, camera, key } = setup(t);
    key('keydown');
    let jumps = 0;
    let peak = 0;
    for (let frame = 0; frame < 108; frame++) {
        // A fresh press while the player is in the air can't increase the first jump height.
        if (frame === 12) { key('keyup'); key('keydown'); }
        const before = player.position.y;
        player.update(1 / 60);
        if (before === 0 && player.position.y > 0) jumps++;
        peak = Math.max(peak, player.position.y);
        assert(Math.abs(camera.position.y - player.position.y - PLAYER.eyeHeight) < 1e-8);
    }
    assert(jumps >= 3, `expected repeat jumps, saw ${jumps}`);
    assert(peak > .62 && peak < .75, `unexpected jump height: ${peak}`);
    key('keyup');
    for (let frame = 0; frame < 75; frame++) player.update(1 / 60);
    assert.equal(player.position.y, 0);
});

test('jump movement stops at a low ceiling and a full-height wall', t => {
    const wall = { min: [-2, 0, -1.2], max: [2, 2.65, -1.1] };
    const ceiling = { min: [-2, 1.98, -3], max: [2, 2.16, 1] };
    const { player, key } = setup(t, { colliders: [wall], ceilings: [ceiling] });
    player.setInput({ forward: 1, sprint: true });
    key('keydown');
    key('keyup');
    let peak = 0;
    for (let frame = 0; frame < 55; frame++) {
        player.update(1 / 60);
        peak = Math.max(peak, player.position.y);
        assert(!overlapsCollider(player.position, ceiling));
        assert(!overlapsCollider(player.position, wall));
    }
    assert(peak > .20 && peak <= .231);
    assert(player.position.z > -.80);
    assert.equal(player.position.y, 0);
});
