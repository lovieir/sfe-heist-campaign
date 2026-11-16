import * as THREE from '../vendor/three.module.js';
import { createSightCone, heading } from './sight-cone.js';
import { PLAYER } from './controller.js';
import { EAST_VAULT } from './layout.js';
import { createNametag, updateNametag } from './nametag.js';

const degrees = THREE.MathUtils.degToRad;
const DETECTION_SECONDS = 2.3;
const MOUNT_HEIGHT = 3.56;
const FLOOR_OVERLAY = .039;

// Positions and aim points are in meters. The paired hall cameras look away
// from the lift landing so the center and the keypad have room to maneuver.
const placements = [
    { name: 'West service hall', at: [-21.1, 1.36], aim: [-14, -.7], range: 10, angle: 48, sweep: 12 },
    { name: 'West archive junction', at: [-8.8, 1.37], aim: [-15, -.25], range: 8, angle: 44, sweep: 11 },
    { name: 'East service hall', at: [22.8, -1.39], aim: [15, .65], range: 10, angle: 48, sweep: 13 },
    { name: 'East archive junction', at: [9.4, 1.37], aim: [15, -.45], range: 8, angle: 44, sweep: 10 },
    { name: 'West vault approach', at: [-6.8, -7.35], aim: [-4.8, -10.3], range: 6.5, angle: 39, sweep: 9 },
    { name: 'East vault approach', at: [6.8, -7.65], aim: [2.45, -9.35], range: 6.4, angle: 36, sweep: 12 },
    { name: 'Records archive', at: [-15.53, -18.45], aim: [-10.75, -11.4], range: 10, angle: 53, sweep: 10 },
    { name: EAST_VAULT.watchCamera, at: [13.0, -8.85], aim: [11.5, -4.8], range: 6.2, angle: 46, sweep: 7 },
    { name: 'Vault antechamber', at: [-15.54, -8.93], aim: [-8.4, -3.6], range: 9, angle: 51, sweep: 11 },
    { name: 'Vault administration', at: [15.54, -8.93], aim: [10, -3.0], range: 8, angle: 45, sweep: 11 },
    { name: 'West basement archive', at: [-9.52, 18.42], aim: [-5.3, 9.4], range: 10, angle: 52, sweep: 14 },
    { name: 'East basement archive', at: [9.52, 18.42], aim: [5.3, 9.4], range: 10, angle: 52, sweep: 14 },
    { name: 'Server room', at: [-25.46, 2.34], aim: [-17.25, 8.4], range: 10, angle: 52, sweep: 12 },
    { name: 'Mechanical room', at: [25.46, 2.34], aim: [17.25, 8.4], range: 10, angle: 52, sweep: 12 },
    { name: 'Inventory stores', at: [-25.46, 18.45], aim: [-17.1, 12.8], range: 10, angle: 54, sweep: 13 },
    { name: 'Receiving annex', at: [25.46, 18.45], aim: [17.1, 12.8], range: 10, angle: 54, sweep: 13 },
];

export function createSecurityCameraSystem({ parent, colliders, floors, level = 3 }) {
    const { y: floorY } = floors.find(floor => floor.id === 'B1');
    // Ceiling cameras see over the basement shelving and desks. Full-height
    // walls and closed doors still cast a shadow on the floor and block detection.
    const occluders = colliders.filter(({ min, max }) => max[1] > floorY + 2.35 && min[1] <= floorY + 1.65);
    const root = new THREE.Group();
    root.name = 'Basement security camera system';
    parent.add(root);

    const housingMaterial = new THREE.MeshStandardMaterial({ color: '#202b35', metalness: .62, roughness: .38 });
    const lensMaterial = new THREE.MeshBasicMaterial({ color: '#5db8ff' });
    const paintedLens = new THREE.MeshBasicMaterial({ color: '#4f322e' });
    const floorMaterial = new THREE.MeshBasicMaterial({ color: '#168cff', transparent: true,
        opacity: .19, side: THREE.DoubleSide, depthWrite: false });
    const alertMaterial = floorMaterial.clone();
    alertMaterial.color.set('#50c8ff');
    const box = new THREE.BoxGeometry(1, 1, 1);
    const lensGeometry = new THREE.SphereGeometry(.085, 12, 10);

    const activePlacements = level === 1 ? [{ name: 'Training camera', at: [-6.68, -6.7], aim: [-5.1, -2.45], range: 6, angle: 44, sweep: 22 }]
        : level === 2 ? placements.filter(camera => camera.name === EAST_VAULT.watchCamera) : placements;
    const sensors = activePlacements.map(({ name, at: [x, z], aim, range, angle, sweep }, index) => {
        const yaw = heading(aim[0] - x, aim[1] - z);
        const mount = new THREE.Group();
        mount.name = `B1 camera · ${name}`;
        mount.position.set(x, floorY + MOUNT_HEIGHT, z);
        root.add(mount);
        const tag = name === EAST_VAULT.watchCamera ? createNametag(name, .34, 'contact') : null;
        if (tag) mount.add(tag);

        const bracket = new THREE.Mesh(box, housingMaterial);
        bracket.position.y = .29;
        bracket.scale.set(.12, .60, .12);
        mount.add(bracket);
        const pivot = new THREE.Group();
        mount.add(pivot);
        const housing = new THREE.Mesh(box, housingMaterial);
        housing.scale.set(.34, .22, .42);
        housing.rotation.x = -.23;
        pivot.add(housing);
        const lens = new THREE.Mesh(lensGeometry, lensMaterial);
        lens.name = 'Blue camera lens';
        lens.position.set(0, -.047, -.204);
        pivot.add(lens);

        const cone = createSightCone({ range, halfAngle: degrees(angle / 2), height: MOUNT_HEIGHT - FLOOR_OVERLAY, slices: 32 });
        const coverage = new THREE.Mesh(cone.geometry, floorMaterial);
        coverage.name = `Blue line of sight · ${name}`;
        coverage.position.set(x, floorY + FLOOR_OVERLAY, z);
        coverage.renderOrder = 2;
        root.add(coverage);
        return { name, mount, tag, x, z, yaw, sweep: degrees(sweep), phase: index * 1.73, rate: .56 + (index % 4) * .055,
            pivot, lens, coverage, cone, exposure: 0, painted: 0 };
    });
    const vaultWatch = sensors.find(sensor => sensor.name === EAST_VAULT.watchCamera);

    let clock = 0;
    let alert = null;
    let failed = false;
    function sweep(sensor) {
        const yaw = sensor.yaw + Math.sin(clock * sensor.rate + sensor.phase) * sensor.sweep;
        sensor.pivot.rotation.y = sensor.coverage.rotation.y = yaw;
        sensor.cone.update(sensor.x, floorY + FLOOR_OVERLAY, sensor.z, yaw, occluders);
    }

    function update(dt, player, grace = 0) {
        if (failed) return alert;
        const position = player?.position;
        const onBasement = position && Math.abs(position.y - floorY) < 1.1;
        if (onBasement) clock += Math.max(0, dt);
        let highest = 0;
        const limit = DETECTION_SECONDS + grace;
        for (const sensor of sensors) {
            if (sensor.tag) updateNametag(sensor.tag, sensor.mount.position, position);
            if (sensor.painted > 0) {
                sensor.painted = Math.max(0, sensor.painted - dt);
                sensor.lens.material = sensor.painted ? paintedLens : lensMaterial;
                sensor.coverage.visible = !sensor.painted;
                if (sensor.painted) continue;
            }
            if (onBasement) sweep(sensor);
            const seesPlayer = onBasement && sensor.cone.contains(position.x - sensor.x, position.z - sensor.z, sensor.coverage.rotation.y);
            sensor.exposure = seesPlayer ? Math.min(limit, sensor.exposure + Math.max(0, dt)) : 0;
            sensor.coverage.material = seesPlayer ? alertMaterial : floorMaterial;
            highest = Math.max(highest, sensor.exposure);
        }
        failed = highest >= limit;
        alert = highest > 0 ? { progress: highest / limit, seconds: limit - highest, failed } : null;
        return alert;
    }

    function spray(position, direction, clear) {
        if (Math.abs(position.y - floorY) > .8) return false;
        const eye = new THREE.Vector3(position.x, position.y + PLAYER.eyeHeight, position.z);
        const target = new THREE.Vector3(), delta = new THREE.Vector3();
        let selected = null, best = .95;
        for (const sensor of sensors) {
            if (sensor.painted) continue;
            sensor.lens.getWorldPosition(target);
            delta.subVectors(target, eye);
            const length = delta.length();
            if (length < .1 || length > 5.4) continue;
            const aim = delta.divideScalar(length).dot(direction);
            if (aim <= best || !clear(eye, target)) continue;
            selected = sensor;
            best = aim;
        }
        if (!selected) return false;
        selected.painted = 18;
        selected.exposure = 0;
        selected.lens.material = paintedLens;
        selected.coverage.visible = false;
        return selected.name;
    }

    function reset() {
        clock = 0;
        failed = false;
        alert = null;
        for (const sensor of sensors) {
            sensor.exposure = 0;
            sensor.painted = 0;
            sensor.lens.material = lensMaterial;
            sensor.coverage.visible = true;
            sensor.coverage.material = floorMaterial;
            sweep(sensor);
        }
    }
    reset();
    return { root, update, reset, spray, get alert() { return alert; },
        get vaultCameraCovered() { return (vaultWatch?.painted ?? 0) > 0; },
        dispose() { alertMaterial.dispose(); paintedLens.dispose(); } };
}
