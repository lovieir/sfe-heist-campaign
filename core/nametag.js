import * as THREE from '../vendor/three.module.js';

export function createNametag(name, height, tone = 'civilian') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(140, name.length * 25 + 32);
    canvas.height = 62;
    const context = canvas.getContext('2d');
    context.fillStyle = '#101814';
    context.fillRect(0, 5, canvas.width, 52);
    context.fillStyle = tone === 'guard' ? '#ff8b82' : tone === 'contact' ? '#ecd497' : '#b9c9bf';
    context.fillRect(0, 5, 5, 52);
    context.font = 'bold 36px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, canvas.width / 2 + 2, 32, canvas.width - 28);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    tag.name = `Nametag · ${name}`;
    tag.position.y = height;
    tag.scale.set(.24 * canvas.width / canvas.height, .24, 1);
    return tag;
}

export function updateNametag(tag, actorPosition, viewer) {
    if (!viewer) return;
    const distance = actorPosition.distanceTo(viewer);
    tag.visible = distance < 14;
    tag.material.opacity = THREE.MathUtils.clamp((14 - distance) / 3, 0, 1);
}
