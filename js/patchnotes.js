// Patch notes, newest first. The first entry is the current build (shown on the title screen).
'use strict';

const PATCH_NOTES = [
  { v: '1.5', name: 'Hard Time', date: '30 Oct 2026', notes: [
    ['new', 'Sentences fit the crime: days for a scuffle, weeks or months for a rampage, and years for knocking out cops and blowing things up at five stars'],
    ['new', 'The township decays over time: graffiti, boarded-up windows and doors, caved-in roofs, rubbish everywhere, and fewer bikers about. A long stretch inside makes it much worse'],
    ['new', 'Fix up run-down buildings for a council payout, and bin rubbish for spare change'],
    ['new', 'Long sentences end with a "While you were inside…" report on the state of the town'],
    ['fixed', 'Your wanted level now always clears when you are busted (including by wardens) or black out'],
  ] },
  { v: '1.4', name: 'Pocket Valley', date: '30 Oct 2026', notes: [
    ['changed', 'Mobile overhaul: the menu buttons are a compact icon column under your vitals, so nothing covers the top of the screen'],
    ['changed', 'Mobile: tap the minimap to open the big map, and tap outside it to close'],
    ['changed', 'Mobile: smaller toasts, no keyboard hints, and the HUD respects phone notches'],
    ['changed', 'Mobile: sharper performance on high-density screens'],
    ['fixed', 'Mobile: the lockpick panel fits on screen, and the touch buttons hide while the big map is open'],
  ] },
  { v: '1.3', name: 'Hot Wired', date: '29 Oct 2026', notes: [
    ['changed', 'Poison hits harder: damage over time, blurred and colour-shifting vision, a woozy camera, staggering, slower legs, waves of nausea, and hallucinations that whisper and vanish when you get close'],
    ['changed', 'Poisons ease in and each acts differently. Snake venom hits within seconds. Death caps creep up over a minute, then turn deadly. Fly agarics are mild but make you see things'],
    ['changed', 'Gunfire hits harder: a layered crack-and-boom with an echo off the hills, a muzzle flash that lights things up, bright tracer beams, dust or spray where rounds land, and screen kick'],
    ['new', 'Everyone talks now, in gibberish. Each local has their own voice, and shouting comes out faster and higher'],
    ['fixed', 'Screen shake (explosions, bites, crashes) actually shakes the screen'],
    ['fixed', 'Getting released from jail no longer drops you into an empty blue void (worst when arrested on a bike). Stolen rides get impounded'],
    ['new', 'Stealing a ride is now a lockpicking job: three random lock puzzles (pins, latches and a dial) against a rising alert meter'],
    ['changed', 'The alert climbs faster with the owner or the law nearby (crouch to stay calmer). Hit 100% and the owner comes for you with a wanted star'],
    ['changed', 'Finish quietly and nobody sees. The owner only notices their ride is gone after you leave'],
  ] },
  { v: '1.2', name: 'Wild Things', date: '29 Oct 2026', notes: [
    ['changed', 'Black out at zero health and wake up in the clinic: Nurse Ngaio tells you what hurt you most, the final blow, and the bill'],
    ['new', 'Rolling hills across the backcountry: climb them for a view, ride them for air'],
    ['new', 'Forage mushrooms in the forest and meadows. Some are delicious, some are deadly, and the deadly white ones look a lot like the tasty white ones'],
    ['new', 'Snakes in the forest. A bite poisons you (crouch-walk past them to improve your odds)'],
    ['new', 'Valley Clinic on the main street: Nurse Ngaio heals you and flushes out poison, for a fee'],
    ['new', 'Ducks paddling about on the lakes and ponds. They take off if you charge at them'],
    ['new', 'NPC hunters in hi-vis stalking deer and boar (and entering the hunting derby)'],
    ['new', 'Big houses: roomy two-bed places to rent, and some locals live in them too'],
    ['changed', 'Cottage rent is cheaper ($15 to $30 a day)'],
    ['changed', 'Locals pop home during the day, then walk out the front door to their next fishing spot'],
  ] },
  { v: '1.1', name: 'Here Be Monsters', date: '29 Oct 2026', notes: [
    ['new', 'Urban legend fish: the Bunyip, the Taniwha Eel and the Dam Monster Carp. Watch for a huge silhouette sliding past'],
    ['new', 'Leviathan Heavy rod and 60 kg Diamond Braid at Hettie\'s. Without both, a legend snaps you off in seconds'],
    ['new', 'Shoot bikes and go-karts: they smoke, catch fire, then blow up (and set off anything parked nearby)'],
    ['new', 'Ammo count and reload ring at your cursor while a gun is out'],
    ['changed', 'Steal someone\'s ride and they come after you, with fists or a pistol'],
    ['changed', 'Bikers and kart drivers ride to real places (town, bridges, lakes, cottages) and stop when they get there'],
    ['changed', 'The controls panel in the top left is gone. The action bar and prompts cover it'],
  ] },
  { v: '1.0', name: 'Weekend Warriors', date: '29 Oct 2026', notes: [
    ['new', 'Weekend contests: alternate fishing and hunting weekends. Enter with Tim, heaviest catch from Saturday dawn to Monday dawn wins cash and a trophy'],
    ['new', 'Go-karts: the Go-Kart 90 and Racer Kart, sold by Revs alongside the dirt bikes'],
    ['new', 'Number plates and rider permits for every ride. Fuelling a stolen ride sets off the pump camera, and wardens check plates on sight'],
    ['new', 'Wind sock beside the minimap, showing which way and how hard it\'s blowing'],
    ['new', 'Sleep in your rented cottage to skip to the next morning'],
    ['changed', 'Wanted stars are now a big banner at the top of the screen'],
    ['changed', 'Riders and drivers keep both hands on the bars or the wheel'],
    ['changed', 'Sunbathers are fully au naturel (censored), and sunbathers and swimmers carry their gear home when they leave the water'],
    ['changed', 'The clock now shows the day of the week'],
  ] },
  { v: '0.9', name: 'Into the Woods', date: '29 Oct 2026', notes: [
    ['new', 'Axe (key 5): fell trees for firewood. They grow back after a week'],
    ['new', 'Campfires: build one anywhere to cook, rest by and feed with logs. Rain puts them out faster'],
    ['new', 'Mobile support: landscape fullscreen with a thumbstick, touch buttons and a phone-sized HUD'],
    ['new', 'Add to Home Screen for a full-screen app on phones'],
  ] },
  { v: '0.8', name: 'Arms Race', date: '28 Oct 2026', notes: [
    ['new', 'Pistol and pump shotgun at Hettie\'s; SMG and rocket launcher under Dusty\'s counter'],
    ['new', 'Each gun has its own model and ammo. Press 2 again to cycle through the guns you own'],
    ['fixed', 'Houses, shops and camps no longer generate in (or right on the edge of) water'],
  ] },
  { v: '0.7', name: 'Grand Trout Auto', date: '28 Oct 2026', notes: [
    ['new', 'Wanted levels: police, then the army. Hide in bushes or crouch in the forest to lose them'],
    ['new', 'Health, food and energy bars. Punch with empty hands'],
    ['new', 'Gas station with pumps. Bikes need fuel, and the local bikers stop to gas up and take smoko'],
    ['new', 'Steal parked dirt bikes, and walk into unlocked houses'],
    ['changed', 'Renamed to Grand Trout Auto VI (Early Access)'],
    ['changed', 'Your arm follows the fishing rod. Mozzies stay home when it rains'],
  ] },
  { v: '0.6', name: 'Braaap', date: '28 Oct 2026', notes: [
    ['new', 'Dirt bikes to buy and ride, plus local trail riders'],
    ['new', 'Original country-style theme tune on the main menu'],
    ['changed', 'The whole world is redrawn as a flat, ink-outlined cartoon, with real 3D trees, people and animals'],
    ['changed', 'A proper cartoon title screen'],
    ['fixed', 'Bridges now always run land to land, some with hand rails'],
    ['fixed', 'The droning "portal" sound near buildings (it was a bike engine)'],
  ] },
  { v: '0.5', name: 'Small Town Life', date: '28 Oct 2026', notes: [
    ['new', 'Enterable shops with their keepers inside, laid out along a main street with door rings and signs'],
    ['new', 'Rent a cottage, store your gear, cook your catch and keep fed'],
    ['new', 'Quick travel, NPC homes, and anglers who brawl over stolen spots'],
    ['new', 'Tim the guide, swimmers, fair-weather beachgoers and some… busy bushes'],
    ['changed', 'The dodge roll is now a slide (crouch while running)'],
    ['fixed', 'Squeeze past trees instead of getting stuck, and quieter mosquitoes'],
  ] },
  { v: '0.4', name: 'Law of the Lake', date: '28 Oct 2026', notes: [
    ['new', 'Area fishing permits from Ranger Dale, patrolling wardens, size limits and jail'],
    ['new', 'The reel is a real control: grab it and wind, with tension, drag and bail gauges'],
    ['changed', 'The shotgun is now a scoped hunting rifle. Tools sit in your hands'],
    ['changed', 'Polished HUD and title screen, with round cartoon characters'],
  ] },
  { v: '0.3', name: 'Unsporting Conduct', date: '28 Oct 2026', notes: [
    ['new', 'A gun for "fishing", and biting bugs to swat'],
    ['new', 'Sunbathers drifting about on lilos'],
    ['new', 'Wading, wider footbridges, and deer and boar to hunt'],
    ['new', 'Jump, crouch and an action bar for your tools'],
  ] },
  { v: '0.2', name: 'Tall Tales', date: '28 Oct 2026', notes: [
    ['new', 'NPC anglers who really catch fish and tell you it was THIS big'],
    ['new', 'Prized golden fish with a shareable catch photo'],
    ['changed', 'Simpler mouse-first controls. No walking while your line is out'],
  ] },
  { v: '0.1', name: 'First Cast', date: '28 Oct 2026', notes: [
    ['new', 'A big open valley of rivers, streams and lakes to explore in 2.5D'],
    ['new', 'Hands-on fishing: cast, work the lure, set the hook and fight the fish'],
  ] },
];

const PatchNotes = {
  current() { return PATCH_NOTES[0]; },
  html() {
    const tag = { new: 'New', changed: 'Changed', fixed: 'Fixed' };
    return PATCH_NOTES.map((p, i) => `
      <article class="pn${i === 0 ? ' pn-cur' : ''}">
        <header><span class="pn-v">v${p.v}</span><b>${p.name}</b>${i === 0 ? '<span class="pn-badge">Current</span>' : ''}<span class="pn-date">${p.date}</span></header>
        <ul>${p.notes.map(([k, t]) => `<li><span class="pn-tag pn-${k}">${tag[k]}</span><span>${t}</span></li>`).join('')}</ul>
      </article>`).join('');
  },
};
