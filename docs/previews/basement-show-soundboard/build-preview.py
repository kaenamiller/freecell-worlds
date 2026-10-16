from pathlib import Path
from PIL import Image
import io,base64
root=Path(__file__).resolve().parent
def uri(p):
 im=Image.open(p).convert('RGB');im.thumbnail((1440,900));b=io.BytesIO();im.save(b,'WEBP',quality=88)
 return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
new=root/'originals/safetypin/hero.png'
old=root.parent/'basement-show-crowd-first/originals/jumping-silhouettes/hero.png'
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Basement Show · Soundboard & cards</title><style>body{margin:0;background:#141414;color:#eee;font:15px system-ui}main{max-width:1280px;margin:auto;padding:20px}h1{font-size:28px}p{color:#bbb}button{padding:11px 17px;background:#eee;color:#111;border:0;cursor:pointer;margin:0 8px 15px 0}img{display:block;width:100%;height:auto}small{color:#aaa}</style><main><small>NANO BANANA 2.1 · PREVIEW</small><h1>In the Crowd — soundboard & cards</h1><p>The crowd-first scene with a fan of safety-pin cards on a battered mixing desk in the bottom-right quadrant. The installed hero is unchanged.</p><button onclick="document.getElementById('hero').src=after">With soundboard & cards</button><button onclick="document.getElementById('hero').src=before">Original crowd scene</button><img id="hero" alt="Crowd-first basement show with cards on a soundboard"></main><script>const after='AFTER',before='BEFORE';document.getElementById('hero').src=after;</script></html>'''.replace('AFTER',uri(new)).replace('BEFORE',uri(old))
(root/'index.html').write_text(html)
im=Image.open(new).convert('RGB');im.thumbnail((1600,1000));im.save(root/'preview.jpg',quality=93)
print('Built comparison preview:',len(html.encode()),'bytes')
