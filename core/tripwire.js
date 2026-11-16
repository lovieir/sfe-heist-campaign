import * as THREE from '../vendor/three.module.js';
import { EAST_VAULT } from './layout.js';

const ALARM_SECONDS = 42;
const INTERACT_RANGE = 2.25;
const { minX: wireMinX, maxX: wireMaxX, z: wireZ } = EAST_VAULT.wire;
const CODE_WORDS = ['Ash', 'Cedar', 'Echo', 'Flint', 'Harbor', 'Iris', 'Juniper', 'Quartz', 'Raven', 'Slate', 'Tide', 'Willow'];
const CODE_SYMBOLS = ['!', '#', '@', '-'];
const randomItem = items => items[Math.floor(Math.random() * items.length)];

export function generateOverrideCode(previous = '') {
    const first = randomItem(CODE_WORDS);
    const number = Math.floor(Math.random() * 1000);
    const end = randomItem(CODE_WORDS);
    const symbols = randomItem(CODE_SYMBOLS) + randomItem(CODE_SYMBOLS);
    const format = value => `${first}${symbols[0]}${String(value).padStart(3, '0')}${symbols[1]}${end}`;
    const next = format(number);
    return next === previous ? format((number + 1) % 1000) : next;
}

/** Vault tripwire, timed keypad and an inspectable rotating clue on L2. */
export function createTripwireSystem({ parent, floors, onFailure = () => {} }) {
    const b1 = floors.find(floor => floor.id === 'B1');
    const l2 = floors.find(floor => floor.id === 'L2');
    const root = new THREE.Group();
    root.name = 'Vault tripwire and code clue';
    parent.add(root);

    const wireMaterial = new THREE.MeshBasicMaterial({ color: '#8e343a', transparent: true, opacity: .26 });
    const postMaterial = new THREE.MeshStandardMaterial({ color: '#34383c', metalness: .55, roughness: .42 });
    const panelMaterial = new THREE.MeshStandardMaterial({ color: '#202b30', metalness: .4, roughness: .45 });
    const keyMaterial = new THREE.MeshStandardMaterial({ color: '#c8aa69', metalness: .55, roughness: .35 });
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 768;
    labelCanvas.height = 320;
    const ctx = labelCanvas.getContext('2d');
    let code = generateOverrideCode();
    function drawCodeSign() {
        ctx.fillStyle = '#29251e';
        ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
        ctx.fillStyle = '#f1e7cf';
        ctx.textAlign = 'center';
        ctx.font = 'bold 46px Arial';
        ctx.fillText('MAINTENANCE', 384, 76);
        ctx.font = 'bold 38px Arial';
        ctx.fillText('OVERRIDE CODE', 384, 146);
        ctx.font = `bold ${code.length > 9 ? 42 : 48}px monospace`;
        ctx.fillText(code, 384, 238, 700);
    }
    drawCodeSign();
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, color: '#ffffff' });
    const box = new THREE.BoxGeometry(1, 1, 1);

    // A subtle, floor-level beam spans the vault approach from wall to wall.
    const wire = new THREE.Mesh(new THREE.BoxGeometry(wireMaxX - wireMinX, .022, .022), wireMaterial);
    wire.name = 'Vault tripwire beam';
    wire.position.set((wireMinX + wireMaxX) / 2, b1.y + .12, wireZ);
    root.add(wire);
    for (const x of [wireMinX, wireMaxX]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.028, .035, .24, 10), postMaterial);
        post.position.set(x, b1.y + .13, wireZ);
        root.add(post);
    }

    // The physical keypad appears at the vault's right side when the tripwire arms.
    const keypad = new THREE.Group();
    keypad.name = 'Tripwire override console';
    keypad.position.set(EAST_VAULT.keypad[0], b1.y, EAST_VAULT.keypad[1]);
    keypad.visible = false;
    root.add(keypad);
    const pedestal = new THREE.Mesh(box, postMaterial);
    pedestal.scale.set(.62, 1.35, .48);
    pedestal.position.set(0, .675, 0);
    keypad.add(pedestal);
    const base = new THREE.Mesh(box, panelMaterial);
    base.scale.set(.78, .12, .62);
    base.position.set(0, .06, 0);
    keypad.add(base);
    const screen = new THREE.Mesh(box, panelMaterial);
    screen.scale.set(.50, .42, .08);
    screen.position.set(0, 1.12, .19);
    keypad.add(screen);
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = 512;
    displayCanvas.height = 384;
    const displayCtx = displayCanvas.getContext('2d');
    displayCtx.fillStyle = '#10231a';
    displayCtx.fillRect(0, 0, 512, 384);
    displayCtx.fillStyle = '#a7e3bc';
    displayCtx.textAlign = 'center';
    displayCtx.font = 'bold 42px Arial';
    displayCtx.fillText('VAULT SECURITY', 256, 112);
    displayCtx.font = 'bold 34px Arial';
    displayCtx.fillText('OVERRIDE CONSOLE', 256, 188);
    displayCtx.font = '28px Arial';
    displayCtx.fillText('PRESS E TO ENTER CODE', 256, 270);
    const displayTexture = new THREE.CanvasTexture(displayCanvas);
    displayTexture.colorSpace = THREE.SRGBColorSpace;
    const screenLight = new THREE.Mesh(new THREE.PlaneGeometry(.40, .30), new THREE.MeshBasicMaterial({ map: displayTexture }));
    screenLight.position.set(0, 1.12, .232);
    keypad.add(screenLight);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const button = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .02, 12), keyMaterial);
        button.rotation.x = Math.PI / 2;
        button.position.set((col - 1) * .13, .52 + row * .10, .25);
        keypad.add(button);
    }

    // Keep the rotating clue understated on the blank wall beside the Executive Office Suite.
    const codeSign = new THREE.Sprite(labelMaterial);
    codeSign.name = 'Visible rotating vault override code sign';
    codeSign.position.set(12.86, l2.y + 2.15, 8.55);
    codeSign.scale.set(.78, .33, 1);
    codeSign.material.opacity = .68;
    root.add(codeSign);

    let previous = null;
    let armed = false;
    let disarmed = false;
    let remaining = 0;
    let failed = false;

    function distanceXZ(position, point) {
        return Math.hypot(position.x - point.x, position.z - point.z);
    }

    function update(dt, player) {
        if (!player?.position) return;
        const position = player.position;
        if (!armed && !disarmed && previous) {
            const crossed = (previous.z > wireZ && position.z <= wireZ) || (previous.z < wireZ && position.z >= wireZ);
            if (crossed) {
                const fraction = (wireZ - previous.z) / (position.z - previous.z);
                const crossX = THREE.MathUtils.lerp(previous.x, position.x, fraction);
                const crossY = THREE.MathUtils.lerp(previous.y, position.y, fraction);
                // The visible beam marks a security plane across the passage, including above the floor.
                if (crossX >= wireMinX && crossX <= wireMaxX && crossY >= b1.y - .1 && crossY <= b1.y + 2.4) {
                    armed = true;
                    remaining = ALARM_SECONDS;
                    failed = false;
                    keypad.visible = true;
                }
            }
        }
        previous = { x: position.x, y: position.y, z: position.z };
        if (!armed || failed) return;
        remaining = Math.max(0, remaining - Math.max(0, dt));
        if (remaining <= 0) {
            failed = true;
            onFailure();
        }
    }

    function interact(position) {
        const keypadGround = new THREE.Vector3(keypad.position.x, b1.y, keypad.position.z);
        if (armed && !disarmed && Math.abs(position.y - b1.y) < 1.4 && distanceXZ(position, keypadGround) <= INTERACT_RANGE) return 'keypad';
        return null;
    }

    function enterCode(value) {
        if (!armed || disarmed) return { ok: false, message: 'The tripwire is not active.' };
        if (String(value).trim() !== code) return { ok: false, message: 'Incorrect code. The countdown is still running.' };
        armed = false;
        disarmed = true;
        remaining = 0;
        keypad.visible = false;
        wireMaterial.color.set('#38e08e');
        wireMaterial.opacity = .35;
        return { ok: true, message: 'Tripwire disabled.' };
    }

    function onMissionFailure() {
        code = generateOverrideCode(code);
        drawCodeSign();
        labelTexture.needsUpdate = true;
        armed = false;
        disarmed = false;
        failed = false;
        remaining = 0;
        keypad.visible = false;
        previous = null;
        wireMaterial.color.set('#8e343a');
        wireMaterial.opacity = .26;
    }

    return {
        update,
        interact,
        enterCode,
        onMissionFailure,
        get active() { return armed && !disarmed; },
        get disarmed() { return disarmed; },
        get signPosition() { return codeSign.position; },
        readCode() { return code; },
        get secondsRemaining() { return remaining; },
        get failed() { return failed; },
        dispose() {
            labelTexture.dispose();
            labelMaterial.dispose();
        },
    };
}
