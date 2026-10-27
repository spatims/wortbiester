import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, STAGE_NAMES, speciesFor, randomSpecies, stageFor, rollRarity, biestFor, perkFor, perksFor, describePerk } from '../js/core/biester.js';
import { rollRarity as huntRarity } from '../js/core/hunt.js';
import { seeded } from './helpers.mjs';

test('Arten: feste IDs, stabile Wortzuordnung und Verteilung über 2000 Wörter', () => {
  assert.equal(SPECIES.length, 12);
  assert.deepEqual(SPECIES.map(s => s.id), Array.from({length:12},(_,i)=>i));
  assert.equal(new Set(SPECIES.map(s=>s.name)).size,12);
  // Bekannte Werte sichern den Hash auch über spätere Umbauten hinweg.
  assert.equal(speciesFor(''), 1);
  assert.equal(speciesFor('a'), 4);
  assert.equal(speciesFor('explore'), speciesFor('explore'));
  for(const word of ['Äpfel','🐾','ice cream']) assert.ok(Number.isInteger(speciesFor(word)));
  const counts = Array(12).fill(0), rng=seeded(81);
  for(let i=0;i<2000;i++) {
    const word=Array.from({length:3+Math.floor(rng()*10)},()=>String.fromCharCode(97+Math.floor(rng()*26))).join('');
    counts[speciesFor(word)]++;
  }
  assert.ok(counts.every(n=>n>=60),counts.join(', '));
  assert.equal(randomSpecies(()=>0),0);
  assert.equal(randomSpecies(()=>.999999),11);
});

test('Boxen ergeben sechs begrenzte Stufen', () => {
  assert.deepEqual([-1,0,1,2,3,4,5,9].map(stageFor),[0,0,1,2,3,4,5,5]);
  assert.equal(stageFor(undefined),0); assert.equal(stageFor(NaN),0);
  assert.equal(stageFor(3.8),3);
  assert.equal(STAGE_NAMES.length,6);
});

test('Seltenheit entspricht Hunt an jeder Grenze und unterstützt beide min-Verträge', () => {
  for(const x of [0,.049999,.05,.299999,.30,.999999]) {
    for(const min of ['gewoehnlich','selten','episch']) {
      assert.equal(rollRarity(()=>x,min),huntRarity(()=>x,min));
      assert.equal(rollRarity(()=>x,{min}),huntRarity(()=>x,min));
    }
  }
  assert.equal(rollRarity(()=>.05),'selten');
  assert.equal(rollRarity(()=>.30),'gewoehnlich');
});

test('Jede Art bringt ab zahm einen Vorteil, insgesamt 4/4/4 ohne Dubletten', () => {
  for(const perk of ['schild','kombo-schutz','muenzen']) {
    assert.equal(SPECIES.filter(s=>s.perk===perk).length,4);
    assert.ok(describePerk(perk).length>20);
  }
  for(const sp of SPECIES) for(let stage=0;stage<6;stage++) {
    assert.equal(perkFor({species:sp.id,stage}),stage>=4?sp.perk:null);
  }
  assert.deepEqual(perksFor(SPECIES.flatMap(s=>[{species:s.id,stage:4},{species:s.id,stage:5}])),['schild','kombo-schutz','muenzen']);
  assert.deepEqual(perksFor([{species:0,stage:3}]),[]);
  assert.equal(describePerk(null),'');
});

test('Biest vereint Wort, Stand und Schmuck ohne sie zu verändern; due ist einschließlich', t => {
  t.mock.method(Date,'now',()=>1000);
  const word={id:'l|explore',en:'explore'};
  const record={box:4,due:1000};
  const state={rarity:'episch',hat:'helm',skin:'nacht'};
  const result=biestFor(word,record,state,'#6dd3ff');
  assert.deepEqual(result,{species:speciesFor(word.en),speciesName:SPECIES[speciesFor(word.en)].name,stage:4,rarity:'episch',color:'#6dd3ff',hat:'helm',skin:'nacht',name:'explore',wordId:word.id,hungrig:true});
  assert.equal(biestFor(word,{box:2,due:1001}).hungrig,false);
  assert.equal(biestFor(word,{box:2,due:999}).hungrig,true);
  const wild=biestFor(word,null);
  assert.equal(wild.stage,0); assert.equal(wild.hungrig,false);
  assert.equal(wild.rarity,'gewoehnlich'); assert.equal(wild.hat,null); assert.equal(wild.skin,null);
  assert.deepEqual(record,{box:4,due:1000}); assert.deepEqual(state,{rarity:'episch',hat:'helm',skin:'nacht'});
});

test('Zeichnung: alle Hüte und Muster deterministisch, Kontext ausgeglichen', async () => {
  const { drawBiest } = await import('../js/render/biest.js');
  function trace(biest) {
    const calls=[]; let depth=0;
    const ctx=new Proxy({}, {
      get:(_,key)=>(...args)=>{
        calls.push([key,...args]);
        if(key==='save')depth++;
        if(key==='restore')depth--;
        assert.ok(depth>=0);
      },
      set:(_,key,value)=>{calls.push([key,value]);return true;},
    });
    drawBiest(ctx,biest,{size:48,x:13,y:17,t:2});
    assert.equal(depth,0);
    return calls;
  }
  for(const hat of ['muetze','krone','hut','brille','schleife','helm']) for(const skin of ['streifen','punkte','flecken','nacht']) {
    const biest={species:7,stage:5,rarity:'episch',color:'#6fcf6a',hat,skin};
    assert.deepEqual(trace(biest),trace(biest));
    assert.notDeepEqual(trace(biest),trace({...biest,hat:null,skin:null}));
  }
});

test('Animation: Ruhe als Standbild, Wechsel zur Bewegung und stop räumt auf', async t => {
  const { animateBiest, biestCanvas }=await import('../js/render/biest.js');
  let quiet=true, callback, disconnected=false, removed=false, next=0;
  const frames=new Map(), times=[];
  const ctx=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  const canvas={width:192,height:192,style:{width:'96px'},getContext:()=>ctx,setAttribute:()=>{}};
  ctx.clearRect=()=>times.push('paint');
  const saved=new Map();
  function mockGlobal(key,value){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  t.after(()=>{for(const [key,descriptor] of saved) {
    if(descriptor) Object.defineProperty(globalThis,key,descriptor);
    else delete globalThis[key];
  }});
  mockGlobal('document',{createElement:()=>canvas,documentElement:{classList:{contains:()=>quiet}}});
  mockGlobal('devicePixelRatio',2);
  mockGlobal('MutationObserver',class { constructor(cb){callback=cb;} observe(){} disconnect(){disconnected=true;} });
  mockGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){removed=true;}}));
  mockGlobal('requestAnimationFrame',cb=>{frames.set(++next,cb);return next;});
  mockGlobal('cancelAnimationFrame',id=>frames.delete(id));
  const biest={species:0,stage:4,color:'#6fcf6a'};
  assert.equal(biestCanvas(biest,{size:96}),canvas);
  assert.equal(canvas.width,192);
  const stop=animateBiest(canvas,biest,()=> 'ruhig');
  assert.equal(times.length,1); assert.equal(frames.size,0);
  quiet=false; callback(); assert.equal(frames.size,1);
  quiet=true; callback(); assert.equal(frames.size,0);
  quiet=false; callback(); assert.equal(frames.size,1);
  stop(); stop(); assert.equal(frames.size,0); assert.ok(disconnected && removed);
});
