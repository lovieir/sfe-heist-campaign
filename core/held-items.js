import * as THREE from '../vendor/three.module.js';

export function createHeldItems(renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10);
    camera.position.z = 3;
    scene.add(new THREE.HemisphereLight(0xffebd4, 0x555e70, 2));
    const light = new THREE.DirectionalLight(0xfff1d7, 2.4);
    light.position.set(-2, 3, 4);
    scene.add(light);

    const hand = new THREE.Group();
    scene.add(hand);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const tube = new THREE.CylinderGeometry(.5, .5, 1, 12);
    const jewel = new THREE.OctahedronGeometry(.5);
    const materials = new Map();
    function part(parent, shape, color, at, size, angles = [0, 0, 0]) {
        if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .65 }));
        const mesh = new THREE.Mesh(shape, materials.get(color));
        mesh.position.set(...at);
        mesh.scale.set(...size);
        mesh.rotation.set(...angles);
        parent.add(mesh);
    }
    part(hand, box, '#293934', [.15, -.21, -.035], [.16, .46, .15], [0, 0, .52]);
    part(hand, box, '#aa7453', [.025, -.047, .035], [.18, .12, .14], [0, 0, .2]);
    part(hand, box, '#c08c69', [-.05, .006, .105], [.072, .079, .056], [0, 0, -.4]);

    const items = Array.from({ length: 5 }, () => {
        const model = new THREE.Group();
        model.rotation.y = -.26;
        hand.add(model);
        return model;
    });
    part(items[0], jewel, '#65e8fc', [-.035, .125, .025], [.27, .29, .24], [.25, .4, -.18]);
    part(items[1], box, '#373436', [0, .045, -.02], [.10, .19, .09], [0, 0, -.2]);
    part(items[1], box, '#e8a735', [-.015, .16, 0], [.30, .13, .15]);
    part(items[1], tube, '#888e91', [-.216, .16, 0], [.056, .14, .056], [0, 0, Math.PI / 2]);
    part(items[2], box, '#d0a753', [-.044, .111, .003], [.20, .123, .022], [0, 0, .12]);
    part(items[2], box, '#343e42', [-.044, .14, .016], [.17, .025, .006]);
    part(items[3], tube, '#c56552', [-.026, .12, -.01], [.14, .255, .14], [0, 0, .13]);
    part(items[3], tube, '#d9dfdc', [-.042, .254, -.01], [.116, .043, .116]);
    part(items[3], box, '#30373b', [-.055, .283, -.01], [.055, .035, .053]);
    part(items[4], box, '#30383b', [-.026, .048, 0], [.073, .16, .063], [0, 0, .24]);
    part(items[4], box, '#e9e5d8', [-.078, .224, 0], [.057, .205, .027], [0, 0, .26]);
    part(items[4], box, '#e9e5d8', [-.109, .337, 0], [.039, .047, .027], [0, 0, .68]);

    return {
        select(slot) {
            hand.visible = slot >= 0;
            items.forEach((item, index) => { item.visible = slot === index; });
        },
        resize(aspect) {
            camera.left = -aspect;
            camera.right = aspect;
            camera.updateProjectionMatrix();
            hand.position.set(aspect - .29, -.67, 0);
        },
        render() {
            if (!hand.visible) return;
            const autoClear = renderer.autoClear;
            renderer.autoClear = false;
            try {
                renderer.clearDepth();
                renderer.render(scene, camera);
            } finally {
                renderer.autoClear = autoClear;
            }
        },
        dispose() {
            for (const geometry of [box, tube, jewel]) geometry.dispose();
            for (const material of materials.values()) material.dispose();
        },
    };
}
