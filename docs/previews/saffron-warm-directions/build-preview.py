from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import io,base64,json
root=Path(__file__).resolve().parent
repo=root.parents[2]
def uri(path,maxsize=(1280,900)):
 im=Image.open(path).convert('RGB');im.thumbnail(maxsize)
 b=io.BytesIO();im.save(b,'WEBP',quality=84)
 return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
data=json.loads((root/'directions.json').read_text())
for d in data:
 d['hero']=uri(root/'originals'/d['id']/'hero.png')
 d['back']=uri(root/'originals'/d['id']/'back.png',(480,640))
current={'id':'current','name':'Current Saffron Court','description':'The installed late-morning courtyard, for comparison.','hero':uri(repo/'assets/art/saffron/hero.webp'),'back':uri(repo/'assets/art/saffron/back.webp',(480,640))}
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saffron Court · Three warm directions</title><style>
*{box-sizing:border-box}body{margin:0;background:#24160e;color:#fff0cb;font:15px system-ui,sans-serif}main{max-width:1280px;padding:24px;margin:auto}h1{font:36px Georgia,serif;margin:8px 0}h2{font:26px Georgia,serif;margin:0}p{color:#dec399;line-height:1.6}nav{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;padding:12px 0;background:#24160ef5;z-index:2}button{border:1px solid #976536;border-radius:22px;padding:10px 16px;background:#452b17;color:#ffe6b6;cursor:pointer}button[aria-pressed=true]{background:#e9ac4a;color:#25170c}section{margin:18px 0 34px;padding:18px;border:1px solid #72502c;border-radius:14px;background:#302015}.images{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:12px;align-items:start}.images img{display:block;width:100%;height:auto;border-radius:8px}figure{margin:0}figcaption{color:#d0a56e;margin:8px 0}small{color:#e5af60}a{color:#efbc68}@media(max-width:650px){main{padding:12px}section{padding:12px}.images{grid-template-columns:1fr}.back{width:45%}h1{font-size:30px}}
</style><main><small>NANO BANANA 2.1 · ART DIRECTION PREVIEWS</small><h1>Saffron Court, in the heat</h1><p>Three warmer directions with golden-hour sun and a palpable sense of summer heat. Each includes a hero image and matching card back. The active theme remains unchanged.</p><nav id="nav"></nav><div id="gallery"></div><p>Preview-only. Full-resolution originals and the exact Gemini prompts are saved alongside this page.</p></main><script>
const dirs=DATA, current=CURRENT;
const choices=[['all','All three'],...dirs.map((x,i)=>[x.id,`${i+1}. ${x.name}`]),['current','Current art']];
function show(id){document.getElementById('nav').innerHTML=choices.map(([k,v])=>`<button aria-pressed="${k===id}" onclick="show('${k}')">${v}</button>`).join('');const items=id==='all'?dirs:id==='current'?[current]:dirs.filter(x=>x.id===id);document.getElementById('gallery').innerHTML=items.map(d=>`<section><h2>${d.name}</h2><p>${d.description}</p><div class="images"><figure><img src="${d.hero}" alt="${d.name} hero"><figcaption>Hero art</figcaption></figure><figure class="back"><img src="${d.back}" alt="${d.name} card back"><figcaption>Matching card back</figcaption></figure></div></section>`).join('')};show('all');
</script></html>'''.replace('DATA',json.dumps(data)).replace('CURRENT',json.dumps(current))
(root/'index.html').write_text(html)
canvas=Image.new('RGB',(1500,3*510+70),'#24160e');draw=ImageDraw.Draw(canvas)
draw.text((24,20),'SAFFRON COURT / THREE WARM DIRECTIONS / NANO BANANA 2.1',fill='#fff0cb')
for i,d in enumerate(data):
 y=60+i*510;draw.text((24,y),f'{i+1}. {d["name"]} — {d["description"]}',fill='#fff0cb')
 im=Image.open(root/'originals'/d['id']/'hero.png').convert('RGB');im=ImageOps.fit(im,(1120,450));canvas.paste(im,(24,y+30))
 im=Image.open(root/'originals'/d['id']/'back.png').convert('RGB');im=ImageOps.fit(im,(320,450));canvas.paste(im,(1160,y+30))
canvas.save(root/'contact-sheet.jpg',quality=92)
print('Built preview; HTML bytes:',len(html.encode()))
