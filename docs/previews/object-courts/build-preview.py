from pathlib import Path
from PIL import Image,ImageDraw,ImageOps,ImageFont
import base64,io,json
root=Path(__file__).resolve().parent;repo=root.parents[2]
audit={x['id']:x for x in json.loads((repo/'docs/reviews/court-art-audit/audit.json').read_text())}
manifest=json.loads((root/'manifest.json').read_text())
ids=list(dict.fromkeys(x['theme'] for x in manifest))
def encoded(path,width=360):
 im=Image.open(path).convert('RGB');im.thumbnail((width,width));out=io.BytesIO();im.save(out,'WEBP',quality=83)
 return 'data:image/webp;base64,'+base64.b64encode(out.getvalue()).decode()
rows=[]
for theme in ids:
 files=[root/'originals'/theme/f'court_{r}.png' for r in 'jqk']
 if not all(p.exists() for p in files):continue
 entry=audit[theme]
 rendered_before=[root/'rendered/before'/theme/f'court_{r}.webp' for r in 'jqk']
 rendered_after=[root/'rendered/after'/theme/f'court_{r}.webp' for r in 'jqk']
 if all(p.exists() for p in rendered_before+rendered_after):
  before_images=[encoded(p) for p in rendered_before]
  after_images=[encoded(p) for p in rendered_after]
 else:
  before_images=[encoded(root/'before'/theme/f'court_{r}.webp') for r in 'jqk']
  after_images=[encoded(p) for p in files]
 rows.append({'id':theme,'name':entry['name'],'primary':entry['priority']=='Strong candidate','reason':entry['reason'],'subjects':entry['suggested'].split('; '),'before':before_images,'after':after_images})
base='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Court art · TITLE</title><style>*{box-sizing:border-box}body{margin:0;background:#201a15;color:#eee5d7;font:15px system-ui}main{max-width:1240px;margin:auto;padding:22px}h1{font:32px Georgia,serif}h2{font:26px Georgia,serif;margin:0 0 8px}p{color:#cdbca5;line-height:1.5}nav{position:sticky;top:0;display:flex;gap:8px;flex-wrap:wrap;background:#201a15f7;padding:12px 0;z-index:2}button,select{padding:11px 16px;border-radius:6px;border:1px solid #a0835d;background:#3b2c1e;color:#fff1ce;cursor:pointer}button.active{background:#dfbd86;color:#211a14}section{border-top:1px solid #80684b;margin:15px 0;padding:22px 0}.sets{display:grid;grid-template-columns:1fr 1fr;gap:22px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}figure{margin:0}img{display:block;width:100%;height:auto;background:#34271e}figcaption{font-size:13px;color:#cdb592;margin:8px 0}h3{font-size:16px;color:#f0ce95}.new-only .sets,.old-only .sets{grid-template-columns:1fr}.new-only .old,.old-only .new{display:none}small{color:#dfbc83}@media(max-width:760px){main{padding:12px}.sets{grid-template-columns:1fr}}</style><main><small>NANO BANANA 2.1 · COURT ART</small><h1>TITLE</h1><p>INTRO</p><nav><button class="active" onclick="mode('both',this)">Side by side</button><button onclick="mode('new-only',this)">New cards</button><button onclick="mode('old-only',this)">Previous cards</button><select onchange="draw(this.value)"><option value="all">All themes</option>OPTIONS</select></nav><div id="gallery"></div><p>Exact prompts are saved in manifest.json; full-resolution PNGs are in originals/. No secondary theme will be installed without your approval.</p></main><script>const rows=DATA;function mode(m,b){document.getElementById('gallery').className=m;document.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))}function cards(x,k){return x[k].map((im,i)=>`<figure><img src="${im}" alt="${x.name} ${['Jack','Queen','King'][i]} ${k}"><figcaption>${['Jack','Queen','King'][i]}${k==='after'?' · '+x.subjects[i]:''}</figcaption></figure>`).join('')}function draw(id){document.getElementById('gallery').innerHTML=rows.filter(x=>id==='all'||x.id===id).map(x=>`<section><h2>${x.name}</h2><p>${x.reason}</p><div class="sets"><div class="old"><h3>Previous humanoid courts</h3><div class="cards">${cards(x,'before')}</div></div><div class="new"><h3>Object / creature alternatives</h3><div class="cards">${cards(x,'after')}</div></div></div></section>`).join('')}draw('all');</script></html>'''
for primary,title,intro,filename in [(True,'18 approved court replacements','The object and creature courts approved for installation. Compare each replacement with the previous set.','primary.html'),(False,'8 secondary court alternatives — review','Preview-only alternatives. These active themes still use the previous humanoid cards. Compare the full Jack / Queen / King sets, rendered in the actual double-ended card layout, before signing off.','secondary.html')]:
 subset=[x for x in rows if x['primary']==primary]
 if not subset:continue
 page=base.replace('TITLE',title).replace('INTRO',intro).replace('OPTIONS',''.join(f'<option value="{x["id"]}">{x["name"]}</option>' for x in subset)).replace('DATA',json.dumps(subset))
 (root/filename).write_text(page);print(filename,len(subset),'themes;',len(page.encode()),'bytes')
font=ImageFont.load_default(size=21)
# Compact contact sheets for visual review. Six themes per sheet.
for batch in range((len(rows)+5)//6):
 group=rows[batch*6:(batch+1)*6];out=Image.new('RGB',(1260,len(group)*270+40),'#211b15');draw=ImageDraw.Draw(out)
 draw.text((20,8),'NEW COURT ART / JACK — QUEEN — KING',font=font,fill='#fff0ce')
 for i,x in enumerate(group):
  y=i*270+40;draw.text((15,y+100),x['name'],font=font,fill='#fff0ce')
  for j,r in enumerate('jqk'):
   im=Image.open(root/'originals'/x['id']/f'court_{r}.png').convert('RGB');im=ImageOps.contain(im,(250,250));out.paste(im,(360+j*290,y))
 out.save(root/f'review-{batch+1}.jpg',quality=94)
print('Complete sets ready:',len(rows),'of',len(ids))
