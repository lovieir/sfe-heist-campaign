import * as THREE from '../vendor/three.module.js';
import { ENTRANCES, FLOORS } from './layout.js';
import { moveWithCollisions, PLAYER } from './controller.js';
import { angleDelta, createSightCone, heading } from './sight-cone.js';
import { createNametag, updateNametag } from './nametag.js';
import { LEVELS } from './levels.js';

const DETECTION_SECONDS = 1;
const VISION_RANGE = 5.4;
const VISION_HALF_ANGLE = THREE.MathUtils.degToRad(20);
const EYE_HEIGHT = 1.48;
const VISION_FLOOR_OFFSET = .024;
const FLOOR_Y = FLOORS[0].y;

/** Floor patrols with collision-safe movement and wall-clipped vision. */
export function createGuardSystem({ parent, colliders, supports, level = 3 }) {
    const root = new THREE.Group();
    root.name = 'Basement guard system';
    parent.add(root);
    const occluders = colliders.filter(({ min, max }) => max[1] > FLOOR_Y + VISION_FLOOR_OFFSET && min[1] <= FLOOR_Y + EYE_HEIGHT);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#263a4a', roughness: .78 });
    const trouserMaterial = new THREE.MeshStandardMaterial({ color: '#20272c', roughness: .84 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: '#bd8b6c', roughness: .92 });
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#182c39', roughness: .78 });
    const badgeMaterial = new THREE.MeshStandardMaterial({ color: '#d8b563', metalness: .55, roughness: .42 });
    const visionMaterial = new THREE.MeshBasicMaterial({
        color: '#ff2b36', transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false,
    });
    const gunMaterial = new THREE.MeshStandardMaterial({ color: '#34383c', metalness: .65, roughness: .4 });
    const flashMaterial = new THREE.MeshBasicMaterial({ color: '#fff1bb', transparent: true, opacity: .95 });
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
    const patrols = [];
    let activeGuard = null;
    let failureElapsed = 0;
    let disposed = false;

    function addMesh(parentGroup, geometry, material, position, scale, rotation = null, name = '') {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        if (rotation) mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parentGroup.add(mesh);
        return mesh;
    }

    function clippedVision(guard) {
        const { x, y, z } = guard.position;
        guard.head.rotation.y = guard.look;
        guard.vision.rotation.y = guard.look;
        guard.cone.update(x, y + VISION_FLOOR_OFFSET, z, guard.group.rotation.y + guard.look,
            guard.floorY === FLOOR_Y ? occluders : colliders);
    }

    function routeHeading(route) {
        if (route.length === 1) return 0;
        return heading(route[1][0] - route[0][0], route[1][1] - route[0][1]);
    }

    function makeGuard(name, label, route, speed, floorY = FLOOR_Y) {
        const group = new THREE.Group();
        group.name = name;
        group.position.set(route[0][0], floorY, route[0][1]);
        group.rotation.y = routeHeading(route);
        root.add(group);
        const tag = createNametag(label, 1.95, 'guard');
        group.add(tag);

        // Human proportions and a recognizable security uniform.
        addMesh(group, box, bodyMaterial, [0, .99, 0], [.50, .66, .30], null, `${name} uniform torso`);
        const head = new THREE.Group();
        group.add(head);
        addMesh(head, sphere, skinMaterial, [0, 1.48, 0], [.205, .235, .205], null, `${name} head`);
        addMesh(head, sphere, skinMaterial, [-.196, 1.47, 0], [.045, .075, .055], null, `${name} left ear`);
        addMesh(head, sphere, skinMaterial, [.196, 1.47, 0], [.045, .075, .055], null, `${name} right ear`);
        for (const side of [-1, 1]) addMesh(head, sphere, trouserMaterial,
            [side * .067, 1.515, -.174], [.027, .025, .018], null, `${name} eye`);
        addMesh(head, sphere, skinMaterial, [0, 1.46, -.207], [.036, .048, .035], null, `${name} nose`);
        addMesh(head, box, trouserMaterial, [0, 1.402, -.195], [.065, .012, .014], null, `${name} mouth`);
        addMesh(head, cylinder, capMaterial, [0, 1.675, 0], [.235, .075, .235], null, `${name} security cap`);
        addMesh(head, box, capMaterial, [0, 1.63, -.16], [.28, .035, .10], null, `${name} cap brim`);
        addMesh(group, box, badgeMaterial, [0, 1.285, -.154], [.24, .07, .025], null, `${name} uniform nameplate`);
        addMesh(group, box, badgeMaterial, [-.13, 1.13, -.157], [.085, .13, .025], null, `${name} badge`);
        const leftLeg = addMesh(group, box, trouserMaterial, [-.145, .37, 0], [.17, .56, .22], null, `${name} left trouser leg`);
        const rightLeg = addMesh(group, box, trouserMaterial, [.145, .37, 0], [.17, .56, .22], null, `${name} right trouser leg`);
        addMesh(group, box, trouserMaterial, [-.145, .075, -.045], [.19, .13, .34], null, `${name} left shoe`);
        addMesh(group, box, trouserMaterial, [.145, .075, -.045], [.19, .13, .34], null, `${name} right shoe`);
        const leftArm = addMesh(group, cylinder, bodyMaterial, [-.31, .99, 0], [.105, .48, .105], [0, 0, -.08], `${name} left sleeve`);
        const rightArm = addMesh(group, cylinder, bodyMaterial, [.31, .99, 0], [.105, .48, .105], [0, 0, .08], `${name} right sleeve`);
        addMesh(group, sphere, skinMaterial, [-.315, .72, -.025], [.085, .10, .085], null, `${name} left hand`);
        addMesh(group, sphere, skinMaterial, [.315, .72, -.025], [.085, .10, .085], null, `${name} right hand`);
        addMesh(group, box, trouserMaterial, [0, .67, -.165], [.47, .12, .06], null, `${name} utility belt`);

        const weapon = new THREE.Group();
        weapon.name = `${name} holstered handgun`;
        weapon.position.set(.36, .78, -.15);
        weapon.rotation.x = -.25;
        weapon.visible = false;
        group.add(weapon);
        addMesh(weapon, box, gunMaterial, [0, .02, 0], [.22, .09, .14], null, 'handgun game prop');
        addMesh(weapon, cylinder, gunMaterial, [0, .02, -.105], [.045, .15, .045], [Math.PI / 2, 0, 0], 'short prop barrel');
        addMesh(weapon, box, gunMaterial, [0, -.07, .035], [.08, .17, .07], [-.2, 0, 0], 'prop grip');
        const muzzleFlash = addMesh(weapon, sphere, flashMaterial, [0, .02, -.205], [.11, .11, .11], null, 'brief game muzzle flash');
        muzzleFlash.visible = false;

        const cone = createSightCone({ range: VISION_RANGE, halfAngle: VISION_HALF_ANGLE, height: EYE_HEIGHT - VISION_FLOOR_OFFSET });
        const vision = new THREE.Mesh(cone.geometry, visionMaterial);
        vision.name = `${name} wall-clipped red vision cone`;
        vision.position.y = VISION_FLOOR_OFFSET;
        vision.frustumCulled = false;
        vision.renderOrder = 2;
        group.add(vision);
        const guard = {
            name, group, head, tag, vision, cone, weapon, muzzleFlash, route, speed, floorY,
            active: true, down: false,
            waypoint: 1, pause: null, look: 0, postClock: 0, tracking: false,
            exposure: 0, blockedTime: 0, flashSeconds: 0, walkPhase: 0,
            limbs: { leftLeg, rightLeg, leftArm, rightArm },
            get position() { return group.position; },
        };
        clippedVision(guard);
        return guard;
    }

    // [x, z, optional head turn in degrees, pause in seconds]
    patrols.push(makeGuard('Basement patrol west', 'West Guard', [
        [-12, .75], [-6, .75], [-4.1, -.55], [-4.1, -4.5, -23, .75],
        [-5.6, -8.8, 29, 1.05], [-6.25, -5.3], [-5.7, -.75], [-12, -.75], [-17, 0, 24, .9],
    ], 1.06));
    patrols.push(makeGuard('Basement patrol east', 'East Guard', [
        [6.2, -8.7], [4.6, -7.25], [4.6, -2.5, 22, .8], [6.2, -.55], [12.7, -.55],
        [17.5, .45, -28, .95], [11, .75], [5.8, .7], [6.38, -5.65, 26, .8],
    ], 1.12));

    const vaultSentry = makeGuard('East Reserve sentry', 'Vault Sentry', [[11.7, -7.83]], 0);
    patrols.push(vaultSentry);

    const lobbyResponse = [[-6.5, 8.1], [-6.5, 15.4], [-3.2, 17.25], [-.9, 17.1, -24, .9], [-5.5, 16]];
    const responder = makeGuard('Drill response guard', 'Response Guard', lobbyResponse, 1.52, FLOORS[1].y);
    responder.active = responder.group.visible = false;
    patrols.push(responder);

    function configurePatrols() {
        for (const [index, guard] of patrols.entries()) {
            guard.active = guard.group.visible = guard !== responder && (level === 3 ||
                (level === 1 ? index === 0 : guard === vaultSentry));
        }
    }
    configurePatrols();

    function investigateExit(definition) {
        if (responder.active) return;
        const side = Math.sign(definition.position[0]);
        responder.route = side ? [[side * 14.5, -.58], [side * 21.4, -.58],
            [side * 24.2, .6, side * 25, .9], [side * 21, .72]] : lobbyResponse;
        resetGuard(responder);
        responder.pause = { angle: 0, duration: 1.25, elapsed: 0 };
        responder.active = responder.group.visible = true;
    }

    function inVision(guard, position) {
        if (Math.abs(position.y - guard.floorY) > .75) return false;
        return guard.cone.contains(position.x - guard.position.x, position.z - guard.position.z,
            guard.group.rotation.y + guard.look);
    }

    function relaxLimbs(guard, dt) {
        for (const limb of Object.values(guard.limbs)) {
            limb.rotation.x *= Math.max(0, 1 - dt * 8);
        }
    }

    function walkAnimation(guard, distance) {
        guard.walkPhase += distance * 9;
        const swing = Math.sin(guard.walkPhase) * .29;
        guard.limbs.leftLeg.rotation.x = swing;
        guard.limbs.rightLeg.rotation.x = -swing;
        guard.limbs.leftArm.rotation.x = -swing * .7;
        guard.limbs.rightArm.rotation.x = swing * .7;
    }

    function trackPlayer(guard, position, dt) {
        const yaw = heading(position.x - guard.position.x, position.z - guard.position.z);
        const aim = THREE.MathUtils.clamp(angleDelta(yaw, guard.group.rotation.y), -.38, .38);
        guard.look = THREE.MathUtils.damp(guard.look, aim, 6, dt);
        relaxLimbs(guard, dt);
    }

    function updatePatrol(guard, dt) {
        if (dt <= 0) return;
        if (guard.route.length === 1) {
            guard.postClock += dt;
            guard.look = Math.sin(guard.postClock * 1.15) * .23;
            return;
        }
        if (guard.pause) {
            const pause = guard.pause;
            pause.elapsed = Math.min(pause.duration, pause.elapsed + dt);
            guard.look = Math.sin(Math.PI * pause.elapsed / pause.duration) * pause.angle;
            relaxLimbs(guard, dt);
            if (pause.elapsed >= pause.duration) guard.pause = null;
            return;
        }
        guard.look = THREE.MathUtils.damp(guard.look, 0, 8, dt);

        const [targetX, targetZ, glance = 0, duration = 0] = guard.route[guard.waypoint];
        const dx = targetX - guard.position.x;
        const dz = targetZ - guard.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .12) {
            guard.waypoint = (guard.waypoint + 1) % guard.route.length;
            if (duration) guard.pause = { angle: THREE.MathUtils.degToRad(glance), duration, elapsed: 0 };
            return;
        }
        const turn = angleDelta(heading(dx, dz), guard.group.rotation.y);
        guard.group.rotation.y += THREE.MathUtils.clamp(turn, -2.9 * dt, 2.9 * dt);
        if (Math.abs(turn) > .8) {
            relaxLimbs(guard, dt);
            return;
        }

        const step = Math.min(distance, guard.speed * dt);
        const next = moveWithCollisions(guard.position, {
            x: dx * step / distance,
            z: dz * step / distance,
        }, colliders, { supports, radius: .31, height: PLAYER.height, stepHeight: .18 });
        const moved = Math.hypot(next.x - guard.position.x, next.z - guard.position.z);
        if (moved > .0005) {
            guard.blockedTime = 0;
            guard.position.set(next.x, guard.floorY, next.z);
            walkAnimation(guard, moved);
        } else {
            guard.blockedTime += dt;
            relaxLimbs(guard, dt);
            if (guard.blockedTime >= .8) {
                guard.waypoint = (guard.waypoint + 1) % guard.route.length;
                guard.blockedTime = 0;
            }
        }
    }

    function resetGuard(guard) {
        guard.position.set(guard.route[0][0], guard.floorY, guard.route[0][1]);
        guard.group.rotation.set(0, routeHeading(guard.route), 0);
        guard.waypoint = 1;
        guard.pause = null;
        guard.look = 0;
        guard.postClock = 0;
        guard.down = false;
        guard.vision.visible = true;
        guard.tag.visible = true;
        guard.exposure = 0;
        guard.blockedTime = 0;
        guard.tracking = false;
        guard.walkPhase = 0;
        guard.weapon.visible = false;
        guard.muzzleFlash.visible = false;
        for (const limb of Object.values(guard.limbs)) limb.rotation.set(0, 0, 0);
        clippedVision(guard);
    }

    function resetPatrols() {
        for (const guard of patrols) resetGuard(guard);
        configurePatrols();
    }

    function takedown(position, direction, clear) {
        for (const guard of patrols) {
            if (!guard.active || guard.down || guard.tracking || Math.abs(position.y - guard.floorY) > .6) continue;
            const dx = position.x - guard.position.x, dz = position.z - guard.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < .16 || distance > 1.42 || (-dx * direction.x - dz * direction.z) / distance < .63) continue;
            const yaw = guard.group.rotation.y;
            if ((-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > -.55) continue;
            const eye = new THREE.Vector3(position.x, position.y + PLAYER.eyeHeight, position.z);
            const target = guard.position.clone().add(new THREE.Vector3(0, 1.38, 0));
            if (!clear(eye, target)) continue;
            guard.down = true;
            guard.exposure = 0;
            guard.vision.visible = false;
            guard.tag.visible = false;
            guard.position.y += .24;
            guard.group.rotation.x = -Math.PI / 2;
            return true;
        }
        return false;
    }

    function triggerFailure(guard, player) {
        if (missionFailed) return;
        missionFailed = true;
        failureElapsed = 0;
        activeGuard = guard;
        if (guard) {
            guard.weapon.visible = true;
            guard.weapon.position.set(.28, 1.08, -.34);
            guard.weapon.rotation.set(-.12, 0, .02);
            guard.flashSeconds = .14;
            guard.muzzleFlash.visible = true;
        }
        if (player?.setEnabled) player.setEnabled(false);
        if (player?.setPosition) player.setPosition(LEVELS[level]?.spawn ?? ENTRANCES[0].spawn, LEVELS[level]?.yaw ?? ENTRANCES[0].yaw, 0);
    }

    let missionFailed = false;
    let sightProgress = 0;
    function update(dt, player) {
        if (disposed) return;
        const step = Math.min(Math.max(dt, 0), .05);
        if (missionFailed) {
            failureElapsed += step;
            if (failureElapsed >= 2.8) {
                missionFailed = false;
                activeGuard = null;
                resetPatrols();
                player?.setEnabled?.(true);
            }
            for (const guard of patrols) {
                if (!guard.active || guard.down) continue;
                if (guard.flashSeconds > 0) {
                    guard.flashSeconds -= step;
                    if (guard.flashSeconds <= 0) guard.muzzleFlash.visible = false;
                }
                clippedVision(guard);
                updateNametag(guard.tag, guard.position, player?.position);
            }
            sightProgress = 0;
            return;
        }

        if (!player?.position) {
            for (const guard of patrols) {
                if (!guard.active || guard.down) continue;
                guard.tracking = false;
                guard.exposure = 0;
                updatePatrol(guard, step);
                clippedVision(guard);
            }
            sightProgress = 0;
            return;
        }
        let highestExposure = 0;
        let spotted = null;
        for (const guard of patrols) {
            if (!guard.active || guard.down) continue;
            if (guard.tracking) trackPlayer(guard, player.position, step);
            else updatePatrol(guard, step);
            clippedVision(guard);
            updateNametag(guard.tag, guard.position, player.position);
            guard.tracking = inVision(guard, player.position);
            if (guard.tracking) {
                guard.exposure += step;
                if (guard.exposure > highestExposure) {
                    highestExposure = guard.exposure;
                    spotted = guard;
                }
                if (guard.exposure >= DETECTION_SECONDS) {
                    triggerFailure(guard, player);
                    break;
                }
            } else {
                guard.exposure = 0;
            }
        }
        sightProgress = Math.min(1, highestExposure / DETECTION_SECONDS);
        activeGuard = spotted;
    }

    return {
        update,
        investigateExit,
        takedown,
        get vaultGuardDown() { return vaultSentry.down; },
        failMission(player) { triggerFailure(null, player); },
        get alert() {
            return sightProgress > 0 ? {
                progress: sightProgress,
                seconds: Math.max(0, DETECTION_SECONDS - (activeGuard?.exposure || 0)),
                guard: activeGuard?.name || 'Basement patrol',
            } : null;
        },
        get missionFailed() { return missionFailed; },
        get patrols() { return patrols; },
        reset: resetPatrols,
        dispose() {
            disposed = true;
        },
    };
}
