// Static game data: fish species, lures and tackle.
'use strict';

// habitats: relative abundance per water kind. kg: [min, typical, max].
// lures: how much each lure appeals. time: activity at dawn/day/dusk/night.
// depth: preferred depth band in metres. wary: how much line visibility matters.
const SPECIES = [
  { id: 'bluegill', name: 'Bluegill', color: '#5f7d5a', belly: '#e9a24b', fin: '#3d4f6a',
    habitats: { pond: 10, lake: 6, river: 1, stream: 0 }, kg: [0.05, 0.25, 0.7],
    power: 1.3, speed: 1.0, jumpy: 0.05, depth: [0.3, 3], wary: 0.2, price: 6,
    time: [1, 1, 1, 0.3], lures: { worm: 1, spinner: 0.45, popper: 0.5, spoon: 0.1, crank: 0.15 } },
  { id: 'perch', name: 'Yellow Perch', color: '#9aa53d', belly: '#f0e3a0', fin: '#e06a2e', stripes: '#3f4a1c',
    habitats: { pond: 4, lake: 8, river: 3, stream: 0 }, kg: [0.1, 0.35, 1.2],
    power: 1.1, speed: 1.0, jumpy: 0.05, depth: [1, 6], wary: 0.3, price: 9,
    time: [1, 1.1, 1, 0.3], lures: { worm: 0.9, spinner: 0.8, spoon: 0.4, crank: 0.35, popper: 0.05 } },
  { id: 'brook', name: 'Brook Trout', color: '#4c5b3c', belly: '#e8743b', fin: '#e8743b', spots: '#f2d36b',
    habitats: { stream: 9, river: 2, lake: 0, pond: 0 }, kg: [0.1, 0.4, 2.0],
    power: 1.4, speed: 1.3, jumpy: 0.35, depth: [0.2, 2], wary: 1, price: 18,
    time: [1.4, 0.9, 1.3, 0.3], lures: { spinner: 1, worm: 0.7, spoon: 0.5, crank: 0.2, popper: 0.15 } },
  { id: 'rainbow', name: 'Rainbow Trout', color: '#6e8a7a', belly: '#f1e6e0', fin: '#c7697a', band: '#d9748a', spots: '#2b2b2b',
    habitats: { stream: 6, river: 6, lake: 2, pond: 0 }, kg: [0.3, 1.2, 5],
    power: 1.5, speed: 1.4, jumpy: 0.85, depth: [0.3, 3], wary: 0.9, price: 16,
    time: [1.3, 1, 1.2, 0.4], lures: { spinner: 1, spoon: 0.8, worm: 0.6, crank: 0.3, popper: 0.2 } },
  { id: 'brown', name: 'Brown Trout', color: '#7a6338', belly: '#e9d39a', fin: '#8a6a3a', spots: '#3a2412',
    habitats: { stream: 4, river: 5, lake: 2, pond: 0 }, kg: [0.4, 1.6, 9],
    power: 1.6, speed: 1.3, jumpy: 0.45, depth: [0.5, 4], wary: 1.2, price: 18,
    time: [1.1, 0.5, 1.5, 1.2], lures: { spinner: 0.8, spoon: 0.7, crank: 0.7, worm: 0.4, popper: 0.25 } },
  { id: 'grayling', name: 'Arctic Grayling', color: '#6d7480', belly: '#d9d6e2', fin: '#6a4ea0', spots: '#2a2a35',
    habitats: { stream: 4, river: 1, lake: 0, pond: 0 }, kg: [0.2, 0.6, 2],
    power: 1.2, speed: 1.2, jumpy: 0.3, depth: [0.2, 2], wary: 0.8, price: 24,
    time: [1, 1.1, 1, 0.2], lures: { spinner: 0.7, worm: 0.6, spoon: 0.3, crank: 0.1, popper: 0.4 } },
  { id: 'smallmouth', name: 'Smallmouth Bass', color: '#7b6a3e', belly: '#ddd2a0', fin: '#6a5a30', stripes: '#4a3a1a',
    habitats: { river: 7, lake: 4, stream: 1, pond: 0 }, kg: [0.3, 1.2, 3.5],
    power: 1.8, speed: 1.2, jumpy: 0.7, depth: [0.5, 5], wary: 0.5, price: 12,
    time: [1.2, 1, 1.2, 0.4], lures: { crank: 1, spinner: 0.8, popper: 0.7, worm: 0.5, spoon: 0.4 } },
  { id: 'largemouth', name: 'Largemouth Bass', color: '#58753c', belly: '#e6e3b5', fin: '#43582c', band: '#2c3a1c',
    habitats: { lake: 7, pond: 7, river: 2, stream: 0 }, kg: [0.4, 2, 6],
    power: 1.7, speed: 1.1, jumpy: 0.6, depth: [0.3, 4], wary: 0.4, price: 12,
    time: [1.5, 0.8, 1.5, 0.5], lures: { popper: 1, crank: 0.9, spinner: 0.7, worm: 0.6, spoon: 0.5 } },
  { id: 'walleye', name: 'Walleye', color: '#8a7f45', belly: '#e9e5c9', fin: '#7a6d38', band: '#4e4523',
    habitats: { lake: 6, river: 4, pond: 0, stream: 0 }, kg: [0.5, 1.6, 6],
    power: 1.2, speed: 1.0, jumpy: 0.05, depth: [2, 9], wary: 0.6, price: 15,
    time: [1.3, 0.5, 1.6, 1.4], lures: { crank: 1, worm: 0.7, spoon: 0.6, spinner: 0.5, popper: 0 } },
  { id: 'pike', name: 'Northern Pike', color: '#4f6a3a', belly: '#e3e6c0', fin: '#a85a32', spots: '#c8d68c',
    habitats: { lake: 6, river: 3, pond: 1, stream: 0 }, kg: [1, 3.5, 14],
    power: 1.9, speed: 1.6, jumpy: 0.35, depth: [0.5, 5], wary: 0.2, price: 9,
    time: [1.1, 1.1, 1.2, 0.4], lures: { spoon: 1, spinner: 0.9, crank: 0.8, popper: 0.5, worm: 0.15 } },
  { id: 'catfish', name: 'Channel Catfish', color: '#5e6670', belly: '#dfe2e6', fin: '#4a5058', spots: '#2a2e33', whiskers: true,
    habitats: { river: 5, lake: 3, pond: 3, stream: 0 }, kg: [0.5, 3, 18],
    power: 1.9, speed: 0.8, jumpy: 0, depth: [1.5, 10], wary: 0.1, price: 8,
    time: [0.6, 0.3, 1.3, 2], lures: { worm: 1, crank: 0.15, spoon: 0.1, spinner: 0.05, popper: 0 } },
  { id: 'carp', name: 'Common Carp', color: '#8b6c34', belly: '#e0c27a', fin: '#a06438', scales: true,
    habitats: { pond: 5, lake: 4, river: 2, stream: 0 }, kg: [1, 4, 20],
    power: 2.1, speed: 0.9, jumpy: 0.03, depth: [0.5, 5], wary: 0.9, price: 4,
    time: [1, 0.8, 1, 0.8], lures: { worm: 0.8, crank: 0.02, spinner: 0.02, spoon: 0, popper: 0 } },
  { id: 'chinook', name: 'Chinook Salmon', color: '#5a6d7c', belly: '#e8e8ea', fin: '#46525c', spots: '#20262c',
    habitats: { river: 2, lake: 0.3, stream: 0.2, pond: 0 }, kg: [3, 8, 26],
    power: 2.2, speed: 1.8, jumpy: 0.5, depth: [1, 6], wary: 0.6, price: 14, rare: true,
    time: [1.3, 0.8, 1.3, 0.5], lures: { spoon: 1, spinner: 0.7, crank: 0.6, worm: 0.2, popper: 0 } },
  { id: 'muskie', name: 'Muskellunge', color: '#7d8455', belly: '#e8e8cc', fin: '#9a5a38', band: '#4c5530',
    habitats: { lake: 1.2, river: 0.3, pond: 0, stream: 0 }, kg: [3, 9, 27],
    power: 2.2, speed: 1.7, jumpy: 0.4, depth: [1, 6], wary: 0.5, price: 20, rare: true,
    time: [1.1, 0.7, 1.4, 0.7], lures: { popper: 0.9, spoon: 0.8, crank: 0.8, spinner: 0.6, worm: 0.05 } },
  { id: 'sturgeon', name: 'Lake Sturgeon', color: '#5b5a52', belly: '#c9c6b5', fin: '#45443d', scutes: true, whiskers: true,
    habitats: { lake: 0.35, river: 0.25, pond: 0, stream: 0 }, kg: [8, 25, 90],
    power: 2.4, speed: 0.9, jumpy: 0.15, depth: [5, 30], wary: 0.3, price: 11, legendary: true,
    time: [0.8, 0.6, 1, 1.2], lures: { worm: 1, crank: 0.05, spoon: 0.05, spinner: 0, popper: 0 } },
  { id: 'silverjaw', name: 'Old Silverjaw', color: '#a8b4bb', belly: '#f4f6f8', fin: '#7e8c94', spots: '#dfe8ee',
    habitats: { lake: 0.12, river: 0, pond: 0, stream: 0 }, kg: [18, 24, 32],
    power: 2.6, speed: 2.0, jumpy: 0.6, depth: [3, 30], wary: 1, price: 60, legendary: true,
    time: [0.3, 0, 0.6, 2.2], lures: { spoon: 1, popper: 0.8, crank: 0.6, spinner: 0.6, worm: 0.2 } },
];
const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

// sink: m/s when idle (negative floats up). Depth behaviour handled in fishing.js.
const LURES = [
  { id: 'spinner', key: '1', name: 'Inline Spinner', price: 15, pack: 1, sink: 0.35, sight: 6, snag: 0.5,
    color: '#d9d9e0', accent: '#e8b33a', tip: 'Steady medium crank (1–3 turns/s) keeps the blade thumping.' },
  { id: 'spoon', key: '2', name: 'Casting Spoon', price: 22, pack: 1, sink: 0.9, sight: 7, snag: 0.8,
    color: '#e8c34a', accent: '#d2412e', tip: 'Crank, pause, crank. Fish hit it fluttering on the drop.' },
  { id: 'crank', key: '3', name: 'Diving Crankbait', price: 30, pack: 1, sink: -0.25, sight: 5, snag: 1.1,
    color: '#6fbf4a', accent: '#f0e14a', tip: 'Floats at rest, dives deeper the faster you crank. Ticks the bottom.' },
  { id: 'popper', key: '4', name: 'Topwater Popper', price: 25, pack: 1, sink: -1, sight: 6, snag: 0.05,
    color: '#f2f0e8', accent: '#d23a3a', tip: 'Let the rings settle, then right-click to pop it. Deadly at dawn and dusk.' },
  { id: 'worm', key: '5', name: 'Worm & Bobber', price: 10, pack: 15, sink: 0, sight: 3.5, snag: 0.1,
    color: '#c95f6f', accent: '#e83a3a', tip: 'Cast and wait. Click when the bobber goes UNDER — not when it twitches.' },
];
const LURE_BY_ID = Object.fromEntries(LURES.map((l) => [l.id, l]));

// cast: max cast distance (m). cushion: absorbs tension spikes. hookset: hook penetration.
const RODS = [
  { id: 'willow', name: 'Willow Spin 1.9m', price: 0, cast: 13, cushion: 0.55, hookset: 0.85, color: '#a8834c' },
  { id: 'graphite', name: 'Graphite Medium 2.3m', price: 220, cast: 18, cushion: 0.75, hookset: 1.0, color: '#3a4652' },
  { id: 'carbon', name: 'Carbon Pro 2.7m', price: 780, cast: 24, cushion: 0.95, hookset: 1.15, color: '#1d1d24' },
];
// gear: line in per handle turn = gear * 0.16 m. maxDrag in kg.
const REELS = [
  { id: 'basic', name: 'Basic Spin 2000', price: 0, gear: 4.6, maxDrag: 4, smooth: 0.6 },
  { id: 'swift', name: 'Swiftline 3000 (6.2:1)', price: 260, gear: 6.2, maxDrag: 7, smooth: 0.8 },
  { id: 'titan', name: 'Titan 5000 (5.4:1)', price: 900, gear: 5.4, maxDrag: 15, smooth: 1 },
];
// strength in kg; vis scales bites for wary fish (lower is stealthier).
const LINES = [
  { id: 'mono3', name: '3 kg Mono', price: 0, strength: 3, vis: 1.0, stretch: 1.0 },
  { id: 'fluoro5', name: '5 kg Fluorocarbon', price: 70, strength: 5, vis: 0.7, stretch: 0.9 },
  { id: 'braid10', name: '10 kg Braid', price: 160, strength: 10, vis: 1.25, stretch: 0.5 },
  { id: 'braid20', name: '20 kg Braid', price: 360, strength: 20, vis: 1.4, stretch: 0.45 },
];

const TIME_NAMES = ['Dawn', 'Day', 'Dusk', 'Night'];
const WEATHERS = [
  { id: 'clear', name: 'Clear', bite: 0.9, light: 1 },
  { id: 'cloudy', name: 'Overcast', bite: 1.15, light: 0.85 },
  { id: 'rain', name: 'Rain', bite: 1.35, light: 0.7 },
];
