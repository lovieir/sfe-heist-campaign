# SFE Heist · Foundry National Bank

An independent challenge build of the Foundry National Bank map. Get inside, follow Jonathan’s messages, and escape with the jewel. The map uses bundled Three.js and assets, so no package installation is required.

[Play the campaign](https://sfe-heist-cloudflare.heist-game-lab.workers.dev/) or [jump straight to East Reserve](https://sfe-heist-cloudflare.heist-game-lab.workers.dev/?level=3).

Built from the [SFE Foundry hackathon starter map](https://github.com/karamvschool-ai/sfe-heist-hackathon-map).

## Run locally

From this folder, run `node tools/serve.mjs` with Node.js 20 or newer. Keep the terminal open and visit [the mission menu at 127.0.0.1:4175](http://127.0.0.1:4175/) in a desktop browser with WebGL 2. All missions are available immediately. The port can be overridden with `PORT`.

| Control | Action |
| --- | --- |
| Click the game | Capture the mouse |
| WASD or arrow keys | Walk |
| Shift | Sprint |
| Space | Jump. Hold to jump again each time you land. |
| E | Talk, pick up an item, use a console, or open a door |
| 1 / 2 / 3 inside the lift | Choose B1 / L1 / L2 |
| 4 / 5 outside the lift | Select paint / ceramic blade after earning them |
| Left-click while aiming | Use the selected spray or ceramic blade |
| P | Pause and adjust mouse sensitivity or field of view |
| M | Inspect the floor plan after buying it from Noah in East Reserve |
| Escape | Release the mouse or close the current panel |

## Missions

1. **First Break-In:** Dodge a guard and a camera, grab a file in the west antechamber, and return to extraction.
2. **Tools of the Trade:** Use the supplied spray and blade on Vault Watch and the sentry, then return to extraction.
3. **East Reserve:** The full mission, with quests and shops. Use the route below.

- Finish Maya’s job in the L1 lobby and Eli’s job on the L2 gallery to get paint and a ceramic blade. Pick up the East Reserve access card in L1 Operations and record the L2 maintenance code with **E**.
- On B1, follow the clues to the real vault and use the override console when the tripwire triggers. Approach the Vault Sentry from behind and use the blade. Spray the camera marked **Vault Watch**, then open the vault while the lens is covered.
- Solve the vault riddle, retrieve the jewel and find the drill in Member Services on L1. The drill takes seven seconds and brings a guard to investigate. Get out of sight and escape through the opened exit.

Look for cash in offices. Completing Maya’s quest unlocks her shop. Noah sells a floor plan in the L1 lobby. Adrenaline pickups boost sprint speed, and camera buffers give you extra time to get out of a camera’s sweep.

Vault Watch stays covered for 18 seconds. After the first opening, the security interlock stays released for that attempt. Return to Maya for more paint if both sprays are spent, or to Eli for another blade if the Vault Sentry is still up.

## Source

- `walkthrough.js` connects controls, panels, and inventory to the game world.
- `core/challenge.js` handles contacts, pickups and tools. `core/tripwire.js` generates codes and manages the alarm. `core/world.js` ties them to the vault and escape.
- See the [room and door registry](ROOMS.md), [machine-readable layout](assets/registry.json), [asset credits](assets/SOURCES.md), and [bundled Three.js license](vendor/THREE-LICENSE.txt).

Run `node --test tests/*.test.mjs` to check navigation, doors, security and challenge interactions.
