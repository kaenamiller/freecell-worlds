import {createRequire} from 'node:module';import {homedir} from 'node:os';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(homedir()+'/Documents/mahjpods/film/package.json');const puppeteer=require('puppeteer-core');
const root='docs/previews/object-courts/selected';const items=JSON.parse(readFileSync(root+'/manifest.json','utf8'));const requested=process.argv.slice(2);const themes=[...new Set(items.map(x=>x.theme))].filter(id=>!requested.length||requested.includes(id));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let count=0;
try{
 await page.goto('http://localhost:8139/'+root+'/render-check.html');await page.waitForFunction(()=>!!window.renderCourtSet);
 for(const theme of themes)for(const side of ['before','after']){
  const {output,checks}=await page.evaluate((t,s)=>window.renderCourtSet(t,s),theme,side);count+=checks;
  mkdirSync(`${root}/rendered/${side}/${theme}`,{recursive:true});
  for(const [r,data]of Object.entries(output))writeFileSync(`${root}/rendered/${side}/${theme}/court_${r}.webp`,Buffer.from(data.split(',')[1],'base64'));
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Rendered checks:',count,'across',themes.length,'themes, old/new, all suits, standard/four-color/high-contrast.');
 writeFileSync(root+'/render-validation.json',JSON.stringify({themes:themes.length,renderedChecks:count,pageErrors:errors},null,2)+'\n');
}finally{await browser.close();}
