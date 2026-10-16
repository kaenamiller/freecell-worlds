from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import base64, io, json
root=Path(__file__).resolve().parent
repo=root.parents[2]
names={'hero':'Cover art','board':'Playing surface','backdrop':'Backdrop','back':'Card back','court_j':'Jack','court_q':'Queen','court_k':'King'}
def encoded(path,width=1100):
    im=Image.open(path).convert('RGB'); im.thumbnail((width,width))
    b=io.BytesIO(); im.save(b,'WEBP',quality=83)
    return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
items=[]
for key,label in names.items():
    items.append({'id':key,'label':label,'new':encoded(root/'originals/saffron'/f'{key}.png'),'old':encoded(repo/'assets/art/saffron'/f'{key}.webp')})
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saffron Court · Sunbaked Courtyard complete set</title><style>
*{box-sizing:border-box}body{margin:0;background:#21170f;color:#fff1cf;font:16px system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}h1{font:36px Georgia,serif;margin:5px 0 10px}p{color:#d7bd91;line-height:1.5}button{background:#493017;color:#ffe6a7;border:1px solid #b88943;padding:11px 18px;border-radius:24px;cursor:pointer}button[aria-pressed=true]{background:#f0bd59;color:#24180d}nav{display:flex;gap:8px;position:sticky;top:0;background:#21170fee;padding:12px 0;z-index:2}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0;background:#302115;border:1px solid #624324;border-radius:12px;overflow:hidden}figure.wide{grid-column:1/-1}figure img{display:block;width:100%;height:auto}figure.card img{max-height:410px;object-fit:contain;background:#eee0bd}figcaption{padding:12px 15px;color:#edcf97}small{color:#cfad78} @media(max-width:650px){main{padding:12px}.grid{grid-template-columns:repeat(2,1fr)}figure.card{grid-column:auto}h1{font-size:29px}}
</style><main><small>ART DIRECTION PREVIEW · NANO BANANA 2.1</small><h1>Saffron Court, Sunbaked Courtyard</h1><p>The selected hero and card back, with a matching table, backdrop, and three artisan courts. Generated with the approved hero as a palette and lighting reference.</p><nav><button aria-pressed="true" onclick="show('new',this)">Sunbaked Courtyard set</button><button aria-pressed="false" onclick="show('old',this)">Previous art</button></nav><div class="grid" id="gallery"></div><p>Generated with gemini-nano-banana-2.1 through the repository Gemini generator. Prompts and full resolution PNGs are saved alongside this preview.</p></main><script>const items=DATA;function show(which,button){document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',b===button));document.getElementById('gallery').innerHTML=items.map(x=>`<figure class="${['hero','board','backdrop'].includes(x.id)?'wide':'card'}"><img src="${x[which]}" alt="${x.label}" loading="lazy"><figcaption>${x.label}</figcaption></figure>`).join('')}show('new',document.querySelector('button'));</script></html>'''.replace('DATA',json.dumps(items))
(root/'index.html').write_text(html)
canvas=Image.new('RGB',(1400,1350),'#21170f'); draw=ImageDraw.Draw(canvas)
draw.text((30,15),'SAFFRON COURT / SUNBAKED COURTYARD',fill='#fff1cf')
for key,box in [('hero',(20,50,900,545)),('back',(930,50,1380,650)),('board',(20,580,900,1075)),('court_j',(20,1100,280,1330)),('court_q',(330,1100,590,1330)),('court_k',(640,1100,900,1330))]:
    im=Image.open(root/'originals/saffron'/f'{key}.png').convert('RGB'); im.thumbnail((box[2]-box[0],box[3]-box[1]));canvas.paste(im,(box[0],box[1]));draw.text((box[0],box[1]-16),names[key],fill='#fff1cf')
im=Image.open(root/'originals/saffron/backdrop.png').convert('RGB');im=ImageOps.fit(im,(450,600));canvas.paste(im,(930,690));draw.text((930,670),'Backdrop',fill='#fff1cf')
canvas.save(root/'contact-sheet.jpg',quality=90)
print('Built preview:',root/'index.html')
print('HTML bytes:',len(html.encode()))
