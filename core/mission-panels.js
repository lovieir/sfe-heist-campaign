import { ROOMS, DOORS, ELEVATOR, FLOORS, floorAt } from './layout.js';
import { SHOP_STOCK } from './challenge.js';

export function createMissionPanels({ challenge, player, pause, resume }) {
    const market = document.querySelector('#market-screen');
    const plan = document.querySelector('#floor-plan');
    const stock = document.querySelector('#market-stock');
    const result = document.querySelector('#market-result');
    const closeMarket = document.querySelector('#close-market');
    const closePlan = document.querySelector('#close-plan');
    const floor = document.querySelector('#plan-floor');
    const drawing = document.querySelector('#bank-plan');
    const svg = (name, attrs) => {
        const part = document.createElementNS('http://www.w3.org/2000/svg', name);
        for (const [key, value] of Object.entries(attrs)) part.setAttribute(key, value);
        return part;
    };
    function drawPlan() {
        const selected = floor.value;
        drawing.replaceChildren(svg('rect', { x: -26, y: -19, width: 52, height: 38, fill: '#203129', stroke: '#b09460', 'stroke-width': .2 }));
        for (const room of ROOMS.filter(item => item.floor === selected)) {
            const { min, max } = room.bounds;
            drawing.append(svg('rect', { x: min[0], y: min[2], width: max[0] - min[0], height: max[2] - min[2],
                fill: '#294638', stroke: '#7d977d', 'stroke-width': .15 }));
            const label = svg('text', { x: room.center[0], y: room.center[2], fill: '#e0ddc4', 'text-anchor': 'middle', 'font-size': .62 });
            const words = room.name.split(' ');
            const lines = words.length === 1 ? words : [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')];
            for (const [i, line] of lines.entries()) {
                const row = svg('tspan', { x: room.center[0], dy: i ? .8 : 0 });
                row.textContent = line;
                label.append(row);
            }
            drawing.append(label);
        }
        for (const door of DOORS.filter(item => item.floor === selected)) {
            const [x, , z] = door.position;
            drawing.append(svg('circle', { cx: x, cy: z, r: .25, fill: '#d6d9bb' }));
        }
        const label = svg('text', { x: ELEVATOR.position[0], y: ELEVATOR.position[2], fill: '#ece4bc', 'text-anchor': 'middle', 'font-size': .75 });
        label.textContent = 'Lift';
        drawing.append(label);
        if (floorAt(player.position.y).id === selected) {
            drawing.append(svg('circle', { cx: player.position.x, cy: player.position.z, r: .52, fill: '#ffcf62', stroke: '#171914', 'stroke-width': .15 }));
        }
    }
    function showStock() {
        document.querySelector('#market-title').textContent = challenge.shop === 'maya' ? 'Maya’s supplies' : 'Noah’s survey desk';
        document.querySelector('#market-cash').textContent = `Cash $${challenge.cash}`;
        stock.replaceChildren();
        for (const item of SHOP_STOCK[challenge.shop] ?? []) {
            const row = document.createElement('div');
            row.className = 'stock-row';
            const name = document.createElement('strong');
            name.textContent = item.name;
            const description = document.createElement('p');
            description.textContent = item.detail;
            const button = document.createElement('button');
            button.type = 'button';
            const owned = item.id === 'map' && challenge.hasMap;
            button.disabled = owned;
            button.textContent = owned ? 'Owned' : `Buy · $${item.price}`;
            button.addEventListener('click', () => {
                result.textContent = challenge.buy(item.id);
                showStock();
                closeMarket.focus();
            });
            row.append(name, description, button);
            stock.append(row);
        }
    }
    function close() {
        market.hidden = plan.hidden = true;
        challenge.closeShop();
        resume();
    }
    closeMarket.addEventListener('click', close);
    closePlan.addEventListener('click', close);
    floor.addEventListener('change', drawPlan);
    return {
        get open() { return !market.hidden || !plan.hidden; },
        openMarket() {
            result.textContent = '';
            showStock();
            market.hidden = false;
            pause();
            closeMarket.focus();
        },
        openPlan() {
            if (!challenge.hasMap) return false;
            floor.value = FLOORS.find(item => item.id === floorAt(player.position.y).id).id;
            drawPlan();
            plan.hidden = false;
            pause();
            floor.focus();
            return true;
        },
        close,
    };
}
