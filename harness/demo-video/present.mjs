// Mend — generate a self-contained, auto-playing LIVE demo page you can
// screen-record. Bakes the REAL receipt data + deploy URL into one HTML file that
// animates through the whole story (naive counter, four gates, convergence, the
// caught-and-reverted stamp, a receipt, the live Zero link), with captions and
// optional in-browser narration (Web Speech). Runs locally (open the file or serve
// it) and is deployable to Zero (<500KB, self-contained).
//
// Output: dashboard/present.html   Usage: node harness/demo-video/present.mjs

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const readJSON = (p, f = null) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return f; } };

// ---- real data
const receipts = [];
const rd = resolve(ROOT, "receipts");
for (const d of readdirSync(rd).sort()) {
  const r = readJSON(resolve(rd, d, "receipt.json"));
  if (!r) continue;
  let patch = "";
  try { patch = readFileSync(resolve(rd, d, "patch.diff"), "utf8"); } catch {}
  receipts.push({
    seq: r.seq, rule: r.ruleId, impact: r.impact, decision: r.decision, selector: r.selector,
    file: r.source?.file, gates: (r.gates ?? []).map((g) => ({ name: g.name.replace(/^gate/, "g").replace(/-/g, " "), pass: g.pass })),
    critic: r.critic ? { verdict: r.critic.verdict, reason: r.critic.reason } : null,
    before: r.beforeCount, after: r.afterCount,
    patch: patch.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-") || l.startsWith("@@")).slice(0, 8).join("\n"),
    models: r.models ?? null,
  });
}
const seed = readJSON(resolve(ROOT, "runs/000-before/axe.json"))?.totals?.violations ?? 561;
const deploy = readJSON(resolve(ROOT, "runs/deploy.json")) ?? {};
const accepts = receipts.filter((r) => r.decision === "accept");
const reverts = receipts.filter((r) => r.decision === "revert");
const fixed = accepts.reduce((n, r) => n + Math.max(0, (r.before ?? 0) - (r.after ?? 0)), 0);

// ---- narration beats (caption + spoken). Reuse the demo script wording.
const BEATS = [
  { id: "title", caption: "Mend — the accessibility healer", say: "This is Mend. It repairs website accessibility in the source code, and it refuses to believe itself.", min: 5200 },
  { id: "naive", caption: "The naive loop games the counter", say: "Hand a naive agent a page and it games the counter — it deletes the login buttons and hides the label. The number drops, but the site got worse. The counter lies.", min: 8500 },
  { id: "thesis", caption: "The model is the commodity. The harness is the product.", say: "Claude can write the fix. Only a harness can prove it. So every fix must survive four gates before it counts.", min: 6000 },
  { id: "loop", caption: "scan → map to source → patch → verify", say: "Mend scans with axe, maps each violation to the exact source line, patches the source, and verifies.", min: 6500 },
  { id: "gates", caption: "4 gates · axe · pixel-diff · banned-patterns · IBM Equal Access", say: "Gate one, the violation is gone. Gate two, not a single pixel moved. Gate three, no suppression tricks. Gate four, an independent engine agrees.", min: 9000 },
  { id: "critic", caption: "Independent critic — an open model on Akash", say: "For anything semantic, an independent critic on Akash — a different model family — judges whether the fix is actually true. The fixer can't grade its own homework.", min: 8500 },
  { id: "revert", caption: "Caught & reverted — the revert is the product", say: "And here is the moment that matters. A fix tries to hide a violation instead of fixing it. The harness catches it, and reverts it. That revert is the product.", min: 8500 },
  { id: "receipt", caption: "Every fix ships a receipt", say: "Every fix, accepted or reverted, ships a receipt: the before and after, the exact patch, all four gate results, and the critic's verdict.", min: 8000 },
  { id: "deploy", caption: "The agent self-deploys the healed site via Zero — live, $0", say: "Then the agent deploys the healed site itself, to a live link, through Zero, paying nothing. The cured patient ships itself.", min: 7500 },
  { id: "close", caption: "We fix verified violations. We hand you the evidence.", say: "We fix verified violations, and we hand you the evidence. Mend.", min: 5000 },
];

const DATA = { seed, fixed, accepts: accepts.length, reverts: reverts.length, receipts, deploy: { url: deploy.url ?? null }, beats: BEATS };

const html = TEMPLATE().replace("/*__DATA__*/", JSON.stringify(DATA));
const outPath = resolve(ROOT, "dashboard/present.html");
writeFileSync(outPath, html);
console.log(`✓ ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(0)}KB) — open it or serve dashboard/ and screen-record.`);
if (Buffer.byteLength(html) < 500 * 1024) console.log("  under 500KB → deployable to Zero (npm run deploy points at target pages; this is a standalone file).");

function TEMPLATE() {
  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mend — live demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#080c11;--ink2:#0d131a;--panel:#101822;--panel2:#0b1119;--line:rgba(180,205,235,.09);--line2:rgba(180,205,235,.16);
--teal:#33c9b0;--teal-br:#74f0d8;--teal-dim:#123f39;--amber:#eaa63f;--red:#ff5b62;--red-deep:#c0353b;--red-dim:#3a1417;
--txt:#e9eff7;--soft:#c3cedd;--mut:#78859a;--display:'Fraunces',Georgia,serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:var(--txt);font-family:var(--mono);height:100vh;overflow:hidden;
background-image:radial-gradient(1100px 620px at 78% -8%,rgba(51,201,176,.09),transparent 60%),radial-gradient(900px 520px at 8% 108%,rgba(234,166,63,.06),transparent 55%),linear-gradient(rgba(180,205,235,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(180,205,235,.028) 1px,transparent 1px);
background-size:100% 100%,100% 100%,46px 46px,46px 46px;}
.wrap{height:100vh;display:flex;flex-direction:column;padding:26px clamp(20px,4vw,64px)}
header{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--line2);padding-bottom:16px}
.mark{font-family:var(--display);font-weight:700;font-size:34px;letter-spacing:-.02em}.mark .d{color:var(--teal-br)}
.kick{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--mut)}
.flow{margin-left:8px;font-size:12px;color:var(--soft);letter-spacing:.05em}.flow b{color:var(--teal-br)}
.status{margin-left:auto;display:flex;gap:14px;align-items:center;font-size:12px;color:var(--mut)}
.status button{font-family:var(--mono);font-size:12px;color:var(--soft);background:var(--panel);border:1px solid var(--line2);border-radius:8px;padding:7px 12px;cursor:pointer}
.status button:hover{border-color:var(--teal)}
.stage{flex:1;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;grid-template-rows:auto 1fr;gap:16px;padding:22px 0;min-height:0}
.vital{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:16px;padding:18px 20px;position:relative;overflow:hidden}
.vital .l{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.vital .n{font-family:var(--display);font-weight:600;font-size:clamp(40px,5.4vw,78px);line-height:.92;letter-spacing:-.03em;color:var(--teal-br);font-variant-numeric:tabular-nums}
.vital.rev .n{color:var(--red)}.vital.seed .n{color:var(--amber)}.vital .c{margin-top:6px;font-size:11px;color:var(--soft)}
.left{grid-column:1;grid-row:2;min-height:0;display:flex;flex-direction:column}
.right{grid-column:2 / span 3;grid-row:2;min-height:0;position:relative}
.sect{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--mut);margin-bottom:12px}
#log{overflow:hidden;display:flex;flex-direction:column;gap:10px}
.row{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--teal);border-radius:11px;padding:12px 14px;opacity:0;transform:translateX(-14px);transition:opacity .4s,transform .4s}
.row.in{opacity:1;transform:none}.row.rev{border-left-color:var(--red)}
.row .t{display:flex;align-items:center;gap:10px}.row .seq{font-size:12px;color:var(--mut)}
.row .rule{font-family:var(--display);font-size:17px;font-weight:600}
.row .v{margin-left:auto;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:3px 9px;border-radius:99px}
.v.acc{background:var(--teal-dim);color:var(--teal-br)}.v.rev{background:var(--red-dim);color:#ff989c}
.lamps{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.lamp{display:flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.05em;padding:4px 8px;border-radius:6px;border:1px solid var(--line);color:var(--mut);text-transform:uppercase;opacity:.35;transition:opacity .3s}
.lamp.on{opacity:1}.lamp .d{width:6px;height:6px;border-radius:50%;background:var(--mut)}
.lamp.ok{color:var(--teal-br);border-color:rgba(51,201,176,.28);background:rgba(51,201,176,.07)}.lamp.ok .d{background:var(--teal-br);box-shadow:0 0 7px var(--teal-br)}
.lamp.no{color:#ff989c;border-color:rgba(192,53,59,.4);background:rgba(192,53,59,.1)}.lamp.no .d{background:var(--red);box-shadow:0 0 7px var(--red)}
.crit{margin-top:9px;font-size:11px;color:var(--soft);font-style:italic;border-top:1px dashed var(--line2);padding-top:8px;opacity:0;transition:opacity .4s}.crit.in{opacity:1}.crit b{color:var(--teal-br);font-style:normal}
/* spotlight cards in the right column */
.card{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:24px}
.card.show{display:flex;animation:rise .5s ease}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.card h2{font-family:var(--display);font-weight:700;font-size:clamp(26px,3.4vw,46px);line-height:1.05;letter-spacing:-.01em}
.card p{margin-top:14px;color:var(--soft);font-size:15px;max-width:46ch;line-height:1.6}
.gatechips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:22px}
.gatechips .g{font-family:var(--mono);font-size:13px;color:var(--soft);background:var(--panel);border:1px solid var(--line2);border-radius:10px;padding:10px 14px;opacity:0;transform:scale(.9);transition:.4s}
.gatechips .g.in{opacity:1;transform:none;color:var(--teal-br);border-color:var(--teal-dim)}
.stamp{font-family:var(--display);font-weight:700;font-size:34px;letter-spacing:.05em;padding:12px 22px;border:3px solid var(--red-deep);color:#ff8b90;border-radius:10px;transform:rotate(-8deg);text-transform:uppercase;margin-top:20px;opacity:0}
.stamp.slam{animation:slam .5s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes slam{0%{opacity:0;transform:rotate(-8deg) scale(2.6)}60%{opacity:1}100%{opacity:1;transform:rotate(-8deg) scale(1)}}
.naiveN{font-family:var(--display);font-size:64px;color:var(--amber);font-variant-numeric:tabular-nums}
.strike{color:var(--red);text-decoration:line-through;opacity:.85}
.dlink{display:inline-block;margin-top:20px;font-size:16px;color:var(--teal-br);text-decoration:none;border:1px solid var(--teal);border-radius:10px;padding:12px 18px}
.patch{font-size:11.5px;line-height:1.6;text-align:left;background:#0a0f16;border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-top:16px;max-width:640px;overflow:auto;white-space:pre}
.patch .a{color:var(--teal-br)}.patch .r{color:#ff9a9d}.patch .h{color:var(--mut)}
/* caption bar */
.cap{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;padding:0 0 40px;pointer-events:none;z-index:30}
.cap span{font-family:var(--display);font-weight:600;font-size:clamp(20px,2.4vw,34px);color:#fff;background:rgba(8,12,17,.82);border:1px solid var(--line2);border-radius:14px;padding:14px 26px;text-align:center;max-width:80vw;opacity:0;transform:translateY(10px);transition:opacity .4s,transform .4s;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.cap.show span{opacity:1;transform:none}
/* progress */
#bar{position:fixed;top:0;left:0;height:3px;background:var(--teal-br);width:0;z-index:40;transition:width .3s}
/* start overlay */
#start{position:fixed;inset:0;z-index:50;background:radial-gradient(1200px 700px at 50% 30%,rgba(51,201,176,.12),transparent 60%),var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;cursor:pointer}
#start .b{font-family:var(--display);font-weight:700;font-size:clamp(48px,8vw,110px);letter-spacing:-.02em}#start .b .d{color:var(--teal-br)}
#start .t{color:var(--soft);font-size:16px;letter-spacing:.02em}
#start .go{margin-top:8px;font-family:var(--mono);font-size:15px;color:#03231e;background:var(--teal-br);border:0;border-radius:12px;padding:14px 28px;cursor:pointer;font-weight:600}
#start label{font-size:12px;color:var(--mut);display:flex;gap:8px;align-items:center;margin-top:6px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head>
<body>
<div id="bar"></div>
<div class="wrap">
  <header>
    <div><div class="kick">Mend · self-verifying repair loop</div><div class="mark">Mend<span class="d">.</span></div></div>
    <div class="flow"><b>fix</b> → <b>verify</b> → <b>receipt</b></div>
    <div class="status"><span id="beatlabel">ready</span><button id="mute">🔊 narration on</button><button id="restart">⟲ restart</button></div>
  </header>
  <div class="stage">
    <div class="vital"><div class="l">Violation nodes fixed &amp; verified</div><div class="n" id="v-fixed">0</div><div class="c">accepted through all four gates + the critic</div></div>
    <div class="vital"><div class="l">Fixes accepted</div><div class="n" id="v-acc">0</div><div class="c">each committed with a receipt</div></div>
    <div class="vital rev"><div class="l">Caught &amp; reverted</div><div class="n" id="v-rev">0</div><div class="c">the revert is the product</div></div>
    <div class="vital seed"><div class="l">Seed violations (axe)</div><div class="n" id="v-seed">0</div><div class="c">axe-core + IBM Equal Access</div></div>
    <div class="left"><div class="sect">Round log — live</div><div id="log"></div></div>
    <div class="right" id="spot">
      <div class="card" id="card-naive"><div class="l" style="color:var(--mut);letter-spacing:.2em;text-transform:uppercase;font-size:11px">Act 1 · the naive loop</div>
        <div style="margin-top:14px"><span class="naiveN" id="naiveN">8</span> <span style="color:var(--mut)">→</span> <span class="naiveN" id="naiveN2" style="color:var(--red)">4</span></div>
        <p>The counter dropped — by <span class="strike">deleting the Login buttons</span> and <span class="strike">hiding the label</span>. Fewer violations reported, worse for real users.</p></div>
      <div class="card" id="card-gates"><h2>Four gates, or it doesn't count</h2>
        <div class="gatechips" id="gatechips"><span class="g">axe re-scan</span><span class="g">pixel-diff = 0</span><span class="g">no suppression</span><span class="g">IBM Equal Access</span></div></div>
      <div class="card" id="card-critic"><h2>The judge isn't the worker</h2><p>Semantic fixes — alt text, labels — are judged by an <b style="color:var(--teal-br)">independent open model on Akash</b>. A different model family, so the fixer can never grade its own homework.</p></div>
      <div class="card" id="card-revert"><h2 style="color:var(--red)">Suppression, caught</h2><p>A fix tried to hide a violation with <code>aria-hidden</code> instead of fixing it.</p><div class="stamp" id="revstamp">Reverted · caught</div></div>
      <div class="card" id="card-receipt"><h2>Every fix ships a receipt</h2><div class="patch" id="rpatch"></div><p id="rcritic" style="margin-top:12px"></p></div>
      <div class="card" id="card-deploy"><h2>The cured patient ships itself</h2><p>The agent deployed the healed site via <b style="color:var(--teal-br)">Zero</b> — live, no keys, $0.</p><a class="dlink" id="dlink" href="#" target="_blank" rel="noopener">↗ open the live healed site</a></div>
      <div class="card" id="card-close"><h2>We fix verified violations.<br>We hand you the <span style="color:var(--teal-br)">evidence</span>.</h2></div>
    </div>
  </div>
</div>
<div class="cap" id="cap"><span id="captext"></span></div>
<div id="start">
  <div class="kick" style="letter-spacing:.32em">Loop Engineering Hackathon</div>
  <div class="b">Mend<span class="d">.</span></div>
  <div class="t">A self-verifying accessibility repair loop — live demo</div>
  <button class="go" id="go">▶ Play the demo</button>
  <label><input type="checkbox" id="narr" checked> in-browser narration (Web Speech)</label>
</div>
<script>
const DATA=/*__DATA__*/;
const $=(id)=>document.getElementById(id);
let muted=false, voice=null, timer=null, beatIdx=-1;

function pickVoice(){ const vs=speechSynthesis.getVoices(); voice=vs.find(v=>/Samantha|Google US English|en-US/.test(v.name+v.lang))||vs.find(v=>/^en/.test(v.lang))||vs[0]||null; }
speechSynthesis.onvoiceschanged=pickVoice; pickVoice();
function speak(text,onend){ if(muted||!('speechSynthesis'in window)){onend&&setTimeout(onend,0);return null;}
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); if(voice)u.voice=voice; u.rate=1.02; u.pitch=1; u.onend=()=>onend&&onend(); speechSynthesis.speak(u); return u; }

function count(el,to,dur=900){ const from=+String(el.textContent).replace(/\D/g,'')||0; if(from===to){el.textContent=to;return;} const t0=performance.now();
  (function f(t){const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=Math.round(from+(to-from)*e);if(p<1)requestAnimationFrame(f);})(t0); }

const gnames={"g1 axe":"axe","g2 pixel":"pixel","g2b contrast":"contrast","g3 patterns":"patterns","g4 engine2":"engine2"};
function addRow(r,delay){ const el=document.createElement('div'); el.className='row '+(r.decision==='accept'?'':'rev');
  const lamps=r.gates.map(g=>'<span class="lamp '+(g.pass?'ok':'no')+'"><span class="d"></span>'+(gnames[g.name]||g.name)+'</span>').join('');
  const crit=r.critic?'<div class="crit"><b>critic '+r.critic.verdict+'</b> — '+r.critic.reason+'</div>':'';
  el.innerHTML='<div class="t"><span class="seq">#'+String(r.seq).padStart(2,'0')+'</span><span class="rule">'+r.rule+'</span><span class="v '+(r.decision==='accept'?'acc':'rev')+'">'+(r.decision==='accept'?'accepted':'reverted')+'</span></div>'+
    '<div class="lamps">'+lamps+'</div>'+crit;
  $('log').prepend(el);
  // keep only the last 4 visible
  while($('log').children.length>4)$('log').lastChild.remove();
  setTimeout(()=>{el.classList.add('in'); el.querySelectorAll('.lamp').forEach((l,i)=>setTimeout(()=>l.classList.add('on'),120+i*120)); const c=el.querySelector('.crit'); if(c)setTimeout(()=>c.classList.add('in'),700);},delay||30);
  return el;
}
function showCard(id){ document.querySelectorAll('.card').forEach(c=>c.classList.remove('show')); if(id)$('card-'+id).classList.add('show'); }
function caption(t){ $('captext').textContent=t; $('cap').classList.add('show'); }

// beat actions
const R=DATA.receipts;
const actions={
  title(){ showCard(); caption(DATA.beats[0].caption); },
  naive(){ showCard('naive'); count($('naiveN'),8,600); count($('naiveN2'),4,900); },
  thesis(){ showCard('gates'); [...$('gatechips').children].forEach((g,i)=>setTimeout(()=>g.classList.add('in'),200+i*260)); },
  loop(){ showCard(); addRow(R[0],60); count($('v-fixed'),Math.max(0,(R[0].before||0)-(R[0].after||0)),700); count($('v-acc'),1,700); setTimeout(()=>{addRow(R[1],20);count($('v-acc'),2);},1600); },
  gates(){ showCard('gates'); [...$('gatechips').children].forEach(g=>g.classList.add('in')); },
  critic(){ showCard('critic'); },
  revert(){ showCard('revert'); const rev=R.find(r=>r.decision==='revert'); addRow(rev,60); count($('v-rev'),1,600); setTimeout(()=>$('revstamp').classList.add('slam'),700); },
  receipt(){ const acc=R.filter(r=>r.decision==='accept'); acc.slice(2).forEach((r,i)=>setTimeout(()=>addRow(r,20),200+i*500));
    const withPatch=acc.find(r=>r.critic)||acc[0]; showCard('receipt');
    $('rpatch').innerHTML=(withPatch.patch||'').split('\n').map(l=>l.startsWith('+')?'<span class="a">'+esc(l)+'</span>':l.startsWith('-')?'<span class="r">'+esc(l)+'</span>':'<span class="h">'+esc(l)+'</span>').join('\n');
    $('rcritic').innerHTML=withPatch.critic?'<b style="color:var(--teal-br)">critic '+withPatch.critic.verdict+'</b> — '+esc(withPatch.critic.reason):'';
    count($('v-fixed'),DATA.fixed); count($('v-acc'),DATA.accepts); },
  deploy(){ showCard('deploy'); if(DATA.deploy.url){$('dlink').href=DATA.deploy.url;$('dlink').textContent='↗ '+DATA.deploy.url;} },
  close(){ showCard('close'); }
};
function esc(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function playBeat(i){ if(i>=DATA.beats.length){ finish(); return; } beatIdx=i; const b=DATA.beats[i];
  $('bar').style.width=((i+1)/DATA.beats.length*100)+'%'; $('beatlabel').textContent='playing · '+(i+1)+'/'+DATA.beats.length;
  caption(b.caption); (actions[b.id]||(()=>{}))();
  let ended=false; const done=()=>{ if(ended)return; ended=true; clearTimeout(timer); playBeat(i+1); };
  if(muted){
    // no speech — hold each beat for its own duration so visuals can breathe
    timer=setTimeout(done, b.min);
  } else {
    // narrated — advance when the voice finishes (+ a beat), with a generous
    // safety cap so a stalled voice can never freeze the demo
    speak(b.say, ()=> setTimeout(done, 650));
    timer=setTimeout(done, b.min + 6000);
  }
}
function finish(){ $('beatlabel').textContent='done'; caption(DATA.beats[DATA.beats.length-1].caption); }
function start(){ $('v-seed').textContent=DATA.seed; count($('v-seed'),DATA.seed,900); $('start').style.display='none'; playBeat(0); }
function restart(){ clearTimeout(timer); speechSynthesis.cancel(); ['v-fixed','v-acc','v-rev'].forEach(id=>$(id).textContent='0'); $('log').innerHTML=''; document.querySelectorAll('.gatechips .g').forEach(g=>g.classList.remove('in')); $('revstamp').classList.remove('slam'); showCard(); playBeat(0); }

$('go').addEventListener('click',()=>{ muted=!$('narr').checked; $('mute').textContent=muted?'🔇 narration off':'🔊 narration on'; if(!muted){const w=new SpeechSynthesisUtterance(' ');speechSynthesis.speak(w);} start(); });
$('start').addEventListener('click',(e)=>{ if(e.target.id==='start'){$('go').click();} });
$('mute').addEventListener('click',()=>{ muted=!muted; $('mute').textContent=muted?'🔇 narration off':'🔊 narration on'; if(muted)speechSynthesis.cancel(); });
$('restart').addEventListener('click',restart);
addEventListener('keydown',e=>{ if(e.key===' '){e.preventDefault(); $('start').style.display!=='none'?$('go').click():restart();} });
$('v-seed').textContent=DATA.seed;
</script>
</body></html>`;
}
