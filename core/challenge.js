import * as THREE from '../vendor/three.module.js';
import { PLAYER } from './controller.js';
import { EAST_VAULT } from './layout.js';

const CONTACTS = [
    { name: 'Maya · Maintenance', at: [-5.5, 0, 16.4], yaw: -1.1,
        item: 'Filter', itemAt: [15.1, 0, 14.7], color: '#78dec7', tool: 'paint',
        request: 'Maya: Could you bring me the spare air filter from the east waiting lounge on L1? I can give you spray paint.',
        reminder: 'Maya: The spare filter is in the east waiting lounge on L1.',
        reward: 'Maya: Two sprays, 18 seconds each. Select 4, aim at Vault Watch, and left-click. Talk to me again to shop.' },
    { name: 'Eli · Bank clerk', at: [-4.9, 4.4, 3.1], yaw: -1.45,
        item: 'Badge', itemAt: [8.95, 4.4, 13.8], color: '#c5a9ff', tool: 'knife',
        request: 'Eli: I dropped my badge on the east gallery railing. Bring it back and I’ll give you a ceramic blade.',
        reminder: 'Eli: Follow the L2 gallery east and check by the railing.',
        reward: 'Eli: One quiet takedown. Select 5, get close behind the Vault Sentry, aim at their back, and left-click.' },
];

export const SHOP_STOCK = {
    maya: [
        { id: 'paint', name: 'Paint refill', price: 20, detail: 'Adds one spray charge.' },
        { id: 'buffer', name: 'Camera buffer', price: 30, detail: 'For 35 seconds, cameras take 1.4 seconds longer to catch you.' },
    ],
    noah: [{ id: 'map', name: 'Bank floor plan', price: 35, detail: 'Press M to inspect all three floors and see your position.' }],
};

export function createChallenge({ parent, civilians, colliders, guards, cameras, tripwire, level = 3 }) {
    const items = new THREE.Group();
    items.name = 'Challenge contacts and pickups';
    parent.add(items);
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const ring = new THREE.RingGeometry(.23, .30, 20);
    const ray = new THREE.Ray();
    const bounds = new THREE.Box3();
    const hit = new THREE.Vector3();

    function makePickup(name, at, color, scale) {
        const group = new THREE.Group();
        group.name = name;
        group.position.set(...at);
        items.add(group);
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .3, roughness: .55 });
        const object = new THREE.Mesh(cube, material);
        object.position.y = .57;
        object.scale.set(...scale);
        group.add(object);
        const marker = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = .035;
        group.add(marker);
        return { group, object };
    }

    const quests = (level === 3 ? CONTACTS : []).map(info => ({ ...info,
        actor: civilians.addContact(info.name, info.at, info.yaw),
        pickup: makePickup(info.item, info.itemAt, info.color, info.tool === 'paint' ? [.32, .20, .25] : [.20, .07, .14]),
        state: 'new',
    }));
    const accessCard = makePickup('East reserve access card', [5.15, 0, -5.60], '#fbc96c', [.24, .045, .15]);
    const decoy = makePickup('Central Reserve transfer notice', [0, -4.4, -15.5], '#e5beb0', [.28, .04, .20]);
    const extras = (level === 3 ? [
        ['Cash', [5.6, 0, -13.8], '#8fe3ac', 25], ['Cash', [-5.6, 0, -5.6], '#8fe3ac', 20],
        ['Cash', [5.75, 4.4, -5.6], '#8fe3ac', 25], ['Cash', [-5.65, 4.4, -14.3], '#8fe3ac', 20],
        ['Cash', [-12.0, -4.4, -6.6], '#8fe3ac', 25],
        ['Adrenaline', [9.0, 4.4, 16.2], '#fac26d', 0], ['Adrenaline', [-3.1, -4.4, -7.6], '#fac26d', 0],
        ['Camera buffer', [10.05, -4.4, -3.0], '#7dcdfa', 0], ['Camera buffer', [15.1, 0, 6.1], '#7dcdfa', 0],
    ] : []).map(([name, at, color, value]) => ({ name, value, pickup: makePickup(name, at, color, [.20, .09, .15]) }));
    const noah = level === 3 ? civilians.addContact('Noah · Surveyor', [5.7, 0, 16.4], 1.1) : null;
    const file = level === 1 ? makePickup('Training file', [-9.0, -4.4, -5.6], '#fbc96c', [.25, .08, .18]) : null;
    const extraction = level < 3 ? makePickup('Extraction', level === 1 ? [0, -4.4, .65] : [8.45, -4.4, -5.6], '#9be5c4', [.24, .11, .24]) : null;
    const animatedPickups = [accessCard, decoy, ...quests.map(quest => quest.pickup), ...extras.map(extra => extra.pickup), file, extraction].filter(Boolean);
    const sign = tripwire.signPosition.clone().setY(4.4);
    let keycard = false, copiedCode = '', paint = 0, knife = false, decoySeen = false;
    let cash = 0, hasMap = false, bufferTime = 0, adrenalineTime = 0, shop = '', fileFound = false, trainingPainted = false, completed = false;

    function clear(from, to) {
        const distance = from.distanceTo(to);
        if (distance < .035) return true;
        ray.origin.copy(from);
        ray.direction.subVectors(to, from).divideScalar(distance);
        return !colliders.some(collider => {
            if (collider.enabled === false) return false;
            bounds.min.fromArray(collider.min);
            bounds.max.fromArray(collider.max);
            return ray.intersectBox(bounds, hit) && from.distanceTo(hit) < distance - .055;
        });
    }

    function targeted(position, direction, target, range, aimY) {
        const x = target.x - position.x, z = target.z - position.z;
        const distance = Math.hypot(x, z);
        if (distance > range || Math.abs(target.y - position.y) > .8) return false;
        if (distance > .5 && (direction.x * x + direction.z * z) / distance < .32) return false;
        const eye = new THREE.Vector3(position.x, position.y + PLAYER.eyeHeight, position.z);
        return clear(eye, new THREE.Vector3(target.x, target.y + aimY, target.z));
    }

    function nearby(position, direction) {
        if (level < 3) {
            if (file && !fileFound && targeted(position, direction, file.group.position, 1.6, .55)) return { action: 'file' };
            if ((fileFound || (level === 2 && trainingPainted && guards.vaultGuardDown)) &&
                targeted(position, direction, extraction.group.position, 1.6, .55)) return { action: 'extract' };
            return null;
        }
        if (noah && targeted(position, direction, noah.position, 2.1, 1.2)) return { action: 'mapShop' };
        for (const quest of quests) {
            if (targeted(position, direction, quest.actor.position, 2.1, 1.2)) return { quest, action: 'talk' };
            if (quest.state === 'looking' && targeted(position, direction, quest.pickup.group.position, 1.65, .55)) {
                return { quest, action: 'questItem' };
            }
        }
        if (!keycard && targeted(position, direction, accessCard.group.position, 1.7, .55)) return { action: 'card' };
        if (!copiedCode && targeted(position, direction, sign, 2.4, 2.15)) return { action: 'code' };
        if (!decoySeen && targeted(position, direction, decoy.group.position, 2, .55)) return { action: 'decoy' };
        const extra = extras.find(({ pickup }) => pickup.group.visible && targeted(position, direction, pickup.group.position, 1.5, .55));
        if (extra) return { action: 'extra', extra };
        return null;
    }

    function interact(position, direction) {
        const target = nearby(position, direction);
        if (!target) return '';
        const { quest, action } = target;
        if (action === 'file') { fileFound = true; file.group.visible = false; return 'File secured. Return to the green extraction marker.'; }
        if (action === 'extract') { completed = true; return 'Extraction complete.'; }
        if (action === 'mapShop') { shop = 'noah'; return 'Noah: I sell a floor plan. Offices are a good place to look for cash.'; }
        if (action === 'extra') {
            const { extra } = target;
            extra.pickup.group.visible = false;
            if (extra.value) { cash += extra.value; return `Found $${extra.value}.`; }
            if (extra.name === 'Adrenaline') { adrenalineTime = 15; return 'Adrenaline: faster sprint for 15 seconds.'; }
            bufferTime = 35;
            return 'Camera buffer: extra time to break line of sight for 35 seconds.';
        }
        if (action === 'card') {
            keycard = true;
            accessCard.group.visible = false;
            return 'East Reserve access card acquired.';
        }
        if (action === 'code') {
            copiedCode = tripwire.readCode();
            return `Maintenance code noted: ${copiedCode}.`;
        }
        if (action === 'decoy') {
            decoySeen = true;
            return 'Transfer notice: The jewel has been moved to the East Reserve vault, beyond Vault Administration.';
        }
        if (action === 'questItem') {
            quest.pickup.group.visible = false;
            quest.state = 'return';
            return `Found the ${quest.item.toLowerCase()}. Bring it back to ${quest.name.split(' · ')[0]}.`;
        }
        quest.actor.rotation.y = Math.atan2(quest.actor.position.x - position.x, quest.actor.position.z - position.z);
        if (quest.state === 'new') {
            quest.state = 'looking';
            quest.pickup.group.visible = true;
            return quest.request;
        }
        if (quest.state === 'looking') return quest.reminder;
        if (quest.state === 'return') {
            quest.state = 'done';
            if (quest.tool === 'paint') paint = 2;
            else knife = true;
            return quest.reward;
        }
        if (quest.tool === 'paint') {
            if (paint === 0 && cash < 20) {
                paint = 1;
                return 'Maya: Here’s an emergency spray. Save it for Vault Watch.';
            }
            shop = 'maya';
            return 'Maya: The shop is open. Save a charge for Vault Watch.';
        }
        if (quest.tool === 'knife' && !knife && !guards.vaultGuardDown) {
            knife = true;
            return 'Eli: Here’s a replacement blade. Save it for the Vault Sentry.';
        }
        return `${quest.name.split(' · ')[0]}: Good luck out there.`;
    }

    function buy(id) {
        const item = SHOP_STOCK[shop]?.find(product => product.id === id);
        if (!item) return 'This item is unavailable.';
        if (id === 'map' && hasMap) return 'You already own the floor plan.';
        if (cash < item.price) return 'Not enough cash. Check the offices.';
        cash -= item.price;
        if (id === 'map') hasMap = true;
        if (id === 'paint') paint++;
        if (id === 'buffer') bufferTime = 35;
        return `${item.name} purchased.`;
    }

    function use(slot, position, direction) {
        if (slot === 3 && paint > 0) {
            const target = cameras.spray(position, direction, clear);
            if (!target) return 'Get closer and aim up at an uncovered camera lens.';
            paint--;
            if (level === 2) { trainingPainted = true; return 'Camera covered. Use the blade from behind the sentry, then extract.'; }
            if (target === EAST_VAULT.watchCamera) return 'Vault Watch covered for 18 seconds. Open the vault before it clears.';
            return `Camera covered for 18 seconds. ${paint} spray${paint === 1 ? '' : 's'} left.`;
        }
        if (slot === 4 && knife) {
            const sentryWasUp = !guards.vaultGuardDown;
            if (!guards.takedown(position, direction, clear)) return 'Get close behind an unaware guard and aim at their back.';
            knife = false;
            if (level === 2) return 'Sentry down. Cover the camera if you haven’t, then return to extraction.';
            return sentryWasUp && guards.vaultGuardDown
                ? 'Vault Sentry quietly taken down. Cover Vault Watch before opening the door.' : 'Guard quietly taken down.';
        }
        return 'Select a tool you own with 4 or 5.';
    }

    function reset() {
        keycard = knife = decoySeen = false;
        copiedCode = '';
        paint = level === 2 ? 2 : 0;
        knife = level === 2;
        shop = '';
        cash = bufferTime = adrenalineTime = 0;
        hasMap = fileFound = trainingPainted = completed = false;
        decoy.group.visible = accessCard.group.visible = level === 3;
        if (file) file.group.visible = true;
        for (const extra of extras) extra.pickup.group.visible = true;
        for (const quest of quests) {
            quest.state = 'new';
            quest.pickup.group.visible = false;
        }
    }
    reset();
    return {
        interact, use, reset, buy,
        closeShop() { shop = ''; },
        update(time, dt = 0) {
            bufferTime = Math.max(0, bufferTime - dt);
            adrenalineTime = Math.max(0, adrenalineTime - dt);
            for (const { object } of animatedPickups) {
                object.rotation.y = time * 1.3;
                object.position.y = .55 + Math.sin(time * 2.1) * .07;
            }
        },
        prompt(position, direction) {
            const target = nearby(position, direction);
            if (!target) return '';
            if (target.action === 'file') return 'E · Take the file';
            if (target.action === 'extract') return 'E · Extract';
            if (target.action === 'extra') return `E · Take ${target.extra.name.toLowerCase()}`;
            if (target.action === 'mapShop') return 'E · Browse Noah’s maps';
            if (target.action === 'talk' && target.quest.tool === 'paint' && target.quest.state === 'done') return 'E · Browse Maya’s shop';
            if (target.action === 'talk') return `E · Talk to ${target.quest.name}`;
            if (target.action === 'questItem') return `E · Pick up ${target.quest.item.toLowerCase()}`;
            if (target.action === 'code') return 'E · Note the maintenance code';
            if (target.action === 'decoy') return 'E · Read the transfer notice';
            return 'E · Pick up the East Reserve access card';
        },
        get keycard() { return keycard; }, get copiedCode() { return copiedCode; },
        get gearQuestsComplete() { return quests.every(quest => quest.state === 'done'); },
        get paint() { return paint; }, get knife() { return knife; },
        get cash() { return cash; }, get shop() { return shop; }, get hasMap() { return hasMap; }, get completed() { return completed; },
        get bufferTime() { return bufferTime; }, get adrenalineTime() { return adrenalineTime; },
    };
}
