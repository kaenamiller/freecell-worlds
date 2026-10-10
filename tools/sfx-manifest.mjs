// ElevenLabs sound-effect prompts. Output: assets/sfx/<id>.mp3
const CLEAN = ', close microphone, dry, no music, no voices, clean isolated sound effect';

export const SHARED = [
  ...[1, 2, 3].map((n) => ({ id: `pickup_${n}`, dur: 0.6, text: 'a single playing card being picked up quickly from a felt table, soft paper rustle' + CLEAN })),
  ...[1, 2, 3, 4].map((n) => ({ id: `place_${n}`, dur: 0.6, text: 'a single playing card laid down onto a felt table, soft satisfying paper thwap' + CLEAN })),
  ...[1, 2].map((n) => ({ id: `slide_${n}`, dur: 0.9, text: 'a playing card sliding across a felt table surface, brief soft swish' + CLEAN })),
  ...[1, 2, 3].map((n) => ({ id: `deal_${n}`, dur: 0.5, text: 'a playing card flicked quickly onto a table by a dealer, crisp short snap and slide' + CLEAN })),
  ...[1, 2].map((n) => ({ id: `flip_${n}`, dur: 0.6, text: 'a playing card being flipped over on a table, crisp flick' + CLEAN })),
  { id: 'shuffle', dur: 3, text: 'a deck of playing cards being riffle shuffled and bridged, realistic' + CLEAN },
  { id: 'invalid', dur: 0.6, text: 'a soft dull muted wooden knock, gentle negative buzz, subtle error feedback' + CLEAN },
  { id: 'undo', dur: 0.8, text: 'a quick soft reverse whoosh with a tiny paper rustle' + CLEAN },
  { id: 'hint', dur: 1.2, text: 'a short gentle sparkle shimmer twinkle, magical subtle notification' + CLEAN },
];

export const THEME = {
  roman: {
    ui: 'a soft stone tap with a tiny gold coin tink, subtle UI click',
    chime: 'a single pure struck bronze bell note with warm shimmering golden decay, one note only',
    win: 'a triumphant ancient Roman fanfare with brass horns (cornu and tuba), timpani drums and a choir swell, victorious, 6 seconds',
    ambience: 'quiet marble temple atrium ambience with gentle fountain water, distant birdsong and soft wind, very subtle, seamless loop',
    music:
      'Calm contemplative neo-classical instrumental for a solitaire game: solo harp arpeggios and warm lyre, soft strings, gentle ancient Mediterranean mood, slow tempo, no drums, no vocals, relaxed and elegant, seamless ambient bed',
  },
  cyber: {
    ui: 'a crisp futuristic digital UI click with a short synth blip, subtle',
    chime: 'a single glassy electronic synth pluck note with short reverb tail, neon cyberpunk, one note only',
    win: 'an epic cyberpunk victory sting with a heavy synth bass drop, glitchy arpeggios and rising laser sweeps, 6 seconds',
    ambience: 'rainy futuristic city night ambience, distant traffic hum, electric buzz of neon signs, soft rain on metal, very subtle, seamless loop',
    music:
      'Dark atmospheric cyberpunk synthwave instrumental for a solitaire game: slow pulsing analog bass, shimmering arpeggios, soft gated drums, moody neon rain mood, no vocals, focused and hypnotic, seamless ambient bed',
  },
  aero: {
    ui: 'a glossy water bubble pop click, bright and cute, subtle UI sound',
    chime: 'a single sparkling glassy marimba and bell note with bubbly watery shimmer, one note only',
    win: 'a joyful sparkling tropical victory jingle with steel drums, glittering chimes, dolphin clicks and whistles and splashing water, 6 seconds',
    ambience: 'gentle ocean waves lapping with bubbles and distant seagulls in a bright lagoon, soft and calming, very subtle, seamless loop',
    music:
      'Bright relaxing Frutiger Aero chillout instrumental for a solitaire game: soft marimba and glassy electric piano, airy pads, gentle shuffle beat, optimistic early-2000s lounge, dreamy ocean mood, no vocals, seamless ambient bed',
  },
  zen: {
    ui: 'a soft wooden block tap with a tiny bamboo click, subtle UI sound',
    chime: 'a single struck Japanese singing bowl note with long warm resonant shimmer, one note only',
    win: 'a joyful Japanese celebration with koto glissando, shakuhachi flute flourish, a taiko drum hit and a temple bell, victorious yet serene, 6 seconds',
    ambience: 'quiet zen garden ambience: gentle breeze, a bamboo water fountain tock now and then, distant temple bell, soft birdsong, very subtle, seamless loop',
    music:
      'Calm Japanese instrumental for a solitaire game: gentle koto arpeggios, soft shakuhachi flute, warm ambient pads, slow tempo, no drums, no vocals, peaceful and contemplative, seamless ambient bed',
  },
  forest: {
    ui: 'a soft glassy magical chime tap with a tiny sparkle, subtle UI sound',
    chime: 'a single celesta and music-box note with magical sparkling shimmer, one note only',
    win: 'a magical fairy-tale victory fanfare with a harp glissando, flutes, shimmering chimes and a soft choir swell, enchanting and triumphant, 6 seconds',
    ambience: 'enchanted forest at night ambience: soft crickets, gentle breeze through leaves, a distant owl, a quiet babbling brook, very subtle, seamless loop',
    music:
      'Whimsical fantasy instrumental for a solitaire game: harp and celesta, soft flute and gentle strings, a slow waltz-like feel, mysterious yet cozy, no drums, no vocals, seamless ambient bed',
  },
  deco: {
    ui: 'a soft piano key tap with a short brass click, subtle 1920s UI sound',
    chime: 'a single muted vibraphone note with warm sustain and gentle shimmer, one note only',
    win: 'a 1920s jazz victory fanfare with a swinging muted trumpet flourish, piano glissando, a cymbal crash and clinking glasses, glamorous and triumphant, 6 seconds',
    ambience: 'quiet 1920s speakeasy room tone: low murmur of a crowd, faint clinking glasses, light vinyl crackle, distant muffled jazz, very subtle, seamless loop',
    music:
      'Smooth 1920s jazz instrumental for a card game: muted trumpet, upright bass, brushed drums and piano, slow elegant swing, warm and sophisticated, no vocals, seamless ambient bed',
  },
  muertos: {
    ui: 'a soft nylon guitar string pluck tap with a tiny wooden click, subtle UI sound',
    chime: 'a single small hand bell note with warm glassy shimmer, one note only',
    win: 'a festive Mexican celebration fanfare with mariachi trumpets, guitarrón and vihuela strums, a confetti pop and a cheering crowd, joyful and triumphant, 6 seconds',
    ambience: 'quiet candlelit ofrenda night ambience: soft wind, gentle crackle of candle flames, a distant church bell, faint crickets, very subtle, seamless loop',
    music:
      'Gentle Mexican folk instrumental for a solitaire game: nylon-string guitar arpeggios, soft violin, light marimba, tender and warm, slow tempo, no drums, no vocals, seamless ambient bed',
  },
  space: {
    ui: 'a soft clean futuristic computer beep, subtle sci-fi UI tap',
    chime: 'a single clean futuristic synth bell chirp with a short shimmering tail, one note only',
    win: 'a triumphant sci-fi orchestral fanfare with soaring brass swells, shimmering synth arpeggios and a rising whoosh, hopeful and victorious, 6 seconds',
    ambience: 'starship bridge ambience: a low steady engine hum, soft computer beeps in the distance, gentle air circulation, very subtle, seamless loop',
    music:
      'Optimistic sci-fi ambient instrumental for a solitaire game: warm synth pads, soft orchestral strings, a gentle pulsing arpeggio, wonder and exploration, no drums, no vocals, seamless ambient bed',
  },
};

export function sfxList() {
  const list = SHARED.map((s) => ({ ...s, file: `assets/sfx/${s.id}.mp3` }));
  for (const [t, d] of Object.entries(THEME)) {
    list.push({ id: `${t}_ui`, file: `assets/sfx/${t}_ui.mp3`, dur: 0.5, text: d.ui + CLEAN });
    list.push({ id: `${t}_chime`, file: `assets/sfx/${t}_chime.mp3`, dur: 2, text: d.chime + CLEAN });
    list.push({ id: `${t}_win`, file: `assets/sfx/${t}_win.mp3`, dur: 6, text: d.win });
    list.push({ id: `${t}_ambience`, file: `assets/sfx/${t}_ambience.mp3`, dur: 20, text: d.ambience, loop: true });
  }
  return list;
}

export function musicList() {
  return Object.entries(THEME).map(([t, d]) => ({ id: t, file: `assets/music/${t}.mp3`, prompt: d.music, ms: 90000 }));
}
