from pathlib import Path
from PIL import Image
import json,base64,io,html
root=Path(__file__).resolve().parent;repo=root.parents[2]
# Proposed J/Q/K are art-direction suggestions, not generated or installed assets.
strong={
'zen':('Period human figures make the garden feel like a historical character theme.','Bonsai; stone lantern; sculptural garden stone'),
'azulejo':('Tile portraits emphasize people over the distinctive ceramic tradition.','Swallow tile; flowering urn; sailing-ship tile'),
'library':('Costumed literary portraits compete with the books-and-lamplight identity.','Leatherbound book; green glass reading lamp; illuminated manuscript'),
'conservatory':('Gardeners take the place of the plants this theme is built around.','Unfurling fern; flowering orchid; sculptural palm'),
'canyon':('Artisan portraits barely communicate the canyon or turquoise at card size.','Turquoise cluster; painted ceramic vessel; layered mesa formation'),
'lowtide':('Coastal researchers obscure the tide-pool life.','Anemone; sea star; spiral shell'),
'forge':('Smith portraits are less distinctive than the material and tools.','Forged hammer; glowing crucible; basalt anvil'),
'deepstorage':('Scientists and officials make an eerie hangar feel like office staff.','Sealed specimen case; strange recovered device; tarp-covered saucer'),
'museum':('Curator portraits hide the strongest subject: fossils.','Ammonite; trilobite slab; dinosaur skull'),
'mint':('Mint workers miss the chance to make the engraving and currency the subject.','Engraved coin; guilloche printing plate; ornate banknote seal'),
'moth':('Human faces and aristocratic clothing overpower the moth imagery.','Plum-patterned moth; pale silk moth; broad-winged dusk moth'),
'sewing':('Embroidered human portraits weaken the tiny-world sewing-box premise.','Thread spool; pin cushion; ornate scissors'),
'signal':('A remote observatory becomes three generic staff portraits.','Radio receiver; instrument panel; radio-telescope dish'),
'darkroom':('Photographers obscure the red-lit equipment and photographic process.','Film reel; developing tray with print; enlarger'),
'deepsea':('Divers and expedition staff displace the strange underwater world.','Jellyfish; chambered nautilus; brass diving bell'),
'plaster':('Living artists are less specific than sculptural plaster objects.','Plaster hand cast; relief medallion; classical cast bust'),
'backrooms':('Three office workers undermine the eerie emptiness of the setting.','Fluorescent fixture; abandoned office chair; empty yellow doorway'),
'vaporwave':('Fashion portraits read as generic retro people rather than surreal mall imagery.','Chrome dolphin; classical marble bust; palm beneath a gridded sun')
}
optional={
'harvest':('Orchard workers fit, but fruit and agricultural objects would identify the theme faster.','Apple branch; copper cider jug; wooden cider press'),
'cafe':('Baristas fit the cafe, but coffee equipment could make a tighter still-life set.','Ceramic espresso cup; pour-over dripper; brass espresso machine'),
'arctic':('Expedition staff are plausible; instruments and ice would feel more isolated.','Ice core; weather instrument; frost-covered radio'),
'rink':('Skaters fit the social setting; equipment could be more iconic at small size.','Quad skate; mirror ball; DJ turntable'),
'smokewatch':('Rangers fit naturally, but instruments might reinforce the quiet lonely lookout.','Binoculars; fire-finder instrument; lookout tower'),
'broadcast':('TV-headed courtiers are distinctive, though the costumes dilute the broadcast equipment.','Microphone; test-pattern television; walnut radio console'),
'risograph':('Printed royal figures fit the name, but abstract print artifacts could better show the medium.','Overprinted rosette; layered halftone proof; ink drum'),
'runes':('Norse craftspeople fit, though carved artifacts would make the rune theme more direct.','Rune stone; carved knotwork panel; ship-prow carving')
}
subjects={
'roman':'Gold classical busts','cyber':'Cyberpunk human characters','aero':'Dolphin characters','zen':'Historical Japanese human figures','forest':'Fantasy woodland humanoids','deco':'1920s social characters','muertos':'Decorated skeleton characters','azulejo':'Human figures rendered in blue-and-white tile','jetset':'Airline staff and travelers','riverboat':'Period casino characters','carvings':'Animal carvings','pinecone':'Camp guides and leaders','winterglass':'Ice-palace fantasy royalty','concrete':'Artists and neighborhood characters','library':'Costumed literary figures','conservatory':'Gardeners with plants','saffron':'Contemporary courtyard artisans and tea host','harvest':'Orchard workers','carnival':'Fairground performers','canyon':'Artisans with maps, pottery and tools','lowtide':'Coastal researchers with specimens','theater':'Wooden marionettes','forge':'Human smiths','saloon':'Western saloon characters','lapis':'Egyptian figures and a funerary mask','diner':'Diner staff and patron','cove':'Sailors and pirate-like characters','deepstorage':'Scientists and officials','cafe':'Coffee professionals','arctic':'Polar expedition staff','museum':'Fossil workers and curators','mint':'Engravers and mint workers','toybox':'Toy soldiers and rag doll','prizelights':'TV production staff, host and contestant','safetypin':'Punk musicians','honeyhouse':'Natural bee characters','moth':'Human-faced moth aristocrats','cutpaper':'Paper-cut royal characters','broadcast':'TV-headed humanoid courtiers','sewing':'Embroidered human portraits','risograph':'Printed humanoid royalty','runes':'Norse craftspeople','signal':'Radio-outpost personnel','rink':'Skaters and DJ','darkroom':'Photographers and printers','smokewatch':'Lookout staff and rangers','bloodmoon':'Gothic human/vampire-like figures','deepsea':'Divers and expedition staff','plaster':'Living sculptors and studio workers','backrooms':'Office workers','vaporwave':'Retro human portraits','cinema':'Cinema staff and performers'
}
keep={
'roman':'These already are sculptural objects; humanoid shape is central to classical statuary.',
'aero':'Already uses dolphins rather than people.',
'carvings':'Already uses animal carvings.',
'toybox':'These already are thematic toy objects, despite their human shapes.',
'honeyhouse':'Already uses bees, recently revised and approved.',
'theater':'Marionettes are thematic objects; human shape helps convey their material.',
'forest':'Fantasy inhabitants support the enchanted-world premise.',
'winterglass':'Ice royalty supports the palace-fantasy premise.',
'muertos':'Decorated skeleton characters are a defining part of the theme.',
'cutpaper':'Paper royalty fits both the material and Kingdom premise.',
'bloodmoon':'Gothic characters support the existing castle atmosphere.',
'lapis':'The funerary mask is already an artifact; the figures form a coherent historical set.',
'saffron':'The newly approved artisans and tea host connect well with the courtyard hero.',
'safetypin':'Musicians make sense in a theme about a live show.'
}
roster=json.loads((root/'roster.json').read_text());rows=[]
for t in roster:
 key=t['id'];r={**t,'current':subjects[key]}
 if key in strong:r.update(priority='Strong candidate',reason=strong[key][0],suggested=strong[key][1])
 elif key in optional:r.update(priority='Optional',reason=optional[key][0],suggested=optional[key][1])
 else:r.update(priority='Keep',reason=keep.get(key,'Human roles help establish this social or historical setting; no strong mismatch.'),suggested='Retain current direction')
 r['images']=[]
 for rank in 'jqk':
  im=Image.open(repo/'assets/art'/key/f'court_{rank}.webp').convert('RGB');im.thumbnail((145,145));b=io.BytesIO();im.save(b,'WEBP',quality=80);r['images'].append('data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode())
 rows.append(r)
(root/'audit.json').write_text(json.dumps([{k:v for k,v in r.items() if k!='images'} for r in rows],indent=2))
page='''<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Court art audit · 52 themes</title><style>body{margin:0;background:#1d1a17;color:#eee6dc;font:15px system-ui}main{max-width:1200px;margin:auto;padding:22px}p{line-height:1.5;color:#cfc2b3}nav{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;background:#1d1a17f7;padding:12px 0}button,input{background:#332b24;color:#eee;border:1px solid #8c755e;padding:10px;border-radius:5px}button{cursor:pointer}button.active{background:#ddbd89;color:#231c15}article{display:grid;grid-template-columns:1fr 1fr;gap:20px;border-top:1px solid #645343;padding:22px 0}h2{margin:0 0 8px}.courts{display:flex;gap:8px}.courts img{width:100%;display:block}figure{margin:0;flex:1;min-width:0}figcaption{padding:6px 0;color:#b8a58d}small{color:#e2b978}@media(max-width:700px){article{grid-template-columns:1fr}main{padding:12px}}</style><main><h1>Court art audit</h1><p>All 52 active themes and 156 installed J/Q/K images visually reviewed. 18 strong candidates, 8 optional changes, 26 themes to retain. Suggestions are editorial judgments; no art has been regenerated or replaced. Object lists read Jack / Queen / King and are starting points, not approved designs.</p><nav><button onclick="filter('Strong candidate',this)" class="active">18 strong candidates</button><button onclick="filter('Optional',this)">8 optional</button><button onclick="filter('Keep',this)">26 keep</button><button onclick="filter('All',this)">All 52</button></nav><div id="list"></div></main><script>const rows=DATA;function filter(p,b){document.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('list').innerHTML=rows.filter(x=>p==='All'||x.priority===p).map(x=>`<article><div><small>${x.priority}</small><h2>${x.name}</h2><p><b>Current:</b> ${x.current}</p><p>${x.reason}</p><p><b>Direction:</b> ${x.suggested}</p></div><div class="courts">${x.images.map((im,i)=>`<figure><img src="${im}" alt="${x.name} ${['Jack','Queen','King'][i]}"><figcaption>${['Jack','Queen','King'][i]}</figcaption></figure>`).join('')}</div></article>`).join('')}filter('Strong candidate',document.querySelector('button'));</script></html>'''.replace('DATA',json.dumps(rows))
(root/'index.html').write_text(page)
print('Built full audit:',len(page.encode()),'bytes;',len(strong),'strong;',len(optional),'optional;',52-len(strong)-len(optional),'keep')
