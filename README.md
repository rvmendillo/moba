# ❄️ Frostvale Legends — 5v5 MOBA for iPhone

An original 3D 5v5 MOBA in the style of popular mobile MOBAs, built for **iPhone 16 Plus (landscape)**. Three lanes, a jungle with bushes, towers, minion waves, two epic bosses, ten heroes per match, items, battle spells, pets, levels 1–15 and WiFi multiplayer — all set in a sparkling frozen fairy-tale valley under the northern lights.

> Frostvale Legends is a fan-made, original game. Heroes, skills, map art, music and names are all original and are not affiliated with any other game.

![icon](public/icon-512.png)

## Features

| | |
|---|---|
| **Map** | Three lanes (top / mid / bottom), frozen river, jungle walls, frost-grass bushes that hide you, 18 towers + 2 base crystals, fountains |
| **Rules** | Minion waves every 30s (siege minions every 3rd wave), tower protection order, backdoor protection, tower aggro on hero attacks, fog of war, respawn timers, recall & regen, buy items anywhere |
| **Objectives** | 🐢 **Crystal Tortoise** (2:00, river) gives your team gold, EXP and a shield · 👑 **Frost Titan** (8:00) — slay it to summon a Titan Avatar that pushes a lane for you |
| **Jungle** | Azure Owl (cooldown/mana blessing), Ember Stag (burning attacks), wolf & crystal beetle camps |
| **Heroes** | 12 original heroes, 2 per class: Tank, Fighter, Assassin, Mage, Marksman, Support — each with a passive and 3 skills (ultimate at level 4/8/12) |
| **Levels** | Hero level 1 → 15 in every match (skill points each level) · Account level 1 → 15 unlocks legendary items, boots and pets |
| **Items** | 44 items with recipes (components → legendary), 5 boots, jungle & roam items, sell for 60% |
| **Battle spells** | Blink, Mend, Frostbite (jungle), Sprint, Purify, Execute, Aegis |
| **Pets** | 8 companion pets that follow your hero, each with a small bonus |
| **Bots** | 9 AI heroes (Easy / Normal / Hard) that lane, last-hit, jungle, gank, take objectives, team-fight, retreat and push |
| **Multiplayer** | WiFi: iPhone-to-iPhone (Multipeer Connectivity, no server) or a LAN server; host-authoritative, bots fill empty slots |
| **Graphics** | Real-time 3D (WebGL2/Three.js): toon-shaded anime heroes with outlines, aurora sky, snowfall, glittering snow, ice crystals, bloom, shadows, fog of war, 40+ skill effects |
| **Audio** | Fully synthesized sound effects, original procedural music, wind ambience, announcer voice ("First Blood!") |
| **Minimap** | See-through minimap (top-left) with teammates, visible enemies, towers, camps, Tortoise/Titan and timers; drag it to look around |

### Heroes
| Class | Heroes |
|---|---|
| 🛡️ Tank | **Brannoc** the Glacier Warden · **Mamu** the Yeti of the Peaks |
| ⚔️ Fighter | **Kael** the Frostblade · **Valka** the Skyspear Valkyrie |
| 🗡️ Assassin | **Nyra** the Moonfrost Shadow · **Sable** the Snow Leopard Huntress |
| 🔮 Mage | **Lumi** the Aurora Sorceress · **Pyra** the Ember Witch |
| 🏹 Marksman | **Aria** the Windarrow Ranger · **Gideon** the Frost Rifleman |
| ✨ Support | **Elara** the Snow Priestess · **Lyra** the Songweaver |

## 📱 Get it on your iPhone

### Option A — download the IPA built by GitHub Actions
Every push builds the iOS app on a macOS runner (`.github/workflows/ios.yml`).
1. Open the repository's **Actions** tab → **Build iOS app (IPA)** → the latest successful run.
2. Download the **Frostvale-unsigned-ipa** artifact and unzip it to get `Frostvale-unsigned.ipa`.
3. Install it with a sideloading tool that signs it with your own Apple ID:
   - **Sideloadly** (Windows/macOS): drag the IPA in, enter your Apple ID, install. With a free Apple ID the app must be re-signed every 7 days.
   - **AltStore / SideStore**: open the IPA from the Files app via AltStore.
   - With a paid Apple Developer account you can sign it for your device in Xcode or with your usual signing tools.
4. On the iPhone: **Settings → General → VPN & Device Management** → trust your Apple ID, and enable **Developer Mode** (Settings → Privacy & Security) if iOS asks.

### Option B — build and run with Xcode (Mac)
```bash
npm ci
npm run ios:prepare            # builds the game into ios/Frostvale/www
brew install xcodegen
cd ios && xcodegen generate && open Frostvale.xcodeproj
```
Select the **Frostvale** target → *Signing & Capabilities* → choose your Team, plug in your iPhone and press **Run**.

### Option C — play in Safari, no install
```bash
npm ci && npm run build && npm run serve    # serves dist/ on port 8787
```
On the iPhone (same WiFi) open `http://<your-computer-ip>:8787`, then **Share → Add to Home Screen** to play full-screen in landscape. The server prints the address to use.

## 📶 WiFi multiplayer
- **Nearby iPhones** (inside the iOS app): one player taps *WiFi Battle → Host a match*, friends tap *Find & join a match*. Up to 8 players over local WiFi / peer-to-peer; bots fill the remaining slots. iOS asks for *Local Network* permission the first time.
- **LAN Server**: run `npm run serve` on a computer on the same WiFi, then in the game choose *WiFi Battle → LAN Server*, enter the address it prints (e.g. `192.168.1.10:8787`) and a room name. One player hosts, others join. Works from the iOS app and from Safari.

The host runs the authoritative simulation; clients send their joystick/skill inputs and receive ~15 snapshots per second. Tap a player in the lobby to switch their team.

## 🎮 Controls
- **Left thumb**: floating joystick to move.
- **Right thumb**: ⚔️ basic attack (hold to keep attacking; it auto-targets heroes first). The small 🐺 / 🏰 buttons focus minions or towers.
- **Skills**: tap to auto-aim at the nearest enemy, or **drag** to aim (line, area or target indicators appear on the ground). Release over **CANCEL** to cancel.
- **Battle spell** (left of the skills), **🏠 Recall** (back to base), **💚 Regen** (heal over time).
- **+** above a skill upgrades it (or turn on *Auto-upgrade skills* in Settings).
- **🛍️ Shop** (left) with a one-tap *quick buy* for the next recommended item; buy anywhere.
- **📊** scoreboard, **⚙️** settings / surrender.
- Keyboard (desktop testing): WASD move, Space attack, 1/2/3 skills, F spell, B recall, P shop.

## ⚙️ Settings
Graphics quality (Low / Medium / High / Ultra, with automatic resolution scaling), music & sound volume, announcer voice, camera distance, auto-upgrade skills, haptics, FPS counter, bot difficulty, and a sandbox switch to unlock all items & pets.

## 🛠️ Development
```bash
npm ci
npm run build          # dist/index.html + game.js + style.css  (add -- --single for one self-contained HTML)
npm run serve          # LAN server + static hosting on :8787
npm run simtest        # headless 10-bot full match (balance / AI regression test)
```

```
src/
  sim/        authoritative simulation: map + nav grid (A*), world tick, combat, buffs, vision, bot AI
  data/       heroes & skills, items & recipes, spells, pets, minion/tower/monster stats
  render/     Three.js renderer: environment, procedural hero/creature models, animation, FX, overlay
  ui/         HUD (touch controls), minimap, menus, hero select, shop, icons
  game/       match session (local / host / client), client-side interpolation, profile & progression
  audio/      WebAudio synthesizer: SFX, procedural music, announcer
  net/        WiFi transports (Multipeer bridge, WebSocket relay)
server/relay.js   LAN relay + static server
ios/              native iOS wrapper (Swift, WKWebView, Multipeer Connectivity, haptics) — XcodeGen project.yml
tools/            headless tests (simulation, screenshots, multiplayer)
```

All models, textures, icons frames, music and sound effects are generated procedurally at runtime — there are no third-party art or audio assets.
