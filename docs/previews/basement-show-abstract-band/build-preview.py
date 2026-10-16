from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import io,base64,json
root=Path(__file__).resolve().parent
repo=root.parents[2]
def encode(p):
 im=Image.open(p).convert('RGB');im.thumbnail((1400,800));b=io.BytesIO();im.save(b,'WEBP',quality=85)
 return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
items=json.loads((root/'options.json').read_text())
for d in items:d['image']=encode(root/'originals'/d['id']/'hero.png')
current={'id':'current','name':'Previous Rough Xerox','description':'The earlier, more realistic Rough Xerox option.','image':encode(root.parent/'basement-show-variations/originals/xerox-collage/hero.png')}
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Basement Show · Abstract singer & full band</title><style>*{box-sizing:border-box}body{margin:0;background:#121212;color:#eee;font:15px system-ui}main{max-width:1280px;padding:22px;margin:auto}h1{font-size:32px;margin:8px 0}h2{font-size:23px;margin:0}p{color:#bcbcbc;line-height:1.6}nav{position:sticky;top:0;background:#121212f5;display:flex;gap:8px;flex-wrap:wrap;padding:12px 0;z-index:2}button{border:1px solid #777;border-radius:3px;padding:10px 16px;background:#282828;color:#eee;cursor:pointer}button[aria-pressed=true]{background:#eee;color:#111}section{margin:20px 0 32px;border:1px solid #494949;padding:15px}img{width:100%;height:auto;display:block}small{color:#aaa}@media(max-width:650px){main{padding:12px}section{padding:10px}}</style><main><small>NANO BANANA 2.1 · PREVIEW ONLY</small><h1>Basement Show — two new directions</h1><p>Two Rough Xerox interpretations: an abstract cut-paper singer and a wider full-band scene with a crowd. The installed hero stays unchanged.</p><nav id="nav"></nav><div id="gallery"></div></main><script>const items=DATA,current=CURRENT;const tabs=[['all','Both directions'],...items.map(x=>[x.id,x.name]),['current','Previous Rough Xerox']];function show(id){document.getElementById('nav').innerHTML=tabs.map(([k,v])=>`<button aria-pressed="${id===k}" onclick="show('${k}')">${v}</button>`).join('');document.getElementById('gallery').innerHTML=(id==='all'?items:id==='current'?[current]:items.filter(x=>x.id===id)).map(x=>`<section><h2>${x.name}</h2><p>${x.description}</p><img src="${x.image}" alt="${x.name}"></section>`).join('')}show('all');</script></html>'''.replace('DATA',json.dumps(items)).replace('CURRENT',json.dumps(current))
(root/'index.html').write_text(html)
out=Image.new('RGB',(1280,2*770+50),'#121212');draw=ImageDraw.Draw(out)
draw.text((20,15),'BASEMENT SHOW / ABSTRACT SINGER & FULL BAND / NANO BANANA 2.1',fill='white')
for i,d in enumerate(items):
 y=55+i*770;draw.text((20,y),d['name']+' / '+d['description'],fill='white')
 im=Image.open(root/'originals'/d['id']/'hero.png').convert('RGB');im=ImageOps.fit(im,(1240,698));out.paste(im,(20,y+28))
out.save(root/'contact-sheet.jpg',quality=92)
print('Built comparison preview:',len(html.encode()),'bytes')
