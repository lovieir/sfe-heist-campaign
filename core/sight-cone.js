import * as THREE from '../vendor/three.module.js';

const TAU = 2 * Math.PI;
export const angleDelta = (target, current) => THREE.MathUtils.euclideanModulo(target - current + Math.PI, TAU) - Math.PI;
export const heading = (dx, dz) => Math.atan2(-dx, -dz);

function rayDistance(x, z, dx, dz, maxDistance, { min, max }) {
    let near = 0, far = maxDistance;
    for (let axis = 0; axis <= 2; axis += 2) {
        const start = axis === 0 ? x : z;
        const direction = axis === 0 ? dx : dz;
        if (Math.abs(direction) < 1e-8) {
            if (start < min[axis] || start > max[axis]) return Infinity;
            continue;
        }
        const a = (min[axis] - start) / direction, b = (max[axis] - start) / direction;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) return Infinity;
    }
    return far > 0 ? near : Infinity;
}

export function createSightCone({ range, halfAngle, height, slices = 40 }) {
    const width = (2 * halfAngle) / slices;
    const edges = Array.from({ length: slices + 1 }, (_, i) => -halfAngle + i * width);
    const local = edges.map(angle => [-Math.sin(angle), -Math.cos(angle)]);
    const limits = new Float64Array(slices);
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array((2 * slices + 1) * 3), 3)
        .setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setIndex(Array.from({ length: slices }, (_, i) => [0, 2 * i + 1, 2 * i + 2]).flat());
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), range);

    return {
        geometry,
        update(x, floor, z, yaw, colliders) {
            const nearby = [];
            for (const collider of colliders) {
                const { min, max } = collider;
                if (collider.enabled === false || max[1] <= floor || min[1] > floor + height) continue;
                const dx = THREE.MathUtils.clamp(x, min[0], max[0]) - x;
                const dz = THREE.MathUtils.clamp(z, min[2], max[2]) - z;
                const distance = Math.hypot(dx, dz);
                if (distance <= range) nearby.push({ collider, distance, angle: angleDelta(heading(dx, dz), yaw) });
            }
            const rayLengths = edges.map(angle => {
                const dx = -Math.sin(yaw + angle), dz = -Math.cos(yaw + angle);
                let distance = range;
                for (const { collider } of nearby) {
                    distance = Math.min(distance, rayDistance(x, z, dx, dz, distance, collider));
                }
                return distance;
            });
            for (let i = 0; i < slices; i++) {
                let distance = Math.min(rayLengths[i], rayLengths[i + 1]);
                // Include obstacles between the two rays so the triangle cannot leak past a corner.
                for (const blocker of nearby) {
                    if (!blocker.distance || (blocker.angle >= edges[i] && blocker.angle <= edges[i + 1])) {
                        distance = Math.min(distance, blocker.distance);
                    }
                }
                limits[i] = distance < range ? Math.max(0, distance - .025) : range;
                positions.setXYZ(2 * i + 1, local[i][0] * limits[i], 0, local[i][1] * limits[i]);
                positions.setXYZ(2 * i + 2, local[i + 1][0] * limits[i], 0, local[i + 1][1] * limits[i]);
            }
            positions.needsUpdate = true;
        },
        contains(dx, dz, yaw) {
            const distance = Math.hypot(dx, dz);
            if (distance < .18 || distance > range) return false;
            const angle = angleDelta(heading(dx, dz), yaw);
            if (Math.abs(angle) > halfAngle) return false;
            const slice = Math.min(slices - 1, Math.floor((angle + halfAngle) / width));
            const chord = limits[slice] * Math.cos(width / 2) / Math.cos(angle - edges[slice] - width / 2);
            return distance <= chord;
        },
    };
}
