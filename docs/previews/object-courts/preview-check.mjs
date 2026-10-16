import {createRequire} from 'node:module';import {homedir} from 'node:os';import {writeFileSync} from 'node:fs';
const require=createRequire(homedir()+'/Documents/mahjpods/film/package.json');const puppeteer=require('puppeteer-core');
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();await page.setViewport({width:1280,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const[name,count]of[['primary',18],['secondary',8]]){
 await page.goto(`http://localhost:8139/docs/previews/object-courts/${name}.html`);await page.waitForFunction(()=>document.querySelectorAll('section').length>0);
 const result=await page.evaluate(async()=>{await Promise.all([...document.images].map(im=>im.decode()));return {themes:document.querySelectorAll('section').length,images:document.images.length,allImagesLoaded:[...document.images].every(im=>im.naturalWidth>0)}});
 if(result.themes!==count||result.images!==count*6||!result.allImagesLoaded)throw Error('Bad preview '+name);
 await page.select('select',name==='secondary'?'cafe':'museum');if(await page.$$eval('section',a=>a.length)!==1)throw Error('Theme filter failed');
 await page.click('button:nth-child(2)');if(await page.$eval('#gallery',e=>e.className)!=='new-only')throw Error('New-only toggle failed');
 await page.click('button:nth-child(1)');await page.select('select','all');console.log(name,result);
 if(name==='secondary')await page.screenshot({path:'docs/previews/object-courts/secondary-page-check.png'});
}
if(errors.length)throw Error(errors.join('\n'));writeFileSync('docs/previews/object-courts/preview-validation.json',JSON.stringify({primaryThemes:18,secondaryThemes:8,allImagesDecoded:true,themeFilter:true,modeToggle:true,pageErrors:errors},null,2)+'\n');
}finally{await browser.close();}
