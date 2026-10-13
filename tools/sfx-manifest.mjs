// ElevenLabs sound-effect prompts. Output: assets/sfx/<id>.mp3
import { EXPANSION_AUDIO } from './expansion-content.mjs';
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
  ...EXPANSION_AUDIO,
  // Final 52-roster worlds.
  signal: {
    ui: "a small radio-console toggle clicks once, soft metal and bakelite",
    chime: "one clear rounded analog oscillator bell ping, a gentle radio lock tone, one note only",
    win: "an original hopeful six-second flourish of warm analog synth and sparse piano, a signal resolving from soft static, no voices",
    ambience: "quiet radio observatory at polar night, faint equipment ventilation, low tape hiss and occasional distant relay tick, subdued seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: sparse analog synth, felt piano and low strings, patient polar-night radio observatory, cold stars and amber instrument glow, no drums, no vocals, seamless ambient bed",
  },
  rink: {
    ui: "a roller-skate wheel gently taps a maple floor, a tiny bearing click",
    chime: "one warm electric-piano bell note with a soft silver shimmer, one note only",
    win: "an original joyful six-second disco instrumental flourish, electric piano, round bass, muted rhythm guitar and a silver bell, no voices",
    ambience: "empty indoor roller rink, low ventilation and an occasional soft wheel coast over maple, subtle mirror-ball motor hum, quiet seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: relaxed late-1970s instrumental disco, warm electric piano, rounded bass, muted guitar and soft brushed steady drums, magenta and teal lights over maple, restrained slow-skate groove, no vocals, seamless ambient bed",
  },
  darkroom: {
    ui: "print tongs gently tap the edge of a metal developing tray",
    chime: "one soft silver triangle ping blended with a low warm electric-piano note, one note only",
    win: "an original quiet six-second piano and brushed-metal flourish, a clear print emerging under a red safelight, understated satisfaction, no voices",
    ambience: "quiet photographic darkroom, tiny water drips into a developing tray, faint enlarger fan and ventilation, subdued seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: sparse felt piano, bowed vibraphone and warm low bass, red safelight and photographic silver, focused contemplative darkroom mood, no drums, no vocals, seamless ambient bed",
  },
  smokewatch: {
    ui: "a brass fire-finder knob turns with one small wooden click",
    chime: "one soft brass instrument bell note with a short warm decay, one note only",
    win: "an original reassuring six-second acoustic guitar and low-string flourish with a brass bell, lookout at dusk, no voices",
    ambience: "wind softly brushes a high wooden fire-lookout cab, muted pine-board creaks and a tiny stove crackle, very distant forest wind, quiet seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: fingerpicked acoustic guitar, low bowed strings and sparse felt piano, dusk-violet fire lookout above a smoky forest, watchful yet reassuring, no drums, no vocals, seamless ambient bed",
  },
  bloodmoon: {
    ui: "an antique iron door latch makes one soft muted click",
    chime: "one low bronze handbell note with a gentle dark shimmer, one note only",
    win: "an original six-second restrained gothic chamber flourish, cello, harpsichord and one bronze bell, a candle surviving cold moonlight, no voices",
    ambience: "a quiet stone castle threshold at night, faint wind in distant corridors, gentle candle crackle and occasional old oak creak, subtle seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: restrained gothic chamber instrumental, solo cello, sparse harpsichord and low sustained strings, distant castle beneath a crimson moon, beautiful quiet suspense, no jump scares or drums, no vocals, seamless ambient bed",
  },
  deepsea: {
    ui: "a brass pressure-gauge switch makes one muted click",
    chime: "one delicate sonar-like glass bell note, soft and rounded with a short luminous decay, one note only",
    win: "an original luminous six-second glass-harmonica and low-string flourish, soft celesta and a gentle sonar ping, deep ocean wonder, no voices",
    ambience: "inside a deep-ocean brass observation sphere, low pressure-shell hum, very soft water movement and occasional restrained hull creak, peaceful quiet seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: slow glass harmonica, soft celesta, submerged warm synth pads and low strings, abyssal blue water with cyan and pale-rose jellyfish, spacious calm exploration, no percussion, no vocals, seamless ambient bed",
  },
  plaster: {
    ui: "a small plaster cast is gently set onto a linen-covered bench, soft dry tap",
    chime: "one warm porcelain bell note with a delicate powdery decay, one note only",
    win: "an original graceful six-second piano, viola and small porcelain-bell flourish, gentle studio satisfaction, no voices",
    ambience: "quiet sculptor studio in north light, soft airy window breeze and occasional linen-sheet rustle, subtle distant brush on plaster, subdued seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: gentle solo piano, viola and delicate harp harmonics, cool north light on plaster casts and linen, calm patient craft, unhurried and spacious, no drums, no vocals, seamless ambient bed",
  },
  backrooms: {
    ui: "an old fluorescent light switch makes one small dull plastic click",
    chime: "one soft glassy electric-piano notification note above a faint fluorescent overtone, one note only",
    win: "an original uneasy but relieved six-second electric-piano and soft synth flourish, a door found in an endless corridor, no voices",
    ambience: "empty endless office corridor, low fluorescent ballast hum, muffled ventilation and a faint distant ceiling-panel rattle, subtle seamless loop, no footsteps, voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: minimal detuned electric piano and soft sustained analog pads, empty yellow office corridors and fluorescent light, liminal stillness with gentle unease, quiet and focused, no drums or sudden sounds, no vocals, seamless ambient bed",
  },
  vaporwave: {
    ui: "a cassette-deck button presses once with a soft tactile snap",
    chime: "one mellow glassy FM-synth bell note, a short pink-and-cyan shimmer, one note only",
    win: "an original dreamy six-second FM-synth and electric-piano flourish with soft round bass, sunset in an empty mall, no voices",
    ambience: "deserted mall atrium, soft fountain trickle, faint air-conditioning hum and a very distant escalator motor, quiet seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: original slow vaporwave instrumental, warm electric piano, soft FM bells, airy analog pads, rounded bass and gentle restrained drum-machine pulse, pink marble and cyan glass in a deserted sunset mall, no samples or recognizable existing melody, no vocals, seamless ambient bed",
  },
  cinema: {
    ui: "a film projector lever makes one soft mechanical click",
    chime: "one warm celesta note with a tiny silver bell overtone, one note only",
    win: "an original elegant six-second silent-film piano and chamber-organ victory flourish, warm amber resolution, no voices",
    ambience: "empty silent-era picture palace, faint steady projector mechanism through thick glass, quiet velvet-damped room tone and subtle ventilation, seamless loop, no voices or music",
    music: "Original unobtrusive instrumental for a focused solitaire game: original gentle 1920s silent-cinema accompaniment, tender upright piano, soft chamber organ and low bowed strings, restrained lyrical warmth beneath silver projector light, no drums, no existing film melody, no vocals, seamless ambient bed",
  },

  pinecone: {
    ui: 'a soft wooden canoe paddle tap on a cedar dock, warm tactile UI click',
    chime: 'one gentle clean camp dinner-bell note with a warm short ringing tail, one note only',
    win: 'an original cheerful summer-camp victory flourish with acoustic guitar, glockenspiel and a small camp bell, warm and adventurous, no voices, 6 seconds',
    ambience: 'a peaceful lakeside summer camp at dusk, soft crickets, a small campfire gently crackling and faint lake water lapping against a canoe, subtle seamless loop, no music or voices',
    music: 'Original cozy nostalgic summer-camp instrumental for a relaxing solitaire game: gentle fingerpicked acoustic guitar, warm upright bass, occasional glockenspiel and soft brushed percussion, relaxed evening by a pine-lined lake and campfire, quietly adventurous and reassuring, no vocals, no recognizable existing song, seamless ambient bed',
  },
  winterglass: {
    ui: 'a tiny clear crystal bead tap on frosted glass, delicate soft UI click',
    chime: 'one luminous celesta note blended with a tiny crystal bell, gentle short shimmering sustain, one note only',
    win: 'an original enchanted winter-palace victory flourish with celesta, a gentle harp glissando, warm strings and shimmering glass bells, elegant uplifting melody, no voices, 6 seconds',
    ambience: 'a quiet grand ice-and-glass palace in winter twilight, very soft airy wind outside thick glass, occasional faint crystalline creak and a distant delicate ice chime, peaceful subtle seamless loop, no music or voices',
    music: 'Original luminous winter-palace instrumental for a relaxing solitaire game: sparse celesta melody, warm sustained strings, delicate harp and glass harmonics, slow graceful arrangement, magical translucent ice architecture and aurora atmosphere, gentle wonder rather than drama, no vocals, no recognizable film soundtrack or existing melody, seamless ambient bed',
  },
  concrete: {
    ui: 'one muted spray-can cap click with a tiny brief mixing-ball rattle, tactile street-art UI tap',
    chime: 'one warm Rhodes electric-piano chord stab with a tiny clean vinyl percussion accent, short mellow musical sustain',
    win: 'an original upbeat instrumental hip-hop victory sting, warm bass, crisp dusty drums, a bright electric-piano phrase and one basketball bounce accent, playful confident neighborhood energy, no voices, 6 seconds',
    ambience: 'a quiet neighborhood blacktop court at sunset, soft distant city traffic, a very occasional faraway basketball bounce and chain-link fence rattle in a gentle breeze, subdued seamless loop, no speech or music',
    music: 'Original mellow instrumental hip-hop for a focused solitaire game: warm round bass, dusty restrained boom-bap drums, jazzy Rhodes electric piano and soft vinyl texture, relaxed New York neighborhood sunset mood, head-nodding but unobtrusive groove, no vocals, no samples of existing recordings, no recognizable melody, seamless ambient bed',
  },
  carvings: {
    ui: 'a gentle carved cedar block tap with a short warm woody resonance, subtle UI click',
    chime: 'one softly struck resonant wooden marimba note with a small clear bell overtone, warm and rounded, one note only',
    win: 'an original uplifting short instrumental flourish with warm wooden marimba, gently swelling strings and one soft bell, grounded and contemplative, no voices, 6 seconds',
    ambience: 'a sheltered cedar pavilion beside a misty Pacific coastal inlet, gentle rain on a wooden roof, soft water at the shore, wind through evergreen branches and a very occasional distant raven, subtle seamless loop, no music or speech',
    music: 'Original quiet contemporary instrumental for a contemplative solitaire game overlooking a misty cedar-lined coast: sparse warm wooden marimba notes, soft acoustic guitar harmonics and sustained low strings, spacious unhurried arrangement, grounded natural mood, no vocals, no chants, no ceremonial music, no imitation of a named Indigenous song, no strong percussion, seamless ambient bed',
  },
  varsity: {
    ui: 'a muted leather-covered button tap with a tiny brass snap, tactile collegiate clubhouse UI click',
    chime: 'one warm clean vibraphone note blended with a soft brass bell ping, short musical sustain, one note only',
    win: 'an original joyful collegiate marching-band victory flourish with bright brass, a short snare roll and cymbal accent, school spirit without any existing fight song, no voices, 6 seconds',
    ambience: 'a quiet wood-paneled college athletics clubhouse on an autumn afternoon, soft room tone, faint breeze through an open window and a very distant subdued stadium crowd outside, no intelligible speech, no music, subtle seamless loop',
    music: 'Original relaxed nostalgic collegiate clubhouse instrumental for a solitaire game, warm upright piano, soft muted brass phrases, upright bass and restrained brushed snare, gentle easy swing and autumn homecoming mood, unobtrusive and cozy rather than a loud sports anthem, no vocals, no existing fight song or recognizable melody, seamless ambient bed',
  },
  driftwood: {
    ui: 'a soft weathered wooden dock tap with a tiny rope creak, muted nautical UI click',
    chime: 'one gentle rounded distant brass buoy bell note with a warm short shimmering tail, one note only',
    win: 'an original gentle celebratory harbor melody flourish with fingerpicked acoustic guitar, warm piano and a soft brass buoy bell, cozy and hopeful, no voices, 6 seconds',
    ambience: 'a sleepy small fishing harbor at dawn, gentle water lapping against timber pilings, occasional mooring-rope creak and a distant soft buoy bell, very occasional quiet gull, peaceful subtle seamless loop, no music or voices',
    music: 'Original calm cozy fishing-village instrumental for a solitaire game, delicate fingerpicked acoustic guitar and sparse felt piano, warm low strings, slow unhurried tempo, quiet early-morning sea mist and weathered driftwood porch atmosphere, slight wistfulness with reassuring warmth, no drums, no vocals, no sea shanty or recognizable existing tune, seamless ambient bed',
  },
  azulejo: {
    ui: 'a delicate glazed ceramic tile tap, soft and refined, subtle UI click',
    chime: 'one clear small porcelain cup struck gently with a wooden stick, a musical crystalline ceramic note with a warm short decay, one note only',
    win: 'an elegant joyful Portuguese guitar flourish with nylon guitar accompaniment and delicate ceramic bell accents, warm sunlit celebration, no voices, 6 seconds',
    ambience: 'a serene Portuguese seaside courtyard, a faint fountain trickle, soft Atlantic breeze and very occasional distant small birds, no music or speech, quiet seamless loop',
    music: 'Original gentle Portuguese-guitar-inspired instrumental for a relaxing solitaire game, lyrical plucked Portuguese guitar melody, warm nylon-string classical guitar accompaniment, unhurried and sunlit Mediterranean courtyard atmosphere, subtle tender saudade, sparse arrangement, no drums, no vocals, no recognizable existing melody, seamless ambient bed',
  },
  jetset: {
    ui: 'a muted tactile click of a vintage airport console button, soft clean mechanical snap',
    chime: 'a single warm rounded electric-piano bell tone reminiscent of a refined 1960s airline cabin notification, short clean sustain, one note only',
    win: 'a glamorous optimistic early-1960s lounge victory flourish with vibraphone, brushed snare, warm brass and piano, original melody, no voices, 6 seconds',
    ambience: 'a quiet spacious early-1960s airport first-class lounge, gentle ventilation, very faint distant jet-engine rumble beyond thick glass and an occasional distant soft mechanical click, no announcements, no speech, no music, seamless subtle loop',
    music: 'Original sophisticated early-1960s jet-set cocktail lounge instrumental for a solitaire game, gentle bossa nova rhythm, warm electric piano, soft vibraphone, nylon guitar and upright bass with restrained brushes, glamorous optimistic mid-century air-travel mood, relaxed tempo, unobtrusive arrangement, no vocals, no recognizable existing melody, seamless ambient bed',
  },
  riverboat: {
    ui: 'a single antique clay poker chip lightly tapped against polished wood, soft satisfying click',
    chime: 'a single gently ringing antique brass poker-chip clink blended with a warm upright piano note, one note only, soft and musical',
    win: 'a charming triumphant riverboat saloon victory flourish with upright piano, a short fiddle phrase, warm brass and a scattering of clay poker chips, original melody, no voices, 6 seconds',
    ambience: 'inside a quiet Victorian Mississippi paddle-steamer salon, low muffled steady steam-engine rhythm, gentle paddle-wheel churn and river water outside, occasional wooden creak, no music or speech, subtle seamless loop',
    music: 'Original relaxed 19th-century riverboat saloon instrumental for a solitaire game, warm upright piano with a gentle lilting ragtime feel, occasional tender fiddle phrases and soft acoustic bass, charming roguish Victorian poker-salon atmosphere at dusk, restrained dynamics and easy tempo, no vocals, no recognizable film soundtrack or existing melody, seamless ambient bed',
  },
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
