// Install only the 18 approved themes; leave all 24 secondary preview cards untouched.
import {copyFileSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {OBJECT_COURTS} from '../../../tools/court-object-content.mjs';
import {THEMES,THEME_ORDER} from '../../../js/themes.js';
const root='docs/previews/object-courts';
const primary=Object.keys(OBJECT_COURTS).filter(id=>OBJECT_COURTS[id].status==='approved');
const expected=new Set(primary.flatMap(id=>[...'jqk'].map(r=>`${id}/court_${r}.webp`)));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const before=Object.fromEntries(THEME_ORDER.flatMap(id=>[...'jqk'].map(r=>{const key=`${id}/court_${r}.webp`;return[key,hash('assets/art/'+key)];})));
if(primary.length!==18||expected.size!==54)throw Error('Wrong approval scope');
for(const id of primary)for(const r of 'jqk'){
 const src=`${root}/originals/${id}/court_${r}.png`;
 if(!existsSync(src))throw Error('Missing generated art: '+src);
 if(THEMES[id].card.courtFit!=='contain')throw Error('Object fitting not enabled: '+id);
}
for(const [id,d]of Object.entries(OBJECT_COURTS))if(d.status==='preview')for(const r of 'jqk'){
 if(hash(`assets/art/${id}/court_${r}.webp`)!==hash(`${root}/before/${id}/court_${r}.webp`))throw Error('Secondary changed before install: '+id);
}
for(const id of primary){
 mkdirSync(`assets-src/art/${id}`,{recursive:true});
 for(const r of 'jqk'){
  const src=`${root}/originals/${id}/court_${r}.png`,dest=`assets/art/${id}/court_${r}.webp`;
  copyFileSync(src,`assets-src/art/${id}/court_${r}.png`);
  execFileSync('ffmpeg',['-v','error','-y','-i',src,'-vf','scale=768:768:flags=lanczos','-c:v','libwebp','-quality','88','-compression_level','6',dest]);
 }
 console.log('Installed',id);
}
const changed=[];
for(const[key,original]of Object.entries(before)){
 const different=hash('assets/art/'+key)!==original;
 if(different&&!expected.has(key))throw Error('Unexpected court replacement: '+key);
 if(different)changed.push(key);
}
if(changed.length!==54)throw Error('Expected 54 installed replacements');
writeFileSync(root+'/installation.json',JSON.stringify({model:'gemini-nano-banana-2.1',installedThemes:primary,installedImages:changed,secondaryActiveSetsUnchanged:true,otherActiveCourtSetsUnchanged:true},null,2)+'\n');
console.log('Verified exactly 54 replacements; every secondary and other court asset unchanged.');
