import * as THREE from './vendor/three.module.js';
import { createHeldItems } from './core/held-items.js';
import { createMissionPanels } from './core/mission-panels.js';
import { LEVELS } from './core/levels.js';
import { createController, createLighting, createLightingPass, createWorld, EAST_VAULT, ELEVATOR, ELEVATOR_CALL, FLOORS, floorAt } from './map.js';
import { createJonathan } from './core/jonathan.js';

const canvas = document.querySelector('canvas');
const requestedLevel = new URLSearchParams(location.search).get('level');
const playingLevel = ['1', '2', '3'].includes(requestedLevel);
const level = playingLevel ? Number(requestedLevel) : 3;
const levelMenu = document.querySelector('#level-menu');
levelMenu.hidden = playingLevel;
document.body.classList.toggle('mission-select', !playingLevel);
if (playingLevel) document.title = `SFE Heist · ${LEVELS[level].title}`;
const wallet = document.querySelector('#wallet');
wallet.hidden = level !== 3 || !playingLevel;
const guardAlert = document.querySelector('#guard-alert');
const guardAlertText = document.querySelector('#guard-alert-text');
const guardAlertTime = document.querySelector('#guard-alert-time');
const detectionProgress = document.querySelector('#detection-progress');
const cameraAlert = document.querySelector('#camera-alert');
const cameraAlertTime = document.querySelector('#camera-alert-time');
const cameraDetectionProgress = document.querySelector('#camera-detection-progress');
const missionFailure = document.querySelector('#mission-failure');
const tripwireAlert = document.querySelector('#tripwire-alert');
const tripwireTime = document.querySelector('#tripwire-time');
const vaultLockAlert = document.querySelector('#vault-lock-alert');
const vaultLockTime = document.querySelector('#vault-lock-time');
const tripwireDialog = document.querySelector('#tripwire-dialog');
const tripwireDialogTitle = document.querySelector('#tripwire-dialog-title');
const tripwireDialogText = document.querySelector('#tripwire-dialog-text');
const tripwireForm = document.querySelector('#tripwire-code-form');
const tripwireInput = document.querySelector('#tripwire-code');
const tripwireResult = document.querySelector('#tripwire-result');
const tripwireClose = document.querySelector('#tripwire-close');
const pickupPrompt = document.querySelector('#pickup-prompt');
const escapeObjective = document.querySelector('#escape-objective');
const hotbarSlots = [...document.querySelectorAll('[data-hotbar-slot]')];
const fieldMessage = document.querySelector('#field-message');
const settingsScreen = document.querySelector('#settings-screen');
const settingsButton = document.querySelector('#view-settings');
const sensitivity = document.querySelector('#sensitivity');
const fieldOfView = document.querySelector('#field-of-view');
const victoryScreen = document.querySelector('#victory-screen');
const playAgain = document.querySelector('#play-again');
const directionToAim = new THREE.Vector3();
let fieldExpires = 0;
let won = false;
let attemptStart = null;
const vaultRiddleDialog = document.querySelector('#vault-riddle-dialog');
const vaultRiddleForm = document.querySelector('#vault-riddle-form');
const vaultRiddleAnswer = document.querySelector('#vault-riddle-answer');
const vaultRiddleResult = document.querySelector('#vault-riddle-result');
const vaultRiddleClose = document.querySelector('#vault-riddle-close');
const vaultRiddleQuestion = document.querySelector('#vault-riddle-question');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b8c7cf');
scene.fog = new THREE.Fog('#b8c7cf', 145, 410);
const camera = new THREE.PerspectiveCamera(76, 1, .08, 420);
const world = createWorld(scene, { level });
const lighting = createLighting(scene, renderer);
const lightingPass = createLightingPass(renderer, camera);
const heldItems = createHeldItems(renderer);
renderer.shadowMap.needsUpdate = true;

const player = createController({
    camera, domElement: canvas, colliders: world.colliders, supports: world.supports, ceilings: world.ceilings,
    onInteract: interact,
});
world.player = player;
if (LEVELS[level].spawn) player.setPosition(LEVELS[level].spawn, LEVELS[level].yaw);
player.setEnabled(playingLevel);
const jonathanMessage = document.querySelector('#jonathan-message');
const jonathan = level === 3 ? createJonathan({ world, player, send: text => { jonathanMessage.textContent = text; } }) : null;
if (!jonathan) jonathanMessage.textContent = LEVELS[level].brief;
const panels = createMissionPanels({ challenge: world.challenge, player, pause() {
    player.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
}, resume() { player.lock(); } });

const viewDefaults = { sensitivity: 70, fieldOfView: 76 };
const viewKey = 'sfe-east-reserve-view';
function applyView(save = true) {
    player.setLookSensitivity(Number(sensitivity.value) * .00002);
    camera.fov = Number(fieldOfView.value);
    camera.updateProjectionMatrix();
    document.querySelector('#sensitivity-value').textContent = `${sensitivity.value}%`;
    document.querySelector('#field-of-view-value').textContent = `${fieldOfView.value}°`;
    if (save) {
        try { localStorage.setItem(viewKey, JSON.stringify({ sensitivity: sensitivity.value, fieldOfView: fieldOfView.value })); } catch {}
    }
}
try {
    const saved = JSON.parse(localStorage.getItem(viewKey));
    if (saved) {
        sensitivity.value = saved.sensitivity ?? viewDefaults.sensitivity;
        fieldOfView.value = saved.fieldOfView ?? viewDefaults.fieldOfView;
    }
} catch {}
applyView(false);
sensitivity.addEventListener('input', () => applyView());
fieldOfView.addEventListener('input', () => applyView());
document.querySelector('#reset-view').addEventListener('click', () => {
    sensitivity.value = viewDefaults.sensitivity;
    fieldOfView.value = viewDefaults.fieldOfView;
    applyView();
});
function openViewSettings() {
    if (!playingLevel || panels.open || !settingsScreen.hidden) return;
    if (won || world.guards.missionFailed || !tripwireDialog.hidden || !vaultRiddleDialog.hidden) return;
    player.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    settingsScreen.hidden = false;
    sensitivity.focus();
}
settingsButton.addEventListener('click', openViewSettings);
document.querySelector('#resume-game').addEventListener('click', () => {
    settingsScreen.hidden = true;
    player.lock();
});
playAgain.addEventListener('click', () => location.reload());

function showFieldMessage(text) {
    fieldMessage.textContent = text;
    fieldExpires = time + 10;
}

function showVictory() {
    won = true;
    player.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const duration = Math.floor(time - (attemptStart ?? 0));
    const minutes = Math.floor(duration / 60), seconds = duration % 60;
    document.querySelector('#victory-time').textContent = `Escape time · ${minutes}:${String(seconds).padStart(2, '0')}`;
    document.querySelector('#victory-result').textContent = LEVELS[level].ending;
    const confetti = document.querySelector('#victory-confetti');
    for (let i = 0; i < 28; i++) {
        const piece = document.createElement('i');
        piece.style.left = `${(i * 37) % 96}%`;
        piece.style.setProperty('--delay', `${(i % 7) * .1}s`);
        confetti.append(piece);
    }
    victoryScreen.hidden = false;
    playAgain.focus();
}

function inLift() {
    const { min, max } = ELEVATOR.bounds;
    const { x, y, z } = player.position;
    return Math.abs(x) < max[0] - .35 && z > min[2] + .35 && z < max[2] - .35 &&
        Math.abs(y - world.lift.y) < .22;
}

function interact({ position, direction }) {
    if (world.lift.moving || inLift()) return;
    const tripwireTarget = world.tripwire.interact(position);
    if (tripwireTarget) {
        openTripwireDialog();
        return;
    }
    if (world.vaultRiddle.interact(position)) {
        openVaultRiddleDialog();
        return;
    }
    if (world.vaultLoot.pickup(position)) return;
    if (world.escape.interact(position)) return;
    const message = world.challenge.interact(position, direction);
    if (message) {
        if (world.challenge.shop) panels.openMarket();
        else showFieldMessage(message);
        return;
    }
    const { x, y, z } = position;
    let nearest;
    for (const door of world.doors.values()) {
        const d = door.definition;
        const [doorX, doorY, doorZ] = d.position;
        if (Math.abs(y - doorY) > .8 || door.moving) continue;
        const half = d.width / 2;
        const dx = (d.axis === 'x' ? THREE.MathUtils.clamp(x, doorX - half, doorX + half) : doorX) - x;
        const dz = (d.axis === 'z' ? THREE.MathUtils.clamp(z, doorZ - half, doorZ + half) : doorZ) - z;
        const distance = Math.hypot(dx, dz);
        if (distance > 2.7 || (distance > .2 && direction.x * dx + direction.z * dz < .26 * distance)) continue;
        if (!nearest || distance < nearest.distance) nearest = { door, distance };
    }
    const floor = floorAt(y);
    const front = Math.min(Math.hypot(x, z - ELEVATOR.bounds.max[2]), Math.hypot(x - ELEVATOR_CALL[0], z - ELEVATOR_CALL[1]));
    const rear = Math.hypot(x - 1.63, z - ELEVATOR.bounds.min[2]);
    const call = front < 2 && z > ELEVATOR.bounds.max[2] && direction.z < -.25 ? front
        : floor.id === 'B1' && rear < 2.1 && z < ELEVATOR.bounds.min[2] && direction.z > .25 ? rear : Infinity;
    if (Math.abs(y - floor.y) < .4 && call < (nearest?.distance ?? Infinity)) {
        world.lift.moveTo(floor.y);
    } else if (nearest) {
        if (!nearest.door.setOpen(!nearest.door.open) && nearest.door.definition.id === EAST_VAULT.doorId) {
            const reason = world.vaultBlocker();
            if (reason) showFieldMessage(reason);
        }
    }
}

function openTripwireDialog() {
    tripwireDialogTitle.textContent = 'Vault tripwire keypad';
    tripwireDialogText.textContent = world.challenge.copiedCode
        ? `Recorded code: ${world.challenge.copiedCode}`
        : 'Enter the code from the L2 maintenance sign before the countdown expires.';
    tripwireForm.hidden = false;
    tripwireResult.textContent = '';
    tripwireInput.value = '';
    tripwireDialog.hidden = false;
    player.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    tripwireInput.focus();
}

function closeTripwireDialog() {
    tripwireDialog.hidden = true;
    if (!world.guards.missionFailed) player.setEnabled(true);
}

function openVaultRiddleDialog() {
    vaultRiddleQuestion.textContent = world.vaultRiddle.prompt;
    vaultRiddleResult.textContent = '';
    vaultRiddleAnswer.value = '';
    vaultRiddleDialog.hidden = false;
    player.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    vaultRiddleAnswer.focus();
}

function closeVaultRiddleDialog() {
    vaultRiddleDialog.hidden = true;
    if (!world.guards.missionFailed) player.setEnabled(true);
}

tripwireForm.addEventListener('submit', event => {
    event.preventDefault();
    const result = world.tripwire.enterCode(tripwireInput.value);
    tripwireResult.textContent = result.message;
    if (result.ok) closeTripwireDialog();
});
tripwireClose.addEventListener('click', closeTripwireDialog);
vaultRiddleForm.addEventListener('submit', event => {
    event.preventDefault();
    const result = world.vaultRiddle.answer(vaultRiddleAnswer.value);
    vaultRiddleResult.textContent = result.message;
    if (result.ok) closeVaultRiddleDialog();
});
vaultRiddleClose.addEventListener('click', closeVaultRiddleDialog);
function closeTripwireOnEscape(event) {
    if (event.key === 'Escape' && panels.open) {
        panels.close();
        return;
    }
    if (event.key === 'Escape' && !tripwireDialog.hidden) closeTripwireDialog();
    if (event.key === 'Escape' && !vaultRiddleDialog.hidden) closeVaultRiddleDialog();
    if (event.key === 'Escape' && !settingsScreen.hidden) {
        settingsScreen.hidden = true;
        player.lock();
    }
}
window.addEventListener('keydown', closeTripwireOnEscape);

function selectLiftFloor(event) {
    const match = /^(?:Digit|Numpad)([123])$/.exec(event.code);
    if (!match || event.repeat || !inLift()) return;
    const destination = FLOORS[Number(match[1]) - 1];
    if (Math.abs(world.lift.y - destination.y) > .05 && world.lift.moveTo(destination.y, true)) {
        player.setEnabled(false);
    }
}

let selectedHotbarSlot = 0;
function updateHotbar() {
    const inventory = [world.vaultLoot.jewelCollected && ['Jewel', '💎'], world.escape.drillCollected && ['Drill', '🔧'],
        world.challenge.keycard && ['Access card', '▰'], world.challenge.paint > 0 && [`Paint ×${world.challenge.paint}`, '▧'],
        world.challenge.knife && ['Ceramic blade', '◆']];
    heldItems.select(inventory[selectedHotbarSlot] ? selectedHotbarSlot : -1);
    hotbarSlots.forEach((slot, index) => {
        const [name, icon] = inventory[index] || ['Empty', ''];
        slot.classList.toggle('selected', index === selectedHotbarSlot);
        slot.classList.toggle('filled', Boolean(inventory[index]));
        slot.querySelector('.hotbar-icon').textContent = icon;
        slot.querySelector('.hotbar-name').textContent = name;
        slot.setAttribute('aria-label', `Hotbar slot ${index + 1}, ${name.toLowerCase()}`);
    });
}

function selectHotbarSlot(index) {
    selectedHotbarSlot = index;
    updateHotbar();
}

function onHotbarKey(event) {
    if (event.code === 'KeyP' && !event.repeat && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) openViewSettings();
    if (won || panels.open || !settingsScreen.hidden || !player.enabled || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '') || inLift()) return;
    if (level === 3 && event.code === 'KeyM' && !event.repeat && !panels.openPlan()) showFieldMessage('Buy a floor plan from Noah in the L1 lobby.');
    const match = /^(?:Digit|Numpad)([1-5])$/.exec(event.code);
    if (match) selectHotbarSlot(Number(match[1]) - 1);
}

hotbarSlots.forEach((slot, index) => slot.addEventListener('click', () => selectHotbarSlot(index)));
updateHotbar();

function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    lightingPass.resize();
    heldItems.resize(camera.aspect);
}

let fallbackPress = null;
function rememberCanvasPress(event) {
    fallbackPress = event.button === 0 && player.fallback && player.enabled && document.activeElement === canvas
        ? { x: event.clientX, y: event.clientY } : null;
}
function onCanvasClick(event) {
    if (!playingLevel || event.button !== 0 || won || panels.open || !settingsScreen.hidden || !tripwireDialog.hidden || !vaultRiddleDialog.hidden ||
        world.guards.missionFailed || world.lift.moving) return;
    attemptStart ??= time;
    const press = fallbackPress;
    fallbackPress = null;
    if (!player.locked && !press) {
        player.lock();
        return;
    }
    if (!player.enabled || inLift() || (press && !player.locked && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)) return;
    const hasTool = selectedHotbarSlot === 3 ? world.challenge.paint > 0 : selectedHotbarSlot === 4 && world.challenge.knife;
    if (!hasTool) return;
    camera.getWorldDirection(directionToAim);
    showFieldMessage(world.challenge.use(selectedHotbarSlot, player.position, directionToAim));
    updateHotbar();
}
canvas.addEventListener('pointerdown', rememberCanvasPress);
canvas.addEventListener('click', onCanvasClick);
window.addEventListener('keydown', selectLiftFloor);
window.addEventListener('keydown', onHotbarKey);
window.addEventListener('resize', resize);
resize();

let previous = performance.now();
let time = 0;
let vaultRiddleWasActive = false;
renderer.setAnimationLoop(now => {
    let remaining = Math.min((now - previous) / 1000, .25);
    previous = now;
    while (playingLevel && remaining > .00001 && settingsScreen.hidden && !panels.open && !won) {
        const dt = Math.min(.05, remaining);
        const riding = world.lift.moving && world.lift.passenger;
        time += dt;
        world.update(dt, time, player);
        if (level === 3) {
            player.setSprintMultiplier(world.challenge.adrenalineTime > 0 ? 1.22 : 1);
            const effects = [];
            if (world.challenge.adrenalineTime > 0) effects.push(`Sprint ${Math.ceil(world.challenge.adrenalineTime)}s`);
            if (world.challenge.bufferTime > 0) effects.push(`Camera buffer ${Math.ceil(world.challenge.bufferTime)}s`);
            if (world.challenge.hasMap) effects.push('Map · M');
            wallet.textContent = [`$${world.challenge.cash}`, ...effects].join('  ·  ');
        }
        camera.getWorldDirection(directionToAim);
        const actionPrompt = world.vaultLoot.canPickup(player.position) ? 'PRESS E TO PICK UP JEWEL'
            : world.escape.prompt(player.position) ||
                (world.tripwire.interact(player.position) ? 'E · Use override console' : world.challenge.prompt(player.position, directionToAim));
        if (fieldMessage.textContent && (time >= fieldExpires || world.guards.missionFailed)) fieldMessage.textContent = '';
        pickupPrompt.textContent = actionPrompt;
        pickupPrompt.classList.toggle('active', Boolean(actionPrompt));
        pickupPrompt.setAttribute('aria-hidden', String(!actionPrompt));
        escapeObjective.textContent = world.escape.message;
        escapeObjective.classList.toggle('active', Boolean(world.escape.message));
        escapeObjective.setAttribute('aria-hidden', String(!world.escape.message));
        updateHotbar();
        const alert = world.guards.alert;
        const cameraSight = world.cameras.alert;
        if (world.vaultRiddle.active && !vaultRiddleWasActive) openVaultRiddleDialog();
        vaultRiddleWasActive = world.vaultRiddle.active;
        guardAlert.classList.toggle('active', Boolean(alert));
        guardAlert.setAttribute('aria-hidden', String(!alert));
        if (alert) {
            guardAlertText.textContent = `${alert.guard} - YOU ARE IN SIGHT`;
            guardAlertTime.textContent = `${alert.seconds.toFixed(1)}s`;
            detectionProgress.style.width = `${Math.round(alert.progress * 100)}%`;
        } else {
            detectionProgress.style.width = '0%';
        }
        cameraAlert.classList.toggle('active', Boolean(cameraSight));
        cameraAlert.setAttribute('aria-hidden', String(!cameraSight));
        if (cameraSight) {
            cameraAlertTime.textContent = `${cameraSight.seconds.toFixed(1)}s`;
            cameraDetectionProgress.style.width = `${Math.round(cameraSight.progress * 100)}%`;
        } else {
            cameraDetectionProgress.style.width = '0%';
        }
        missionFailure.classList.toggle('active', world.guards.missionFailed);
        if (world.guards.missionFailed) attemptStart = time;
        missionFailure.setAttribute('aria-hidden', String(!world.guards.missionFailed));
        tripwireAlert.classList.toggle('active', world.tripwire.active);
        tripwireAlert.setAttribute('aria-hidden', String(!world.tripwire.active));
        if (world.tripwire.active) tripwireTime.textContent = `${Math.ceil(world.tripwire.secondsRemaining)}s`;
        const lockCountdown = world.vaultRiddle.lockCountdown;
        vaultLockAlert.classList.toggle('active', lockCountdown !== null);
        vaultLockAlert.setAttribute('aria-hidden', String(lockCountdown === null));
        if (lockCountdown !== null) vaultLockTime.textContent = `${lockCountdown.toFixed(1)}s`;
        if (world.guards.missionFailed && !tripwireDialog.hidden) tripwireDialog.hidden = true;
        if (world.guards.missionFailed && !vaultRiddleDialog.hidden) vaultRiddleDialog.hidden = true;
        if (riding && !world.guards.missionFailed) {
            player.setPosition(player.position);
            if (!world.lift.moving) player.setEnabled(true);
        } else {
            player.update(dt);
        }
        const playing = player.enabled && (player.locked || document.activeElement === canvas);
        const solvingPuzzle = !tripwireDialog.hidden || !vaultRiddleDialog.hidden;
        jonathan?.update(dt, !document.hidden && (playing || solvingPuzzle));
        if ((level === 3 && world.escape.escaped) || world.challenge.completed) showVictory();
        remaining -= dt;
    }
    lighting.update(camera.position);
    lightingPass.render(scene);
    if (!won) heldItems.render();
});

window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    renderer.setAnimationLoop(null);
    canvas.removeEventListener('pointerdown', rememberCanvasPress);
    canvas.removeEventListener('click', onCanvasClick);
    window.removeEventListener('keydown', selectLiftFloor);
    window.removeEventListener('keydown', onHotbarKey);
    window.removeEventListener('keydown', closeTripwireOnEscape);
    window.removeEventListener('resize', resize);
    player.dispose();
    lightingPass.dispose();
    heldItems.dispose();
    lighting.dispose();
    world.dispose();
    renderer.dispose();
});
