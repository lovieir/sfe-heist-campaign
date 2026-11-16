import { FLOORS, isOutside } from './layout.js';

const messages = {
    approach: 'Hey, I’m here. Get inside and I’ll talk you through it.',
    bank: 'Talk to Maya in the L1 lobby and Eli on the L2 gallery. You need both of their tools, the L1 Operations access card, and the L2 maintenance code.',
    basement: 'You made it to B1. Watch the patrol beams. Check the transfer notice in Central Reserve if you’re unsure which vault holds the jewel.',
    alarm: 'The tripwire is live. Use the console beside the East Reserve door. If you recorded the L2 code, it’ll show in the keypad window.',
    disarmed: 'Tripwire down. Take out the Vault Sentry, spray the camera marked Vault Watch, then open the door while it’s covered.',
    riddle: 'You made it into the vault. Think through the riddle before you submit an answer.',
    treasure: 'You solved it! The jewel is out on the pedestal now.',
    jewel: 'You grabbed the jewel. The exits just locked, so we’ll need a drill.',
    drill: 'You found the drill. Take it to a locked exit.',
    drilling: 'The drill’s loud. A guard is coming to check it. Step out of sight until the exit opens.',
    exit: 'You drilled through the lock! Get outside with the jewel.',
    escaped: 'You made it out with the jewel. Nice work!',
};

const hints = {
    approach: { after: 22, text: ['Try the main doors at the top of the front steps. Face a door and press E to open it.'] },
    bank: { after: 30, text: [
        'The Operations office is east of the L1 lift. On L2, look for the sign by the east offices and press E to record the code.',
        'Finish Maya and Eli’s jobs before taking the lift to B1. You’ll need their spray paint and blade at the vault.',
    ] },
    basement: { after: 22, text: ['The jewel was moved. From the rear lift landing, take the east door marked Vault Administration, then go to East Reserve.'] },
    alarm: { after: 8, text: ['Look for the lit console to the right of the round door. Type the code exactly as written, including the symbols.'] },
    disarmed: { after: 18, text: [world => world.vaultBlocker() || 'Face the East Reserve door and press E. Give it room to swing.'] },
    riddle: { after: 14, text: [
        world => world.vaultRiddle.hint,
        'If you closed the riddle, press E near the pedestal to reopen it. You have three attempts in total.',
    ] },
    treasure: { after: 20, text: ['Walk up to the jewel and press E. Solving the riddle reveals it, but you still have to pick it up.'] },
    jewel: { after: 26, text: [
        'Get back to L1. The drill is in Member Services.',
        'Look for Member Services on the west side of the L1 lift corridor. Go inside and press E near the drill.',
    ] },
    drill: { after: 22, text: ['Walk up to any locked exterior exit and press E to start drilling.'] },
    exit: { after: 20, text: ['Walk through the exit you drilled and keep going until you’re outside.'] },
};

export function createJonathan({ world, player, send }) {
    let entered = false;
    let reachedBasement = false;
    let stage = 'approach';
    let elapsed = 0;
    let nextHint = 0;
    const announced = new Set([stage]);
    send(messages.approach);

    function missionStage() {
        if (world.escape.escaped) return 'escaped';
        if (world.escape.exitDrilled) return 'exit';
        if (world.escape.drillingSeconds !== null) return 'drilling';
        if (world.escape.drillCollected) return 'drill';
        if (world.vaultLoot.jewelCollected) return 'jewel';
        if (world.vaultRiddle.solved) return 'treasure';
        if (world.vaultRiddle.active) return 'riddle';
        if (world.tripwire.disarmed) return 'disarmed';
        if (world.tripwire.active) return 'alarm';
        if (reachedBasement) return 'basement';
        return entered ? 'bank' : 'approach';
    }

    return {
        update(dt, allowHints) {
            if (world.guards.missionFailed) {
                if (stage !== 'failed') {
                    stage = 'failed';
                    entered = reachedBasement = false;
                    announced.clear();
                    announced.add('approach');
                    send('We’re back at the entrance. Take a breath and try again.');
                }
                return;
            }

            entered ||= !isOutside(player.position);
            reachedBasement ||= entered && !world.lift.moving && Math.abs(player.position.y - FLOORS[0].y) < .24;
            const nextStage = missionStage();
            if (nextStage !== stage) {
                stage = nextStage;
                elapsed = nextHint = 0;
                if (!announced.has(stage)) {
                    announced.add(stage);
                    send(messages[stage]);
                }
                return;
            }

            const hint = hints[stage];
            if (!allowHints || !hint || nextHint >= hint.text.length) return;
            elapsed += dt;
            if (elapsed < hint.after) return;
            const text = hint.text[nextHint++];
            send(typeof text === 'function' ? text(world) : text);
            elapsed = 0;
        },
    };
}
