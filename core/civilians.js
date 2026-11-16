import * as THREE from '../vendor/three.module.js';
import { groundHeight, overlapsCollider } from './controller.js';
import { FLOORS } from './layout.js';
import { createNametag, updateNametag } from './nametag.js';

const radius = .4;
const height = 1.98;
const corridorAreas = [
    { x: [-24, -4], z: [-.85, .85], count: 1 },
    { x: [4, 24], z: [-.85, .85], count: 1 },
];
const walkingAreas = {
    L1: [
        { x: [-7.8, 7.8], z: [8, 18], count: 3 },
        ...corridorAreas,
    ],
    L2: [
        { x: [-7.2, 7.2], z: [2.35, 3.55], count: 2 },
        { x: [-9.42, -8.6], z: [5, 17.5], count: 1 },
        { x: [8.6, 9.42], z: [5, 17.5], count: 1 },
        ...corridorAreas,
    ],
};
const clothes = ['#943f44', '#5d6743', '#45688b', '#94612f', '#654c75', '#486b6b',
    '#a17e65', '#9a6673', '#4b4d75', '#785552', '#53737e'];
const trousers = ['#29292d', '#383e53', '#6c604d', '#484650'];
const skinTones = ['#f1bf9e', '#d49a72', '#b87955', '#8d563c', '#633d32'];
const hairColors = ['#241d1b', '#4a2f26', '#b27a40', '#535056'];
const civilianNames = ['Alex', 'Nora', 'Jordan', 'Sam', 'Priya', 'Mateo', 'Robin', 'Zoe', 'Avery', 'Hana', 'Luis'];
const between = (min, max) => min + (max - min) * Math.random();
const pick = items => items[Math.floor(Math.random() * items.length)];

export function createCivilianSystem({ parent, colliders, supports }) {
    const root = new THREE.Group();
    root.name = 'Bank civilians';
    parent.add(root);

    const box = new THREE.BoxGeometry(1, 1, 1);
    const sphere = new THREE.SphereGeometry(1, 12, 8);
    const materials = new Map();
    const people = [];
    const availableClothes = [...clothes];

    function part(group, geometry, color, position, scale) {
        if (!materials.has(color)) {
            materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .88 }));
        }
        const mesh = new THREE.Mesh(geometry, materials.get(color));
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        group.add(mesh);
        return mesh;
    }

    function makePerson(position, name, label, tone) {
        const model = new THREE.Group();
        model.name = name;
        model.position.copy(position);
        model.rotation.y = between(-Math.PI, Math.PI);
        model.scale.set(between(.88, 1.06), between(.9, 1.08), between(.9, 1.05));
        root.add(model);
        const tag = createNametag(label, 1.9, tone);
        model.add(tag);

        const [shirt = pick(clothes)] = availableClothes.splice(Math.floor(Math.random() * availableClothes.length), 1);
        const pants = pick(trousers);
        const skin = pick(skinTones);
        const hair = pick(hairColors);
        const shoes = '#282320';
        const style = pick(['short hair', 'long hair', 'bun', 'cap']);
        const outfit = pick(['sweater', 'jacket', 'cardigan']);
        part(model, box, shirt, [0, 1.01, 0], [.44, .55, .27]);
        part(model, sphere, skin, [0, 1.3, 0], [.08, .1, .08]);
        part(model, sphere, skin, [0, 1.5, 0], [.145, .178, .137]);
        part(model, sphere, skin, [0, 1.48, -.126], [.026, .031, .035]);
        part(model, sphere, hair, [0, 1.602, .025], [.15, .103, .137]);
        if (style === 'long hair') part(model, sphere, hair, [0, 1.46, .083], [.148, .20, .082]);
        if (style === 'bun') part(model, sphere, hair, [0, 1.63, .126], [.082, .086, .078]);
        if (style === 'cap') {
            part(model, sphere, shirt, [0, 1.63, .012], [.161, .094, .15]);
            part(model, box, shirt, [0, 1.608, -.121], [.22, .023, .16]);
        }
        if (outfit !== 'sweater') {
            part(model, box, outfit === 'jacket' ? '#ddd4c0' : '#4d3e39',
                [0, 1.061, -.137], [outfit === 'jacket' ? .135 : .038, .428, .02]);
        }

        const legs = [], arms = [];
        for (const side of [-1, 1]) {
            part(model, sphere, shoes, [side * .052, 1.526, -.122], [.015, .014, .012]);
            const leg = new THREE.Group();
            leg.position.set(side * .116, .755, 0);
            model.add(leg);
            part(leg, box, pants, [0, -.33, 0], [.176, .664, .18]);
            part(leg, box, shoes, [0, -.698, -.04], [.18, .11, .28]);
            legs.push(leg);

            const arm = new THREE.Group();
            arm.position.set(side * .262, 1.23, 0);
            arm.rotation.z = side * .065;
            model.add(arm);
            part(arm, box, shirt, [0, -.215, 0], [.115, .47, .133]);
            part(arm, sphere, skin, [0, -.477, 0], [.058, .082, .064]);
            arms.push(arm);
        }
        return { model, tag, legs, arms, speed: between(.78, 1.36), phase: 0, stride: 0,
            target: null, wait: between(.1, 1.4) };
    }

    function randomPoint(area, y) {
        return new THREE.Vector3(between(...area.x), y, between(...area.z));
    }

    const candidate = new THREE.Vector3();
    function canStand(point, area) {
        return groundHeight(point, area.supports, 0) !== null &&
            !area.colliders.some(collider => overlapsCollider(point, collider, radius, height));
    }

    function isClearOfPeople(point, person) {
        return people.every(other => other === person || other.model.position.y !== point.y ||
            other.model.position.distanceToSquared(point) >= .72 ** 2);
    }

    for (const floor of FLOORS.filter(floor => walkingAreas[floor.id])) {
        for (const bounds of walkingAreas[floor.id]) {
            const area = { ...bounds,
                supports: supports.filter(surface => surface.y === floor.y && surface.id !== 'elevator-car'),
                colliders: colliders.filter(({ min, max }) => max[1] > floor.y && min[1] < floor.y + height &&
                    max[0] >= bounds.x[0] - radius && min[0] <= bounds.x[1] + radius &&
                    max[2] >= bounds.z[0] - radius && min[2] <= bounds.z[1] + radius),
            };
            for (let i = 0; i < area.count; i++) {
                for (let attempt = 0; attempt < 60; attempt++) {
                    const position = randomPoint(area, floor.y);
                    if (!canStand(position, area) || !isClearOfPeople(position)) continue;
                    people.push({ ...makePerson(position, `${floor.id} civilian ${people.length + 1}`, civilianNames[people.length]), area });
                    break;
                }
            }
        }
    }

    function chooseTarget(person) {
        const { area, model: { position } } = person;
        for (let attempt = 0; attempt < 18; attempt++) {
            const target = randomPoint(area, position.y);
            const distance = target.distanceTo(position);
            if (distance < 1.35 || distance > 8 || !isClearOfPeople(target, person)) continue;
            const steps = Math.ceil(distance / .16);
            let clear = true;
            // Sample the whole route so a valid destination across a wall is rejected.
            for (let i = 1; i <= steps; i++) {
                if (canStand(candidate.lerpVectors(position, target, i / steps), area)) continue;
                clear = false;
                break;
            }
            if (clear) return target;
        }
        return null;
    }

    return {
        addContact(name, position, yaw) {
            const contact = makePerson(new THREE.Vector3(...position), name, name.split(' · ')[0], 'contact');
            contact.model.rotation.y = yaw;
            people.push({ ...contact, stationary: true });
            return contact.model;
        },
        update(dt, viewer) {
            const step = Math.min(dt, .05);
            if (!(step > 0)) return;
            for (const person of people) {
                updateNametag(person.tag, person.model.position, viewer);
                if (person.stationary) continue;
                const { model, area } = person;
                let walked = 0;
                if (person.target) {
                    const dx = person.target.x - model.position.x;
                    const dz = person.target.z - model.position.z;
                    const distance = Math.hypot(dx, dz);
                    const heading = Math.atan2(-dx, -dz);
                    const angle = THREE.MathUtils.euclideanModulo(heading - model.rotation.y + Math.PI, 2 * Math.PI) - Math.PI;
                    model.rotation.y += THREE.MathUtils.clamp(angle, -5 * step, 5 * step);
                    if (Math.abs(angle) < .5) {
                        const stride = Math.min(distance, person.speed * step);
                        candidate.copy(model.position).lerp(person.target, stride / distance);
                        if (canStand(candidate, area) && isClearOfPeople(candidate, person)) {
                            model.position.copy(candidate);
                            walked = stride;
                        }
                        if (!walked || stride === distance) {
                            person.target = null;
                            person.wait = walked ? between(.55, 2.7) : between(.2, .7);
                        }
                    }
                } else {
                    person.wait -= step;
                    if (person.wait <= 0) {
                        person.target = chooseTarget(person);
                        person.wait = between(.3, .8);
                    }
                }

                person.phase += walked * 8.5;
                person.stride = THREE.MathUtils.damp(person.stride, walked ? 1 : 0, 9, step);
                const swing = Math.sin(person.phase) * person.stride * .38;
                for (let i = 0; i < 2; i++) {
                    const direction = i === 0 ? 1 : -1;
                    person.legs[i].rotation.x = direction * swing;
                    person.arms[i].rotation.x = -direction * swing * .7;
                }
            }
        },
    };
}
