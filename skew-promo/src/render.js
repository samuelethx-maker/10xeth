const puppeteer=require('puppeteer-core');const fs=require('fs');
const [,,mode,a,b,fps]=process.argv;const FPS=+(fps||60);
(async()=>{
 const br=await puppeteer.launch({executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
 const pg=await br.newPage();await pg.setViewport({width:1920,height:1080});
 pg.on('pageerror',e=>console.error('PAGEERR',e.message));pg.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text())});
 await pg.goto('http://127.0.0.1:8766/index.html');await pg.evaluate(()=>window.ready);
 const grab=async t=>{const d=await pg.evaluate(async t=>{await frame(t);return document.getElementById('c').toDataURL('image/png')},t);return Buffer.from(d.split(',')[1],'base64')};
 if(mode==='stills'){fs.mkdirSync('stills',{recursive:true});for(const t of a.split(','))fs.writeFileSync(`stills/${t}.png`,await grab(+t))}
 else{fs.mkdirSync('frames',{recursive:true});for(let f=+a;f<+b;f++){const p=`frames/${String(f).padStart(4,'0')}.png`;if(!fs.existsSync(p)){const buf=await grab(f/FPS);fs.writeFileSync(p+'.tmp',buf);fs.renameSync(p+'.tmp',p)}}}
 await br.close()})();
