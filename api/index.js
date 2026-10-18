// server/review-client.ts
function validReviewRows(value) {
  return Array.isArray(value) && value.length <= 2e3 && value.every((r) => r && typeof r === "object" && typeof r.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(r.id) && typeof r.title === "string" && r.title.length <= 2e3 && typeof r.ref === "string" && r.ref.length <= 100 && typeof r.note === "string" && r.note.length <= 1e4 && ["to_review", "in_progress", "needs_documents", "explained"].includes(r.status) && typeof r.updated_at === "string" && Number.isFinite(Date.parse(r.updated_at))) && new Set(value.map((r) => r.id)).size === value.length;
}
var REVIEW_SCRIPT = `<script>
(()=>{
const editor=document.querySelector('[data-review-editor]'), list=document.getElementById('review-list');
if(!editor&&!list)return;
const valid=${validReviewRows.toString()}, key='tendoscope-review-v1';
const labels={to_review:'\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438',in_progress:'\u0423 \u0440\u043E\u0431\u043E\u0442\u0456',needs_documents:'\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438',explained:'\u0404 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F'};
const message=document.getElementById('review-message');let loadedVersion=null;
function say(text){message.textContent=text;}
function read(){const rows=JSON.parse(localStorage.getItem(key)||'[]');if(!valid(rows))throw Error('invalid');return rows;}
function save(rows){if(!valid(rows))throw Error('invalid');localStorage.setItem(key,JSON.stringify(rows));}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function draw(){if(!list)return;const rows=read(),status=document.getElementById('review-filter').value,query=document.getElementById('review-search').value.toLocaleLowerCase();list.replaceChildren();
const selected=rows.filter(r=>(!status||r.status===status)&&[r.title,r.ref,r.note].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
document.getElementById('review-count').textContent=selected.length+' \u0456\u0437 '+rows.length;
if(!selected.length){list.append(node('p',rows.length?'\u0417\u0430 \u0446\u0438\u043C\u0438 \u0443\u043C\u043E\u0432\u0430\u043C\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435\u043C\u0430\u0454.':'\u0412\u0456\u0434\u043A\u0440\u0438\u0439\u0442\u0435 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0442\u0430 \u043D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \xAB\u041C\u043E\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430\xBB, \u0449\u043E\u0431 \u0434\u043E\u0434\u0430\u0442\u0438 \u0457\u0457 \u0441\u044E\u0434\u0438.'));return;}
selected.forEach(r=>{const card=node('article','');card.className='review-card';card.append(node('small',labels[r.status]));const title=node('a',r.title);title.href='/tender/'+encodeURIComponent(r.id)+'?from=%2Freview';card.append(title,node('span',r.ref));if(r.note){const note=node('p',r.note);note.className='review-note';card.append(note);}card.append(node('small','\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043E '+new Date(r.updated_at).toLocaleString('uk-UA')));list.append(card);});}
function loadEditor(){if(!editor)return;const meta=JSON.parse(editor.dataset.reviewEditor), row=read().find(r=>r.id===meta.id);loadedVersion=row?.updated_at||null;editor.elements.status.value=row?.status||'to_review';editor.elements.note.value=row?.note||'';}
try{loadEditor();draw();}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0443 \u0447\u0435\u0440\u0433\u0443. \u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0435; \u043D\u0430\u044F\u0432\u043D\u0456 \u0434\u0430\u043D\u0456 \u043D\u0435 \u0437\u043C\u0456\u043D\u0435\u043D\u043E.');}
editor?.addEventListener('submit',event=>{event.preventDefault();try{const rows=read(),meta=JSON.parse(editor.dataset.reviewEditor),current=rows.find(r=>r.id===meta.id);if((current?.updated_at||null)!==loadedVersion){say('\u0417\u0430\u043F\u0438\u0441 \u0437\u043C\u0456\u043D\u0438\u0432\u0441\u044F \u0432 \u0456\u043D\u0448\u0456\u0439 \u0432\u043A\u043B\u0430\u0434\u0446\u0456. \u0421\u043A\u043E\u043F\u0456\u044E\u0439\u0442\u0435 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0442\u0430 \u043E\u043D\u043E\u0432\u0456\u0442\u044C \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443 \u043F\u0435\u0440\u0435\u0434 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F\u043C.');return;}const row={...meta,status:editor.elements.status.value,note:editor.elements.note.value,updated_at:new Date().toISOString()};save([...rows.filter(r=>r.id!==row.id),row]);loadedVersion=row.updated_at;say('\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u0443 \u0446\u044C\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456.');}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0434\u043E\u0441\u0442\u0443\u043F \u0434\u043E \u0441\u0445\u043E\u0432\u0438\u0449\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0430\u0431\u043E \u0435\u043A\u0441\u043F\u043E\u0440\u0442\u0443\u0439\u0442\u0435 \u0447\u0435\u0440\u0433\u0443.');}});
for(const id of ['review-filter','review-search'])document.getElementById(id)?.addEventListener('input',()=>{try{draw();}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u0438 \u0447\u0435\u0440\u0433\u0443.');}});
document.getElementById('review-export')?.addEventListener('click',()=>{try{const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a','');a.href=url;a.download='tendoscope-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0443 \u043A\u043E\u043F\u0456\u044E \u043F\u0456\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043E. \u0412\u043E\u043D\u0430 \u043C\u0456\u0441\u0442\u0438\u0442\u044C \u0432\u0430\u0448\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438.');}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0435\u043A\u0441\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u0447\u0435\u0440\u0433\u0443.');}});
document.getElementById('review-import')?.addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>5000000)throw Error('size');const incoming=JSON.parse(await file.text());if(!valid(incoming))throw Error('invalid');const merged=new Map(read().map(r=>[r.id,r]));incoming.forEach(r=>{const old=merged.get(r.id);if(!old||Date.parse(r.updated_at)>Date.parse(old.updated_at))merged.set(r.id,r);});save([...merged.values()]);draw();say('\u041A\u043E\u043F\u0456\u044E \u0432\u0456\u0434\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u0414\u043B\u044F \u0437\u0431\u0456\u0433\u0456\u0432 \u0437\u0430\u043B\u0438\u0448\u0435\u043D\u043E \u043D\u043E\u0432\u0456\u0448\u0438\u0439 \u0437\u0430\u043F\u0438\u0441.');}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0456\u043C\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438: \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442, \u0440\u043E\u0437\u043C\u0456\u0440 \u0444\u0430\u0439\u043B\u0443 \u0442\u0430 \u0434\u043E\u0441\u0442\u0443\u043F \u0434\u043E \u0441\u0445\u043E\u0432\u0438\u0449\u0430.');}finally{event.target.value='';}});
window.addEventListener('storage',event=>{if(event.key===key){try{draw();if(editor)say('\u0427\u0435\u0440\u0433\u0430 \u0437\u043C\u0456\u043D\u0438\u043B\u0430\u0441\u044F \u0432 \u0456\u043D\u0448\u0456\u0439 \u0432\u043A\u043B\u0430\u0434\u0446\u0456. \u041E\u043D\u043E\u0432\u0456\u0442\u044C \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443 \u043F\u0435\u0440\u0435\u0434 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043D\u043D\u044F\u043C.');}catch{say('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u0438 \u0437\u043C\u0456\u043D\u0435\u043D\u0443 \u0447\u0435\u0440\u0433\u0443.');}}});
})();</script>`;
var REVIEW_STYLES = `<style>
.review-editor{display:grid;gap:.8rem;padding:1rem 0}.review-editor label{display:grid;gap:.4rem}.review-editor textarea{min-height:6rem;resize:vertical}.review-editor input,.review-editor select,.review-editor textarea,.review-tools input,.review-tools select{font:inherit;max-width:100%;width:100%;min-width:0;padding:.65rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink)}
.review-actions,.review-tools{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}.review-actions button,.review-tools button{min-height:44px;padding:.5rem .85rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--accent);font:inherit;cursor:pointer}.review-tools label{flex:1;min-width:12rem;display:grid;gap:.35rem}.review-card{display:grid;gap:.5rem;padding:1rem 0;border-bottom:1px solid var(--line);min-width:0}.review-card>a{font-weight:600;font-size:1.05rem}.review-card small,.review-card>span{color:var(--ink-soft)}.review-note{white-space:pre-wrap;max-height:8rem;overflow:auto;margin:0}.review-card,.document-fact{overflow-wrap:anywhere}.document-fact{padding:1rem 0;border-bottom:1px solid var(--line)}.document-fact blockquote{margin:.5rem 0;padding-left:.8rem;border-left:2px solid var(--line);white-space:pre-wrap;font-size:.9rem}.document-results{margin:1.5rem 0}#review-message:empty{display:none}
@media(max-width:44rem){.review-tools{align-items:stretch}.review-tools label{flex-basis:100%}.review-editor select,.review-editor textarea,.review-tools input,.review-tools select{font-size:16px}}
</style>`;

// server/studio-styles.ts
var STUDIO_STYLES = `
:root[data-theme="light"]{--paper:#fff;--surface:#fff;--surface-2:#f3f7f4;--ink:#15251d;--ink-soft:#57665e;--ink-faint:#68766e;--line:#dce5df;--line-soft:#edf1ee;--accent:#187443;--accent-bg:#e7f5eb}
:root:not([data-theme="light"]){--paper:#111e17;--surface:#182a20;--surface-2:#22392b;--ink:#eff8f1;--ink-soft:#b3c7b8;--line:#355441;--line-soft:#284533;--accent:#8bdeb0;--accent-bg:#254b35}
body{font-family:var(--f-body);line-height:1.5}button,input,select{font-family:inherit}
.wrap{max-width:1240px;padding-top:0}.top .inner{max-width:1240px;padding-block:18px}.top{box-shadow:none}.brand{font-family:inherit;gap:5px;font-size:21px;letter-spacing:-.7px}.brand span{color:var(--ink)}.studio-logo{width:32px;height:32px;color:var(--accent);margin-right:5px;flex:none}
.top .nav a{font-size:14px}.menu-trigger{border-radius:6px}.theme-btn{border:0;background:none}.studio-hero{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:center;padding:64px 0 56px}.studio-eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--accent)}.studio-copy h1{font-family:inherit;font-size:clamp(38px,4.5vw,60px);line-height:1.08;letter-spacing:-2.4px;font-weight:700;margin:22px 0}.studio-copy h1 span{color:var(--accent)}.studio-copy p{font-size:17px;line-height:1.6;max-width:420px;color:var(--ink-soft);margin:0 0 20px}.studio-help{display:inline-flex;gap:28px;align-items:center;min-height:44px;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--line)}
.studio-visual{position:relative;min-height:300px;display:flex;align-items:center;justify-content:center}.studio-orbit{position:absolute;inset:0;background:radial-gradient(circle at 25% 25%,#c6ebd3 0 24%,transparent 24.5%),radial-gradient(circle at 75% 25%,#dff2e5 0 24%,transparent 24.5%),radial-gradient(circle at 25% 75%,#e8f6ec 0 24%,transparent 24.5%),radial-gradient(circle at 75% 75%,#c6ebd3 0 24%,transparent 24.5%);opacity:.85}.studio-stat{position:relative;width:72%;background:var(--surface);border:1px solid var(--line);box-shadow:0 16px 40px #133d2010;border-radius:12px;padding:26px;transform:rotate(-3deg)}.studio-stat>span{font-size:9px;font-weight:700;letter-spacing:1px;color:var(--ink-soft)}.studio-stat strong{display:block;font-size:48px;line-height:1.2;letter-spacing:-2px;margin:8px 0}.studio-stat small{font-size:12px;color:var(--ink-soft)}.studio-bars{height:52px;display:flex;gap:8px;align-items:end;margin-top:16px}.studio-bars i{background:#93cfa7;width:100%;height:35%;border-radius:3px 3px 0 0}.studio-bars i:nth-child(2n){height:65%;background:#54a872}.studio-bars i:nth-child(3n){height:85%;background:#187443}.studio-bars i:last-child{height:100%}.studio-signal{position:absolute;right:0;bottom:-6px;max-width:85%;padding:16px 20px;display:flex;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px #133d2010}.studio-signal strong{font-size:14px}.studio-signal small{display:block;font-size:11px;max-width:230px;color:var(--ink-soft);margin-top:4px}.studio-dot{width:12px;height:12px;border-radius:50%;background:#3ca865;box-shadow:0 0 0 5px #e6f5eb;flex:none}
.studio-workspace{border-top:1px solid var(--line);padding-top:28px}.results-heading{margin:0 0 20px}.results-heading h2{font-family:inherit;font-size:24px;letter-spacing:-.6px}.results-heading>span{font-size:12px}.scope-nav{border:0;gap:4px;padding:4px;background:var(--surface-2);border-radius:8px;width:max-content;max-width:100%}.scope-nav a{font-size:13px;min-height:40px;padding:8px 22px;border-radius:5px}.scope-nav a[aria-current]{background:var(--surface);color:var(--accent);box-shadow:0 1px 4px #0001;border:1px solid var(--line)}.scope-caption{font-size:11px;padding:12px 0 18px}.scope-caption a{text-decoration:none}
.control-panel{border:0;border-radius:0;padding:0;background:none}.control-panel .sortbar{display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:16px}.control-panel .sortbar input[type=search]{width:100%;min-width:0;height:52px;background:var(--surface);border-radius:6px;font-size:16px;border:1px solid var(--line);padding:14px 16px}.control-panel .sortbar .go{grid-column:2;grid-row:1;height:52px;border-radius:6px;padding:12px 24px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:22px;background:var(--accent);color:var(--paper)}.sort-options{grid-column:1 / -1;grid-row:2;border-top:1px solid var(--line-soft);padding-top:4px}.sort-options>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-soft)}.sort-options>summary::after{content:'+';margin-left:auto;font-size:20px}.sort-options[open]>summary::after{content:'\u2212'}.sort-options-fields{display:flex;flex-wrap:wrap;gap:16px;padding:8px 0 12px}.sort-options-fields label{flex:1;min-width:180px!important}.sort-options-fields select{max-width:none!important;width:100%}.sort-apply{margin-bottom:12px;padding:10px 20px}
.control-panel .presets{display:flex;flex-wrap:wrap;gap:8px;border:0;padding:0;margin:0 0 14px}.control-panel .preset{width:auto;min-height:38px;border-radius:5px;padding:8px 14px;font-size:12px;background:var(--surface);color:var(--ink-soft);border:1px solid var(--line)}.control-panel .preset.on{background:var(--accent-bg);border-color:var(--accent);color:var(--accent);font-weight:700}.control-panel .filters-more summary{border:0;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);border-radius:0;padding:12px 0;font-size:13px}.data-overview{font-size:12px}.data-overview>summary{font-size:12px}.row{box-shadow:none;border-radius:8px;padding:20px}.row .name{font-family:inherit}.case-open a{font-size:12px}.menu-section h3{font-family:inherit;color:var(--accent)}.site-menu nav{gap:28px}.menu-header h2{font-family:inherit}.menu-icon{background:var(--accent-bg);border:0}
@media(max-width:44rem){
 .top .inner{padding:12px 18px;gap:10px}.top .brand{font-size:18px;gap:3px}.top .brand span{display:inline}.studio-logo{width:27px;height:27px;margin-right:4px}.top .theme-btn{display:inline-flex;width:44px;height:44px;flex:0 0 44px;margin:0}.top .menu-trigger{border:0;background:none;padding:8px 0 8px 12px;font-size:13px;min-height:44px}.wrap{padding:0 20px 88px}
 .studio-hero{display:block;padding:28px 0 26px}.studio-eyebrow{font-size:9px;letter-spacing:1px}.studio-copy h1{font-size:36px;letter-spacing:-1.4px;margin:14px 0;line-height:1.08}.studio-copy p{font-size:14px;line-height:1.55;margin:0;max-width:330px}.studio-help{font-size:12px;min-height:38px;margin-top:8px;gap:16px}.studio-visual{display:none}
 .studio-workspace{padding-top:20px}.results-heading{margin-bottom:14px}.results-heading h2{font-size:20px}.results-heading>span{display:none}.scope-nav{width:100%;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px}.scope-nav a{padding:8px 3px;font-size:11px;min-height:40px}.scope-caption{font-size:10px;padding:10px 0 16px;gap:4px}.scope-caption>span{display:none}
 .control-panel{padding:0}.control-panel .sortbar{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.control-panel .sortbar input[type=search]{grid-column:1;grid-row:1;height:48px;border-radius:6px}.control-panel .sortbar .go{grid-column:1;grid-row:2;height:46px;min-height:46px;font-size:14px}.sort-options{grid-column:1;grid-row:3}.sort-options-fields{display:grid;grid-template-columns:1fr;gap:12px}.control-panel .sortbar label{gap:6px;font-size:12px}.control-panel .sortbar select{height:46px;font-size:16px}.control-panel .presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.control-panel .preset{width:100%;min-height:40px;padding:8px 4px;font-size:11px;justify-content:center}.control-panel .preset:first-child{grid-column:1 / -1}.control-panel .filters-more summary{min-height:44px}.row{padding:16px}.tabbar{box-shadow:0 -2px 12px #00000005}.tabbar a,.tabbar button{font-size:10px!important}.data-overview>summary{line-height:1.5}.menu-section strong{font-size:15px}.menu-section small{font-size:12px}
}
@media(max-width:350px){.studio-copy h1{font-size:32px}.wrap{padding-inline:16px}.top .inner{padding-inline:16px}.top .brand{font-size:17px}}

/* Compact railway overview and shared procurement cards. */
.railway-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:32px 0 12px}.railway-heading h1{font:700 28px/1.2 var(--f-body);letter-spacing:-.7px;margin:0 0 8px}.railway-heading .sub{font-size:14px;margin:0;color:var(--ink-soft)}.railway-count{font-size:13px;white-space:nowrap;color:var(--ink-soft)}.railway-about{margin-bottom:20px;border-bottom:1px solid var(--line)}.railway-about>summary,.railway-analysis>summary{font-size:13px;cursor:pointer;padding:14px 0;min-height:44px;color:var(--accent)}.railway-about-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 0 16px}.railway-about-grid p{font-size:13px;color:var(--ink-soft);margin:0;line-height:1.6}.railway-about-grid strong{color:var(--ink)}.railway-analysis{margin-top:24px;border-top:1px solid var(--line)}.railway-analysis-body{padding-bottom:20px}
.rows .tender-card{scroll-margin-top:90px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px 32px;padding:22px;position:relative;align-items:start}.tender-card .card-topline{grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;min-width:0}.card-status{font-size:11px;font-weight:600;color:var(--ink-soft);background:var(--surface-2);border-radius:4px;padding:5px 8px}.sev-proven .card-status{color:var(--alarm);background:var(--alarm-bg)}.sev-high .card-status{color:var(--accent);background:var(--accent-bg)}.tender-card .star-form{margin:0}.tender-card .star{font-size:22px;min-width:44px;min-height:44px}.tender-card .who{grid-column:1;grid-row:2;min-width:0}.card-title{font:600 17px/1.45 var(--f-body);margin:0;letter-spacing:-.2px}.card-title a{color:var(--ink);text-decoration:none}.card-title a:hover{text-decoration:underline}.card-buyer{font-size:12px;color:var(--ink-soft);line-height:1.5;margin-top:6px}.card-buyer:empty{display:none}.card-facts{grid-column:2;grid-row:2;display:grid;grid-template-columns:1fr;gap:10px}.card-facts>div{display:flex;flex-direction:column;gap:3px}.card-facts span,.card-reason>span{font-size:11px;color:var(--ink-soft)}.card-facts strong{font-size:18px;letter-spacing:-.4px;font-weight:600}.card-facts>div+div strong{font-size:12px;font-weight:400;letter-spacing:0}.card-reason{grid-column:1;grid-row:3;margin:0;font-size:13px;line-height:1.5}.card-reason>span{display:block;margin-bottom:3px}.card-extra{grid-column:1;grid-row:4;min-width:0}.card-extra>summary{font-size:12px;color:var(--ink-soft);cursor:pointer;min-height:44px;padding:12px 0}.card-extra-body{padding:8px 0}.card-flags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.tender-card .case-open{grid-column:2;grid-row:4;align-self:end;justify-content:stretch}.tender-card .case-open a{display:flex;justify-content:space-between;gap:16px;width:100%;border-top:1px solid var(--line);border-radius:0;background:none;text-decoration:none;font-size:13px;min-height:44px;font-weight:600}
@media(max-width:44rem){.railway-heading{display:block;padding:24px 0 8px}.railway-heading h1{font-size:24px;max-width:300px}.railway-heading .sub{font-size:13px}.railway-count{display:block;margin-top:10px;font-size:12px}.railway-about-grid{grid-template-columns:1fr;gap:14px}.railway-about{margin-bottom:16px}.rows .tender-card{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:10px}.tender-card .card-topline{width:100%;min-height:30px}.tender-card .who{order:initial;width:100%}.tender-card .star{min-height:36px;min-width:44px}.card-title{font-size:16px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.card-buyer{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card-facts{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;padding:12px 0;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}.card-facts strong{font-size:20px}.card-facts>div+div strong{font-size:12px;line-height:1.5}.card-reason{font-size:13px;width:100%}.card-extra{width:100%}.tender-card .case-open{order:initial;width:100%}.tender-card .case-open a{padding:8px 0}.card-extra>summary{min-height:36px;padding:8px 0}}

.tender-detail{max-width:1040px;margin:auto;padding:24px 0 40px}.detail-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.detail-toolbar .back{margin:0;font-size:13px}.detail-toolbar .star-form{margin:0}.detail-toolbar .star{display:flex;gap:8px;align-items:center;min-height:44px;font-size:20px}.detail-toolbar .star span{font-size:13px}.detail-ref{font-size:12px;color:var(--ink-soft);margin:0 0 10px;overflow-wrap:anywhere}.detail-heading h1{font:600 28px/1.3 var(--f-body);letter-spacing:-.6px;max-width:900px;margin:0 0 12px}.detail-buyer{font-size:14px;color:var(--ink-soft);margin:0}.detail-overview{display:grid;grid-template-columns:1.2fr .7fr 1fr;gap:24px;margin:24px 0;padding:20px 0;border-block:1px solid var(--line)}.detail-overview>div{display:flex;flex-direction:column;gap:6px}.detail-overview span{font-size:12px;color:var(--ink-soft)}.detail-overview strong{font-size:22px;font-weight:600}.detail-overview>div:last-child strong{font-size:16px}.detail-source{display:flex;align-items:center;gap:16px;margin-bottom:28px}.detail-source>a{background:var(--accent);color:var(--paper);padding:12px 18px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;min-height:44px;display:flex;gap:24px;align-items:center;justify-content:space-between}.detail-source>span{font-size:12px;color:var(--ink-soft)}.detail-columns{display:grid;grid-template-columns:1.15fr 1fr;gap:32px;align-items:start}.tender-detail h2{font:600 18px/1.4 var(--f-body);border:0;margin:0 0 10px;padding:0}.detail-signals h2>span{font-size:12px;background:var(--surface-2);padding:4px 8px;border-radius:4px;margin-left:6px}.detail-caution{font-size:12px!important;color:var(--ink-soft);margin:0 0 14px}.detail-competition{font-size:14px;color:var(--ink-soft);margin:0 0 14px}.detail-fold{border-bottom:1px solid var(--line);margin:0}.detail-fold>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;min-height:48px;cursor:pointer;font-size:14px;line-height:1.5}.detail-fold>summary::-webkit-details-marker{display:none}.detail-fold>summary::after{content:'+';flex:none;font-size:20px;color:var(--accent)}.detail-fold[open]>summary::after{content:'\u2212'}.detail-fold>summary strong{display:block;font-weight:500}.detail-fold>summary small{display:block;color:var(--ink-soft);font-size:12px;margin:3px 0}.detail-fold-body{padding:4px 0 20px;font-size:14px;overflow-wrap:anywhere}.detail-fold-body p{font-size:14px;line-height:1.65}.detail-fold-body .card{box-shadow:none;border:0;padding:12px 0;margin:0;border-radius:0;background:none}.detail-fold-body .card h3{font-size:16px}.detail-next{background:var(--surface-2);padding:20px;border-radius:8px}.detail-next ol{padding-left:22px;margin:14px 0;font-size:14px;line-height:1.6}.detail-next li{padding:0 0 12px 4px}.detail-next li:last-child{padding-bottom:0}.detail-next .detail-fold{border:0;border-top:1px solid var(--line)}.detail-next .detail-fold>summary{font-size:12px;padding-bottom:0}.detail-next .detail-fold[open]>summary{padding-bottom:12px}.detail-reference{margin-top:28px;border-top:1px solid var(--line)}.detail-downloads{display:flex;gap:24px;flex-wrap:wrap}.detail-downloads a{min-height:44px;display:flex;align-items:center}.tender-detail [id]{scroll-margin-top:100px}
@media(max-width:44rem){.tender-detail{padding-top:12px}.detail-toolbar{margin-bottom:14px}.detail-heading h1{font-size:21px;line-height:1.35;letter-spacing:-.3px}.detail-buyer{font-size:13px;line-height:1.5}.detail-overview{grid-template-columns:1fr 1fr;gap:16px;margin:18px 0;padding:16px 0}.detail-overview>div:last-child{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;gap:12px}.detail-overview strong{font-size:21px}.detail-overview>div:last-child strong{font-size:14px}.detail-source{display:block;margin-bottom:24px}.detail-source>a{width:100%}.detail-source>span{display:none}.detail-columns{display:flex;flex-direction:column;gap:24px}.detail-columns>section{width:100%}.detail-next{padding:16px}.detail-reference{margin-top:24px}.detail-fold>summary{font-size:15px}.detail-fold-body p,.detail-next ol{font-size:15px}.detail-fold-body .facts{display:grid;grid-template-columns:1fr;margin:0}.detail-fold-body .facts dt{padding-top:12px;font-size:12px}.detail-fold-body .facts dd{padding:2px 0 8px;margin:0;font-size:14px}.detail-fold-body .card{margin-inline:0}.detail-fold-body h2{margin-top:16px}}

/* Shared type scale and control geometry: keep overrides in one place. */
:root{--f-body:"Noto Sans","Segoe UI",Arial,sans-serif;--f-display:var(--f-body);--control-radius:8px}
body{font-family:var(--f-body);font-weight:400;line-height:1.6}
h1,h2,h3,.brand{font-family:var(--f-body)}
h1,.studio-copy h1,.detail-heading h1,.railway-heading h1{font-weight:700;letter-spacing:-.025em}
h2,.tender-detail h2,.results-heading h2{font-weight:600;letter-spacing:-.015em}
h3,.card-title,.menu-section strong{font-weight:600}
.card-title{line-height:1.5}.detail-heading h1{line-height:1.35}
.card-facts strong,.detail-overview strong,.studio-stat strong,.radar-metrics strong{font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.card-facts>div+div strong,.detail-overview>div:last-child strong{font-weight:500;letter-spacing:0}
.detail-overview span,.card-facts span,.card-reason>span,.sortbar label,.filter-fieldsets label{font-weight:500}
.detail-buyer,.card-buyer,.detail-caution,.hint,.meta,.menu-section small{font-weight:400}
button,.action,.preset,.menu-trigger,.case-open a,.detail-source>a{font-weight:600}
/* Radius applies to button-like links and disclosure controls as well. */
button,input[type=submit],input[type=button],a.action,a.preset,a.back,a.starred-btn,a.skip,.scope-nav a,.top .nav a,.tender-sections a,.case-open a,.detail-source>a,.pager>a,summary,.menu-section a{border-radius:var(--control-radius)!important}
input:not([type=checkbox]):not([type=radio]),select,textarea{border-radius:var(--control-radius)!important}
.detail-fold>summary{font-weight:500}.detail-fold>summary strong{font-weight:600}
.detail-fold-body p,.detail-next ol{font-size:15px;line-height:1.65}
.card-buyer,.card-facts span,.card-reason>span,.detail-ref,.detail-overview span{font-size:12px}
@media(max-width:44rem){.card-title{font-size:16px}.detail-heading h1{font-size:21px}.card-facts strong{font-size:21px}.detail-overview strong{font-size:22px}.detail-fold>summary{font-size:15px}.control-panel .preset{font-size:12px}.menu-section small{font-size:13px}.detail-buyer{font-size:14px}.detail-next ol,.detail-fold-body p{font-size:16px}}

.detail-toolbar .back,.detail-toolbar .star{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;min-height:44px;padding:0 14px;margin:0;border:1px solid var(--line);border-radius:8px!important;background:var(--surface);color:var(--accent);font-size:13px;font-weight:500;line-height:1;white-space:nowrap;text-decoration:none}
.detail-toolbar .star span{font-size:13px;font-weight:500}.detail-toolbar .star-form{display:flex;align-items:center;margin:0}

.detail-toolbar .star-form:has(.star span){margin:0;line-height:1;height:44px}
.top .brand .brand-word{display:inline;font-size:23px;font-weight:700;letter-spacing:-.7px;color:var(--ink)}.top .studio-logo{color:var(--ink);width:32px;height:32px;margin-right:7px}
@media(max-width:44rem){.top .brand .brand-word{font-size:22px}.top .studio-logo{width:29px;height:29px}}

.top .studio-logo{width:34px;height:34px}.top .brand .brand-word{font-size:22px;font-weight:600;letter-spacing:-.6px}
@media(max-width:44rem){.top .studio-logo{width:29px;height:29px;margin-right:5px}.top .brand .brand-word{font-size:20px}}

/* Consistent page breathing room, including older section templates. */
body .wrap{padding-top:32px}body[data-nav="feed"] .wrap{padding-top:0}.railway-heading{padding-top:0}.tender-detail{padding-top:0}
.company-search{max-width:680px;margin:8px auto 32px}.company-eyebrow{font-size:11px;font-weight:600;letter-spacing:1px;color:var(--accent);margin:0 0 10px}.company-search-heading h1{font-size:32px;line-height:1.25;margin:0 0 12px;max-width:none}.company-search-heading>p{font-size:16px;color:var(--ink-soft);margin:0 0 28px;max-width:510px}.company-search-form{padding:24px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.company-search-form>label{display:block;font-size:14px;font-weight:600;margin-bottom:10px}.company-search-input{display:flex;gap:10px}.company-search-input input{flex:1;min-width:0;height:48px;font-size:16px;padding:12px 14px;background:var(--paper)}.company-search-input button{height:48px;display:flex;align-items:center;justify-content:center;gap:28px;padding:0 20px;color:var(--paper);background:var(--accent)}.company-search-form>p{font-size:12px;line-height:1.6;color:var(--ink-soft);margin:10px 0 0}.company-search-form>p.company-error{color:var(--alarm);font-weight:500}.company-search-input input[aria-invalid]{border-color:var(--alarm)}.company-search-guide{padding:28px 0}.company-search-guide h2{font-size:15px;border:0;padding:0;margin:0 0 16px}.company-search-guide>div{display:grid;grid-template-columns:1fr 1fr;gap:24px}.company-search-guide p{margin:0;font-size:14px}.company-search-guide strong,.company-search-guide span{display:block}.company-search-guide span{color:var(--ink-soft);margin-top:6px;line-height:1.6}.company-search-guide>a{font-size:13px;min-height:44px;display:inline-flex;align-items:center;margin-top:16px}.company-empty{padding:24px 0}.company-empty h2{font-size:20px;border:0;margin:0 0 12px}.company-empty p{font-size:14px;color:var(--ink-soft);line-height:1.7}.company-empty>a{font-size:14px;min-height:44px;display:inline-flex;align-items:center}.company-results{max-width:960px;margin:auto}.company-profile{display:flex;gap:20px;justify-content:space-between;align-items:start;border-top:1px solid var(--line);padding-top:24px}.company-profile h2{font-size:23px;line-height:1.4;border:0;margin:0;padding:0}.company-profile .star-form{flex:none}.company-profile .star{display:flex;align-items:center;gap:8px;min-height:44px}.company-profile .star span{font-size:13px}.company-roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0 32px}.company-roles>a{display:flex;flex-direction:column;gap:10px;padding:20px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;text-decoration:none}.company-roles span{font-size:13px}.company-roles strong{font-size:24px;color:var(--ink);font-weight:600}.company-list-heading h2{font-size:20px;border:0;margin:0;padding:0}.company-list-heading>span{display:block;font-size:12px;color:var(--ink-soft);margin:8px 0 18px}
@media(max-width:44rem){body .wrap{padding-top:24px}body[data-nav="feed"] .wrap{padding-top:0}.railway-heading,.tender-detail{padding-top:0}.company-search{margin-top:0}.company-search-heading h1{font-size:27px}.company-search-heading>p{font-size:15px;margin-bottom:20px}.company-search-form{padding:16px}.company-search-input{flex-direction:column}.company-search-input button{width:100%}.company-search-guide>div{grid-template-columns:1fr;gap:18px}.company-profile{flex-direction:column;gap:12px}.company-profile h2{font-size:20px}.company-roles{grid-template-columns:1fr;gap:10px}.company-roles>a{padding:16px}.company-roles strong{font-size:22px}}
/* Keep the theme control legible and pagination on one row on phones. */
.top .theme-btn{display:inline-flex;flex:0 0 44px;width:44px;height:44px;border:0;background:transparent;color:var(--ink);padding:13px}
.theme-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.pager.compact-pager{display:flex;flex-wrap:nowrap;align-items:center;justify-content:center;gap:12px;margin:24px 0;width:100%;font-size:14px}
.compact-pager .page-step,.compact-pager a[aria-label]{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:20px;text-decoration:none}
.compact-pager .page-step[aria-disabled]{opacity:.35}
.pager.compact-pager .jump{display:flex;align-items:center;gap:4px;margin:0;min-width:0}
.compact-pager .jump label{display:flex;align-items:center;gap:8px;white-space:nowrap}
.pager.compact-pager .jump input{width:54px;height:44px;min-height:44px;padding:4px;font-size:16px;appearance:textfield;-moz-appearance:textfield}
.compact-pager .jump input::-webkit-inner-spin-button,.compact-pager .jump input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.pager.compact-pager .jump button{height:44px;min-height:44px;width:36px;padding:0;border:0;background:transparent;font-size:20px}
@media(max-width:360px){.top .inner{gap:6px;padding-inline:14px}.top .menu-trigger{padding-left:4px}.pager.compact-pager{gap:8px}}
@media(min-width:64rem){.top .inner{max-width:none;flex-wrap:nowrap;padding-inline:clamp(24px,3vw,56px);gap:16px}.top .brand{margin-right:auto}.top .nav{margin-left:0;flex-wrap:nowrap}.top .starred-btn,.top .theme-btn,.top .menu-trigger{flex-shrink:0}}
`;

// server/favourite-interaction.ts
var FAVOURITE_SCRIPT = `<script>
(function(){
  if(!window.fetch || !window.FormData) return;
  var prefixes={tender:'t',entity:'e',supplier:'s',officer:'o'}, busy=false, timer;
  var notice=document.createElement('div');
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.style.cssText='position:fixed;bottom:88px;left:50%;transform:translateX(-50%);z-index:1000;max-width:calc(100% - 32px);width:max-content;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);box-shadow:0 4px 20px #0002;font-size:14px;';
  notice.hidden=true;
  document.body.appendChild(notice);
  function announce(message){
    clearTimeout(timer);notice.hidden=false;notice.textContent=message;
    timer=setTimeout(function(){notice.hidden=true;notice.textContent='';},6000);
  }
  function saved(){
    var item=document.cookie.split(';').map(function(v){return v.trim();}).find(function(v){return v.indexOf('tr_starred=')===0;});
    return new Set(item ? item.slice('tr_starred='.length).split('~') : []);
  }
  function key(form){return prefixes[form.elements.namedItem('kind').value]+':'+form.elements.namedItem('id').value;}
  function sync(){
    var items=saved();
    document.querySelectorAll('form.star-form').forEach(function(form){
      var button=form.querySelector('button.star');if(!button)return;
      var on=items.has(key(form)),label=button.querySelector('span');
      button.classList.toggle('on',on);
      button.setAttribute('aria-pressed',String(on));
      button.title=on?'\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0437 \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E':'\u0414\u043E\u0434\u0430\u0442\u0438 \u0434\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E';
      button.setAttribute('aria-label',button.title);
      if(button.firstChild && button.firstChild.nodeType===3)button.firstChild.textContent=on?'\u2605':'\u2606';
      if(label)label.textContent=on?'\u0412 \u043E\u0431\u0440\u0430\u043D\u043E\u043C\u0443':'\u0414\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E';
    });
  }
  document.addEventListener('submit',async function(event){
    var form=event.target;
    if(!(form instanceof HTMLFormElement) || !form.matches('form.star-form'))return;
    event.preventDefault();if(busy)return;
    var itemKey=key(form),wanted=!saved().has(itemKey);
    busy=true;
    var buttons=Array.from(document.querySelectorAll('form.star-form button.star'));
    buttons.forEach(function(button){button.setAttribute('aria-disabled','true');});
    form.setAttribute('aria-busy','true');
    try{
      var body=new URLSearchParams();
      new FormData(form).forEach(function(value,name){if(typeof value==='string')body.append(name,value);});
      // The response sets the cookie. Do not follow the normal form redirect
      // and fetch an entire page just to update a star.
      var response=await fetch(form.action,{method:'POST',body:body,credentials:'same-origin',redirect:'manual'});
      if(response.type!=='opaqueredirect' && !response.ok)throw new Error('save failed');
      if(saved().has(itemKey)!==wanted)throw new Error('cookie not updated');
      announce(wanted?'\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u0432 \u043E\u0431\u0440\u0430\u043D\u043E\u043C\u0443':'\u041F\u0440\u0438\u0431\u0440\u0430\u043D\u043E \u0437 \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E');
    }catch(error){
      announce('\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u043C\u0456\u043D\u0438\u0442\u0438 \u043E\u0431\u0440\u0430\u043D\u0435. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u0442\u0430 \u0441\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437.');
    }finally{
      sync();busy=false;form.removeAttribute('aria-busy');
      buttons.forEach(function(button){button.removeAttribute('aria-disabled');});
    }
  });
  window.addEventListener('pageshow',sync);
  window.addEventListener('focus',function(){if(!busy)sync();});
})();
</script>`;

// server/navigation.ts
var groups = [
  { title: "\u0417\u043D\u0430\u0439\u0442\u0438 \u0442\u0430 \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438", items: [
    { href: "/", nav: "feed", label: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", hint: "\u041F\u043E\u0448\u0443\u043A \u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E, \u0440\u0435\u0433\u0456\u043E\u043D\u043E\u043C \u0430\u0431\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C", icon: "\u2315" },
    { href: "/railway", nav: "railway", label: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F", hint: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0438\u0445 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0439", icon: "\u2194" },
    { href: "/starred", nav: "starred", label: "\u041E\u0431\u0440\u0430\u043D\u0435", hint: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0439 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457, \u044F\u043A\u0456 \u0432\u0438 \u0437\u0431\u0435\u0440\u0435\u0433\u043B\u0438", icon: "\u2606" }
  ] },
  { title: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438", items: [
    { href: "/review", nav: "review", label: "\u041C\u043E\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430", hint: "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0430 \u0447\u0435\u0440\u0433\u0430, \u0441\u0442\u0430\u0442\u0443\u0441\u0438 \u0442\u0430 \u043D\u043E\u0442\u0430\u0442\u043A\u0438", icon: "\u2713" },
    { href: "/lookup", nav: "lookup", label: "\u0417\u043D\u0430\u0439\u0442\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044E", hint: "\u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0457\u0457 \u043A\u043E\u0434 \u0404\u0414\u0420\u041F\u041E\u0423", icon: "\u2315" },
    { href: "/prices", nav: "prices", label: "\u0426\u0456\u043D\u043E\u0432\u0456 \u0441\u0438\u0433\u043D\u0430\u043B\u0438", hint: "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F \u0446\u0456\u043D, \u044F\u043A\u0456 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438", icon: "\u20B4" },
    { href: "/article/366", nav: "article-366", label: "\u0420\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0445", hint: "\u0421\u0438\u0433\u043D\u0430\u043B\u0438 \u0442\u0430 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438", icon: "\u2261" }
  ] },
  { title: "\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C", items: [
    { href: "/entities", nav: "entities", label: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438", hint: "\u0425\u0442\u043E \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u0454 \u0442\u043E\u0432\u0430\u0440\u0438, \u0440\u043E\u0431\u043E\u0442\u0438 \u0439 \u043F\u043E\u0441\u043B\u0443\u0433\u0438", icon: "\u2197" },
    { href: "/suppliers", nav: "suppliers", label: "\u041F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0438", hint: "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u0457, \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u0443 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C", icon: "\u2197" },
    { href: "/officers", nav: "officers", label: "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0456 \u043E\u0441\u043E\u0431\u0438", hint: "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u0438, \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445", icon: "\u2197" }
  ] },
  { title: "\u0414\u043E\u043F\u043E\u043C\u043E\u0433\u0430 \u0442\u0430 \u0434\u0430\u043D\u0456", items: [
    { href: "/about", nav: "about", label: "\u042F\u043A \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0442\u0438\u0441\u044F \u0440\u0430\u0434\u0430\u0440\u043E\u043C", hint: "\u0417\u0432\u0456\u0434\u043A\u0438 \u0434\u0430\u043D\u0456 \u0442\u0430 \u044F\u043A \u0447\u0438\u0442\u0430\u0442\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438", icon: "?" },
    { href: "/indicators", nav: "indicators", label: "\u0429\u043E \u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442\u044C \u0441\u0438\u0433\u043D\u0430\u043B\u0438", hint: "\u041F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u043E\u0437\u043D\u0430\u043A \u0440\u0438\u0437\u0438\u043A\u0443 \u043F\u0440\u043E\u0441\u0442\u0438\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438", icon: "?" },
    { href: "/updates", nav: "updates", label: "\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0434\u0430\u043D\u0438\u0445", hint: "\u041A\u043E\u043B\u0438 \u0456 \u044F\u043A \u043E\u043D\u043E\u0432\u043B\u044E\u0432\u0430\u043B\u0430\u0441\u044F \u0431\u0430\u0437\u0430", icon: "\u21BB" }
  ] }
];
function navigationContent(current2 = "") {
  return groups.map((group, i) => `<section class="menu-section" aria-labelledby="menu-group-${i}"><h3 id="menu-group-${i}">${group.title}</h3><ul>${group.items.map((item) => `<li><a href="${item.href}"${current2 === item.nav ? ' aria-current="page"' : ""}><span class="menu-icon" aria-hidden="true">${item.icon}</span><span><strong>${item.label}</strong><small>${item.hint}</small></span>${current2 === item.nav ? '<span class="menu-current">\u0412\u0438 \u0442\u0443\u0442</span>' : ""}</a></li>`).join("")}</ul></section>`).join("");
}
function navigationDialog(current2 = "") {
  return `<dialog class="site-menu" id="site-menu" aria-labelledby="site-menu-title"><div class="menu-header"><div><h2 id="site-menu-title">\u041A\u0443\u0434\u0438 \u043F\u0435\u0440\u0435\u0439\u0442\u0438?</h2><p>\u041E\u0431\u0435\u0440\u0456\u0442\u044C, \u0449\u043E \u0445\u043E\u0447\u0435\u0442\u0435 \u0437\u0440\u043E\u0431\u0438\u0442\u0438</p></div><button type="button" class="menu-close" data-menu-close aria-label="\u0417\u0430\u043A\u0440\u0438\u0442\u0438 \u043C\u0435\u043D\u044E">\xD7</button></div><nav aria-label="\u0423\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438">${navigationContent(current2)}</nav><p class="menu-footnote">\u0421\u0438\u0433\u043D\u0430\u043B \u0440\u0438\u0437\u0438\u043A\u0443 \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u0435 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p></dialog><noscript><details class="no-script-menu"><summary>\u041C\u0435\u043D\u044E \u2014 \u0443\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438</summary><nav>${navigationContent(current2)}</nav></details></noscript>`;
}
var NAVIGATION_SCRIPT = `<script>
(()=>{const dialog=document.getElementById('site-menu');if(!dialog)return;let opener=null;
const triggers=[...document.querySelectorAll('[data-menu-open]')];
triggers.forEach(button=>button.addEventListener('click',()=>{opener=button;dialog.showModal();triggers.forEach(t=>t.setAttribute('aria-expanded','true'));document.body.classList.add('menu-open');dialog.querySelector('[data-menu-close]').focus();}));
dialog.querySelector('[data-menu-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.classList.remove('menu-open');triggers.forEach(t=>t.setAttribute('aria-expanded','false'));if(opener)opener.focus();});
})();</script>`;
var NAVIGATION_STYLES = `
.menu-trigger,.menu-close{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;min-height:44px;min-width:44px;padding:.55rem 1rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.menu-trigger span{font-size:1.2rem}.menu-open{overflow:hidden}
.site-menu{position:fixed;inset:0 0 0 auto;margin:0;width:min(45rem,100%);height:100dvh;max-height:100dvh;max-width:100%;border:0;border-left:1px solid var(--line);padding:0;background:var(--paper);color:var(--ink);overflow-y:auto;overscroll-behavior:contain;box-shadow:-20px 0 80px #0002}
.site-menu::backdrop{background:#10251ecc;backdrop-filter:blur(3px)}
.menu-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;position:sticky;top:0;z-index:2;background:var(--surface);padding:1.25rem 1.5rem;border-bottom:1px solid var(--line)}
.menu-header h2{border:0;margin:0;padding:0;font-size:1.4rem}.menu-header p{margin:.2rem 0 0;font-size:.85rem;color:var(--ink-soft)}.menu-close{font-size:1.6rem;flex:none;padding:.2rem .7rem}
.site-menu nav{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;padding:1.5rem}.menu-section{min-width:0}.menu-section h3{font-size:.73rem;letter-spacing:.06em;text-transform:uppercase;margin:0 0 .65rem;color:var(--ink-soft)}
.menu-section ul{padding:0;margin:0;list-style:none;display:grid;gap:.4rem}.menu-section a{display:flex;align-items:flex-start;gap:.7rem;border-radius:10px;border:1px solid transparent;padding:.75rem .65rem;min-height:64px;text-decoration:none;color:var(--ink);position:relative}.menu-section a:hover{background:var(--surface);border-color:var(--line)}.menu-section a[aria-current]{background:var(--accent-bg);border-color:var(--accent)}.menu-section strong{display:block;font-size:.9rem;line-height:1.4}.menu-section small{display:block;font-size:.75rem;line-height:1.5;color:var(--ink-soft);margin-top:.25rem}.menu-icon{width:1.75rem;height:1.75rem;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:6px;color:var(--accent)}.menu-current{font-size:.62rem;color:var(--accent);white-space:nowrap;margin-left:auto}.menu-footnote{padding:1rem 1.5rem;border-top:1px solid var(--line);font-size:.8rem;color:var(--ink-soft);max-width:none;margin:0}
.no-script-menu{padding:1rem}.no-script-menu nav{display:grid;grid-template-columns:repeat(2,1fr)}
.tabbar button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:3.5rem;padding:.25rem 0;border:0;border-radius:0;background:transparent;color:var(--ink-soft);font:inherit;font-size:.75rem;cursor:pointer}
.compact-intro{padding:.4rem 0 1.25rem}.compact-intro h1{font-size:clamp(1.6rem,3vw,2.3rem);margin:0 0 .5rem;line-height:1.2;letter-spacing:-.03em}.compact-intro p{margin:0;color:var(--ink-soft);max-width:48rem}.compact-intro a{font-size:.85rem;display:inline-flex;min-height:44px;align-items:center}
.data-overview{margin:1rem 0}.data-overview>summary{min-height:44px;cursor:pointer;font-size:.85rem;color:var(--ink-soft);padding:.5rem 0}.data-overview .radar-metrics{margin:.5rem 0 1rem}
.filter-fieldsets{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}.filter-fieldsets fieldset{min-width:0;margin:0;padding:1rem;border:1px solid var(--line);border-radius:8px}.filter-fieldsets legend{font-size:.85rem;font-weight:700;padding:0 .4rem}.filter-fieldsets label:not(.check){display:flex;flex-direction:column;gap:.35rem;font-size:.8rem;color:var(--ink-soft);margin-bottom:.8rem}.filter-fieldsets select,.filter-fieldsets input{width:100%;max-width:100%;min-width:0}.filter-fieldsets .check{display:flex;gap:.5rem;align-items:center;min-height:44px;white-space:normal}.filter-fieldsets .check input{width:20px;min-height:20px;flex:none}.filter-actions{display:flex;align-items:center;flex-wrap:wrap;gap:1rem;margin-top:1rem}.filter-actions a{min-height:44px;display:inline-flex;align-items:center}.applied-filters{font-size:.8rem;margin:.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.applied-filters a{display:inline-flex;min-height:36px;align-items:center;padding:.25rem .65rem;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;text-decoration:none}
.case-open{grid-column:2 / -1;display:flex;justify-content:flex-end}.case-open a{min-height:44px;display:inline-flex;align-items:center;font-size:.8rem;font-weight:600}.tender-sections{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.tender-sections a{padding:.5rem .8rem;border:1px solid var(--line);border-radius:8px;min-height:44px;text-decoration:none}h2[id]{scroll-margin-top:6rem}
@media(max-width:44rem){.site-menu{width:100%}.site-menu nav{grid-template-columns:1fr;gap:1.2rem;padding:1rem}.menu-header{padding:1rem}.menu-section a{padding:.6rem;min-height:64px}.menu-section strong{font-size:1rem}.menu-section small{font-size:.8rem}.top .inner{flex-wrap:nowrap;gap:.5rem}.top .brand{margin-right:auto;min-width:0}.top .menu-trigger{display:inline-flex;flex:none;padding:.5rem .65rem;font-size:.85rem}.top .theme-btn{flex:none;margin:0}.top .brand span{display:none}.filter-fieldsets{grid-template-columns:1fr}.filter-fieldsets input,.filter-fieldsets select{font-size:16px}.compact-intro{padding-bottom:.5rem}.compact-intro h1{font-size:1.6rem}.compact-intro p{font-size:.88rem}.case-open{width:100%;justify-content:stretch;order:2}.case-open a{justify-content:center;width:100%;border:1px solid var(--line);border-radius:7px;background:var(--surface-2)}.tender-sections a{font-size:.8rem}.scope-caption{padding:.5rem 0}}
`;

// server/radar-styles.ts
var RADAR_STYLES = `
:root[data-theme="light"]{--paper:#f4f6f5;--surface:#fff;--surface-2:#edf3f0;--ink:#162d28;--ink-soft:#4d625b;--ink-faint:#5c7069;--line:#d6e1dc;--line-soft:#e7eeea;--accent:#08745b;--accent-bg:#e0f2e9;--alarm:#b53f32;--alarm-bg:#fceeea}
:root:not([data-theme="light"]){--accent:#77dbc1;--accent-bg:#163d36}
body{font-size:16px;line-height:1.6}
.wrap{max-width:78rem}
.top .inner{max-width:78rem}
.top{box-shadow:0 1px 0 var(--line-soft)}
.top .nav a,.theme-btn,.burger{min-height:44px;align-items:center}
.top .nav a{display:inline-flex;border-radius:8px}
.theme-btn,.burger{min-width:44px}
.burger span{width:100%}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.radar-hero{display:grid;grid-template-columns:1.7fr 1fr;gap:3rem;align-items:center;padding:1.5rem 0 2rem}
.eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.12em;color:var(--accent);margin:0 0 1rem}
.radar-hero h1{font-size:clamp(2rem,3.8vw,3.35rem);line-height:1.12;letter-spacing:-.045em;margin:0 0 1.25rem;font-weight:700}
.radar-hero h1 span{color:var(--accent)}
.hero-description{max-width:39rem;color:var(--ink-soft);font-size:1rem;margin:0}
.hero-guide{padding:1.5rem 1.75rem;border-left:2px solid var(--line);color:var(--ink-soft);font-size:.9rem}
.hero-guide ol{padding-left:1.3rem;margin:.75rem 0 1rem}.hero-guide li{padding:.25rem 0}.hero-guide a{font-weight:600}
.scope-nav{display:flex;gap:.4rem;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:.75rem}
.scope-nav a{display:inline-flex;align-items:center;min-height:44px;padding:.5rem 1.25rem;border:1px solid transparent;border-radius:8px;color:var(--ink-soft);text-decoration:none;font-weight:600}
.scope-nav a:hover{background:var(--surface-2)}.scope-nav a[aria-current]{background:var(--ink);color:var(--paper)}
.scope-caption{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem;padding:1rem 0;font-size:.8rem;color:var(--ink-soft)}
.scope-caption a{color:var(--ink-soft)}
.radar-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-bottom:2.5rem}
.radar-metrics>div{display:flex;flex-direction:column;gap:.4rem;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.15rem;min-width:0}
.radar-metrics span{font-size:.8rem;color:var(--ink-soft)}
.radar-metrics strong{font-size:clamp(1.4rem,2.1vw,1.9rem);letter-spacing:-.04em;line-height:1.4;font-variant-numeric:tabular-nums}
.radar-metrics em{font-style:normal;font-size:.85rem;color:var(--ink-soft);letter-spacing:0}
.radar-metrics small{font-size:.72rem;color:var(--ink-faint)}
.results-heading{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:1rem}.results-heading h2{margin:0;font-size:1.4rem;border:0;padding:0}.results-heading>span{font-size:.8rem;color:var(--ink-soft)}
.control-panel{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);margin-bottom:1.25rem}
.control-panel .sortbar{border:0;background:none;padding:0;box-shadow:none;gap:.75rem;align-items:flex-end;margin-bottom:1rem}
.control-panel .sortbar input[type=search]{min-height:48px;font-size:16px;background:var(--paper);border:1px solid var(--line);padding:.7rem .9rem;flex:1 1 19rem}
.control-panel .sortbar label{display:flex;flex-direction:column;align-items:stretch;gap:.25rem;font-size:.75rem;color:var(--ink-soft)}
.control-panel .sortbar select{min-height:48px;font-size:.85rem;max-width:14rem;padding:.5rem}
.control-panel .go{min-height:48px;background:var(--accent);color:var(--paper);border:0;font-weight:700}
.control-panel .presets{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}
.control-panel .preset{min-height:44px;font-size:.82rem;padding:.5rem .9rem;border-radius:8px;white-space:normal;line-height:1.4;display:inline-flex;align-items:center}
.control-panel .filters{margin:0}.control-panel .filters-more{margin:0;border:0;background:none;box-shadow:none}.control-panel .filters-more summary{padding:.65rem 0;min-height:44px;font-size:.85rem}
.control-panel .filter-row{gap:.75rem}.control-panel .filter-row select{max-width:100%;min-width:0}.control-panel input,.control-panel select,.control-panel button{min-height:44px}
.rows{border:0;background:none;display:grid;gap:.8rem;box-shadow:none}
.row{border:1px solid var(--line)!important;border-radius:12px;padding:1.2rem;gap:.5rem 1rem;box-shadow:0 2px 4px #00000003}
.row:hover{border-color:var(--accent)!important;background:var(--surface)}
.row .who{min-width:0}.row .name{font-size:1rem;line-height:1.5}.row .meta{font-size:.8rem;line-height:1.6;color:var(--ink-soft)}
.row .amount .big{font-size:1.2rem}.row .amount .exact{font-size:.7rem;overflow-wrap:anywhere}
.row .flags{padding-top:.4rem}.row .flag{font-size:.74rem;line-height:1.5;white-space:normal}
.row .row-status{font-size:.72rem;color:var(--accent);font-weight:600;margin-bottom:.3rem}.row .coverage-note{font-size:.75rem;color:var(--ink-soft);margin-top:.3rem}
.row .star{min-width:44px;min-height:44px;display:inline-flex;justify-content:center;align-items:center}
@media(max-width:60rem){.radar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-guide{padding:1rem}.radar-hero{gap:1.5rem}.results-heading{align-items:flex-start;flex-direction:column;gap:.25rem}}
@media(max-width:44rem){
 .wrap{padding-top:1.25rem}.radar-hero{display:block;padding:0 0 1.5rem}.radar-hero h1{font-size:2.25rem}.radar-hero .eyebrow{font-size:.6rem;letter-spacing:.08em;margin-bottom:.8rem}.hero-description{font-size:.9rem}.hero-guide{display:none}
 .scope-nav{gap:.25rem;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.scope-nav a{padding:.5rem .25rem;justify-content:center;font-size:.78rem}
 .scope-caption{font-size:.73rem}.radar-metrics{gap:.5rem;margin-bottom:1.5rem}.radar-metrics>div{padding:.8rem}.radar-metrics span{font-size:.7rem;min-height:2.2em}.radar-metrics strong{font-size:1.4rem}.radar-metrics small{font-size:.68rem}.radar-metrics em{display:block;font-size:.7rem}
 .control-panel{padding:1rem}
 .control-panel .sortbar{display:flex;flex-direction:column;align-items:stretch;gap:1rem}
 .control-panel .sortbar input[type=search]{flex:none;width:100%;min-width:0;height:48px}
 .control-panel .sortbar label{order:initial;display:flex;flex-direction:column;align-items:stretch;gap:.4rem;width:100%;min-width:0;font-size:.85rem}
 .control-panel .sortbar select{max-width:none;width:100%;min-width:0;height:48px;font-size:16px;padding:.5rem .75rem}
 .control-panel .sortbar .go{order:initial;width:100%;height:48px;padding:.5rem 1rem}
 .control-panel .presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;overflow:visible;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line)}
 .control-panel .preset{width:100%;min-width:0;min-height:52px;padding:.5rem;font-size:.8rem;text-align:center;justify-content:center;white-space:normal;line-height:1.35}
 .control-panel .preset:first-child{grid-column:1 / -1}
 .control-panel .filters-more summary{display:flex;align-items:center;gap:.5rem;width:100%;padding:.75rem;border:1px solid var(--line);border-radius:8px;min-height:48px}
 .control-panel .filter-actions{align-items:stretch;flex-direction:column}.control-panel .filter-actions button{width:100%}

 .control-panel .filters-more .inner{padding:.5rem 0}.control-panel .filter-row{display:flex;flex-direction:column;align-items:stretch}.control-panel .filter-row input,.control-panel .filter-row select{width:100%;min-width:0;font-size:16px}.control-panel .check{white-space:normal}
 .rows{margin-inline:0;gap:.75rem}.row{padding:1rem;display:flex;gap:.4rem}.row .dot{display:none}.row .amount{order:0;display:flex;flex-wrap:wrap;gap:.25rem 1rem;width:100%;justify-content:space-between}.row .amount .exact{display:block;font-size:.65rem}.row .who{order:-1;width:100%}.row .name a{display:block;-webkit-line-clamp:unset;overflow:visible}.row .name a::after{display:none}.row .meta{white-space:normal;overflow:visible}.row .signal{white-space:normal;overflow:visible;font-size:.8rem;width:100%;padding-top:.5rem;border-top:1px solid var(--line-soft)}.row .row-status{font-size:.7rem}.row .coverage-note{font-size:.7rem}
 .tabbar a,.tabbar label{font-size:.75rem;color:var(--ink-soft)}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
`;

// server/html.ts
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(amount) + " \u20B4";
}
function unitMoney(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  const digits = Math.abs(amount) < 1e3 ? 2 : 0;
  return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount) + " \u20B4";
}
function shortMoney(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  if (amount >= 1e9) return (amount / 1e9).toFixed(2).replace(".", ",") + " \u043C\u043B\u0440\u0434 \u20B4";
  if (amount >= 1e6) return (amount / 1e6).toFixed(1).replace(".", ",") + " \u043C\u043B\u043D \u20B4";
  if (amount >= 1e3) return Math.round(amount / 1e3).toLocaleString("uk-UA") + " \u0442\u0438\u0441 \u20B4";
  return Math.round(amount) + " \u20B4";
}
var MONTHS = [
  "\u0441\u0456\u0447\u043D\u044F",
  "\u043B\u044E\u0442\u043E\u0433\u043E",
  "\u0431\u0435\u0440\u0435\u0437\u043D\u044F",
  "\u043A\u0432\u0456\u0442\u043D\u044F",
  "\u0442\u0440\u0430\u0432\u043D\u044F",
  "\u0447\u0435\u0440\u0432\u043D\u044F",
  "\u043B\u0438\u043F\u043D\u044F",
  "\u0441\u0435\u0440\u043F\u043D\u044F",
  "\u0432\u0435\u0440\u0435\u0441\u043D\u044F",
  "\u0436\u043E\u0432\u0442\u043D\u044F",
  "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434\u0430",
  "\u0433\u0440\u0443\u0434\u043D\u044F"
];
function date(value) {
  if (!value) return "\u2014";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "\u2014";
  const [, year, month, day2] = m;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day2)} ${name} ${year} \u0440.` : `${day2}.${month}.${year}`;
}
function shortDate(value) {
  if (!value) return "\u2014";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "\u2014";
}
function plural(n, one, few, many) {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
function trim(text, max = 130) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "\u2026";
}
var STYLES = `
:root{
  color-scheme: dark;

  /* Rhythm. Every spacing value in this file comes from here. */
  --s1:.25rem; --s2:.5rem;  --s3:.75rem; --s4:1rem;
  --s5:1.5rem; --s6:2rem;   --s7:3rem;   --s8:4rem;

  /* AiVocado Office design language: a dark navy ground, translucent panels,
     an indigo accent with a faint magenta ambient glow. */
  --paper:#0A0E1A; --surface:#10152A; --surface-2:#161C33;
  --ink:#E2E8F0; --ink-soft:#9AA5B8; --ink-faint:#8791A4;
  --line:#252C42; --line-soft:#1B2138;

  --accent:#4F7CFF; --accent-bg:#1B2547;
  --alarm:#FF6B6B; --alarm-bg:#2A1620;
  --warn:#E0A83E;  --warn-bg:#241D12;
  --calm:#4ADE80;  --calm-bg:#122417;

  --shadow:0 16px 40px -20px rgba(0,0,0,.6);
  --radius:12px; --radius-sm:8px;

  /* DM Sans, carried from AiVocado Office \u2014 one voice, display and body. */
  --f-display:"DM Sans","Segoe UI",system-ui,sans-serif;
  --f-body:"DM Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
/* Light theme: same indigo brand on paper. Chosen by the header toggle, which
   stamps data-theme="light" on <html> and remembers it. Only the colours flip;
   the scale, radius and fonts stay. */
:root[data-theme="light"]{
  color-scheme:light;
  --paper:#FBFBFD; --surface:#FFFFFF; --surface-2:#F1F3F8;
  --ink:#14181A; --ink-soft:#565B60; --ink-faint:#8B9096;
  --line:#E4E6EE; --line-soft:#EEF0F6;
  --accent:#3D5FE0; --accent-bg:#EAEEFF;
  --alarm:#C0392B; --alarm-bg:#FBEAE7;
  --warn:#9A6A15;  --warn-bg:#FAF2DE;
  --calm:#1E7A46;  --calm-bg:#E6F4EC;
  --shadow:0 12px 32px -20px rgba(20,24,26,.28);
}
*{box-sizing:border-box}
pre,table{overflow-x:auto;max-width:100%}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- chrome ---------- */
.top{border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:10}
.top .inner{max-width:72rem;margin:0 auto;padding:var(--s4) clamp(var(--s4),3vw,var(--s6));display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.brand{display:flex;align-items:center;gap:var(--s2);font-family:var(--f-display);font-weight:700;font-size:1.1rem;letter-spacing:-.01em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand span{color:var(--accent)}
/* radius-sm, not the standard radius: the mark carries its own near-black
   backdrop, and square-cornered on a light header it reads as a black
   rectangle rather than a logo. */
.brand-mark{width:28px;height:28px;border-radius:var(--radius-sm);flex:none}
.nav{display:flex;flex-wrap:wrap;gap:var(--s1);margin-left:auto}
.nav a{text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:var(--s1) var(--s3);border-radius:2px}
.nav a:hover{color:var(--accent);background:var(--surface-2)}
.nav a[aria-current]{color:var(--accent);background:var(--accent-bg);font-weight:500}
/* Bottom tab bar \u2014 the phone's primary navigation. Desktop has the header
   links and the drawer, so it stays hidden there. */
.tabbar{display:none}
/* A heavy section folded by default: the legal qualification runs to many
   screens, and most readers want the verdict, not the statute text. */
details.fold{margin:var(--s3) 0 var(--s5)}
details.fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:var(--s2);padding:var(--s3) var(--s4);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--accent);font-weight:500}
details.fold>summary::-webkit-details-marker{display:none}
details.fold>summary::after{content:"";width:.5rem;height:.5rem;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin-left:auto;transition:transform .2s}
details.fold[open]>summary::after{transform:rotate(225deg)}
details.fold[open]>summary{border-radius:var(--radius) var(--radius) 0 0}
details.fold>.fold-body{padding-top:var(--s3)}

/* Slide-in drawer. CSS only \u2014 a checkbox drives it, because <details>
   cannot animate between display:none and shown. The checkbox is hidden
   visually rather than with display:none, which keeps it keyboard-reachable
   and keeps the sibling selectors working. */
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.burger{border-radius:var(--radius);flex:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:4px;width:2.4rem;height:2.4rem;padding:var(--s2);border:1px solid var(--line);background:var(--surface)}
.burger span{display:block;height:2px;background:var(--ink);border-radius:1px;transition:background .2s ease}
.burger:hover{border-color:var(--accent)}
.burger:hover span{background:var(--accent)}
#menu-toggle:focus-visible + .top .burger{border-radius:var(--radius);outline:2px solid var(--accent);outline-offset:2px}

.scrim{position:fixed;inset:0;background:rgba(10,18,24,.42);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s ease;z-index:40;cursor:pointer}
#menu-toggle:checked ~ .scrim{opacity:1;visibility:visible}

/* visibility, not just transform: an off-screen drawer that is still
   "visible" keeps its dozen links in the tab order ahead of the content. */
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(20rem,86vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);visibility:hidden;transition:transform .28s cubic-bezier(.32,.72,.32,1),visibility .28s;overflow-y:auto}
#menu-toggle:checked ~ .drawer{transform:translateX(0);visibility:visible}
/* Skip link: the first tab stop, visible only while focused. */
.skip{position:absolute;left:-999px;top:var(--s2);z-index:100;background:var(--accent);color:#fff;padding:var(--s2) var(--s4);border-radius:var(--radius);text-decoration:none;font-weight:500}
.skip:focus{left:var(--s4)}

.drawer-head{display:flex;align-items:center;justify-content:space-between;padding:var(--s4) var(--s4);border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}
.drawer-head strong{font-family:var(--f-display);font-size:1.02rem;font-weight:700}
.drawer-close{cursor:pointer;font-size:1.5rem;line-height:1;color:var(--ink-faint);padding:var(--s1) var(--s2);border:1px solid transparent}
.drawer-close:hover{color:var(--accent);border-color:var(--line)}
.drawer a{display:flex;flex-direction:column;gap:var(--s1);padding:var(--s3) var(--s4);text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line-soft);font-size:.99rem}
.drawer a:last-child{border-bottom:0}
.drawer a:hover{background:var(--surface-2);color:var(--accent)}
.drawer a[aria-current]{background:var(--accent-bg);color:var(--accent);font-weight:500;box-shadow:inset 3px 0 0 var(--accent)}
.drawer small{color:var(--ink-faint);font-size:.82rem;font-weight:400}
/* A collapsible group of related pages. The summary looks like a drawer link
   but carries a chevron that rotates when the group opens; the children are
   indented so the grouping reads at a glance. */
.drawer-group{border-bottom:1px solid var(--line-soft)}
.drawer-group>summary{display:flex;flex-direction:column;gap:var(--s1);padding:var(--s3) var(--s4);cursor:pointer;color:var(--ink);font-size:.99rem;list-style:none;position:relative}
.drawer-group>summary::-webkit-details-marker{display:none}
.drawer-group>summary::after{content:"";position:absolute;right:var(--s4);top:var(--s4);width:.5rem;height:.5rem;border-right:2px solid var(--ink-faint);border-bottom:2px solid var(--ink-faint);transform:rotate(45deg);transition:transform .2s ease}
.drawer-group[open]>summary::after{transform:rotate(225deg)}
.drawer-group>summary:hover{background:var(--surface-2);color:var(--accent)}
.drawer-group>a{padding-left:var(--s6);background:var(--surface-2);border-bottom:1px solid var(--line-soft)}
.drawer-group>a:last-child{border-bottom:0}

@media (prefers-reduced-motion: reduce){.drawer,.scrim,.filters-drawer,.filters-scrim{transition-duration:.01ms}}

.wrap{max-width:72rem;margin:0 auto;padding:clamp(var(--s4),2.5vw,var(--s5)) clamp(var(--s4),3vw,var(--s6)) var(--s8)}

/* ---------- type ---------- */
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,3vw,1.95rem);line-height:1.18;letter-spacing:-.015em;margin:0 0 var(--s2);text-wrap:balance;max-width:30ch}
h1.long{font-size:clamp(1.35rem,3vw,1.9rem);max-width:32ch}
h2{font-family:var(--f-display);font-weight:700;font-size:1.35rem;line-height:1.25;margin:var(--s7) 0 var(--s2);text-wrap:balance}
h2:first-of-type{margin-top:var(--s6)}
.sub{color:var(--ink-soft);max-width:80ch;margin:0 0 var(--s2);font-size:.95rem}
.hint{color:var(--ink-faint);font-size:.89rem;max-width:70ch;margin:var(--s1) 0 var(--s3)}
.statline{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s2);align-items:baseline;font-size:.88rem;color:var(--ink-soft);margin:0 0 var(--s3);max-width:none}
.statline b{font-family:var(--f-body);font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.caution{font-size:.88rem;line-height:1.5;color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm);border-radius:var(--radius);padding:var(--s2) var(--s3);margin:0 0 var(--s5);max-width:72ch}

/* ---------- breadcrumb ---------- */
.back{display:inline-block;font-size:.9rem;color:var(--ink-soft);text-decoration:none;margin-bottom:var(--s4)}
.back:hover{color:var(--accent)}


/* ---------- filters ---------- */
form.filters{display:flex;flex-wrap:wrap;gap:var(--s2);margin-bottom:var(--s4);align-items:center}
input,select{border-radius:var(--radius);font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:var(--s2) var(--s3);min-width:0}
input[type=search]{flex:1 1 20rem}
select{max-width:24rem}
button{border-radius:var(--radius);font-family:inherit;font-size:.95rem;font-weight:500;color:#fff;background:var(--accent);border:1px solid var(--accent);padding:var(--s2) var(--s4);cursor:pointer}
button:hover{filter:brightness(1.08)}
.check{display:flex;align-items:center;gap:var(--s2);font-size:.93rem;color:var(--ink-soft);white-space:nowrap}
.check input{min-width:auto}
.reset{font-size:.9rem;color:var(--ink-faint)}
form.filters{flex-direction:column;align-items:stretch;gap:var(--s3)}
.filter-row{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center}
/* Inputs must not stretch vertically: the form itself is a column, so a
   bare flex-grow on a child would grow it down the page. */
.filter-row input,.filter-row select,.filter-row button{align-self:center}
.filter-row input[type=search]{flex:1 1 22rem;max-width:38rem}
.filter-row input[type=date]{flex:0 0 auto;width:10.5rem}
.filter-row input.num{flex:0 0 auto;width:9rem;font-variant-numeric:tabular-nums}
.filter-label.faint{color:var(--ink-faint);font-size:.85rem}

/* the collapsed filter panel */
.filters-more{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.filters-more summary{cursor:pointer;list-style:none;padding:var(--s3) var(--s4);font-size:.95rem;font-weight:500;color:var(--accent);display:flex;align-items:center;gap:var(--s2)}
.filters-more summary::-webkit-details-marker{display:none}
.filters-more summary::before{content:"\u25B8";color:var(--ink-faint);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.filters-more[open] summary::before{transform:rotate(90deg)}
.filters-more[open] summary{border-bottom:1px solid var(--line-soft)}
.filters-more summary:hover{background:var(--surface)}
.filters-more .inner{padding:var(--s4);display:flex;flex-direction:column;gap:var(--s3)}
.verdict{border-left:4px solid var(--ink-faint)}
.verdict.high{border-left-color:var(--alarm)}
.verdict.medium{border-left-color:var(--warn)}
.verdict.low{border-left-color:var(--ink-faint)}
.verdict-tag{display:inline-block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:var(--s1) var(--s2);border-radius:2px;margin-right:var(--s2);vertical-align:middle}
.verdict.high .verdict-tag{color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm)}
.verdict.medium .verdict-tag{color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn)}
.verdict.low .verdict-tag{color:var(--ink-faint);background:var(--surface-2);border:1px solid var(--line)}
ol.findings{margin:var(--s2) 0 var(--s4);padding-left:var(--s5);display:flex;flex-direction:column;gap:var(--s3)}
ol.findings li{max-width:68ch}
ol.findings li strong{display:block;margin-bottom:var(--s1)}
ol.findings li span{color:var(--ink-soft);font-size:.96rem}
ol.findings li.w-high::marker{color:var(--alarm);font-weight:700}
ol.findings li.w-medium::marker{color:var(--warn);font-weight:700}
/* the three-line explainer a newcomer reads once */
.primer{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s1) var(--s4);margin:0 0 var(--s3);padding:var(--s2) var(--s3);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);font-size:.85rem;color:var(--ink-soft)}
.primer b{display:inline-flex;align-items:center;justify-content:center;width:1.15rem;height:1.15rem;border-radius:50%;background:var(--accent);color:#fff;font-size:.7rem;margin-right:var(--s2)}
.primer span{display:inline-flex;align-items:center;white-space:nowrap}
.primer a{margin-left:auto;font-size:.88rem}

/* the mobile filter sheet: presets, sort/group and the filter panel share
   one checkbox-driven drawer, the same mechanism the nav drawer already
   uses in this file. Above 44rem there is room for all of it inline, so
   these rules just put the drawer back in normal flow and hide the trigger
   that only exists for the cramped case. */
.filters-trigger{display:none}
.filters-scrim{display:none}
.filters-drawer{position:static;transform:none;visibility:visible;width:auto;box-shadow:none;border:0;background:transparent;overflow:visible}
.filters-drawer .drawer-head{display:none}
.filters-drawer-body{padding:0}

/* one-click starting points */
.presets{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0 0 var(--s3)}
.preset{text-decoration:none;font-size:.8rem;color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);border-radius:var(--control-radius,8px);padding:var(--s1) var(--s3);white-space:nowrap}
.preset:hover{border-color:var(--accent);color:var(--accent)}
.preset.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}

/* sorting and grouping, always in view */
.sortbar{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s3);align-items:center;margin:0 0 var(--s3);padding:var(--s2) var(--s3);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.sortbar label{display:inline-flex;align-items:center;gap:var(--s2);font-size:.86rem;color:var(--ink-faint);white-space:nowrap}
.sortbar select{font-size:.88rem;padding:var(--s1) var(--s2);max-width:12.5rem}
.sortbar input[type=search]{flex:1 1 14rem;min-width:10rem;font-size:.9rem;padding:var(--s2) var(--s2)}
.sortbar .go{font-size:.9rem;padding:var(--s2) var(--s4)}
.filters{margin-bottom:var(--s4)}
.filters-more summary .reset{margin-left:auto}

.actions{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0 0 var(--s5)}
.action{display:inline-flex;align-items:center;gap:var(--s2);text-decoration:none;font-size:.95rem;color:var(--accent);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--s2) var(--s4)}
.action:hover{border-color:var(--accent);background:var(--accent-bg)}
.action.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
.action.primary:hover{filter:brightness(1.08);background:var(--accent)}
/* The download glyph belongs to the report link only, not to every primary
   action \u2014 a 404 page's "all tenders" button is not a download. */
.action.download::before{content:"\u2913";font-size:1.05rem}
.block-head{font-family:var(--f-display);font-weight:700;font-size:1.1rem;margin:var(--s5) 0 var(--s2)}
.badge{background:var(--accent);color:#fff;font-size:.75rem;font-weight:600;min-width:1.3rem;height:1.3rem;border-radius:1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 var(--s2)}
/* star toggle \u2014 a form so the site still needs no scripts */
.star-form{display:inline;margin:0}
.star{background:none;border:0;padding:0 var(--s2) 0 0;margin:0;cursor:pointer;font-size:1.15rem;line-height:1;color:var(--ink-faint);border-radius:var(--radius);vertical-align:baseline}
.star:hover{color:var(--warn)}
.star.on{color:#FBBF24}
.star span{display:none}
.name .star{float:left}

/* the labelled variant, used at the top of a dossier */
.star-form:has(.star span){display:inline-block;margin:0 0 var(--s4)}
.star:has(span){display:inline-flex;align-items:center;gap:var(--s2);font-size:1rem;border:1px solid var(--line);background:var(--surface);padding:var(--s2) var(--s4);color:var(--accent)}
.star:has(span) span{display:inline}
.star.on:has(span){background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.name .star:has(span){float:none}

.starred-btn{display:inline-flex;align-items:center;gap:var(--s2);text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:var(--s1) var(--s3);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.starred-btn:hover{color:var(--accent);border-color:var(--accent)}
.starred-btn.on{color:var(--accent);background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.theme-btn{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;padding:0;cursor:pointer;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--ink-soft);font-size:1.05rem;line-height:1}
.theme-btn:hover{color:var(--accent);border-color:var(--accent)}
/* Dark shows the sun (tap for light); light shows the moon (tap for dark). */
.theme-moon{display:none}
:root[data-theme="light"] .theme-sun{display:none}
:root[data-theme="light"] .theme-moon{display:inline}
.filter-label{font-size:.92rem;color:var(--ink-faint);white-space:nowrap}
select:disabled{opacity:.5;cursor:not-allowed}

/* grouped results */
.group-block{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);margin-bottom:var(--s3)}
.group-block summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--s2) var(--s4);padding:var(--s4) var(--s4)}
.group-block summary::-webkit-details-marker{display:none}
.group-block summary::before{content:"\u25B8";color:var(--ink-faint);margin-right:var(--s2);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.group-block[open] > summary::before{transform:rotate(90deg)}
.group-block[open] > summary{border-bottom:1px solid var(--line-soft)}
.group-block summary:hover{background:var(--surface)}
.g-name{font-weight:600;font-size:1.02rem;flex:1 1 18rem;min-width:0}
.g-meta{font-size:.9rem;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.g-body{padding:var(--s4) var(--s4) var(--s4)}
.group-block .depth-1{background:var(--surface);box-shadow:none}
.group-block .rows{box-shadow:none}

/* ---------- result rows ---------- */
.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.row{background:var(--surface);padding:var(--s3) var(--s4);display:grid;grid-template-columns:auto 1fr minmax(6.5rem,auto);gap:var(--s1) var(--s4);align-items:start}
.row:hover{background:var(--surface)}

/* severity, readable at a glance and on hover */
.dot{grid-row:1 / span 2;width:.55rem;height:.55rem;border-radius:50%;margin-top:var(--s2);flex:none;background:var(--line)}
.sev-proven .dot{background:var(--alarm);box-shadow:0 0 0 3px var(--alarm-bg)}
.sev-high .dot{background:var(--alarm)}
.sev-medium .dot{background:var(--warn)}
.sev-clear .dot{background:var(--calm)}
.sev-low .dot{background:var(--ink-faint)}

.row .who{min-width:0}
.row .name{font-size:1rem;font-weight:600;line-height:1.4;letter-spacing:-.005em;overflow-wrap:anywhere}
.row .name a{color:var(--ink);text-decoration:none}
.row .name a:hover{color:var(--accent);text-decoration:underline}
.row .meta{font-size:.85rem;color:var(--ink-soft);line-height:1.4;overflow-wrap:anywhere}
.row .meta a{color:var(--ink-soft)}
.row .meta a:hover{color:var(--accent)}
.row .amount{text-align:right}
.row .amount .big{font-family:var(--f-display);font-weight:700;font-size:1.05rem;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap}
.row .amount .exact{font-family:var(--f-mono);font-size:.72rem;color:var(--ink-faint);white-space:nowrap;display:block;margin-top:var(--s1)}
.row .flags{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:var(--s1);margin-top:var(--s1)}
/* The compact signal replaces the chip list on the phone; desktop keeps chips. */
.signal{display:none}

/* Base chip. Every coloured variant below builds on this; without it the
   risk chips and "\u0449\u0435 N" links rendered as bare text. */
.flags{display:flex;flex-wrap:wrap;gap:var(--s1)}
.flag{display:inline-flex;align-items:center;font-size:.8rem;line-height:1.3;padding:var(--s1) var(--s2);border:1px solid var(--line);border-radius:var(--control-radius,8px);color:var(--ink-soft);text-decoration:none;white-space:nowrap}
a.flag:hover{border-color:var(--accent);color:var(--accent)}
.flag.alarm{border-color:var(--alarm);background:var(--alarm-bg);color:var(--alarm);font-weight:500}
.flag.warn{border-color:var(--warn);background:var(--warn-bg);color:var(--warn)}
.flag.more{color:var(--ink-faint);border-style:dashed}
.flag.proven{border-color:var(--alarm);background:var(--alarm);color:#fff;font-weight:600}
.flag.clear{border-color:var(--calm);background:var(--calm-bg);color:var(--calm);font-weight:500}
.tier{font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:var(--s1) var(--s2);border:1px solid currentColor;white-space:nowrap;border-radius:2px}
.tier.confirmed{color:var(--calm);background:var(--calm-bg)}
.tier.state{color:var(--warn);background:var(--warn-bg)}
.tier.own{color:var(--ink-faint);background:var(--surface-2)}
.code{font-family:var(--f-mono);font-size:.74rem;color:var(--ink-faint)}

/* ---------- cards ---------- */
.card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--s5) var(--s5);margin-bottom:var(--s4)}
.card h3{margin:0 0 var(--s2);font-size:1.08rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.card p{margin:0 0 var(--s3);color:var(--ink-soft);max-width:68ch}
.card p:last-child{margin-bottom:0}
.card p.lead{color:var(--ink);font-size:1.02rem}
/* The one-line verdict at the top of a tender page. */
.verdict.compact{padding:var(--s3) var(--s4);margin-bottom:var(--s5)}
.verdict.compact h3{margin:0;font-size:1rem;font-weight:500;line-height:1.5}
.verdict.compact h3 a{white-space:nowrap;margin-left:var(--s2)}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:var(--s3) var(--s4);font-size:.94rem;color:var(--ink);max-width:none;border-radius:0 var(--radius) var(--radius) 0}
.legal.reading{border-left-color:var(--warn);background:var(--warn-bg)}
details.sub{margin:var(--s4) 0 var(--s1);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
details.sub summary{cursor:pointer;list-style:none;padding:var(--s3) var(--s4);font-size:.93rem;font-weight:500;color:var(--accent)}
details.sub summary::-webkit-details-marker{display:none}
details.sub summary::before{content:"+";display:inline-block;width:1.1rem;color:var(--ink-faint);font-weight:600}
details.sub[open] summary::before{content:"\u2212"}
details.sub[open] summary{border-bottom:1px solid var(--line-soft)}
details.sub .inner{padding:var(--s3) var(--s4) var(--s4)}
details.sub p{margin:0 0 var(--s3);font-size:.93rem;max-width:68ch}
details.sub p:last-child{margin-bottom:0}
.faint{color:var(--ink-faint);font-size:.9rem}

.group{margin:var(--s6) 0 var(--s3);display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap}
.group h3{font-family:var(--f-display);font-weight:700;font-size:1.12rem;margin:0}
.group .count{font-size:.88rem;color:var(--ink-faint)}

dl.facts{display:grid;grid-template-columns:minmax(8rem,max-content) 1fr;gap:var(--s2) var(--s5);margin:0}
dl.facts dt{font-size:.86rem;color:var(--ink-faint);padding-top:var(--s1)}
dl.facts dd{margin:0;font-size:1rem}
dl.facts dd strong{font-weight:600}

/* ---------- misc ---------- */
.pager{display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap;margin-top:var(--s5);font-size:.94rem}
.pager a{padding:var(--s2) var(--s3);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);text-decoration:none;min-height:2.4rem;display:inline-flex;align-items:center}
.pager a:hover{border-color:var(--accent)}
.pager span{color:var(--ink-faint)}
.pager .jump{display:inline-flex;align-items:center;gap:var(--s2);color:var(--ink-faint);margin:0 auto}
.pager .jump input{width:4.5rem;padding:var(--s1) var(--s2);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);color:var(--ink);font:inherit;text-align:center}
.pager .jump button{padding:var(--s1) var(--s3);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);color:var(--accent);font:inherit;cursor:pointer}
.pager .jump button:hover{border-color:var(--accent)}
.empty{background:var(--surface);border:1px dashed var(--line);padding:var(--s7) var(--s5);text-align:center;color:var(--ink-soft)}
.card ul{margin:var(--s1) 0 var(--s4);padding-left:var(--s4);color:var(--ink-soft);max-width:68ch}
.card li{margin-bottom:var(--s2)}
.note{font-size:.9rem;color:var(--ink-faint);max-width:68ch;margin-top:var(--s7);padding-top:var(--s4);border-top:1px solid var(--line)}

details.help{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:var(--s5)}
details.help summary{cursor:pointer;padding:var(--s4) var(--s4);font-weight:500;font-size:.97rem;list-style:none;display:flex;align-items:center;gap:var(--s2)}
details.help summary::-webkit-details-marker{display:none}
details.help summary::before{content:"?";display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;border:1px solid var(--accent);color:var(--accent);font-size:.82rem;font-weight:600;flex:none}
details.help[open] summary{border-bottom:1px solid var(--line-soft)}
details.help .inner{padding:var(--s4) var(--s4) var(--s4)}
details.help p{margin:0 0 var(--s3);color:var(--ink-soft);max-width:68ch}
details.help p:last-child{margin-bottom:0}
details.help ul{margin:var(--s1) 0 var(--s4);padding-left:var(--s4);color:var(--ink-soft);max-width:68ch}
details.help li{margin-bottom:var(--s2)}
details.help p.lead{color:var(--ink)}
details.help p strong{color:var(--ink)}
details.help + details.help{margin-top:calc(-1 * var(--s4))}
/* ---------- screens ----------
   Every size decision lives here rather than beside the rule it overrides.
   Phones get a single column, thumb-sized hit areas and 16px form text:
   anything smaller and iOS zooms the whole page the moment a field is
   focused, which then leaves the layout scrolled sideways. Tablets keep the
   desktop shape with tighter spacing. */

@media (max-width:64rem){
  .card{padding:var(--s4) var(--s4)}
  h2{margin-top:var(--s6)}
  .wrap{padding-bottom:var(--s8)}
  /* Below a wide desktop the third column is gone and the chips wrap. Let
     them: a flag nobody can see is a flag that may as well not be there. */
  .row .flags .flag{font-size:.76rem;padding:var(--s1) var(--s2)}
}

@media (max-width:44rem){
  body{font-size:16px}

  /* The phone job is scanning the feed, so on the LIST pages the first screen
     must be tenders, not onboarding: the explainer strip and the help fold
     go. Everywhere else the subtitle carries facts \u2014 a \u0404\u0414\u0420\u041F\u041E\u0423, an
     institution, the latest run \u2014 so it stays. */
  .primer{display:none}
  body[data-nav="feed"] .sub,body[data-nav="railway"] .sub,body[data-nav="prices"] .sub,body[data-nav="starred"] .sub,
  body[data-nav="feed"] details.help,body[data-nav="railway"] details.help,body[data-nav="prices"] details.help{display:none}
  h1{font-size:1.3rem}
  .statline{font-size:.8rem;color:var(--ink-faint)}

  /* header: the drawer already lists every section, so the inline links are
     duplication that costs a whole row on a narrow screen */
  .nav{display:none}
  .top .inner{padding:var(--s2) max(var(--s4),env(safe-area-inset-right)) var(--s2) max(var(--s4),env(safe-area-inset-left));gap:var(--s2) var(--s3)}
  .brand{font-size:1rem}
  /* On desktop .nav's margin-left:auto pushes the burger to the right edge;
     the phone hides .nav, so the burger needs its own push or it hugs the
     logo. This keeps the logo left and the burger at the far right. */
  .theme-btn{width:2.75rem;height:2.75rem}
  .burger{width:2.75rem;height:2.75rem;margin-left:auto}
  .starred-btn{min-height:2.75rem;padding:var(--s2) var(--s3)}
  .starred-btn span{display:none}
  .drawer{width:min(20rem,88vw)}
  .drawer a{padding:var(--s4) var(--s4);min-height:2.75rem}

  .wrap{padding:var(--s4) var(--s4) var(--s8)}
  h1{font-size:1.25rem;max-width:none;margin-bottom:var(--s1)}
  h2{font-size:1.15rem;margin-top:var(--s5)}
  .sub{font-size:.88rem;margin-bottom:var(--s2)}
  .presets{margin-bottom:var(--s2)}
  .sortbar{margin-bottom:var(--s2)}
  .sub,.hint,.card p,.card ul,.note,details.sub p{max-width:none}

  /* iOS zoom guard \u2014 every control a finger can land in */
  input,select,button{font-size:16px}

  .sortbar{padding:var(--s2) var(--s2);gap:var(--s2)}
  /* two rows, not four: search shares its row with the button, the two
     selects share the next one with their captions stacked above them.
     Every control here is a tap target, so none goes below 44px. */
  .sortbar input[type=search]{flex:1 1 58%;min-width:0;min-height:2.75rem;font-size:16px}
  .sortbar .go{flex:0 0 auto;width:auto;min-height:2.75rem;padding:var(--s2) var(--s4);font-size:16px}
  .sortbar label{order:1;flex:1 1 calc(50% - .2rem);flex-direction:column;align-items:stretch;gap:var(--s1);font-size:.72rem;letter-spacing:.02em}
  .sortbar.dir label{flex:1 1 100%}
  .sortbar select{width:100%;max-width:none;min-height:2.75rem;font-size:16px}

  /* every chip visible: a hidden one may as well not exist */
  .presets{flex-wrap:wrap;gap:var(--s1)}
  .preset{flex:none;min-height:2.75rem;display:inline-flex;align-items:center;padding:var(--s2) var(--s3);font-size:.86rem}
  .primer{display:none}

  /* the filter sheet: presets, sort/group and the filter panel collapse
     behind one full-width trigger. The count stays on the trigger itself \u2014
     state that hides itself is worse than state that crowds. */
  .filters-trigger{display:flex;align-items:center;justify-content:center;gap:var(--s2);width:100%;min-height:2.75rem;margin:0 0 var(--s3);padding:var(--s2) var(--s4);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--accent);font-size:.95rem;font-weight:500;cursor:pointer}
  .filters-scrim{display:block}
  #filters-toggle:checked ~ .filters-scrim{opacity:1;visibility:visible}
  .filters-drawer{position:fixed;top:0;right:0;bottom:0;left:auto;width:min(22rem,88vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);visibility:hidden;transition:transform .28s cubic-bezier(.32,.72,.32,1),visibility .28s;overflow-y:auto}
  #filters-toggle:checked ~ .filters-drawer{transform:translateX(0);visibility:visible}
  #filters-toggle:focus-visible ~ .filters-trigger{outline:2px solid var(--accent);outline-offset:2px}
  .filters-drawer .drawer-head{display:flex}
  .filters-drawer-body{padding:var(--s4)}

  /* full-bleed lists: on a phone the card frame is noise, the content is not */
  .rows,.group-block{border-radius:0;border-left:0;border-right:0;margin-inline:calc(-1 * var(--s4));box-shadow:none}
  /* the amount is what a reader scans for, so it leads the stack; the dot
     rides along with it instead of floating on its own line. Buyer/title
     comes next, flags last \u2014 nobody scrolls to a chip before the number. */
  .row{display:flex;flex-direction:column;gap:var(--s1);position:relative;padding:var(--s3) var(--s4) var(--s3) calc(var(--s4) + var(--s4));}
  /* the dot is the only severity cue the phone keeps: red for a proven or
     priced-anomaly row, amber for "worth a look", grey for the rest. */
  .row .dot{position:absolute;left:var(--s4);top:1.1rem;grid-row:auto;margin-top:0;width:.5rem;height:.5rem;border-radius:50%;background:var(--ink-faint)}
  .row.sev-proven .dot,.row.sev-high .dot{background:var(--alarm)}
  .row.sev-medium .dot{background:var(--warn)}
  .row .amount{order:-2;text-align:left;margin-top:0;display:flex;align-items:baseline;gap:var(--s2)}
  .row .amount .big{font-size:1.05rem;font-variant-numeric:tabular-nums}
  /* the tender ref is scanning noise on the phone; it stays on the tender page */
  .row .amount .exact{display:none}
  .row .who{order:-1}
  .row .name{font-size:.98rem;display:flex;align-items:flex-start;gap:var(--s1)}
  .row .name a{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .row .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* one short line instead of a stack of sentence chips; the chips are the
     desktop view, the full list is on the tender page */
  .row .flags{display:none}
  /* Kept to a single line come what may: not every risk has a short label, so
     the fallback is the full rule name \u2014 the ellipsis is what guarantees the
     line stays minimal regardless of the data. */
  .row .signal{display:block;order:0;margin-top:var(--s1);font-size:.85rem;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* the worst tap target on the page before this: a 1.15rem glyph with no
     hit-box padding. It now clears 44px on both sides; float is dropped so
     the extra hit area does not overlap the title text next to it. No
     negative margin: the 44px box already sets .name's own line height (it
     is the tallest flex item in that row), so pulling it up with a
     negative margin only ever bleeds into the block above (.amount) \u2014
     there is no slack to reclaim without doing that. */
  .row .name .star{float:none}
  .row .star{display:inline-flex;align-items:center;justify-content:center;min-width:2.75rem;min-height:2.75rem;padding:0;margin:0;font-size:1.3rem;flex:none}

  .group-block summary{padding:var(--s4) var(--s4)}
  .g-name{flex:1 1 100%}
  .g-body{padding:var(--s3) var(--s4) var(--s4)}

  .card{padding:var(--s4) var(--s4);box-shadow:none}
  .actions{gap:var(--s2)}
  .action{flex:1 1 100%;justify-content:center;min-height:2.75rem}
  .pager a{min-height:2.75rem;display:inline-flex;align-items:center}

  .filters-more summary{padding:var(--s3) var(--s4)}
  .filter-row input[type=search],.filter-row input[type=date],.filter-row input.num,.filter-row select{flex:1 1 100%;width:100%;max-width:none}

  dl.facts{grid-template-columns:1fr;gap:var(--s1)}
  dl.facts dd{margin-bottom:var(--s3)}

  details.help summary,details.sub summary{padding:var(--s4) var(--s4)}
  .legal{padding:var(--s3) var(--s4)}

  /* ---------- app shell ----------
     The phone gets a bottom tab bar with the four places people actually go;
     the header keeps only the mark and the theme switch. Everything the tab
     bar replaces (burger, star button) leaves the header. */
  .top .inner{min-height:3.25rem;padding-top:var(--s1);padding-bottom:var(--s1)}
  .burger,.starred-btn{display:none}
  .theme-btn{margin-left:auto;width:2.5rem;height:2.5rem}
  .wrap{padding-bottom:calc(4.5rem + env(safe-area-inset-bottom))}
  .tabbar{display:grid;grid-template-columns:repeat(3,1fr);position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--surface);border-top:1px solid var(--line);padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
  .tabbar a,.tabbar label{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:3.5rem;padding:var(--s1) 0;color:var(--ink-faint);text-decoration:none;font-size:.68rem;font-weight:500;letter-spacing:.01em;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .tabbar svg{width:1.4rem;height:1.4rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .tabbar a[aria-current]{color:var(--accent)}
  .tabbar a:active,.tabbar label:active{background:var(--surface-2)}
  #menu-toggle:checked ~ .tabbar .tab-menu{color:var(--accent)}

  /* "back" as a pill at the top of inner pages: a thumb target, not a
     text link at the very top edge. */
  .back{display:inline-flex;align-items:center;min-height:2.4rem;padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--control-radius,8px);background:var(--surface);text-decoration:none;font-size:.9rem;margin-bottom:var(--s3)}

  /* ---------- lists ----------
     The whole row is the tap target: the title link stretches over the row,
     while the star and the inline links stay above it. */
  .row .name a::after{content:"";position:absolute;inset:0}
  .row .star-form,.row .meta a{position:relative;z-index:1}
  .row:active{background:var(--surface-2)}
  .row{padding-top:var(--s4);padding-bottom:var(--s4)}
  .row .amount .big{font-size:1.1rem}

  /* filters + presets as one horizontally scrolling strip above the list:
     the trigger first, then the chips, no wrapping */
  .filter-sheet{display:flex;align-items:center;gap:var(--s2);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin:0 calc(-1 * var(--s4)) var(--s3);padding:0 var(--s4)}
  .filter-sheet::-webkit-scrollbar{display:none}
  .filters-trigger{flex:none;width:auto;margin:0;min-height:2.5rem;padding:0 var(--s3);border-radius:var(--control-radius,8px);font-size:.88rem}
  .presets{display:flex;flex-wrap:nowrap;gap:var(--s2);margin:0}
  .preset{min-height:2.5rem;padding:0 var(--s3);font-size:.86rem;white-space:nowrap}

  /* pager: two big buttons, the jump form beneath */
  .pager{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);margin-top:var(--s5)}
  .pager a{justify-content:center;min-height:2.75rem;border-radius:var(--radius)}
  .pager a[aria-label]{display:none}
  .pager .jump{grid-column:1 / -1;justify-content:center;margin:var(--s1) 0 0}
  .pager .jump input,.pager .jump button{min-height:2.5rem}

  /* cards: full-bleed, one column of facts */
  .card{border-left:0;border-right:0;border-radius:0;margin-inline:calc(-1 * var(--s4));padding:var(--s4)}
  .verdict.compact{margin-inline:0;border-left:1px solid var(--line);border-right:1px solid var(--line);border-radius:var(--radius)}
  .actions .action.primary{flex:1 1 100%}
  .actions .action:not(.primary){flex:1 1 calc(50% - var(--s1))}
}

@media (max-width:22rem){
  .brand span{display:none}
}

`;
var SITE_DESCRIPTION = "\u041F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443: \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0438 \u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0438, \u0432\u043B\u0430\u0441\u043D\u0438\u0439 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0446\u0456\u043D \u0456 \u043F\u0440\u0430\u0432\u043E\u0432\u0430 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u043F\u043E \u043A\u043E\u0436\u043D\u0456\u0439 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456.";
function siteOrigin() {
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}
var renderPath = "";
function setRenderPath(path) {
  renderPath = path;
}
function canonicalPath() {
  const [pathname, query2 = ""] = renderPath.split("?");
  const p = new URLSearchParams(query2);
  p.delete("from");
  const q = p.toString();
  return (pathname || "/") + (q ? `?${q}` : "");
}
function layout(opts) {
  return `<!doctype html>
<html lang="uk" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} \u2014 \u0422\u0435\u043D\u0434\u043EScope</title>
<meta name="description" content="${esc(opts.description ?? SITE_DESCRIPTION)}">
<meta property="og:site_name" content="\u0422\u0435\u043D\u0434\u043EScope">
${opts.nav === "feed" && siteOrigin() ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "\u0422\u0435\u043D\u0434\u043EScope", url: siteOrigin() + "/" }).replace(/</g, "\\u003c")}</script>` : ""}
<meta property="og:type" content="website">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="${esc(opts.title)} \u2014 \u0422\u0435\u043D\u0434\u043EScope">
<meta property="og:description" content="${esc(opts.description ?? SITE_DESCRIPTION)}">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2042%2042%22%20color%3D%22%23172a20%22%3E%3Cpath%20d%3D%22M24%206A13%2013%200%201%200%2010%2029%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%224.5%22%2F%3E%3Cpath%20d%3D%22M28%2010A13%2013%200%200%201%2028%2025%22%20fill%3D%22none%22%20stroke%3D%22%23187443%22%20stroke-width%3D%224.5%22%2F%3E%3Cpath%20d%3D%22m28%2029%208%208%22%20stroke%3D%22%23187443%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M8%2016%2010%2012Q11%2010%2014%2010H23A3%203%200%200%201%2023%2016Z%22%20fill%3D%22currentColor%22%2F%3E%3Cpath%20d%3D%22M15%2024Q15%2020%2021%2018V29L15%2033Z%22%20fill%3D%22currentColor%22%2F%3E%3Cpath%20d%3D%22M21%2018V23L15%2029V24Q15%2020%2021%2018Z%22%20fill%3D%22%23187443%22%2F%3E%3C%2Fsvg%3E">

<link rel="apple-touch-icon" href="/icon-180.png">
${siteOrigin() ? `<link rel="canonical" href="${esc(siteOrigin() + canonicalPath())}">
<meta property="og:url" content="${esc(siteOrigin() + canonicalPath())}">` : ""}
<meta property="og:image" content="${esc(siteOrigin())}/icon-512.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${STYLES}
${RADAR_STYLES}
${NAVIGATION_STYLES}
${STUDIO_STYLES}</style>
<!-- The site's only script: it applies the saved theme before the first paint,
     so a light-theme reader never sees a dark flash. Everything else is CSS. -->
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
</head>
<body data-nav="${esc(opts.nav ?? "")}">
<a class="skip" href="#main">\u0414\u043E \u0432\u043C\u0456\u0441\u0442\u0443</a>

<header class="top"><div class="inner">
  <a class="brand" href="/"><svg class="studio-logo" viewBox="0 0 42 42" aria-hidden="true"><path d="M24 6A13 13 0 1 0 10 29" fill="none" stroke="currentColor" stroke-width="4.5"/><path d="M28 10A13 13 0 0 1 28 25" fill="none" stroke="#187443" stroke-width="4.5"/><path d="m28 29 8 8" stroke="#187443" stroke-width="5" stroke-linecap="round"/><path d="M8 16 10 12Q11 10 14 10H23A3 3 0 0 1 23 16Z" fill="currentColor"/><path d="M15 24Q15 20 21 18V29L15 33Z" fill="currentColor"/><path d="M21 18V23L15 29V24Q15 20 21 18Z" fill="#187443"/></svg><span class="brand-word">\u0422\u0435\u043D\u0434\u043EScope</span></a>
  <nav class="nav" aria-label="\u041E\u0441\u043D\u043E\u0432\u043D\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438">
    <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
    <a href="/railway"${opts.nav === "railway" ? ' aria-current="page"' : ""}>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</a>
    <a href="/lookup"${opts.nav === "lookup" ? ' aria-current="page"' : ""}>\u0417\u043D\u0430\u0439\u0442\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044E</a>
  </nav>
  <a class="starred-btn${opts.nav === "starred" ? " on" : ""}" href="/starred" title="\u041E\u0431\u0440\u0430\u043D\u0435">\u2605<span>\u041E\u0431\u0440\u0430\u043D\u0435</span></a>
  <button class="theme-btn" type="button" title="\u0421\u0432\u0456\u0442\u043B\u0430 \u0430\u0431\u043E \u0442\u0435\u043C\u043D\u0430 \u0442\u0435\u043C\u0430" aria-label="\u041F\u0435\u0440\u0435\u043C\u043A\u043D\u0443\u0442\u0438 \u0442\u0435\u043C\u0443" onclick="(function(){try{var r=document.documentElement,n=r.dataset.theme==='light'?'dark':'light';r.dataset.theme=n;localStorage.setItem('theme',n);}catch(e){}})()"><svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg></button>
  <button type="button" class="menu-trigger" data-menu-open aria-controls="site-menu" aria-expanded="false"><span aria-hidden="true">\u2630</span> \u041C\u0435\u043D\u044E</button>
</div></header>
${navigationDialog(opts.nav)}
<main class="wrap" id="main">
${opts.body}
</main>
<nav class="tabbar" aria-label="\u0413\u043E\u043B\u043E\u0432\u043D\u0435">
  <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
  <a href="/railway"${opts.nav === "railway" ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-3M15 21l-1.5-3"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/></svg>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</a>
  <a href="/starred"${opts.nav === "starred" ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z"/></svg>\u041E\u0431\u0440\u0430\u043D\u0435</a>

</nav>
${NAVIGATION_SCRIPT}
${FAVOURITE_SCRIPT}
${REVIEW_SCRIPT}
</body>
</html>`;
}

// server/pages/review.ts
var options = '<option value="to_review">\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438</option><option value="in_progress">\u0423 \u0440\u043E\u0431\u043E\u0442\u0456</option><option value="needs_documents">\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438</option><option value="explained">\u0404 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F</option>';
function reviewEditor(meta) {
  return `${REVIEW_STYLES}<details class="detail-fold"><summary><strong>\u041C\u043E\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430</strong></summary><form class="review-editor" data-review-editor="${esc(JSON.stringify(meta))}"><p class="hint">\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u044E\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0443 \u0446\u044C\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456. \u041D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0443\u044E\u0442\u044C\u0441\u044F \u043C\u0456\u0436 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044F\u043C\u0438.</p><label>\u0421\u0442\u0430\u0442\u0443\u0441<select name="status">${options}</select></label><label>\u041D\u043E\u0442\u0430\u0442\u043A\u0430<textarea name="note" maxlength="10000" placeholder="\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438, \u044F\u043A\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0456\u2026"></textarea></label><div class="review-actions"><button type="submit">\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0432 \u0447\u0435\u0440\u0433\u0443</button><a href="/review">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043C\u043E\u044E \u0447\u0435\u0440\u0433\u0443 \u2192</a></div></form></details><p id="review-message" role="status" aria-live="polite"></p><noscript>\u0414\u043B\u044F \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u043E\u0457 \u0447\u0435\u0440\u0433\u0438 \u0443\u0432\u0456\u043C\u043A\u043D\u0456\u0442\u044C JavaScript.</noscript>`;
}
function reviewPage() {
  return layout({ title: "\u041C\u043E\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430", nav: "review", body: `${REVIEW_STYLES}<header class="compact-intro"><h1>\u041C\u043E\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430</h1><p>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u044F\u043A\u0456 \u0432\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u0435, \u0442\u0430 \u0432\u0430\u0448\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438.</p></header><p class="hint">\u0417\u0431\u0435\u0440\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0443 \u0446\u044C\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456. \u0415\u043A\u0441\u043F\u043E\u0440\u0442\u0443\u0439\u0442\u0435 \u043A\u043E\u043F\u0456\u044E \u043F\u0435\u0440\u0435\u0434 \u043E\u0447\u0438\u0449\u0435\u043D\u043D\u044F\u043C \u0434\u0430\u043D\u0438\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.</p><div class="review-tools"><label>\u041F\u043E\u0448\u0443\u043A<input type="search" id="review-search" placeholder="\u041D\u0430\u0437\u0432\u0430, \u043D\u043E\u043C\u0435\u0440 \u0430\u0431\u043E \u043D\u043E\u0442\u0430\u0442\u043A\u0430"></label><label>\u0421\u0442\u0430\u0442\u0443\u0441<select id="review-filter"><option value="">\u0423\u0441\u0456 \u0441\u0442\u0430\u0442\u0443\u0441\u0438</option>${options}</select></label></div><p id="review-count"></p><div id="review-list"></div><p id="review-message" role="status" aria-live="polite"></p><div class="review-actions"><a href="/">\u0417\u043D\u0430\u0439\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u2192</a><button type="button" id="review-export">\u0415\u043A\u0441\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u043F\u0456\u044E</button><label>\u0412\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043A\u043E\u043F\u0456\u044E <input type="file" id="review-import" accept="application/json,.json"></label></div><noscript>\u0414\u043B\u044F \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u043E\u0457 \u0447\u0435\u0440\u0433\u0438 \u0443\u0432\u0456\u043C\u043A\u043D\u0456\u0442\u044C JavaScript.</noscript>` });
}

// server/favourites.ts
var FAVOURITES_COOKIE = "tr_starred";
var MAX_SAVED = 60;
var TTL_SECONDS = 365 * 24 * 60 * 60;
var SEPARATOR = "~";
var PREFIX = {
  tender: "t",
  entity: "e",
  supplier: "s",
  officer: "o"
};
var BY_PREFIX = { t: "tender", e: "entity", s: "supplier", o: "officer" };
var EDRPOU = /^\d{6,10}$/;
function isEdrpou(value) {
  return EDRPOU.test(value.trim());
}
function normaliseEdrpou(input) {
  const digits = input.replace(/\D/g, "");
  return isEdrpou(digits) ? digits : null;
}
function isUsableId(id) {
  return id.length > 0 && id.length <= 120 && !/[~;,\s\\"]/.test(id);
}
function isFavKind(value) {
  return value === "tender" || value === "entity" || value === "supplier" || value === "officer";
}
function encodeFavourite(fav) {
  return `${PREFIX[fav.kind]}:${fav.id}`;
}
function decodeFavourite(token) {
  const colon = token.indexOf(":");
  if (colon !== 1) return null;
  const kind = BY_PREFIX[token.slice(0, 1)];
  const id = token.slice(colon + 1);
  if (!kind || !isUsableId(id)) return null;
  return { kind, id };
}
function parseFavourites(cookieValue) {
  if (!cookieValue) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const token of cookieValue.split(SEPARATOR)) {
    const fav = decodeFavourite(token.trim());
    if (!fav) continue;
    const key = encodeFavourite(fav);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fav);
  }
  return out.slice(0, MAX_SAVED);
}
function serialiseFavourites(favourites) {
  const seen = /* @__PURE__ */ new Set();
  const tokens = [];
  for (const fav of favourites) {
    if (!isUsableId(fav.id)) continue;
    const token = encodeFavourite(fav);
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens.slice(0, MAX_SAVED).join(SEPARATOR);
}
function isStarred(favourites, kind, id) {
  return favourites.some((f) => f.kind === kind && f.id === id);
}
function toggleFavourite(current2, kind, id) {
  if (!isUsableId(id)) return current2;
  return isStarred(current2, kind, id) ? current2.filter((f) => !(f.kind === kind && f.id === id)) : [{ kind, id }, ...current2];
}
function favouritesCookie(favourites, secure) {
  const value = serialiseFavourites(favourites);
  const attrs = `SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
  return value.length === 0 ? `${FAVOURITES_COOKIE}=; ${attrs}; Max-Age=0` : `${FAVOURITES_COOKIE}=${value}; ${attrs}; Max-Age=${TTL_SECONDS}`;
}

// src/labels.ts
var RISK_LABELS = {
  "ari-1-1": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u0443\u0432\u0430\u043B\u0438 \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 \u0442\u0440\u0438\u0447\u0456",
    means: "\u041F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438 \u0434\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0443\u043A\u043B\u0430\u043B\u0438 \u0442\u0440\u0438 \u0447\u0438 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434. \u0421\u0430\u043C\u0435 \u0442\u0430\u043A \u043D\u0430\u0439\u0447\u0430\u0441\u0442\u0456\u0448\u0435 \u043F\u0456\u0434\u043D\u0456\u043C\u0430\u044E\u0442\u044C \u0446\u0456\u043D\u0443 \u0432\u0436\u0435 \u043F\u0456\u0441\u043B\u044F \u0442\u043E\u0433\u043E, \u044F\u043A \u0442\u043E\u0440\u0433\u0438 \u0432\u0438\u0433\u0440\u0430\u043D\u043E.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "ari-1-2": {
    short: "\u0426\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438 \xAB\u0437\u0430 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456\xBB",
    means: "\u0414\u0432\u0456 \u0447\u0438 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434 \u0456\u0437 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F\u043C \u043F\u0440\u043E \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456. \u0426\u0435 \u043F\u043E\u0448\u0438\u0440\u0435\u043D\u0438\u0439 \u0441\u043F\u043E\u0441\u0456\u0431 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u0442\u0438 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "sas24-3-4": {
    short: "\u0426\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438 \u0439 \u0441\u0442\u0440\u043E\u043A \u043F\u043E\u0434\u043E\u0432\u0436\u0438\u043B\u0438",
    means: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0437\u043C\u0456\u043D\u0438\u0432 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0434\u0440\u0430\u0437\u0443 \u0443 \u0434\u0432\u043E\u0445 \u0447\u0430\u0441\u0442\u0438\u043D\u0430\u0445 \u2014 \u0446\u0456\u043D\u0430 \u0432\u0433\u043E\u0440\u0443, \u0441\u0442\u0440\u043E\u043A \u0434\u0430\u043B\u0456.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "sas24-3-2": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0434\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u2014 \u0442\u043E\u0432\u0430\u0440\u0438 \u0439 \u043F\u043E\u0441\u043B\u0443\u0433\u0438",
    means: "\u0423\u0441\u0456\u0445, \u043A\u0440\u0456\u043C \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u0437\u043D\u044F\u043B\u0438 \u0437 \u0442\u043E\u0440\u0433\u0456\u0432. \u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u044F \u0437\u043D\u0438\u043A\u0430\u0454, \u0446\u0456\u043D\u0443 \u043D\u0435\u043C\u0430 \u0437 \u0447\u0438\u043C \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-2-1": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0434\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u2014 \u0440\u043E\u0431\u043E\u0442\u0438",
    means: "\u0422\u0435 \u0441\u0430\u043C\u0435 \u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0440\u043E\u0431\u0456\u0442: \u0443\u0441\u0456\u0445 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043E.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-5": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438, \u043D\u0435 \u0434\u0430\u0432\u0448\u0438 \u0432\u0438\u043F\u0440\u0430\u0432\u0438\u0442\u0438 \u043F\u043E\u043C\u0438\u043B\u043A\u0443",
    means: "\u0417\u0430\u043A\u043E\u043D \u0434\u0430\u0454 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0443 24 \u0433\u043E\u0434\u0438\u043D\u0438 \u043D\u0430 \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0435\u0439. \u0422\u0443\u0442 \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 \u0434\u0432\u043E\u0445 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438, \u043D\u0435 \u0441\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u0432\u0448\u0438\u0441\u044C \u0446\u0438\u043C \u043C\u0435\u0445\u0430\u043D\u0456\u0437\u043C\u043E\u043C.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-15": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432, \u043F\u043E\u043A\u0438 \u0442\u0440\u0438\u0432\u0430\u043B\u0430 \u0441\u043A\u0430\u0440\u0433\u0430",
    means: "\u0414\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0437\u043D\u044F\u043B\u0438 \u0437 \u0442\u043E\u0440\u0433\u0456\u0432 \u0443 \u043C\u043E\u043C\u0435\u043D\u0442, \u043A\u043E\u043B\u0438 \u0441\u043A\u0430\u0440\u0433\u0430 \u0449\u0435 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0430\u043B\u0430\u0441\u044F.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-13": {
    short: "\u0411\u0435\u0437\u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043D\u043E \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0456\u0437\u043C \xAB24 \u0433\u043E\u0434\u0438\u043D\u0438\xBB",
    means: "\u041D\u0430 \u0441\u043F\u0440\u043E\u0449\u0435\u043D\u0456\u0439 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0441\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043B\u0438\u0441\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0442\u0430\u043C, \u0434\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u043D\u0435\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-10": {
    short: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u043F\u043E\u043F\u0440\u0438 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432\u0438\u043C\u043E\u0433",
    means: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0456 \u0432\u0438\u043C\u043E\u0433\u0438 \u0449\u043E\u0434\u043E \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F, \u0430\u043B\u0435 \u0439\u043E\u0433\u043E \u0437\u0430\u043B\u0438\u0448\u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-11-1": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u043B\u0438 \u043F\u043E\u0432\u0437 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
    means: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u043F\u0440\u043E\u0432\u0435\u043B\u0438 \u0431\u0435\u0437 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u0442\u0430\u043C, \u0434\u0435 \u0432\u043E\u043D\u0430 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0430.",
    group: "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438"
  },
  "sas24-3-11-2": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u043B\u0438 \u043F\u0456\u0434 \u0447\u0430\u0441 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F",
    means: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0456\u0434\u043F\u0438\u0441\u0430\u043B\u0438, \u043F\u043E\u043A\u0438 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0443\u0432\u0430\u043B\u0438 \u2014 \u0442\u043E\u0431\u0442\u043E \u043D\u0435 \u0434\u043E\u0447\u0435\u043A\u0430\u0432\u0448\u0438\u0441\u044C \u0440\u0456\u0448\u0435\u043D\u043D\u044F.",
    group: "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438"
  },
  "sas24-3-1": {
    short: "\u041D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043B\u0438 \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043F\u043E \u0441\u043A\u0430\u0440\u0437\u0456 \u0432\u0447\u0430\u0441\u043D\u043E",
    means: "\u0420\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0435 \u0434\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F. \u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0439\u043E\u0433\u043E \u0443 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u0441\u0442\u0440\u043E\u043A.",
    group: "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438"
  },
  "sas24-3-9": {
    short: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043E\u0431\u0440\u0430\u043B\u0438 \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F",
    means: "\u041F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0437\u043D\u043E\u0432\u0443 \u0432\u0438\u0437\u043D\u0430\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430.",
    group: "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438"
  },
  "sas24-3-7": {
    short: "\u0420\u043E\u0431\u043E\u0442\u0438 \xAB\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E\xBB \u043F\u0456\u0434\u043E\u0437\u0440\u0456\u043B\u043E \u0448\u0432\u0438\u0434\u043A\u043E",
    means: "\u041C\u0456\u0436 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F\u043C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0438 \u0456 \u0437\u0432\u0456\u0442\u043E\u043C \u043F\u0440\u043E \u0439\u043E\u0433\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043C\u0438\u043D\u0443\u043B\u043E \u043C\u0435\u043D\u0448\u0435 60 \u0434\u043D\u0456\u0432.",
    group: "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0441\u0445\u043E\u0434\u044F\u0442\u044C\u0441\u044F"
  }
};
var GROUP_ORDER = [
  "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438",
  "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438",
  "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438",
  "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438",
  "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0441\u0445\u043E\u0434\u044F\u0442\u044C\u0441\u044F"
];
var PROCEDURES = {
  aboveThreshold: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438",
  aboveThresholdUA: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438",
  aboveThresholdEU: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438 \u0437 \u043F\u0443\u0431\u043B\u0456\u043A\u0430\u0446\u0456\u0454\u044E \u0432 \u0404\u0421",
  belowThreshold: "\u0421\u043F\u0440\u043E\u0449\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F",
  reporting: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u0438\u0439 \u0434\u043E\u0433\u043E\u0432\u0456\u0440",
  negotiation: "\u041F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u043D\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430",
  "negotiation.quick": "\u041F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u043D\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430, \u0441\u043A\u043E\u0440\u043E\u0447\u0435\u043D\u0430",
  competitiveDialogue: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u0438\u0439 \u0434\u0456\u0430\u043B\u043E\u0433",
  "competitiveDialogue.stage2": "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u0438\u0439 \u0434\u0456\u0430\u043B\u043E\u0433, \u0434\u0440\u0443\u0433\u0438\u0439 \u0435\u0442\u0430\u043F",
  priceQuotation: "\u0417\u0430\u043F\u0438\u0442 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439",
  simple: "\u0421\u043F\u0440\u043E\u0449\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F",
  esco: "\u0415\u043D\u0435\u0440\u0433\u043E\u0441\u0435\u0440\u0432\u0456\u0441",
  closeFrameworkAgreementUA: "\u0420\u0430\u043C\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430"
};
function procedureLabel(code) {
  if (!code) return null;
  return PROCEDURES[code] ?? code;
}
var MONITORING_REASONS = {
  indicator: "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0438\u0439 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0440\u0438\u0437\u0438\u043A\u0443",
  fiscal: "\u0437\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0456\u0432 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E",
  authorities: "\u0437\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u044F \u043F\u0440\u0430\u0432\u043E\u043E\u0445\u043E\u0440\u043E\u043D\u043D\u0438\u0445 \u043E\u0440\u0433\u0430\u043D\u0456\u0432",
  media: "\u043F\u0443\u0431\u043B\u0456\u043A\u0430\u0446\u0456\u044F \u0443 \u0437\u0430\u0441\u043E\u0431\u0430\u0445 \u043C\u0430\u0441\u043E\u0432\u043E\u0457 \u0456\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u0457",
  public: "\u0437\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u044F \u0433\u0440\u043E\u043C\u0430\u0434\u0441\u044C\u043A\u043E\u0441\u0442\u0456"
};
var VIOLATION_TYPES = {
  other: "\u0456\u043D\u0448\u0435 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
  corruptionBiddingDocuments: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432 \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u0456\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457",
  corruptionChanges: "\u043D\u0435\u043F\u0440\u0430\u0432\u043E\u043C\u0456\u0440\u043D\u0456 \u0437\u043C\u0456\u043D\u0438 \u0434\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443",
  corruptionAwarded: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u043F\u0440\u0438 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u0456 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F",
  corruptionUntimely: "\u043D\u0435\u0441\u0432\u043E\u0454\u0447\u0430\u0441\u043D\u0435 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0456\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u0457",
  corruptionFailureDocuments: "\u043D\u0435\u043D\u0430\u0434\u0430\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432",
  corruptionPublicDisclosure: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432\u0438\u043C\u043E\u0433 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F",
  corruptionCancelled: "\u043D\u0435\u043F\u0440\u0430\u0432\u043E\u043C\u0456\u0440\u043D\u0435 \u0441\u043A\u0430\u0441\u0443\u0432\u0430\u043D\u043D\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
  corruptionContracting: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u043F\u0440\u0438 \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u0456 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443",
  corruptionProcurementMethodType: "\u043D\u0435\u043F\u0440\u0430\u0432\u043E\u043C\u0456\u0440\u043D\u0438\u0439 \u0432\u0438\u0431\u0456\u0440 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
  corruptionDescription: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432 \u043E\u043F\u0438\u0441\u0456 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
  documentsForm: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0444\u043E\u0440\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432",
  deadlineForThePublicationDocumentation: "\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0443 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457",
  rejectionOfBidsNotByLaw: "\u043D\u0435\u043F\u0440\u0430\u0432\u043E\u043C\u0456\u0440\u043D\u0435 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439",
  notComplyDecisionACU: "\u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u0410\u043D\u0442\u0438\u043C\u043E\u043D\u043E\u043F\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u043A\u043E\u043C\u0456\u0442\u0435\u0442\u0443"
};
function readableName(name) {
  if (!name) return "";
  const clean = name.replace(/\s+/gu, " ").trim();
  if (!clean) return "";
  const letters = clean.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return clean;
  const upper = [...letters].filter((c) => c === c.toUpperCase()).length;
  if (upper / letters.length < 0.8) return clean;
  let first = true;
  let afterQuote = false;
  return clean.replace(new RegExp(`\\p{L}[\\p{L}'\u2019-]*|[\xAB"\u201C']`, "gu"), (token) => {
    if (/^[«"“']$/.test(token)) {
      afterQuote = true;
      return token;
    }
    if (token.length <= 4) {
      first = false;
      afterQuote = false;
      return token;
    }
    const lower = token[0] + token.slice(1).toLowerCase();
    const capitalise = first || afterQuote;
    first = false;
    afterQuote = false;
    return capitalise ? lower[0].toUpperCase() + lower.slice(1) : lower.toLowerCase();
  });
}

// src/legal.ts
var INDICATOR_LEGAL = {
  "ari-1-1": {
    admin: "3",
    consequences: ["changesVoid", "nullity", "principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0432\u043E\u0441\u044C\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u0437\u0430 \u044F\u043A\u0438\u0445 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E \u0437\u043C\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 41: \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u043A\u043E\u0436\u043D\u0430 \u0437 \u044F\u043A\u0438\u0445 \u043C\u0430\u0454 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u0442\u0438 \u0434\u043E \u0446\u044C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443.",
    criminal: [
      { code: "366", why: "\u041A\u043E\u0436\u043D\u0430 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E. \u042F\u043A\u0449\u043E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456, \u0446\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u043D\u0430 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456 \u0437\u043C\u0456\u043D \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u043F\u043B\u0430\u0442\u0438\u0432 \u0431\u0456\u043B\u044C\u0448\u0435 \u0431\u0435\u0437 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0433\u043E \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u0421\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u043D\u0430 \u0437\u043C\u0456\u043D\u0430 \u0443\u043C\u043E\u0432 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "ari-1-2": {
    admin: "3",
    consequences: ["changesVoid", "nullity", "principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 5 \u043F\u0443\u043D\u043A\u0442 3 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB: \xAB\u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0437\u0430 \u0443\u043C\u043E\u0432\u0438 \u0449\u043E \u0442\u0430\u043A\u0435 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u043D\u0435 \u043F\u0440\u0438\u0437\u0432\u0435\u0434\u0435 \u0434\u043E \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438\xBB.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437 \u043F\u0443\u043D\u043A\u0442\u043E\u043C 3, \u0456 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0442\u0443\u0442 \u043F\u0440\u044F\u043C\u0435: \u0437\u0430\u043A\u043E\u043D \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043B\u0438\u0448\u0435 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438, \u0449\u043E \u0441\u0443\u043C\u0430 \u043D\u0435 \u0437\u0440\u043E\u0441\u0442\u0430\u0454. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0444\u0456\u043A\u0441\u0443\u0454 \u0441\u0430\u043C\u0435 \u0432\u0438\u043F\u0430\u0434\u043A\u0438, \u0434\u0435 \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E \u0446\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438.",
    criminal: [
      { code: "366", why: "\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \xAB\u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456\xBB \u0437\u0430\u0444\u0456\u043A\u0441\u043E\u0432\u0430\u043D\u0430 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456. \u0417\u0430\u043A\u043E\u043D \u043F\u0440\u044F\u043C\u043E \u0437\u0430\u0431\u043E\u0440\u043E\u043D\u044F\u0454 \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438 \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u0442\u043E\u0436 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u043C \u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u043C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0432 \u043F\u0435\u0440\u0448\u0443 \u0447\u0435\u0440\u0433\u0443." },
      { code: "191", why: "\u0420\u0456\u0437\u043D\u0438\u0446\u044F, \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0430 \u043F\u043E\u043D\u0430\u0434 \u043F\u043E\u0447\u0430\u0442\u043A\u043E\u0432\u0443 \u0446\u0456\u043D\u0443 \u0437\u0430 \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E \u043D\u0435\u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u041F\u043E\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u0442\u0430\u043A\u0438\u0445 \u0437\u043C\u0456\u043D \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-4": {
    admin: "3",
    consequences: ["changesVoid", "principles"],
    criminal: [
      { code: "366", why: "\u0417\u043C\u0456\u043D\u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0438\u0445 \u0443\u043C\u043E\u0432 \u043E\u0444\u043E\u0440\u043C\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E \u0439 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F; \u0439\u043E\u0433\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F." },
      { code: "191", why: "\u041F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0431\u0435\u0437 \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u041E\u0434\u043D\u043E\u0447\u0430\u0441\u043D\u0435 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0442\u0430 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0443 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F." }
    ]
  },
  "sas24-3-2": {
    admin: "3",
    consequences: ["principles", "nullity"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 31 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 31, \u044F\u043A\u0443 \u0441\u0430\u043C\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u043B\u044F \u0441\u043F\u043E\u0440\u0456\u0434\u043D\u0435\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u043F\u0440\u043E \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439 (sas24-3-10, sas24-3-15).",
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u043E \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E \u0446\u0456\u043D\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u0435\u044E." }
    ]
  },
  "sas24-3-2-1": {
    admin: "3",
    consequences: ["principles", "nullity"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 31 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 31 \u0442\u0430\u043A \u0441\u0430\u043C\u043E, \u044F\u043A \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u043E\u0433\u0456\u0447\u043D\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0442\u043E\u0432\u0430\u0440\u0456\u0432.",
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u043E \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0440\u043E\u0431\u0456\u0442 \u0437\u0430 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E \u0446\u0456\u043D\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u0435\u044E." }
    ]
  },
  "sas24-3-5": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u041D\u0435\u043D\u0430\u0434\u0430\u043D\u043D\u044F \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430\u043C \u043F\u0435\u0440\u0435\u0434\u0431\u0430\u0447\u0435\u043D\u043E\u0457 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043C\u043E\u0436\u043B\u0438\u0432\u043E\u0441\u0442\u0456 \u0443\u0441\u0443\u043D\u0443\u0442\u0438 \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-15": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0443 \u043C\u043E\u043C\u0435\u043D\u0442, \u043A\u043E\u043B\u0438 \u0441\u043A\u0430\u0440\u0433\u0430 \u0449\u0435 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0430\u043B\u0430\u0441\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-13": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043D\u043D\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0431\u0435\u0437 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-10": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0417\u0430\u043B\u0438\u0448\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0456 \u0432\u0438\u043C\u043E\u0433\u0438, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0443\u043C\u0438\u0441\u043D\u0456 \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { code: "367", why: "\u042F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u0442\u0456 \u0441\u0430\u043C\u0456 \u0434\u0456\u0457 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u044E\u0442\u044C\u0441\u044F \u044F\u043A \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432." }
    ]
  },
  "sas24-3-11-1": {
    admin: "3",
    consequences: ["nullity", "principles"],
    criminal: [
      { code: "364", why: "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043F\u043E\u0432\u0437 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u0442\u0430\u043C, \u0434\u0435 \u0432\u043E\u043D\u0430 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0430, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." },
      { code: "191", why: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043F\u043E\u0437\u0430 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u043E\u044E \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E \u0443\u0441\u0443\u0432\u0430\u0454 \u0446\u0456\u043D\u043E\u0432\u0443 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0443, \u0442\u043E\u0436 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0439 \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." }
    ]
  },
  "sas24-3-11-2": {
    admin: "3",
    consequences: ["nullity", "principles"],
    criminal: [
      { code: "364", why: "\u041F\u0456\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0456\u0434 \u0447\u0430\u0441 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F, \u0431\u0435\u0437 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-1": {
    admin: "5",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0421\u0432\u0456\u0434\u043E\u043C\u0435 \u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u043E\u0433\u043E \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { code: "367", why: "\u042F\u043A\u0449\u043E \u0441\u0442\u0440\u043E\u043A \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u0431\u0435\u0437 \u0443\u043C\u0438\u0441\u043B\u0443, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432." }
    ]
  },
  "sas24-3-9": {
    admin: "5",
    consequences: ["principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 18 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 22 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u0454 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0438\u043C\u0438 \u0434\u043B\u044F \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430\u043C\u0438.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 18, \u044F\u043A\u0443 \u0441\u0430\u043C\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u043B\u044F \u0441\u043F\u043E\u0440\u0456\u0434\u043D\u0435\u043D\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u043F\u0440\u043E \u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F (sas24-3-1).",
    criminal: [
      { code: "364", why: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430 \u043F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-7": {
    admin: "1",
    consequences: ["principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u0440\u0430\u0437\u043E\u043C \u0456\u0437 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u043C \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0438\u0442\u0438 \u0437\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u0422\u0443\u0442 \u043C\u0438 \u0441\u0432\u0456\u0434\u043E\u043C\u043E \u043E\u0431\u0435\u0440\u0435\u0436\u043D\u0456: \u0441\u0430\u043C \u043F\u043E \u0441\u043E\u0431\u0456 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0441\u0442\u0440\u043E\u043A \u043D\u043E\u0440\u043C\u0443 \u043D\u0435 \u043F\u043E\u0440\u0443\u0448\u0443\u0454. \u0417\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043C\u0430\u0454 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043E\u0431\u0441\u044F\u0433\u043E\u043C \u0440\u043E\u0431\u0456\u0442 \u0456 \u0447\u0430\u0441\u043E\u043C, \u0437\u0430 \u044F\u043A\u0438\u0439 \u0457\u0445 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u043C\u0438.",
    criminal: [
      { code: "366", why: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442. \u042F\u043A\u0449\u043E \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442 \u0444\u0456\u0437\u0438\u0447\u043D\u043E \u043D\u0435 \u043C\u0456\u0433 \u0431\u0443\u0442\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u0439 \u0443 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0435\u0439." },
      { code: "191", why: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430 \u0440\u043E\u0431\u043E\u0442\u0438, \u044F\u043A\u0456 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0443\u0432\u0430\u043B\u0438\u0441\u044F \u0432 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u043E\u043C\u0443 \u043E\u0431\u0441\u044F\u0437\u0456, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." }
    ]
  }
};
var ADMIN_ARTICLE = {
  code: "164-14",
  title: "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 (\u041A\u0423\u043F\u0410\u041F)",
  unitUah: 17,
  parts: {
    "1": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 1",
      conduct: "\u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457 \u0432\u0438\u043C\u043E\u0433\u0430\u043C \u0437\u0430\u043A\u043E\u043D\u0443, \u043D\u0435\u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0456\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u0457 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0430\u0431\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0456\u0432 \u0457\u0457 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F.",
      fineFrom: 100,
      fineTo: 100
    },
    "3": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 3",
      conduct: "\u043F\u0440\u0438\u0434\u0431\u0430\u043D\u043D\u044F \u0431\u0435\u0437 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440, \u0431\u0435\u0437\u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043D\u0435 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u0438\u0445 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439, \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0443\u043C\u043E\u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0437\u043C\u0456\u0441\u0442\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0437\u043C\u0456\u043D \u0434\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0437\u0430\u043A\u043E\u043D\u0443.",
      fineFrom: 1500,
      fineTo: 3e3
    },
    "5": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 5",
      conduct: "\u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F.",
      fineFrom: 2e3,
      fineTo: 5e3
    }
  }
};
var CONSEQUENCES = {
  nullity: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 43 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u043D\u0456\u043A\u0447\u0435\u043C\u043D\u0456\u0441\u0442\u044C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E.",
    effect: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0454 \u043D\u0456\u043A\u0447\u0435\u043C\u043D\u0438\u043C, \u0437\u043E\u043A\u0440\u0435\u043C\u0430 \u044F\u043A\u0449\u043E \u0439\u043E\u0433\u043E \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043E \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0434\u0431\u0430\u0447\u0435\u043D\u043E\u0457 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0430\u0431\u043E \u044F\u043A\u0449\u043E \u0432\u0456\u043D \u0441\u0443\u043F\u0435\u0440\u0435\u0447\u0438\u0442\u044C \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0430\u043C \u0441\u0442\u0430\u0442\u0442\u0456 5. \u041D\u0456\u043A\u0447\u0435\u043C\u043D\u0456\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u0432\u0438\u0437\u043D\u0430\u043D\u043D\u044F \u0441\u0443\u0434\u043E\u043C: \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u043D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0437 \u043C\u043E\u043C\u0435\u043D\u0442\u0443 \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F."
  },
  principles: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0438 \u0437\u0434\u0456\u0439\u0441\u043D\u0435\u043D\u043D\u044F \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C.",
    effect: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043C\u0430\u0454 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0430\u043C \u0434\u043E\u0431\u0440\u043E\u0441\u043E\u0432\u0456\u0441\u043D\u043E\u0457 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457, \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0457 \u0435\u043A\u043E\u043D\u043E\u043C\u0456\u0457 \u0442\u0430 \u0435\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0456, \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E\u0441\u0442\u0456 \u0439 \u043F\u0440\u043E\u0437\u043E\u0440\u043E\u0441\u0442\u0456, \u043D\u0435\u0434\u0438\u0441\u043A\u0440\u0438\u043C\u0456\u043D\u0430\u0446\u0456\u0457 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432, \u043E\u0431'\u0454\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0437\u0430\u043F\u043E\u0431\u0456\u0433\u0430\u043D\u043D\u044F \u043A\u043E\u0440\u0443\u043F\u0446\u0456\u0457. \u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0446\u0438\u0445 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0456\u0432 \u2014 \u0441\u0430\u043C\u043E\u0441\u0442\u0456\u0439\u043D\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u044F\u043A \u0442\u0430\u043A\u0443, \u0449\u043E \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0437\u0430\u043A\u043E\u043D\u0443."
  },
  changesVoid: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 4 \u0456 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u0445 \u0437\u043C\u0456\u043D.",
    effect: "\u0423\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0435 \u043C\u043E\u0436\u0443\u0442\u044C \u0432\u0456\u0434\u0440\u0456\u0437\u043D\u044F\u0442\u0438\u0441\u044F \u0432\u0456\u0434 \u0437\u043C\u0456\u0441\u0442\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0437\u043C\u0456\u043D\u044E\u044E\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0437 \u0432\u043E\u0441\u044C\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 5. \u0417\u043C\u0456\u043D\u0430 \u043F\u043E\u0437\u0430 \u0446\u0438\u043C \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u043E\u043C \u0432\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u0437\u0430 \u043C\u0435\u0436\u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u043C."
  }
};
var SHARED_CAUTION = "\u0416\u043E\u0434\u0435\u043D \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u043D\u0435 \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u0441\u043A\u043B\u0430\u0434\u0443 \u0437\u043B\u043E\u0447\u0438\u043D\u0443. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u2014 \u0442\u043E\u0431\u0442\u043E \u043C\u0456\u0441\u0446\u0435, \u0434\u0435 \u0432\u0430\u0440\u0442\u043E \u043F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438. \u0423\u043C\u0438\u0441\u0435\u043B \u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u0456\u0441\u0442\u044C \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0432\u0438\u043A\u043B\u044E\u0447\u043D\u043E \u0441\u0443\u0434.";
var ARTICLES = {
  "366": {
    code: "366",
    title: "\u0421\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u043F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F",
    summary: "\u0421\u043A\u043B\u0430\u0434\u0430\u043D\u043D\u044F \u0447\u0438 \u0432\u0438\u0434\u0430\u0447\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0434\u043E \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0435\u0439 \u0430\u0431\u043E \u0456\u043D\u0448\u0435 \u043F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u2014 \u043C\u0430\u0454 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0439\u043D\u043E-\u0440\u043E\u0437\u043F\u043E\u0440\u044F\u0434\u0447\u0456 \u0430\u0431\u043E \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043D\u043E-\u0433\u043E\u0441\u043F\u043E\u0434\u0430\u0440\u0441\u044C\u043A\u0456 \u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043D\u044F.",
      "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0454 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u043C \u2014 \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430, \u0437\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F, \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
      "\u0412\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456 \u2014 \u043E\u0441\u043E\u0431\u0430 \u0437\u043D\u0430\u043B\u0430 \u043F\u0440\u043E \u0457\u0445 \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456\u0441\u0442\u044C \u0443 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u0443\u043C\u0438\u0441\u0435\u043B. \u041F\u043E\u043C\u0438\u043B\u043A\u0430, \u043D\u0435\u0434\u0431\u0430\u043B\u0456\u0441\u0442\u044C \u0447\u0438 \u0445\u0438\u0431\u043D\u0435 \u0442\u043B\u0443\u043C\u0430\u0447\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u0443 \u0441\u043A\u043B\u0430\u0434\u0443 \u0446\u0456\u0454\u0457 \u0441\u0442\u0430\u0442\u0442\u0456 \u043D\u0435 \u0443\u0442\u0432\u043E\u0440\u044E\u044E\u0442\u044C."
    ],
    caution: SHARED_CAUTION,
    links: [
      {
        risk_id: "ari-1-1",
        why: "\u041A\u043E\u0436\u043D\u0430 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E. \u0422\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0433\u043E\u0434 \u0434\u043E \u043E\u0434\u043D\u043E\u0433\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u044F\u043A\u0456 \u043C\u043E\u0436\u043D\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456."
      },
      {
        risk_id: "ari-1-2",
        why: "\u041F\u0443\u043D\u043A\u0442 3 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 5 \u0441\u0442\u0430\u0442\u0442\u0456 41 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043B\u0438\u0448\u0435 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438, \u0449\u043E \u0441\u0443\u043C\u0430 \u043D\u0435 \u0437\u0440\u043E\u0441\u0442\u0430\u0454. \u042F\u043A\u0449\u043E \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E \u0446\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438, \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u043C \u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u043C \u0441\u0442\u0430\u0454 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u043C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438."
      },
      {
        risk_id: "sas24-3-4",
        why: "\u0417\u043C\u0456\u043D\u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0438\u0445 \u0443\u043C\u043E\u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0444\u043E\u0440\u043C\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E \u0439 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F. \u041E\u0434\u043D\u043E\u0447\u0430\u0441\u043D\u0435 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0442\u0430 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0443 \u2014 \u0442\u0438\u043F\u043E\u0432\u0435 \u043C\u0456\u0441\u0446\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u044C."
      },
      {
        risk_id: "sas24-3-7",
        why: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442. \u042F\u043A\u0449\u043E \u043C\u0456\u0436 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F\u043C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0438 \u0456 \u0437\u0432\u0456\u0442\u043E\u043C \u043F\u0440\u043E \u0457\u0445 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043C\u0438\u043D\u0443\u043B\u043E \u043C\u0435\u043D\u0448\u0435 60 \u0434\u043D\u0456\u0432, \u0432\u0430\u0440\u0442\u043E \u0437\u0432\u0456\u0440\u0438\u0442\u0438 \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442 \u0456\u0437 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u0438\u043C \u0441\u0442\u0440\u043E\u043A\u043E\u043C."
      },
      {
        risk_id: "sas24-3-10",
        why: "\u041D\u0435\u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0432\u0438\u043C\u043E\u0433\u0438 \u0449\u043E\u0434\u043E \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0440\u043E\u0437\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0437 \u043D\u0430\u044F\u0432\u043D\u0438\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438."
      }
    ]
  },
  "191": {
    code: "191",
    title: "\u041F\u0440\u0438\u0432\u043B\u0430\u0441\u043D\u0435\u043D\u043D\u044F, \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u043C\u0430\u0439\u043D\u0430 \u0430\u0431\u043E \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043D\u0438\u043C \u0448\u043B\u044F\u0445\u043E\u043C \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C",
    summary: "\u0417\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0447\u0443\u0436\u0438\u043C \u043C\u0430\u0439\u043D\u043E\u043C \u0447\u0438 \u0439\u043E\u0433\u043E \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u043E\u0441\u043E\u0431\u043E\u044E, \u044F\u043A\u0456\u0439 \u0432\u043E\u043D\u043E \u0432\u0432\u0456\u0440\u0435\u043D\u0435, \u0430 \u0442\u0430\u043A\u043E\u0436 \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043C\u0430\u0439\u043D\u043E\u043C \u0448\u043B\u044F\u0445\u043E\u043C \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0441\u0432\u043E\u0457\u043C \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C.",
    elements: [
      "\u041C\u0430\u0439\u043D\u043E \u0432\u0432\u0456\u0440\u0435\u043D\u0435 \u043E\u0441\u043E\u0431\u0456 \u0430\u0431\u043E \u043F\u0435\u0440\u0435\u0431\u0443\u0432\u0430\u0454 \u0432 \u0457\u0457 \u0432\u0456\u0434\u0430\u043D\u043D\u0456 \u2014 \u0431\u044E\u0434\u0436\u0435\u0442\u043D\u0456 \u043A\u043E\u0448\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430.",
      "\u0412\u0456\u0434\u0431\u0443\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0447\u0438 \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u2014 \u043A\u043E\u0448\u0442\u0438 \u0432\u0438\u0431\u0443\u043B\u0438 \u0431\u0435\u0437 \u043D\u0430\u043B\u0435\u0436\u043D\u043E\u0433\u043E \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F.",
      "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435, \u044F\u043A\u0449\u043E \u0439\u0434\u0435\u0442\u044C\u0441\u044F \u043F\u0440\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0443 \u0444\u043E\u0440\u043C\u0443.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0439 \u0443\u043C\u0438\u0441\u0435\u043B \u0456 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0440\u043E\u0437\u043C\u0456\u0440 \u0448\u043A\u043E\u0434\u0438."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "ari-1-1", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F, \u0447\u0438 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u0438 \u0431\u0430\u0433\u0430\u0442\u043E\u0440\u0430\u0437\u043E\u0432\u0456 \u0437\u043C\u0456\u043D\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0434\u043E \u0441\u043F\u043B\u0430\u0442\u0438 \u043F\u043E\u043D\u0430\u0434 \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u0435." },
      { risk_id: "ari-1-2", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u044F, \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0430 \u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u044F\u043A\u0430 \u0437\u0430 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043D\u0435 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438." },
      { risk_id: "sas24-3-7", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430 \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442, \u044F\u043A\u0438\u0439 \u043D\u0435 \u043C\u0456\u0433 \u0431\u0443\u0442\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u0439 \u0443 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A." },
      { risk_id: "sas24-3-11-1", why: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043F\u043E\u0437\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u043E\u044E \u0443\u0441\u0443\u0432\u0430\u0454 \u0446\u0456\u043D\u043E\u0432\u0443 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0443 \u2014 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442\u0430." }
    ]
  },
  "364": {
    code: "364",
    title: "\u0417\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0432\u043B\u0430\u0434\u043E\u044E \u0430\u0431\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C",
    summary: "\u0423\u043C\u0438\u0441\u043D\u0435, \u0437 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0445 \u043C\u043E\u0442\u0438\u0432\u0456\u0432 \u0447\u0438 \u0432 \u0456\u043D\u0448\u0438\u0445 \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0445 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0430\u0431\u043E \u0432 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0442\u0440\u0435\u0442\u0456\u0445 \u043E\u0441\u0456\u0431, \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0432\u043B\u0430\u0434\u0438 \u0447\u0438 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u0433\u043E \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0430 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E.",
      "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0432\u043B\u0430\u0434\u0443 \u0430\u0431\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u043C\u043E\u0442\u0438\u0432 \u2014 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0439, \u0456\u043D\u0448\u0438\u0439 \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0439, \u0430\u0431\u043E \u0432 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0442\u0440\u0435\u0442\u0456\u0445 \u043E\u0441\u0456\u0431.",
      "\u0417\u0430\u0432\u0434\u0430\u043D\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438 \u043E\u0445\u043E\u0440\u043E\u043D\u044E\u0432\u0430\u043D\u0438\u043C \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u0430\u0432\u0430\u043C \u0442\u0430 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "sas24-3-2", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { risk_id: "sas24-3-5", why: "\u041D\u0435\u043D\u0430\u0434\u0430\u043D\u043D\u044F \u043C\u043E\u0436\u043B\u0438\u0432\u043E\u0441\u0442\u0456 \u0443\u0441\u0443\u043D\u0443\u0442\u0438 \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { risk_id: "sas24-3-9", why: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F." },
      { risk_id: "sas24-3-11-1", why: "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043F\u043E\u0432\u0437 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0443 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443." }
    ]
  },
  "367": {
    code: "367",
    title: "\u0421\u043B\u0443\u0436\u0431\u043E\u0432\u0430 \u043D\u0435\u0434\u0431\u0430\u043B\u0456\u0441\u0442\u044C",
    summary: "\u041D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0430\u0431\u043E \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0441\u0432\u043E\u0457\u0445 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432 \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u0443\u043C\u043B\u0456\u043D\u043D\u0435 \u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0434\u043E \u043D\u0438\u0445, \u0449\u043E \u0437\u0430\u0432\u0434\u0430\u043B\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u0456 \u043C\u0430\u043B\u0430 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438.",
      "\u041E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u0430\u0431\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u043E.",
      "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u2014 \u043D\u0435\u0441\u0443\u043C\u043B\u0456\u043D\u043D\u0435 \u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F, \u0430 \u043D\u0435 \u0443\u043C\u0438\u0441\u0435\u043B; \u0446\u0438\u043C \u0441\u0442\u0430\u0442\u0442\u044F \u0432\u0456\u0434\u0440\u0456\u0437\u043D\u044F\u0454\u0442\u044C\u0441\u044F \u0432\u0456\u0434 364.",
      "\u0417\u0430\u0432\u0434\u0430\u043D\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438, \u0456 \u043C\u0456\u0436 \u0431\u0435\u0437\u0434\u0456\u044F\u043B\u044C\u043D\u0456\u0441\u0442\u044E \u0442\u0430 \u0448\u043A\u043E\u0434\u043E\u044E \u0454 \u043F\u0440\u0438\u0447\u0438\u043D\u043D\u0438\u0439 \u0437\u0432'\u044F\u0437\u043E\u043A."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "sas24-3-1", why: "\u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F, \u044F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E." },
      { risk_id: "sas24-3-10", why: "\u041D\u0435\u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0432\u0438\u043C\u043E\u0433\u0438, \u044F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E." }
    ]
  }
};
var JOINT_STOCK = /(^|[\s"«(“'])(АТ|ПАТ|ПрАТ|ВАТ|ЗАТ)([\s"«.,“']|$)|акціонерн/i;
function isJointStock(name) {
  return name !== null && JOINT_STOCK.test(name);
}

// server/conclusion.ts
function fmt(n, digits = 0) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n);
}
function money2(n) {
  return n === null || !Number.isFinite(n) ? "\u2014" : `${fmt(n)} \u0433\u0440\u043D`;
}
function dominantPattern(entry) {
  const counts = /* @__PURE__ */ new Map();
  for (const id of entry.risks) {
    const group = RISK_LABELS[id]?.group;
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best = null;
  for (const [group, count] of counts) {
    if (!best || count > best.count) best = { group, count };
  }
  return best;
}
function buildConclusion(input) {
  const { entry, sameEntity, sameOfficer, sameWinner } = input;
  const observations = [];
  const nextSteps = [];
  if (entry.audit?.violation) {
    observations.push({
      weight: "high",
      aboutThisTender: true,
      title: "\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F",
      detail: `\u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u043E\u043C \u043F\u0440\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F${entry.audit.published ? ` (${entry.audit.published.slice(0, 10)})` : ""}. \u0426\u0435 \u043D\u0435 \u043D\u0430\u0448\u0430 \u043E\u0446\u0456\u043D\u043A\u0430 \u0439 \u043D\u0435 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u2014 \u0446\u0435 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043E\u0440\u0433\u0430\u043D\u0443 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E. ` + (entry.audit.text ? `\u0424\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0443: \xAB${entry.audit.text}\xBB` : "")
    });
    nextSteps.push("\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u0438 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0432 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B\u0456 \u0442\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438, \u0447\u0438 \u0443\u0441\u0443\u043D\u0443\u0442\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.");
  } else if (entry.audit) {
    observations.push({
      weight: "low",
      aboutThisTender: true,
      title: "\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u043B\u0430 \u0456 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430",
      detail: `\u0417\u0430 \u0446\u0456\u0454\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0435\u044E \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043E \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433${entry.audit.count > 1 ? ` (${entry.audit.count})` : ""}, \u0456 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u0434\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438, \u0430 \u043D\u0435 \u0442\u0435, \u0447\u0438 \u0446\u0456\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0440\u0438\u043D\u043A\u043E\u0432\u0456\u0439.`
    });
  }
  for (const finding of entry.findings) {
    const e = finding.evidence;
    const gap = typeof e.overpayment === "number" ? e.overpayment : typeof e.extra_cost === "number" ? e.extra_cost : null;
    if (finding.detector_key === "peer_price" && typeof e.peer_median === "number" && typeof e.unit_price === "number") {
      observations.push({
        weight: finding.severity === "low" ? "medium" : "high",
        aboutThisTender: true,
        title: "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u0432\u0438\u0449\u0430 \u0437\u0430 \u0440\u0438\u043D\u043A\u043E\u0432\u0443",
        detail: `\u0417\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u043F\u043B\u0430\u0442\u044F\u0442\u044C ${fmt(e.unit_price, 2)} \u0433\u0440\u043D, \u0442\u043E\u0434\u0456 \u044F\u043A \u0443 ${e.peer_count ?? "\u0456\u043D\u0448\u0438\u0445"} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043C\u0435\u0434\u0456\u0430\u043D\u0430 \u2014 ${fmt(e.peer_median, 2)} \u0433\u0440\u043D. ` + (gap !== null ? `\u041D\u0430 \u0432\u0435\u0441\u044C \u043E\u0431\u0441\u044F\u0433 \u0440\u0456\u0437\u043D\u0438\u0446\u044F \u0441\u043A\u043B\u0430\u0434\u0430\u0454 ${money2(gap)}.` : "")
      });
      nextSteps.push("\u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u0438 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0457 \u0432\u0430\u0440\u0442\u043E\u0441\u0442\u0456 \u0442\u0430 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0446\u0456\u043D\u0438 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E.");
    }
    if (finding.detector_key === "own_price_growth" && typeof e.previous_price === "number" && typeof e.growth === "number") {
      observations.push({
        weight: e.growth >= 1 ? "high" : "medium",
        aboutThisTender: true,
        title: "\u0422\u043E\u0439 \u0441\u0430\u043C\u0438\u0439 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043F\u0456\u0434\u043D\u044F\u0432 \u0446\u0456\u043D\u0443",
        detail: `\u0420\u0430\u043D\u0456\u0448\u0435 \u0446\u0435\u0439 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043A\u0443\u043F\u0443\u0432\u0430\u0432 \u0442\u0435 \u0441\u0430\u043C\u0435 \u043F\u043E ${fmt(e.previous_price, 2)} \u0433\u0440\u043D \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E, \u0442\u0435\u043F\u0435\u0440 \u2014 \u043F\u043E ${fmt(Number(e.unit_price ?? 0), 2)} \u0433\u0440\u043D, \u0442\u043E\u0431\u0442\u043E \u043D\u0430 ${Math.round(e.growth * 100)}% \u0431\u0456\u043B\u044C\u0448\u0435. ` + (gap !== null ? `\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u2014 ${money2(gap)}. ` : "") + "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430, \u0442\u043E\u0436 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043C\u0456\u0441\u0446\u0435\u0432\u0456 \u0443\u043C\u043E\u0432\u0438 \u0442\u0443\u0442 \u043D\u0435 \u043F\u0440\u0430\u0446\u044E\u0454."
      });
      nextSteps.push("\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0442\u0435\u0445\u043D\u0456\u0447\u043D\u0456 \u0432\u0438\u043C\u043E\u0433\u0438 \u043E\u0431\u043E\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u2014 \u0447\u0438 \u0441\u043F\u0440\u0430\u0432\u0434\u0456 \u0437\u043C\u0456\u043D\u0438\u0432\u0441\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442.");
    }
  }
  if (entry.detailed && entry.bidders === 1) {
    const big = (entry.value_amount ?? 0) >= 1e7;
    observations.push({
      weight: big ? "high" : "medium",
      aboutThisTender: true,
      title: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E",
      detail: `\u041D\u0430 \u0442\u043E\u0440\u0433\u0438 \u043F\u043E\u0434\u0430\u0432\u0441\u044F \u043E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A, \u0456 \u0432\u0456\u043D \u0436\u0435 \u043F\u0435\u0440\u0435\u043C\u0456\u0433. \u0421\u0443\u043C\u0430 \u2014 ${money2(entry.value_amount)}. \u0411\u0435\u0437 \u0434\u0440\u0443\u0433\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u0446\u0456\u043D\u0443 \u043D\u0435\u043C\u0430\u0454 \u0437 \u0447\u0438\u043C \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0432 \u043C\u0435\u0436\u0430\u0445 \u0441\u0430\u043C\u043E\u0457 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438.`
    });
    nextSteps.push("\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432\u0438\u043C\u043E\u0433\u0438 \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457 \u2014 \u0447\u0438 \u043D\u0435 \u0437\u0432\u0443\u0436\u0443\u0432\u0430\u043B\u0438 \u0432\u043E\u043D\u0438 \u043A\u043E\u043B\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432.");
  }
  if (entry.value_amount && entry.winner_amount && entry.value_amount > 0) {
    const discount = 1 - entry.winner_amount / entry.value_amount;
    if (discount >= 0 && discount < 0.01 && entry.value_amount >= 1e6) {
      observations.push({
        weight: "medium",
        aboutThisTender: true,
        title: "\u0422\u043E\u0440\u0433\u0438 \u043D\u0435 \u0437\u0431\u0438\u043B\u0438 \u0446\u0456\u043D\u0443",
        detail: `\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043E \u043D\u0430 ${money2(entry.winner_amount)} \u043F\u0440\u043E\u0442\u0438 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u0438\u0445 ${money2(entry.value_amount)} \u2014 \u0437\u043D\u0438\u0436\u043A\u0430 ${(discount * 100).toFixed(2)}%. \u0424\u0430\u043A\u0442\u0438\u0447\u043D\u043E \u0430\u0443\u043A\u0446\u0456\u043E\u043D \u043D\u0435 \u0432\u0456\u0434\u0431\u0443\u0432\u0441\u044F.`
      });
    }
  }
  const pattern = dominantPattern(entry);
  if (pattern && pattern.count >= 2) {
    observations.push({
      weight: "medium",
      aboutThisTender: true,
      title: `\u041E\u0437\u043D\u0430\u043A\u0438 \u0441\u043A\u043B\u0430\u0434\u0430\u044E\u0442\u044C\u0441\u044F \u0432 \u043E\u0434\u0438\u043D \u0441\u044E\u0436\u0435\u0442: ${pattern.group.toLowerCase()}`,
      detail: `${pattern.count} \u0437 ${entry.risks.length} \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u043D\u0430\u043B\u0435\u0436\u0430\u0442\u044C \u0434\u043E \u043E\u0434\u043D\u0456\u0454\u0457 \u0433\u0440\u0443\u043F\u0438. \u0426\u0435 \u043D\u0435 \u0437\u0431\u0456\u0433 \u043E\u043A\u0440\u0435\u043C\u0438\u0445 \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0435\u0439, \u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0438\u0439 \u0445\u0456\u0434 \u0443 \u043C\u0435\u0436\u0430\u0445 \u043E\u0434\u043D\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456.`
    });
  }
  const pair = sameWinner.filter((c) => c.entity_edrpou === entry.entity_edrpou).length;
  if (pair >= 3 && entry.winner_name) {
    observations.push({
      weight: pair >= 6 ? "high" : "medium",
      aboutThisTender: false,
      title: "\u041F\u043E\u0441\u0442\u0456\u0439\u043D\u0430 \u043F\u0430\u0440\u0430 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u2014 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C",
      detail: `\u0426\u0435\u0439 \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A \u0432\u0438\u0433\u0440\u0430\u0432 ${pair} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0441\u0430\u043C\u0435 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430, \u0456 \u0432\u0441\u0456 \u0432\u043E\u043D\u0438 \u043C\u0430\u044E\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438. \u0423\u0441\u044C\u043E\u0433\u043E \u0432 \u0431\u0430\u0437\u0456 \u0437\u0430 \u043D\u0438\u043C ${sameWinner.length} \u043F\u0435\u0440\u0435\u043C\u043E\u0433.`
    });
    nextSteps.push("\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0437\u0430\u0441\u043D\u043E\u0432\u043D\u0438\u043A\u0456\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0457\u0445 \u0437\u0432'\u044F\u0437\u043A\u0438 \u0456\u0437 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C.");
  }
  if (entry.officer_name && sameOfficer.length >= 5) {
    const officerSolo = sameOfficer.filter((c) => c.bidders === 1).length;
    observations.push({
      weight: sameOfficer.length >= 20 ? "medium" : "low",
      aboutThisTender: false,
      title: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0446\u0456\u0454\u0457 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442\u044C\u0441\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u043D\u043E",
      detail: `${entry.officer_name} \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E \u0443 ${sameOfficer.length} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u043C\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438` + (officerSolo > 0 ? `, \u0437 \u043D\u0438\u0445 ${officerSolo} \u2014 \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : "") + ". \u0426\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u043F\u043E\u0442\u043E\u043A\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C, \u0430 \u043D\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F \u043E\u0441\u043E\u0431\u0438."
    });
  }
  if (sameEntity.length >= 20) {
    const entityValue = sameEntity.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
    observations.push({
      weight: "low",
      aboutThisTender: false,
      title: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0443 \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E",
      detail: `\u0417\u0430 \u0446\u0438\u043C \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0430\u043D\u043E ${sameEntity.length} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u043D\u0430 ${money2(entityValue)}.`
    });
  }
  const own = observations.filter((o) => o.aboutThisTender);
  const highs = own.filter((o) => o.weight === "high").length;
  const mediums = own.filter((o) => o.weight === "medium").length;
  const level = highs >= 1 ? "high" : mediums >= 1 ? "medium" : "low";
  const proven = Boolean(entry.audit?.violation);
  const clearedAndQuiet = Boolean(entry.audit) && !proven && own.every((o) => o.weight === "low");
  const headline = proven ? "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430, \u0430 \u043D\u0435 \u043C\u0438" : clearedAndQuiet ? "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u043B\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0456 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430" : own.length === 0 ? observations.length === 0 ? "\u041A\u0440\u0456\u043C \u0441\u0430\u043C\u043E\u0457 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438, \u043C\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u0438" : "\u0423 \u0441\u0430\u043C\u0456\u0439 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u0438, \u0430\u043B\u0435 \u043D\u0430\u0432\u043A\u043E\u043B\u043E \u043D\u0435\u0457 \u0454 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442" : level === "high" ? "\u0404 \u0449\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0442\u0438: \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u043D\u0456 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456" : "\u0412\u0430\u0440\u0442\u043E \u043F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F \u0443\u0432\u0430\u0436\u043D\u0456\u0448\u0435";
  if (clearedAndQuiet) {
    nextSteps.push("\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438, \u0447\u0438 \u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0432\u0441\u044F \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0441\u0430\u043C\u0435 \u0442\u043E\u0433\u043E \u043F\u0438\u0442\u0430\u043D\u043D\u044F, \u044F\u043A\u0435 \u0432\u0430\u0441 \u0446\u0456\u043A\u0430\u0432\u0438\u0442\u044C \u2014 \u0439\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0432\u0443\u0436\u0447\u0438\u0439 \u0437\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E.");
  } else if (own.length === 0) {
    nextSteps.push("\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0432 Prozorro \u0456 \u0437\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u043F\u0438\u0441\u043E\u043C \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430.");
  } else {
    nextSteps.push("\u0412\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u0456 \u0432\u0441\u0456 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0443\u0433\u043E\u0434\u0438 \u0434\u043E \u043D\u044C\u043E\u0433\u043E.");
  }
  return { level, headline, observations, nextSteps: [...new Set(nextSteps)] };
}

// server/qualification.ts
var EVIDENCE_BY_ARTICLE = {
  "366": [
    "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0442\u0430 \u0432\u0441\u0456 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0443\u0433\u043E\u0434\u0438 \u0434\u043E \u043D\u044C\u043E\u0433\u043E, \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0437\u043C\u0456\u043D.",
    "\u041F\u0435\u0440\u0432\u0438\u043D\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u044F\u043A\u0456 \u043C\u0430\u043B\u0438 \u0431 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0443\u0432\u0430\u0442\u0438 \u0446\u0456 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0438: \u0430\u043A\u0442\u0438, \u0441\u043F\u0435\u0446\u0438\u0444\u0456\u043A\u0430\u0446\u0456\u0457, \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043A\u0438.",
    "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0442\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u0449\u043E \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0443\u044E\u0442\u044C \u0444\u0430\u043A\u0442\u0438\u0447\u043D\u0438\u0439 \u043E\u0431\u0441\u044F\u0433.",
    "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0438 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430."
  ],
  "191": [
    "\u041F\u043B\u0430\u0442\u0456\u0436\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0442\u0430 \u0432\u0438\u043F\u0438\u0441\u043A\u0438 \u0437\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u043C.",
    "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0440\u0456\u0437\u043D\u0438\u0446\u0456 \u043C\u0456\u0436 \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0438\u043C \u0456 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u043E\u0432\u0430\u043D\u043E\u044E \u0432\u0430\u0440\u0442\u0456\u0441\u0442\u044E.",
    "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u043F\u0440\u043E \u0444\u0430\u043A\u0442\u0438\u0447\u043D\u043E \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u0438\u0439 \u0442\u043E\u0432\u0430\u0440, \u0440\u043E\u0431\u043E\u0442\u0443 \u0447\u0438 \u043F\u043E\u0441\u043B\u0443\u0433\u0443."
  ],
  "364": [
    "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0442\u0430 \u043D\u0430\u043A\u0430\u0437 \u043F\u0440\u043E \u043F\u0440\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
    "\u0422\u0435\u043D\u0434\u0435\u0440\u043D\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u044F \u0442\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0438 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439.",
    "\u041B\u0438\u0441\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0449\u043E\u0434\u043E \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0443 \u0442\u0430 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432."
  ],
  "367": [
    "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0442\u0430 \u043E\u0431\u0441\u044F\u0433 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
    "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u0449\u043E \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C, \u044F\u043A\u0456 \u0434\u0456\u0457 \u043C\u0430\u043B\u0438 \u0431\u0443\u0442\u0438 \u0432\u0447\u0438\u043D\u0435\u043D\u0456 \u0442\u0430 \u0443 \u044F\u043A\u0438\u0439 \u0441\u0442\u0440\u043E\u043A."
  ]
};
function fine(part) {
  const p = ADMIN_ARTICLE.parts[part];
  const uah = (n) => new Intl.NumberFormat("uk-UA").format(n * ADMIN_ARTICLE.unitUah);
  return p.fineFrom === p.fineTo ? `${p.fineFrom} \u043D\u043C\u0434\u0433 (${uah(p.fineFrom)} \u0433\u0440\u043D)` : `\u0432\u0456\u0434 ${p.fineFrom} \u0434\u043E ${p.fineTo} \u043D\u043C\u0434\u0433 (${uah(p.fineFrom)}\u2013${uah(p.fineTo)} \u0433\u0440\u043D)`;
}
function shortName(riskId, rules) {
  return RISK_LABELS[riskId]?.short ?? rules.get(riskId)?.name ?? riskId;
}
function buildQualification(entry, rules) {
  const norms = /* @__PURE__ */ new Map();
  const consequenceKeys = /* @__PURE__ */ new Set();
  const adminParts = /* @__PURE__ */ new Map();
  const criminal = /* @__PURE__ */ new Map();
  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const legal = INDICATOR_LEGAL[riskId];
    const name = shortName(riskId, rules);
    const stateNorm = rule?.legitimateness?.trim();
    const text = stateNorm || legal?.norm;
    if (text) {
      const existing = norms.get(text);
      if (existing) {
        existing.from.push(name);
      } else {
        norms.set(text, {
          norm: text,
          source: stateNorm ? "state" : "reading",
          note: stateNorm ? void 0 : legal?.normNote,
          from: [name]
        });
      }
    }
    for (const key of legal?.consequences ?? []) consequenceKeys.add(key);
    if (legal?.admin) {
      const list = adminParts.get(legal.admin) ?? [];
      list.push(name);
      adminParts.set(legal.admin, list);
    }
    for (const direction of legal?.criminal ?? []) {
      const acc = criminal.get(direction.code) ?? { reasons: [] };
      if (!acc.reasons.includes(direction.why)) acc.reasons.push(direction.why);
      criminal.set(direction.code, acc);
    }
  }
  return {
    norms: [...norms.values()],
    consequences: [...consequenceKeys].map((key) => CONSEQUENCES[key]).filter(Boolean),
    admin: [...adminParts.entries()].map(([part, from]) => ({
      part: ADMIN_ARTICLE.parts[part].label,
      conduct: ADMIN_ARTICLE.parts[part].conduct,
      fine: fine(part),
      from
    })),
    criminal: [...criminal.entries()].map(([code, acc]) => {
      const article = ARTICLES[code];
      return {
        code,
        title: article?.title ?? "",
        summary: article?.summary ?? "",
        elements: article?.elements ?? [],
        reasons: acc.reasons,
        evidence: EVIDENCE_BY_ARTICLE[code] ?? []
      };
    }),
    caution: "\u041D\u0430\u0432\u0435\u0434\u0435\u043D\u0435 \u043D\u0438\u0436\u0447\u0435 \u2014 \u043F\u0440\u0430\u0432\u043E\u0432\u0430 \u0434\u043E\u0432\u0456\u0434\u043A\u0430 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430, \u0430 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0444\u0456\u043A\u0441\u0443\u0454 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456; \u0447\u0438 \u0454 \u0432\u043E\u043D\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F\u043C, \u0456 \u0442\u0438\u043C \u0431\u0456\u043B\u044C\u0448\u0435 \u0437\u043B\u043E\u0447\u0438\u043D\u043E\u043C, \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u044E\u0442\u044C \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0456 \u043E\u0440\u0433\u0430\u043D\u0438 \u0442\u0430 \u0441\u0443\u0434 \u043D\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0456 \u0441\u0430\u043C\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432."
  };
}

// server/report.ts
function plainNumber(n, digits = 2) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n).replace(/ /g, " ");
}
function money3(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  return plainNumber(amount) + " \u0433\u0440\u043D";
}
var day = shortDate;
function wrap(text, width = 78, indent = "  ") {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(indent + line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) lines.push(indent + line.trim());
  return lines.join("\n");
}
function sections(ctx) {
  const { entry, rules } = ctx;
  const out = [];
  const verdict = ctx.conclusion;
  out.push({
    heading: "\u0412\u0418\u0421\u041D\u041E\u0412\u041E\u041A \u0421\u0418\u0421\u0422\u0415\u041C\u0418",
    lines: [
      verdict.headline,
      "",
      ...verdict.observations.length > 0 ? verdict.observations.flatMap((o, i) => [`${i + 1}. ${o.title}`, wrap(o.detail), ""]) : [
        wrap(
          "\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u0430\u043B\u0435 \u043D\u0430\u0448\u0456 \u0432\u043B\u0430\u0441\u043D\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u2014 \u0446\u0456\u043D\u0430 \u043F\u0440\u043E\u0442\u0438 \u0440\u0438\u043D\u043A\u0443, \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u044F, \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0456\u0441\u0442\u044C \u0437\u0432'\u044F\u0437\u043A\u0456\u0432 \u2014 \u043D\u0456\u0447\u043E\u0433\u043E \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u043E\u0433\u043E \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043B\u0438."
        ),
        ""
      ],
      "\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u0430\u043B\u0456:",
      ...verdict.nextSteps.map((step) => wrap(`\u2014 ${step}`)),
      "",
      wrap(
        "\u0426\u0435\u0439 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0441\u043A\u043B\u0430\u043B\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0437 \u0447\u0438\u0441\u0435\u043B, \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0445 \u043D\u0438\u0436\u0447\u0435. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0456 \u043D\u0435 \u0454 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u0454\u044E \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438."
      )
    ]
  });
  out.push({
    heading: "\u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u042F",
    lines: [
      `\u041D\u0430\u0437\u0432\u0430: ${entry.title ?? "\u2014"}`,
      `\u041D\u043E\u043C\u0435\u0440: ${entry.tender_ref || entry.tender_id}`,
      `\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456: ${day(entry.tender_date)}`,
      `\u0414\u0430\u0442\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u0438: ${day(entry.date_assessed)}`,
      `\u0421\u0443\u043C\u0430: ${money3(entry.value_amount)}`,
      `\u0420\u0435\u0433\u0456\u043E\u043D: ${entry.region ?? "\u2014"}`,
      entry.method ? `\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430: ${procedureLabel(entry.method) ?? entry.method}` : "",
      entry.detailed ? `\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432: ${entry.bidders === 1 ? "\u043E\u0434\u0438\u043D \u2014 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E" : entry.bidders || "\u2014"}` : "",
      `\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E: https://prozorro.gov.ua/tender/${entry.tender_ref}`
    ].filter(Boolean)
  });
  out.push({
    heading: "\u0417\u0410\u041C\u041E\u0412\u041D\u0418\u041A",
    lines: [
      `\u041D\u0430\u0437\u0432\u0430: ${readableName(entry.entity_name)}`,
      `\u0404\u0414\u0420\u041F\u041E\u0423: ${entry.entity_edrpou ?? "\u2014"}`,
      `\u0423\u0441\u044C\u043E\u0433\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438: ${ctx.sameEntity}`
    ]
  });
  if (entry.officer_name) {
    out.push({
      heading: "\u0412\u0406\u0414\u041F\u041E\u0412\u0406\u0414\u0410\u041B\u042C\u041D\u0410 \u041E\u0421\u041E\u0411\u0410",
      lines: [
        `\u0406\u043C'\u044F: ${entry.officer_name}`,
        `\u041F\u043E\u0448\u0442\u0430: ${entry.officer_email ?? "\u2014"}`,
        `\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${entry.officer_phone ?? "\u2014"}`,
        `\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0434\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E: ${ctx.sameOfficer}`,
        "",
        wrap(
          "\u0414\u0430\u043D\u0456 \u0432\u0437\u044F\u0442\u043E \u0437 \u043A\u0430\u0440\u0442\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0443 \u043E\u0441\u043E\u0431\u0443. \u0426\u0435 \u043D\u0435 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F \u043F\u0440\u043E \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437 \u0431\u043E\u043A\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438."
        )
      ]
    });
  }
  if (entry.winner_name) {
    out.push({
      heading: "\u041F\u0415\u0420\u0415\u041C\u041E\u0416\u0415\u0426\u042C",
      lines: [
        `\u041D\u0430\u0437\u0432\u0430: ${readableName(entry.winner_name)}`,
        `\u0404\u0414\u0420\u041F\u041E\u0423: ${entry.winner_edrpou ?? "\u2014"}`,
        `\u0421\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443: ${money3(entry.winner_amount)}`,
        `\u041F\u0435\u0440\u0435\u043C\u043E\u0433 \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438: ${ctx.sameWinner}`
      ]
    });
  }
  const indicatorLines = [];
  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const label = RISK_LABELS[riskId];
    const legal = INDICATOR_LEGAL[riskId];
    indicatorLines.push(`[${riskId}] ${label?.short ?? rule?.name ?? riskId}`);
    if (label) indicatorLines.push(wrap(label.means));
    if (rule?.name) indicatorLines.push(wrap(`\u041E\u0444\u0456\u0446\u0456\u0439\u043D\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F: ${rule.name}`));
    const stateNorm = rule?.legitimateness?.trim();
    if (stateNorm) {
      indicatorLines.push(wrap(`\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430: ${stateNorm}`));
    } else if (legal?.norm) {
      indicatorLines.push(wrap(`\u041D\u043E\u0440\u043C\u0430 \u2014 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0446\u0456\u0454\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438: ${legal.norm}`));
      if (legal.normNote) indicatorLines.push(wrap(legal.normNote));
    } else {
      indicatorLines.push(wrap("\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430."));
    }
    for (const direction of legal?.criminal ?? []) {
      const article = ARTICLES[direction.code];
      indicatorLines.push(wrap(`\u0421\u0442\u0430\u0442\u0442\u044F ${direction.code} \u041A\u041A\u0423 \u2014 ${article?.title ?? ""}: ${direction.why}`));
    }
    indicatorLines.push("");
  }
  if (entry.audit) {
    const audit = entry.audit;
    const lines = [];
    lines.push(
      audit.violation ? "\u041E\u0440\u0433\u0430\u043D \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E \u043F\u0440\u043E\u0432\u0456\u0432 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u0412\u0421\u0422\u0410\u041D\u041E\u0412\u0418\u0412 \u041F\u041E\u0420\u0423\u0428\u0415\u041D\u041D\u042F \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456." : "\u041E\u0440\u0433\u0430\u043D \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E \u043F\u0440\u043E\u0432\u0456\u0432 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u041D\u0415 \u0412\u0421\u0422\u0410\u041D\u041E\u0412\u0418\u0412."
    );
    lines.push("");
    if (audit.reasons.length > 0) {
      lines.push(`\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438: ${audit.reasons.map((r) => MONITORING_REASONS[r] ?? r).join(", ")}`);
    }
    if (audit.types.length > 0) {
      lines.push(`\u0422\u0438\u043F \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F: ${audit.types.map((t) => VIOLATION_TYPES[t] ?? t).join(", ")}`);
    }
    if (audit.published) lines.push(`\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043E: ${shortDate(audit.published)}`);
    if (audit.count > 1) lines.push(`\u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0456\u0432 \u0437\u0430 \u0446\u0456\u0454\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0435\u044E: ${audit.count}`);
    if (audit.text) {
      lines.push("");
      lines.push("\u0424\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0443:");
      lines.push(wrap(audit.text));
    }
    lines.push("");
    lines.push(
      wrap(
        "\u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u0434\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454, \u0447\u0438 \u0446\u0456\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0440\u0438\u043D\u043A\u043E\u0432\u0456\u0439 \u2014 \u0446\u0435 \u043E\u043A\u0440\u0435\u043C\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F."
      )
    );
    lines.push(`\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E: https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${audit.monitoring_id}`);
    out.push({
      heading: audit.violation ? "\u0412\u0418\u0421\u041D\u041E\u0412\u041E\u041A \u0414\u0415\u0420\u0416\u0410\u0423\u0414\u0418\u0422\u0421\u041B\u0423\u0416\u0411\u0418 \u2014 \u041F\u041E\u0420\u0423\u0428\u0415\u041D\u041D\u042F \u0412\u0421\u0422\u0410\u041D\u041E\u0412\u041B\u0415\u041D\u041E" : "\u0412\u0418\u0421\u041D\u041E\u0412\u041E\u041A \u0414\u0415\u0420\u0416\u0410\u0423\u0414\u0418\u0422\u0421\u041B\u0423\u0416\u0411\u0418 \u2014 \u041F\u041E\u0420\u0423\u0428\u0415\u041D\u042C \u041D\u0415 \u0412\u0421\u0422\u0410\u041D\u041E\u0412\u041B\u0415\u041D\u041E",
      lines
    });
  }
  out.push({
    heading: `\u0429\u041E \u0417\u0410\u041F\u0406\u0414\u041E\u0417\u0420\u0418\u041B\u0410 \u0414\u0415\u0420\u0416\u0410\u0412\u0410 \u2014 ${entry.risks.length} ${entry.risks.length === 1 ? "\u0406\u041D\u0414\u0418\u041A\u0410\u0422\u041E\u0420" : "\u0406\u041D\u0414\u0418\u041A\u0410\u0422\u041E\u0420\u0418"}`,
    lines: indicatorLines
  });
  if (entry.findings.length > 0) {
    const lines = [];
    for (const finding of entry.findings) {
      lines.push(`${finding.title}`);
      lines.push(wrap(finding.explanation));
      const e = finding.evidence;
      for (const [key, caption] of [
        ["unit_price", "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E"],
        ["peer_median", "\u0422\u0438\u043F\u043E\u0432\u0430 \u0446\u0456\u043D\u0430 (\u043C\u0435\u0434\u0456\u0430\u043D\u0430)"],
        ["peer_count", "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043E \u0456\u0437 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438"],
        ["previous_price", "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0446\u0456\u043D\u0430 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430"],
        ["quantity", "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C"],
        ["overpayment", "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E"],
        ["extra_cost", "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E"]
      ]) {
        if (typeof e[key] === "number") lines.push(`  ${caption}: ${plainNumber(e[key], 2)}`);
      }
      lines.push("");
    }
    out.push({ heading: "\u0420\u041E\u0417\u0420\u0410\u0425\u0423\u041D\u041E\u041A \u0426\u0406\u041D\u0418 \u0426\u0406\u0404\u042E \u0421\u0418\u0421\u0422\u0415\u041C\u041E\u042E", lines });
  }
  const q = buildQualification(entry, rules);
  const legalLines = [wrap(q.caution), ""];
  legalLines.push("\u041D\u041E\u0420\u041C\u0418, \u042F\u041A\u0406 \u0417\u0410\u0427\u0415\u041F\u041B\u0415\u041D\u0406", "");
  for (const n of q.norms) {
    legalLines.push(wrap(`${n.source === "state" ? "\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430" : "\u041D\u043E\u0440\u043C\u0430 \u2014 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0446\u0456\u0454\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438"}: ${n.norm}`));
    if (n.note) legalLines.push(wrap(n.note));
    legalLines.push(wrap(`\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${n.from.join("; ")}`), "");
  }
  if (q.consequences.length > 0) {
    legalLines.push("\u0429\u041E \u0417 \u0426\u042C\u041E\u0413\u041E \u0412\u0418\u041F\u041B\u0418\u0412\u0410\u0404 \u0417\u0410 \u0417\u0410\u041A\u041E\u041D\u041E\u041C \u041F\u0420\u041E \u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u0406", "");
    for (const c of q.consequences) {
      legalLines.push(wrap(c.norm), wrap(c.effect), "");
    }
  }
  if (q.admin.length > 0) {
    legalLines.push("\u0410\u0414\u041C\u0406\u041D\u0406\u0421\u0422\u0420\u0410\u0422\u0418\u0412\u041D\u0410 \u0412\u0406\u0414\u041F\u041E\u0412\u0406\u0414\u0410\u041B\u042C\u041D\u0406\u0421\u0422\u042C", "");
    for (const a of q.admin) {
      legalLines.push(
        wrap(`\u0421\u0442\u0430\u0442\u0442\u044F 164-14 \u041A\u0423\u043F\u0410\u041F, ${a.part}: ${a.conduct}`),
        wrap(`\u0421\u0430\u043D\u043A\u0446\u0456\u044F: ${a.fine} \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u0442\u0430 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0438\u0445 \u043E\u0441\u0456\u0431 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430.`),
        wrap(`\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${a.from.join("; ")}`),
        ""
      );
    }
    legalLines.push(
      wrap("\u0420\u043E\u0437\u043C\u0456\u0440 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u0432 \u043D\u0435\u043E\u043F\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0443\u0432\u0430\u043D\u0438\u0445 \u043C\u0456\u043D\u0456\u043C\u0443\u043C\u0430\u0445 \u0434\u043E\u0445\u043E\u0434\u0456\u0432 \u0433\u0440\u043E\u043C\u0430\u0434\u044F\u043D; \u0434\u043B\u044F \u0448\u0442\u0440\u0430\u0444\u0456\u0432 \u0446\u044F \u043E\u0434\u0438\u043D\u0438\u0446\u044F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C 17 \u0433\u0440\u043D."),
      ""
    );
  }
  if (q.criminal.length > 0) {
    legalLines.push("\u041A\u0420\u0418\u041C\u0406\u041D\u0410\u041B\u042C\u041D\u041E-\u041F\u0420\u0410\u0412\u041E\u0412\u0406 \u041D\u0410\u041F\u0420\u042F\u041C\u0418", "");
    for (const c of q.criminal) {
      legalLines.push(`\u0421\u0442\u0430\u0442\u0442\u044F ${c.code} \u041A\u041A\u0423 \u2014 ${c.title}`, wrap(c.summary));
      legalLines.push("  \u0427\u043E\u043C\u0443 \u0446\u0435\u0439 \u043D\u0430\u043F\u0440\u044F\u043C \u0432\u0438\u043D\u0438\u043A\u0430\u0454 \u0441\u0430\u043C\u0435 \u0442\u0443\u0442:");
      for (const r of c.reasons) legalLines.push(wrap(`\u2014 ${r}`, 78, "    "));
      legalLines.push("  \u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E:");
      for (const e of c.elements) legalLines.push(wrap(`\u2014 ${e}`, 78, "    "));
      legalLines.push("  \u042F\u043A\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438:");
      for (const e of c.evidence) legalLines.push(wrap(`\u2014 ${e}`, 78, "    "));
      legalLines.push("");
    }
  }
  out.push({ heading: "\u041F\u0420\u0410\u0412\u041E\u0412\u0410 \u041A\u0412\u0410\u041B\u0406\u0424\u0406\u041A\u0410\u0426\u0406\u042F", lines: legalLines });
  out.push({
    heading: "\u041C\u0415\u0416\u0406 \u0426\u042C\u041E\u0413\u041E \u0417\u0412\u0406\u0422\u0423",
    lines: [
      wrap(
        "\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0426\u0435 \u043E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F."
      ),
      "",
      wrap(
        "\u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0441\u0442\u0430\u0442\u0442\u0456 \u041A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043A\u043E\u0434\u0435\u043A\u0441\u0443 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0456 \u044F\u043A \u043D\u0430\u043F\u0440\u044F\u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430. \u0426\u0435 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0423\u043C\u0438\u0441\u0435\u043B \u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u0456\u0441\u0442\u044C \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0432\u0438\u043A\u043B\u044E\u0447\u043D\u043E \u0441\u0443\u0434."
      ),
      "",
      wrap("\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u043A\u0440\u043E\u043A \u2014 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0457\u0445.")
    ]
  });
  return out;
}
function reportText(ctx) {
  const title = ctx.entry.title ?? ctx.entry.tender_ref;
  const head = [
    "TENDER RADAR \u2014 \u0417\u0412\u0406\u0422 \u041F\u041E \u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u0406",
    "=".repeat(78),
    wrap(title, 78, ""),
    `\u0421\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E: ${day(ctx.generatedAt)}`,
    "=".repeat(78),
    ""
  ];
  const body = sections(ctx).flatMap((section) => [section.heading, "-".repeat(78), ...section.lines, ""]);
  return [...head, ...body].join("\n");
}
function reportHtml(ctx) {
  const { entry } = ctx;
  const title = entry.title ?? entry.tender_ref;
  const body = sections(ctx).map(
    (section) => `<section>
  <h2>${esc(section.heading)}</h2>
  ${section.lines.filter((l) => l.trim()).map((line) => `<p>${esc(line.trim())}</p>`).join("")}
</section>`
  ).join("");
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\u0417\u0432\u0456\u0442 \u2014 ${esc(entry.tender_ref)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ysabeau:wght@300..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    color-scheme:light;
    /* Same scale as the site (server/html.ts) \u2014 kept local rather than shared
       because this document has no import path back to that stylesheet. */
    --s1:.25rem; --s2:.5rem; --s3:.75rem; --s4:1rem;
    --s5:1.5rem; --s6:2rem;  --s7:3rem;   --s8:4rem;
    --paper:#FCFCFA; --ink:#14181A; --soft:#565B60; --line:#E4E3DD; --accent:#0F5C8C;
    --f-body:"Ysabeau","Segoe UI",system-ui,sans-serif;
    --f-mono:"IBM Plex Mono",Consolas,monospace;
  }
  *{box-sizing:border-box}
  /* One voice on screen, same as the site. On paper it doesn't matter \u2014 the
     print rule below forces plain white regardless of this token. */
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.6}
  .sheet{max-width:52rem;margin:0 auto;background:#fff;padding:var(--s7) var(--s7) var(--s8);min-height:100vh}
  .toolbar{max-width:52rem;margin:var(--s4) auto 0;padding:0 var(--s7);display:flex;gap:var(--s3);flex-wrap:wrap}
  .toolbar a,.toolbar button{font:inherit;font-size:.92rem;text-decoration:none;color:var(--accent);background:#fff;border:1px solid var(--line);border-radius:5px;padding:var(--s2) var(--s4);cursor:pointer}
  .toolbar a:hover,.toolbar button:hover{border-color:var(--accent)}
  .print-hint{max-width:52rem;margin:var(--s2) auto 0;padding:0 var(--s7);color:var(--soft);font-size:.85rem}
  .print-hint kbd{font-family:var(--f-mono);font-size:.85em;background:var(--paper);border:1px solid var(--line);border-radius:var(--radius-sm,4px);padding:0 var(--s1)}
  @media print{.print-hint{display:none}}
  /* No serif on paper either: a second voice here would be the same
     inconsistency the site just dropped. Weight and size still carry the
     hierarchy, same as the site's own h2. */
  h1{font-family:var(--f-body);font-weight:700;font-size:1.5rem;line-height:1.25;margin:0 0 var(--s2)}
  .ref{font-family:var(--f-mono);font-size:.85rem;color:var(--soft)}
  .made{color:var(--soft);font-size:.85rem;margin:var(--s1) 0 var(--s5);padding-bottom:var(--s4);border-bottom:2px solid var(--ink)}
  section{margin:0 0 var(--s5);break-inside:avoid}
  h2{font-family:var(--f-body);font-weight:700;font-size:1rem;letter-spacing:.04em;margin:0 0 var(--s2);padding-bottom:var(--s1);border-bottom:1px solid var(--line)}
  p{margin:0 0 var(--s2);max-width:64ch}
  /* The page a person actually holds: plain black text on white, no tint,
     no brand background \u2014 paper is not a screen and shouldn't try to look
     like one. */
  @media print{
    body{background:#fff;font-size:11pt}
    .toolbar{display:none}
    .sheet{max-width:none;padding:0;min-height:0}
    @page{margin:18mm}
  }
</style>
</head>
<body>
<div class="toolbar">
  <a href="/tender/${encodeURIComponent(entry.tender_id)}">\u2190 \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
  <button type="button" onclick="window.print()">\u0414\u0440\u0443\u043A\u0443\u0432\u0430\u0442\u0438 / \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u044F\u043A PDF</button>
  <a href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C</a>
</div>
<!-- The button calls window.print(), which some mobile browsers ignore. The
     Ctrl+P path always works because this page carries its own @media print
     rules, so the hint is the reliable route, not a footnote. -->
<p class="print-hint">\u041D\u0435 \u0432\u0456\u0434\u043A\u0440\u0438\u043B\u043E\u0441\u044F \u0432\u0456\u043A\u043D\u043E \u0434\u0440\u0443\u043A\u0443? \u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C <kbd>Ctrl</kbd>+<kbd>P</kbd> (\u043D\u0430 Mac <kbd>\u2318</kbd>+<kbd>P</kbd>) \u0456 \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \xAB\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u044F\u043A PDF\xBB.</p>
<div class="sheet">
  <h1>${esc(title)}</h1>
  <div class="ref">${esc(entry.tender_ref || entry.tender_id)}</div>
  <div class="made">\u0422\u0435\u043D\u0434\u043EScope \xB7 \u0437\u0432\u0456\u0442 \u0441\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E ${esc(day(ctx.generatedAt))}</div>
  ${body}
</div>
</body>
</html>`;
}

// server/data.ts
import { readFile as readFile2 } from "node:fs/promises";
import { join as join3 } from "node:path";

// src/config.ts
import { existsSync } from "node:fs";
import { join as join2 } from "node:path";

// src/store/json-store.ts
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
var JsonStore = class {
  #dir;
  constructor(dir) {
    this.#dir = dir;
  }
  async #read(table) {
    try {
      return JSON.parse(await readFile(join(this.#dir, `${table}.json`), "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }
  async #write(table, rows) {
    await mkdir(this.#dir, { recursive: true });
    const target = join(this.#dir, `${table}.json`);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(rows), "utf8");
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temporary, target);
          break;
        } catch (error) {
          if (attempt >= 10 || !["EPERM", "EBUSY", "EACCES"].includes(error.code ?? "")) throw error;
          await delay(100 * (attempt + 1));
        }
      }
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  async replaceTenderCards(cards) {
    if (!cards.length) return;
    const ids = new Set(cards.map((c) => c.tender.id));
    await this.#write("tender_items", [...(await this.allTenderItems()).filter((r) => !ids.has(r.tender_id)), ...cards.flatMap((c) => c.items)]);
    await this.#write("bids", [...(await this.allBids()).filter((r) => !ids.has(r.tender_id)), ...cards.flatMap((c) => c.bids)]);
    await this.#write("awards", [...(await this.allAwards()).filter((r) => !ids.has(r.tender_id)), ...cards.flatMap((c) => c.awards)]);
    await this.upsertTenders(cards.map((c) => c.tender));
  }
  async #upsert(table, rows, key) {
    if (rows.length === 0) return;
    const existing = await this.#read(table);
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    await this.#write(table, [...byKey.values()]);
  }
  upsertTenders(rows) {
    return this.#upsert("tenders", rows, (r) => r.id);
  }
  upsertTenderItems(rows) {
    return this.#upsert("tender_items", rows, (r) => `${r.tender_id}|${r.item_id}`);
  }
  upsertBids(rows) {
    return this.#upsert("bids", rows, (r) => `${r.tender_id}|${r.bid_id}`);
  }
  upsertAwards(rows) {
    return this.#upsert("awards", rows, (r) => `${r.tender_id}|${r.award_id}`);
  }
  upsertRiskFlags(rows) {
    return this.#upsert("risk_flags", rows, (r) => `${r.tender_id}|${r.risk_id}`);
  }
  upsertRiskRules(rows) {
    return this.#upsert("risk_rules", rows, (r) => r.risk_id);
  }
  upsertMonitorings(rows) {
    return this.#upsert("monitorings", rows, (r) => r.monitoring_id);
  }
  upsertCatalogPrices(rows) {
    return this.#upsert("catalog_prices", rows, (r) => r.offer_id);
  }
  upsertFindings(rows) {
    return this.#upsert("findings", rows, (r) => `${r.tender_id}|${r.detector_key}`);
  }
  async replaceDetectorFindings(detectorKeys, rows) {
    const keys = new Set(detectorKeys);
    if (rows.some((row) => !keys.has(row.detector_key))) {
      throw new Error("Finding belongs to a detector outside this completed run");
    }
    const existing = await this.allFindings();
    await this.#write("findings", [
      ...existing.filter((row) => !keys.has(row.detector_key)),
      ...rows
    ]);
  }
  upsertRuns(rows) {
    return this.#upsert("runs", rows, (r) => r.run_id);
  }
  replaceRuns(rows) {
    return this.#write("runs", rows);
  }
  allTenders() {
    return this.#read("tenders");
  }
  allTenderItems() {
    return this.#read("tender_items");
  }
  allBids() {
    return this.#read("bids");
  }
  allAwards() {
    return this.#read("awards");
  }
  allRiskFlags() {
    return this.#read("risk_flags");
  }
  allRiskRules() {
    return this.#read("risk_rules");
  }
  allMonitorings() {
    return this.#read("monitorings");
  }
  allCatalogPrices() {
    return this.#read("catalog_prices");
  }
  allFindings() {
    return this.#read("findings");
  }
  allRuns() {
    return this.#read("runs");
  }
  async getCursor(worker) {
    const all = await this.#read("cursors");
    return all[0]?.[worker] ?? null;
  }
  async setCursor(worker, cursor) {
    const all = await this.#read("cursors");
    const map = all[0] ?? {};
    map[worker] = cursor;
    await this.#write("cursors", [map]);
  }
};

// src/config.ts
var REGION = "\u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0430 \u043E\u0431\u043B\u0430\u0441\u0442\u044C";
var SOUTHERN_RAILWAY_EDRPOU = "40081216";
var RAILWAY_EDRPOU = /* @__PURE__ */ new Set([
  "40075815",
  // АТ «Укрзалізниця»
  SOUTHERN_RAILWAY_EDRPOU,
  // РФ "Південна залізниця" — the Kharkiv branch
  "40081347",
  // Філія "Центр забезпечення виробництва"
  "41022900",
  // Філія "Пасажирська компанія"
  "40123454",
  // Філія "Центр з ремонту та експлуатації колійних машин"
  "45462724",
  // Філія "УЗ Вагон-Сервіс"
  "45246390"
  // Філія "Приміська пасажирська компанія"
]);
var RAILWAY_NAME = /залізни|укрзаліз|колійн|локомотив|вагон|тепловоз|електровоз/i;
function railwayScope(entity) {
  const edrpou = entity.entity_edrpou ?? "";
  if (edrpou === SOUTHERN_RAILWAY_EDRPOU) return "southern";
  if (RAILWAY_EDRPOU.has(edrpou)) return "branch";
  if (/укрзалізниц|українська\s+залізниця|украинская\s+железная\s+дорога/i.test(entity.entity_name ?? "")) return "branch";
  if (entity.region === REGION && RAILWAY_NAME.test(entity.entity_name ?? "")) return "local";
  return null;
}
function dataDir() {
  if (process.env.TR_DATA_DIR) return process.env.TR_DATA_DIR;
  const working = join2(import.meta.dirname, "..", "data");
  return existsSync(working) ? working : join2(import.meta.dirname, "..", "web-data");
}
function openStore() {
  return new JsonStore(dataDir());
}

// src/normalize/tender.ts
function officerKey(row) {
  if (row.officer_email) return row.officer_email.trim().toLowerCase();
  if (row.officer_name && row.entity_edrpou) return `${row.officer_name.trim().toLowerCase()}@@${row.entity_edrpou}`;
  return null;
}

// src/normalize/monitoring.ts
function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}
function asString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function violationEstablished(row) {
  const conclusion = asRecord(row.conclusion);
  return typeof conclusion.violationOccurred === "boolean" ? conclusion.violationOccurred : null;
}
function conclusionText(row, max = 600) {
  const conclusion = asRecord(row.conclusion);
  const text = (conclusion.description ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = cut.lastIndexOf(" ");
  return (stop > max * 0.6 ? cut.slice(0, stop) : cut) + "\u2026";
}
function conclusionPublished(row) {
  const conclusion = asRecord(row.conclusion);
  return asString(conclusion.datePublished) ?? asString(conclusion.dateCreated) ?? row.date_modified;
}

// src/sources/openprocurement.ts
var BASE = "https://public-api.prozorro.gov.ua/api/2.5";
var FEED_START = `${BASE}/tenders?limit=100&descending=1&opt_fields=tenderID,procuringEntity,public_modified`;

// src/ingest/tenders.ts
var INGEST_KEY = "public-tenders-v1";

// server/data.ts
function tenderDateOf(tenderRef) {
  const m = /^UA-(\d{4}-\d{2}-\d{2})-/.exec(tenderRef);
  return m ? m[1] : null;
}
function activeAward(awards) {
  return awards.find((a) => a.status === "active") ?? awards[0];
}
function mergeCardDetail(entry, card) {
  const detail = card.tender;
  const won = activeAward(card.awards);
  return {
    ...entry,
    title: detail.title ?? null,
    status: detail.status ?? null,
    method: detail.method ?? null,
    // The flag already carries these; only fall back to the card when the
    // flag itself did not have them, matching the original priority.
    entity_edrpou: detail.entity_edrpou ?? entry.entity_edrpou ?? null,
    entity_name: detail.entity_name ?? entry.entity_name ?? null,
    region: detail.region ?? entry.region ?? null,
    value_amount: detail.value_amount ?? entry.value_amount ?? null,
    scope_reasons: detail.scope_reasons,
    officer_name: detail.officer_name ?? null,
    officer_email: detail.officer_email ?? null,
    officer_phone: detail.officer_phone ?? null,
    officer_key: officerKey(detail),
    winner_name: won?.supplier_name ?? null,
    winner_edrpou: won?.supplier_edrpou ?? null,
    winner_amount: won?.amount ?? null,
    bidders: card.bids.length,
    detailed: true
  };
}
function violationTypes(row) {
  const conclusion = row.conclusion;
  const types = conclusion?.violationType;
  return Array.isArray(types) ? types.filter((t) => typeof t === "string") : [];
}
async function loadDataset() {
  const store = openStore();
  const checkpoint = await store.getCursor(INGEST_KEY);
  const ingestion = checkpoint ? JSON.parse(checkpoint) : null;
  const flags = await store.allRiskFlags();
  const rules = await store.allRiskRules();
  const tenders = await store.allTenders();
  const awards = await store.allAwards();
  const bids = await store.allBids();
  const runs = await store.allRuns();
  const findings = (await store.allFindings()).filter(
    (row) => ["peer_price", "own_price_growth", "market_price", "document_market_price"].includes(row.detector_key)
  );
  const monitorings = await store.allMonitorings();
  const monitoringsByTender = /* @__PURE__ */ new Map();
  for (const row of monitorings) {
    const list = monitoringsByTender.get(row.tender_id) ?? [];
    list.push(row);
    monitoringsByTender.set(row.tender_id, list);
  }
  const auditByTender = /* @__PURE__ */ new Map();
  for (const [tenderId, list] of monitoringsByTender) {
    const decided = list.filter((row) => violationEstablished(row) !== null);
    if (decided.length === 0) continue;
    const pick = decided.find((row) => violationEstablished(row) === true) ?? decided[0];
    auditByTender.set(tenderId, {
      violation: violationEstablished(pick) === true,
      text: conclusionText(pick),
      published: conclusionPublished(pick),
      monitoring_id: pick.monitoring_id,
      count: decided.length,
      reasons: Array.isArray(pick.reasons) ? pick.reasons : [],
      types: violationTypes(pick)
    });
  }
  const findingsByTender = /* @__PURE__ */ new Map();
  for (const finding of findings) {
    const list = findingsByTender.get(finding.tender_id) ?? [];
    list.push(finding);
    findingsByTender.set(finding.tender_id, list);
  }
  const tenderById = new Map(tenders.map((t) => [t.id, t]));
  const awardsByTender = /* @__PURE__ */ new Map();
  for (const award of awards) {
    const list = awardsByTender.get(award.tender_id) ?? [];
    list.push(award);
    awardsByTender.set(award.tender_id, list);
  }
  const bidsByTender = /* @__PURE__ */ new Map();
  for (const bid of bids) {
    const list = bidsByTender.get(bid.tender_id) ?? [];
    list.push(bid);
    bidsByTender.set(bid.tender_id, list);
  }
  const byTender = /* @__PURE__ */ new Map();
  const flaggedIds = new Set(flags.map((f) => f.tender_id));
  const unflagged = tenders.filter((t) => !flaggedIds.has(t.id)).map((t) => ({
    tender_id: t.id,
    tender_ref: t.tender_id,
    risk_id: "",
    date_assessed: null,
    region: t.region,
    entity_edrpou: t.entity_edrpou,
    entity_name: t.entity_name,
    value_amount: t.value_amount
  }));
  for (const flag of [...flags, ...unflagged]) {
    let entry = byTender.get(flag.tender_id);
    if (!entry) {
      const detail = tenderById.get(flag.tender_id);
      entry = {
        tender_id: flag.tender_id,
        tender_ref: flag.tender_ref || detail?.tender_id || "",
        tender_date: tenderDateOf(flag.tender_ref || detail?.tender_id || ""),
        title: null,
        status: null,
        method: null,
        entity_edrpou: flag.entity_edrpou ?? null,
        entity_name: flag.entity_name ?? null,
        region: flag.region ?? null,
        value_amount: flag.value_amount ?? null,
        date_assessed: flag.date_assessed,
        risks: [],
        officer_name: null,
        officer_email: null,
        officer_phone: null,
        officer_key: null,
        winner_name: null,
        winner_edrpou: null,
        winner_amount: null,
        bidders: 0,
        detailed: false,
        findings: findingsByTender.get(flag.tender_id) ?? [],
        audit: auditByTender.get(flag.tender_id) ?? null
      };
      if (detail) {
        entry = mergeCardDetail(entry, {
          tender: detail,
          items: [],
          bids: bidsByTender.get(flag.tender_id) ?? [],
          awards: awardsByTender.get(flag.tender_id) ?? []
        });
      }
      byTender.set(flag.tender_id, entry);
    }
    if (!entry.tender_ref && flag.tender_ref) {
      entry.tender_ref = flag.tender_ref;
      entry.tender_date = tenderDateOf(flag.tender_ref);
    }
    if (entry.value_amount === null) entry.value_amount = flag.value_amount;
    if (flag.risk_id && !entry.risks.includes(flag.risk_id)) entry.risks.push(flag.risk_id);
  }
  const cases = [...byTender.values()];
  let documents = [];
  try {
    documents = JSON.parse(await readFile2(join3(dataDir(), "document-extractions.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let documentPrices = [];
  try {
    documentPrices = JSON.parse(await readFile2(join3(dataDir(), "document-price-checks.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    documentPrices,
    documents,
    ingestion,
    cases,
    byTender,
    rules,
    ruleById: new Map(rules.map((r) => [r.risk_id, r])),
    runs,
    findingCount: findings.length,
    flagCount: flags.length,
    totalValue: cases.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0)
  };
}

// server/context.ts
var db = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders (${db.cases.filter((c) => c.detailed).length} with full cards)`
);
var starred = [];
var current = "";
function dataset() {
  return db;
}
function setCurrentPath(path) {
  current = path;
}
function currentPath() {
  return current;
}
var memo = /* @__PURE__ */ new Map();
function perDataset(key, build) {
  if (!memo.has(key)) memo.set(key, build());
  return memo.get(key);
}
function setStarred(list) {
  starred = list;
}
function starredList() {
  return starred;
}

// server/grouping.ts
var DIMENSIONS = [
  { value: "", label: "\u0411\u0435\u0437 \u0433\u0440\u0443\u043F\u0443\u0432\u0430\u043D\u043D\u044F" },
  { value: "entity", label: "\u0417\u0430 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C" },
  { value: "officer", label: "\u0417\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u043C" },
  { value: "supplier", label: "\u0417\u0430 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C" },
  { value: "risk", label: "\u0417\u0430 \u043E\u0437\u043D\u0430\u043A\u043E\u044E" },
  { value: "year", label: "\u0417\u0430 \u0440\u043E\u043A\u043E\u043C" },
  { value: "method", label: "\u0417\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E" },
  { value: "severity", label: "\u0417\u0430 \u0433\u043E\u0441\u0442\u0440\u043E\u0442\u043E\u044E" }
];
function isDimension(value) {
  return DIMENSIONS.some((d) => d.value === value);
}
var SEVERITY_ORDER = { \u0413\u043E\u0441\u0442\u0440\u0456: 0, \u041F\u043E\u043C\u0456\u0442\u043D\u0456: 1, \u0417\u0432\u0438\u0447\u0430\u0439\u043D\u0456: 2 };
function bucketsOf(entry, dimension, riskLabel) {
  switch (dimension) {
    case "entity":
      return [
        {
          key: entry.entity_edrpou ?? "\u2014",
          label: entry.entity_name ?? "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u0438\u0439",
          href: entry.entity_edrpou ? `/entity/${encodeURIComponent(entry.entity_edrpou)}` : null
        }
      ];
    case "officer":
      return entry.officer_key ? [{ key: entry.officer_key, label: entry.officer_name ?? entry.officer_key, href: `/officer/${encodeURIComponent(entry.officer_key)}` }] : [{ key: "\u2014", label: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u043E", href: null }];
    case "supplier":
      return entry.winner_edrpou ? [{ key: entry.winner_edrpou, label: entry.winner_name ?? entry.winner_edrpou, href: `/supplier/${encodeURIComponent(entry.winner_edrpou)}` }] : [{ key: "\u2014", label: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043E", href: null }];
    case "risk":
      return entry.risks.map((id) => ({ key: id, label: riskLabel(id), href: `/?risk=${encodeURIComponent(id)}` }));
    case "year": {
      const year = (entry.date_assessed ?? entry.tender_ref.slice(3, 7) ?? "").slice(0, 4);
      return [{ key: year || "\u2014", label: year ? `${year} \u0440\u0456\u043A` : "\u0420\u0456\u043A \u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439", href: null }];
    }
    case "method":
      return [{ key: entry.method ?? "\u2014", label: entry.method ?? "\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443 \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u043E", href: null }];
    case "severity": {
      const label = entry.findings.some((f) => f.severity === "high") || entry.risks.length >= 3 ? "\u0413\u043E\u0441\u0442\u0440\u0456" : entry.findings.length > 0 || entry.bidders === 1 ? "\u041F\u043E\u043C\u0456\u0442\u043D\u0456" : "\u0417\u0432\u0438\u0447\u0430\u0439\u043D\u0456";
      return [{ key: label, label, href: null }];
    }
    default:
      return [];
  }
}
function sum(cases) {
  return cases.reduce((total, c) => total + (c.value_amount ?? 0), 0);
}
function sortGroups(groups2, dimension) {
  if (dimension === "year") return groups2.sort((a, b) => b.bucket.key.localeCompare(a.bucket.key));
  if (dimension === "severity") {
    return groups2.sort((a, b) => (SEVERITY_ORDER[a.bucket.key] ?? 9) - (SEVERITY_ORDER[b.bucket.key] ?? 9));
  }
  return groups2.sort((a, b) => b.value - a.value || b.cases.length - a.cases.length);
}
function buildGroups(cases, first, second, riskLabel) {
  if (!first) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of cases) {
    for (const bucket of bucketsOf(entry, first, riskLabel)) {
      const group = byKey.get(bucket.key) ?? { bucket, cases: [] };
      group.cases.push(entry);
      byKey.set(bucket.key, group);
    }
  }
  const groups2 = [...byKey.values()].map(({ bucket, cases: inner }) => ({
    bucket,
    cases: inner,
    value: sum(inner),
    children: second && second !== first ? buildGroups(inner, second, "", riskLabel) : []
  }));
  return sortGroups(groups2, first);
}

// server/controls.ts
function readControls(url) {
  const rawGroup = url.searchParams.get("group") ?? "";
  const rawThen = url.searchParams.get("then") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().toLowerCase(),
    risk: url.searchParams.get("risk") ?? "",
    region: url.searchParams.get("region") ?? "",
    sort: url.searchParams.get("sort") ?? "value",
    railOnly: url.searchParams.get("rail") === "1",
    soloOnly: url.searchParams.get("solo") === "1",
    priceOnly: url.searchParams.get("price") === "1",
    audit: ["violation", "clear"].includes(url.searchParams.get("audit") ?? "") ? url.searchParams.get("audit") : "",
    dateFrom: (url.searchParams.get("from") ?? "").trim(),
    dateTo: (url.searchParams.get("to") ?? "").trim(),
    min: Number(url.searchParams.get("min") ?? "") || 0,
    max: Number(url.searchParams.get("max") ?? "") || 0,
    group: isDimension(rawGroup) ? rawGroup : "",
    then: isDimension(rawThen) ? rawThen : "",
    // `|| 1`, not just Math.max: `?page=abc` is NaN, and NaN survives max().
    page: Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? 1) || 1))
  };
}
function activeCount(c) {
  return [
    c.risk,
    c.region,
    c.railOnly,
    c.soloOnly,
    c.priceOnly,
    c.audit,
    c.dateFrom,
    c.dateTo,
    c.min > 0,
    c.max > 0,
    c.group,
    c.sort !== "value"
  ].filter(Boolean).length;
}
function isFiltered(c) {
  return Boolean(
    c.q || c.risk || c.region || c.railOnly || c.soloOnly || c.priceOnly || c.audit || c.dateFrom || c.dateTo || c.min > 0 || c.max > 0
  );
}
function applyControls(cases, c, railwayCodes, opts = {}) {
  let list = cases;
  if (c.q) {
    list = list.filter(
      (x) => (x.entity_name ?? "").toLowerCase().includes(c.q) || (x.title ?? "").toLowerCase().includes(c.q) || (x.officer_name ?? "").toLowerCase().includes(c.q) || (x.winner_name ?? "").toLowerCase().includes(c.q) || (x.entity_edrpou ?? "").includes(c.q) || (x.winner_edrpou ?? "").includes(c.q) || x.tender_ref.toLowerCase().includes(c.q)
    );
  }
  if (c.risk) list = list.filter((x) => x.risks.includes(c.risk));
  if (c.region) list = list.filter((x) => x.region === c.region || c.region === "\u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0430 \u043E\u0431\u043B\u0430\u0441\u0442\u044C" && x.scope_reasons?.some((r) => r.startsWith("kharkiv_")));
  if (c.railOnly && !opts.hideRail) list = list.filter((x) => railwayCodes.has(x.entity_edrpou ?? "") || x.scope_reasons?.includes("railway"));
  if (c.soloOnly) list = list.filter((x) => x.bidders === 1);
  if (c.priceOnly && !opts.hidePrice) list = list.filter((x) => x.findings.length > 0);
  if (c.audit === "violation") list = list.filter((x) => x.audit?.violation === true);
  if (c.audit === "clear") list = list.filter((x) => x.audit !== null && !x.audit.violation);
  if (c.dateFrom) list = list.filter((x) => (x.tender_date ?? "") >= c.dateFrom);
  if (c.dateTo) list = list.filter((x) => (x.tender_date ?? "") <= c.dateTo);
  if (c.min > 0) list = list.filter((x) => (x.value_amount ?? 0) >= c.min);
  if (c.max > 0) list = list.filter((x) => (x.value_amount ?? 0) <= c.max);
  return [...list].sort(
    (a, b) => c.sort === "date" ? String(b.tender_date ?? "").localeCompare(String(a.tender_date ?? "")) : c.sort === "date-asc" ? String(a.tender_date ?? "").localeCompare(String(b.tender_date ?? "")) : c.sort === "assessed" ? String(b.date_assessed ?? "").localeCompare(String(a.date_assessed ?? "")) : c.sort === "value-asc" ? (a.value_amount ?? 0) - (b.value_amount ?? 0) : c.sort === "risks" ? b.risks.length - a.risks.length || (b.value_amount ?? 0) - (a.value_amount ?? 0) : (b.value_amount ?? 0) - (a.value_amount ?? 0)
  );
}
function controlParams(c) {
  const p = new URLSearchParams();
  if (c.q) p.set("q", c.q);
  if (c.risk) p.set("risk", c.risk);
  if (c.region) p.set("region", c.region);
  if (c.sort !== "value") p.set("sort", c.sort);
  if (c.railOnly) p.set("rail", "1");
  if (c.soloOnly) p.set("solo", "1");
  if (c.priceOnly) p.set("price", "1");
  if (c.audit) p.set("audit", c.audit);
  if (c.dateFrom) p.set("from", c.dateFrom);
  if (c.dateTo) p.set("to", c.dateTo);
  if (c.min > 0) p.set("min", String(c.min));
  if (c.max > 0) p.set("max", String(c.max));
  if (c.group) p.set("group", c.group);
  if (c.then) p.set("then", c.then);
  return p;
}
function keepControls(action, c, over = {}) {
  const p = controlParams(c);
  for (const [k, v] of Object.entries(over)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const query2 = p.toString();
  return query2 ? `${action}?${query2}` : action;
}
function hiddenControls(c, esc2, skip = []) {
  return [...controlParams(c).entries()].filter(([k]) => !skip.includes(k)).map(([k, v]) => `<input type="hidden" name="${esc2(k)}" value="${esc2(v)}">`).join("");
}

// server/components/risk.ts
function shortRisk(riskId) {
  return RISK_LABELS[riskId]?.short ?? dataset().ruleById.get(riskId)?.name ?? riskId;
}
function riskFlag(riskId) {
  return `<a class="flag" href="/?risk=${encodeURIComponent(riskId)}">${esc(shortRisk(riskId))}</a>`;
}
function rankRisks(list) {
  const counts = /* @__PURE__ */ new Map();
  for (const entry of list) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function riskCard(riskId, count) {
  const rule = dataset().ruleById.get(riskId);
  const label = RISK_LABELS[riskId];
  const legal = INDICATOR_LEGAL[riskId];
  const stateNorm = rule?.legitimateness?.trim();
  const norm = stateNorm ? `<p class="legal"><strong>\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430:</strong> ${esc(stateNorm)}</p>` : legal?.norm ? `<p class="legal reading"><strong>\u041D\u043E\u0440\u043C\u0430 \u2014 \u043D\u0430\u0448\u0435 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F:</strong> ${esc(legal.norm)}</p>
  <p class="faint">${esc(legal.normNote ?? "")}</p>` : `<p class="faint">\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0456 \u043C\u0438 \u043D\u0435 \u0431\u0435\u0440\u0435\u043C\u043E\u0441\u044F \u0457\u0457 \u0434\u043E\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438.</p>`;
  const criminal = legal?.criminal.length ? `<details class="sub">
  <summary>\u0429\u043E \u0446\u0435 \u043C\u043E\u0436\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0442\u0438 \u0437\u0430 \u043A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u0438\u043C \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u2014 ${legal.criminal.length} ${plural(legal.criminal.length, "\u043D\u0430\u043F\u0440\u044F\u043C", "\u043D\u0430\u043F\u0440\u044F\u043C\u0438", "\u043D\u0430\u043F\u0440\u044F\u043C\u0456\u0432")}</summary>
  <div class="inner">
    <p class="faint">\u0426\u0435 \u043D\u0430\u043F\u0440\u044F\u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430, \u0430 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439. \u0423\u043C\u0438\u0441\u0435\u043B \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0441\u0443\u0434.</p>
    ${legal.criminal.map((direction) => {
    const article = ARTICLES[direction.code];
    return `<p><strong>\u0421\u0442\u0430\u0442\u0442\u044F ${esc(direction.code)} \u041A\u041A\u0423 \u2014 ${esc(article?.title ?? "")}</strong><br>${esc(direction.why)}<br><a href="/article/${esc(direction.code)}">\u0423\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430 \u0446\u0438\u043C \u043D\u0430\u043F\u0440\u044F\u043C\u043E\u043C \u2192</a></p>`;
  }).join("")}
  </div>
</details>` : "";
  return `<div class="card">
  <h3><span class="tier state">\u041F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;${esc(label?.short ?? rule?.name ?? riskId)}${count ? ` <span class="faint">\u2014 ${count} ${plural(count, "\u0440\u0430\u0437", "\u0440\u0430\u0437\u0438", "\u0440\u0430\u0437\u0456\u0432")}</span>` : ""}</h3>
  ${label ? `<p class="lead">${esc(label.means)}</p>` : ""}
  ${rule?.name && label ? `<p class="faint"><strong>\u041E\u0444\u0456\u0446\u0456\u0439\u043D\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F:</strong> ${esc(rule.name)}</p>` : ""}
  ${norm}
  ${criminal}
  <p class="code">\u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 ${esc(riskId)} \xB7 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \xB7 <a href="/?risk=${encodeURIComponent(riskId)}">\u0443\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u0446\u0456\u0454\u044E \u043E\u0437\u043D\u0430\u043A\u043E\u044E \u2192</a></p>
</div>`;
}
function groupedRiskCards(ranked) {
  const byGroup = /* @__PURE__ */ new Map();
  const ungrouped = [];
  for (const pair of ranked) {
    const group = RISK_LABELS[pair[0]]?.group;
    if (!group) {
      ungrouped.push(pair);
      continue;
    }
    const list = byGroup.get(group) ?? [];
    list.push(pair);
    byGroup.set(group, list);
  }
  const parts = [];
  for (const group of GROUP_ORDER) {
    const list = byGroup.get(group);
    if (!list) continue;
    const total = list.reduce((sum2, [, n]) => sum2 + n, 0);
    parts.push(
      `<div class="group"><h3>${esc(group)}</h3><span class="count">${total} ${plural(total, "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C")}</span></div>`,
      ...list.map(([riskId, count]) => riskCard(riskId, count))
    );
  }
  parts.push(...ungrouped.map(([riskId, count]) => riskCard(riskId, count)));
  return parts.join("");
}

// server/components/case-row.ts
var MAX_ROW_FLAGS = 3;
function rowSeverity(entry) {
  if (entry.audit?.violation) return "proven";
  if (entry.findings.length > 0) return "high";
  if (entry.audit && !entry.audit.violation) return "clear";
  if (entry.bidders === 1 || entry.risks.length >= 3) return "medium";
  return "low";
}
function signalLine(entry) {
  if (entry.audit?.violation) return "\u0414\u0410\u0421\u0423 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F";
  if (entry.findings.length) return "\u0404 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u0443 \u0446\u0456\u043D\u0456 \u2014 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F";
  if (entry.audit && !entry.audit.violation) return "\u0414\u0410\u0421\u0423 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C";
  if (entry.bidders === 1) return "\u041D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u043F\u043E\u0434\u0430\u0432\u0441\u044F \u043E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A";
  const n = entry.risks.length;
  if (n === 0) return "";
  const topRisk = rankRisks([entry])[0]?.[0] ?? entry.risks[0];
  const count = `${n} ${plural(n, "\u043E\u0437\u043D\u0430\u043A\u0430", "\u043E\u0437\u043D\u0430\u043A\u0438", "\u043E\u0437\u043D\u0430\u043A")}`;
  return `${count} \xB7 ${esc(shortRisk(topRisk))}`;
}
function auditSection(entry) {
  const audit = entry.audit;
  if (!audit) return "";
  const grounds = audit.reasons.map((r) => MONITORING_REASONS[r] ?? r);
  const kinds = audit.types.map((t) => VIOLATION_TYPES[t] ?? t);
  const facts = [];
  if (grounds.length) facts.push(`<dt>\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438</dt><dd>${esc(grounds.join(", "))}</dd>`);
  if (kinds.length) facts.push(`<dt>\u0422\u0438\u043F \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F</dt><dd>${esc(kinds.join(", "))}</dd>`);
  if (audit.published) facts.push(`<dt>\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043E</dt><dd>${date(audit.published)}</dd>`);
  if (audit.count > 1) facts.push(`<dt>\u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0456\u0432</dt><dd>${audit.count}</dd>`);
  return `
<h2>\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0438</h2>
<div class="card verdict ${audit.violation ? "high" : "low"}">
  <span class="verdict-tag">${audit.violation ? "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E" : "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E"}</span>
  <p class="lead">${audit.violation ? "\u041E\u0440\u0433\u0430\u043D \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E \u043F\u0440\u043E\u0432\u0456\u0432 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0432 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430." : "\u041E\u0440\u0433\u0430\u043D \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0433\u043E \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044E \u043F\u0440\u043E\u0432\u0456\u0432 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0432."}</p>
  ${audit.text ? `<p>\xAB${esc(audit.text)}\xBB</p>` : ""}
  ${facts.length ? `<dl class="facts">${facts.join("")}</dl>` : ""}
  <p class="note">\u041C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u0434\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456. \u0412\u0456\u043D \u043D\u0435 \u043E\u0446\u0456\u043D\u044E\u0454, \u0447\u0438 \u0446\u0456\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0440\u0438\u043D\u043A\u043E\u0432\u0456\u0439 \u2014 \u0446\u0435 \u043E\u043A\u0440\u0435\u043C\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F, \u0456 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043D\u0430 \u043D\u044C\u043E\u0433\u043E \u043D\u0438\u0436\u0447\u0435.
  <br><a href="https://audit-api.prozorro.gov.ua/api/2.5/monitorings/${encodeURIComponent(audit.monitoring_id)}">\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0443</a></p>
</div>
`;
}
function auditFlag(entry) {
  if (!entry.audit) return "";
  return entry.audit.violation ? '<span class="flag proven">\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E</span>' : '<span class="flag clear">\u0414\u0410\u0421\u0423: \u0431\u0435\u0437 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C</span>';
}
function alarms(entry) {
  const out = [];
  for (const finding of entry.findings) {
    if (finding.tier === "confirmed") continue;
    out.push(finding.title);
  }
  if (entry.detailed && entry.bidders === 1) out.push("\u0404\u0434\u0438\u043D\u0438\u0439 \u0443\u0447\u0430\u0441\u043D\u0438\u043A");
  if ((entry.value_amount ?? 0) >= 1e9) out.push("\u041F\u043E\u043D\u0430\u0434 \u043C\u0456\u043B\u044C\u044F\u0440\u0434");
  if (entry.risks.length >= 3) out.push(`${entry.risks.length} \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043E\u0434\u0440\u0430\u0437\u0443`);
  return out;
}
function star(kind, id, back, opts = {}) {
  if (!id) return "";
  const on = isStarred(starredList(), kind, id);
  const title = on ? "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0437 \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E" : "\u0414\u043E\u0434\u0430\u0442\u0438 \u0434\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E";
  return `<form class="star-form" method="post" action="/starred/toggle">
  <input type="hidden" name="kind" value="${esc(kind)}">
  <input type="hidden" name="id" value="${esc(id)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button type="submit" class="star${on ? " on" : ""}" title="${title}" aria-label="${title}" aria-pressed="${on}">${on ? "\u2605" : "\u2606"}${opts.label ? `<span>${on ? "\u0412 \u043E\u0431\u0440\u0430\u043D\u043E\u043C\u0443" : "\u0414\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E"}</span>` : ""}</button>
</form>`;
}
function caseRow(entry, opts = {}) {
  const showOfficer = opts.showOfficer ?? true;
  const showEntity = opts.showEntity ?? true;
  const buyer = readableName(entry.entity_name);
  const hasOwnTitle = Boolean(entry.title);
  const title = hasOwnTitle ? trim(entry.title, 110) : buyer || "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F";
  const meta = [];
  if (showEntity && buyer && hasOwnTitle) {
    meta.push(`<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(buyer)}</a>`);
  }
  if (entry.region) meta.push(esc(entry.region));
  if (entry.tender_date) meta.push(date(entry.tender_date));
  const people = [];
  if (showOfficer && entry.officer_name) {
    people.push(`\u043A\u043E\u043D\u0442\u0430\u043A\u0442: <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a>`);
  }
  if (entry.winner_name) {
    people.push(
      `\u0432\u0438\u0433\u0440\u0430\u0432 <a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a>`
    );
  }
  const severity = rowSeverity(entry);
  const here = currentPath();
  const tenderHref = `/tender/${encodeURIComponent(entry.tender_id)}${here && !here.startsWith("/tender/") ? `?from=${encodeURIComponent(here)}` : ""}`;
  return `<article class="row tender-card sev-${severity}">
  <div class="card-topline"><span class="card-status">${esc({ proven: "\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0410\u0421\u0423", high: "\u0426\u0456\u043D\u043E\u0432\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B", medium: "\u041F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u0443\u0432\u0430\u0433\u0438", clear: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0435\u043D\u043E \u0414\u0410\u0421\u0423", low: entry.risks.length ? "\u041E\u0437\u043D\u0430\u043A\u0438 \u0440\u0438\u0437\u0438\u043A\u0443" : "\u0411\u0435\u0437 \u0432\u0438\u044F\u0432\u043B\u0435\u043D\u0438\u0445 \u0441\u0438\u0433\u043D\u0430\u043B\u0456\u0432" }[severity])}</span>${star("tender", entry.tender_id, here || tenderHref)}</div>
  <div class="who"><h3 class="card-title"><a href="${esc(tenderHref)}">${esc(title)}</a></h3><div class="card-buyer">${showEntity && buyer && hasOwnTitle ? esc(buyer) : !hasOwnTitle ? "\u041D\u0430\u0437\u0432\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u044F \u0443 \u0441\u043F\u0438\u0441\u043A\u0443" : ""}</div></div>
  <div class="card-facts"><div><span>\u0421\u0443\u043C\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</span><strong>${shortMoney(entry.value_amount)}</strong></div><div><span>\u041E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043E</span><strong>${entry.tender_date ? date(entry.tender_date) : "\u041D\u0435\u043C\u0430\u0454 \u0434\u0430\u0442\u0438"}</strong></div></div>
  ${signalLine(entry) ? `<p class="card-reason"><span>${severity === "clear" ? "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438" : "\u0427\u043E\u043C\u0443 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438"}</span>${signalLine(entry)}</p>` : ""}
  <details class="card-extra"><summary>\u0414\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456</summary><div class="card-extra-body"><div class="meta">${meta.join(" \xB7 ")}</div>${people.length ? `<div class="meta">${people.join(" \xB7 ")}</div>` : ""}<div class="meta">${esc(entry.tender_ref || entry.tender_id)}</div>${!entry.detailed ? '<p class="coverage-note">\u041D\u0435\u043F\u043E\u0432\u043D\u0456 \u0434\u0430\u043D\u0456 \u0443 \u0441\u043F\u0438\u0441\u043A\u0443 \xB7 \u0432\u0456\u0434\u043A\u0440\u0438\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u043A\u0443 \u0434\u043B\u044F \u0434\u0435\u0442\u0430\u043B\u0435\u0439</p>' : ""}<div class="card-flags">${auditFlag(entry)}${alarms(entry).map((a) => `<span class="flag alarm">${esc(a)}</span>`).join("")}${entry.risks.slice(0, MAX_ROW_FLAGS).map(riskFlag).join("")}</div></div></details>
  <div class="case-open"><a href="${esc(tenderHref)}">\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E <span aria-hidden="true">\u2192</span></a></div>
</article>`;
}

// server/components/filters.ts
var PAGE_SIZE = 30;
var MAX_GROUPS = 40;
function presetsFor(action) {
  const base = [
    { label: "\u0423\u0441\u0456", hint: "\u043F\u043E\u0432\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A", query: "" },
    { label: "\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0410\u0421\u0423", hint: "\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F", query: "audit=violation" },
    { label: "\u0426\u0456\u043D\u043E\u0432\u0456 \u0441\u0438\u0433\u043D\u0430\u043B\u0438", hint: "\u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0446\u0456\u043D, \u044F\u043A\u0456 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438", query: "price=1" },
    { label: "\u0411\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432", hint: "\u043F\u043E\u0434\u0430\u0432\u0441\u044F \u043E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A", query: "solo=1" },
    { label: "\u0412\u0456\u0434 100 \u043C\u043B\u043D", hint: "\u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0456 \u0441\u0443\u043C\u0438", query: "min=100000000" }
    // "Кілька ознак" and "Найновіші" used to live here too, but they are sorts,
    // not filters — the sort bar already offers "більше ознак" and "новіші
    // закупівлі". Kept out of the presets so the row stays short and the chips
    // are all genuine filters.
  ];
  return action === "/prices" ? base.filter((p) => p.query !== "price=1") : base;
}
function presetBar(action, url, c) {
  const cleared = { ...c, audit: "", priceOnly: false, soloOnly: false, min: 0, page: 1 };
  const current2 = keepControls(action, { ...c, page: 1 });
  return `<div class="presets">
  ${presetsFor(action).map((p) => {
    const href = keepControls(action, cleared, Object.fromEntries(new URLSearchParams(p.query)));
    const active = href === current2;
    return `<a class="preset${active ? " on" : ""}" href="${esc(href)}" title="${esc(p.hint)}"${active ? ' aria-current="true"' : ""}>${esc(p.label)}</a>`;
  }).join("")}
</div>`;
}
function sortBar(action, c, extra = "") {
  const dimensionOptions = (selected, skip) => DIMENSIONS.filter((d) => d.value !== skip || d.value === "").map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`).join("");
  const hidden = (name, value) => value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : "";
  return `<form class="sortbar" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="\u041D\u0430\u0437\u0432\u0430 \u0430\u0431\u043E \u0404\u0414\u0420\u041F\u041E\u0423" aria-label="\u041F\u043E\u0448\u0443\u043A">
  ${extra}
  ${hidden("risk", c.risk)}${hidden("region", c.region)}
  ${hidden("from", c.dateFrom)}${hidden("to", c.dateTo)}
  ${hidden("min", c.min > 0 ? String(c.min) : "")}${hidden("max", c.max > 0 ? String(c.max) : "")}
  ${c.railOnly ? '<input type="hidden" name="rail" value="1">' : ""}
  ${c.soloOnly ? '<input type="hidden" name="solo" value="1">' : ""}
  ${c.priceOnly ? '<input type="hidden" name="price" value="1">' : ""}
  ${c.audit ? `<input type="hidden" name="audit" value="${esc(c.audit)}">` : ""}

  <details class="sort-options">
  <summary>\u0421\u043E\u0440\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0442\u0430 \u0433\u0440\u0443\u043F\u0443\u0432\u0430\u043D\u043D\u044F</summary><div class="sort-options-fields">
  <label>\u0421\u043E\u0440\u0442\u0443\u0432\u0430\u043D\u043D\u044F
    <select name="sort">
      <option value="value"${c.sort === "value" ? " selected" : ""}>\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0441\u043F\u0430\u0434\u0430\u043D\u043D\u044F</option>
      <option value="value-asc"${c.sort === "value-asc" ? " selected" : ""}>\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0437\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F</option>
      <option value="date"${c.sort === "date" ? " selected" : ""}>\u043D\u043E\u0432\u0456\u0448\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</option>
      <option value="date-asc"${c.sort === "date-asc" ? " selected" : ""}>\u0441\u0442\u0430\u0440\u0456\u0448\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</option>
      <option value="assessed"${c.sort === "assessed" ? " selected" : ""}>\u043D\u0435\u0449\u043E\u0434\u0430\u0432\u043D\u043E \u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0456</option>
      <option value="risks"${c.sort === "risks" ? " selected" : ""}>\u0431\u0456\u043B\u044C\u0448\u0435 \u043E\u0437\u043D\u0430\u043A</option>
    </select>
  </label>

  <label>\u0413\u0440\u0443\u043F\u0443\u0432\u0430\u043D\u043D\u044F
    <select name="group">${dimensionOptions(c.group)}</select>
  </label>

  ${c.group ? `<label>\u043F\u043E\u0442\u0456\u043C
    <select name="then">${dimensionOptions(c.then, c.group)}</select>
  </label>` : ""}

  </div><button type="submit" class="sort-apply">\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0442\u0438</button></details>
  <button type="submit" class="go">\u0417\u043D\u0430\u0439\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 <span aria-hidden="true">\u2192</span></button>
</form>`;
}
function groupBlock(group, depth) {
  const inner = group.children.length > 0 ? group.children.map((child) => groupBlock(child, depth + 1)).join("") : `<div class="rows">${group.cases.slice(0, 20).map((c) => caseRow(c)).join("")}</div>${group.cases.length > 20 ? `<p class="hint" style="margin:.6rem 0 0">\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E 20 \u043D\u0430\u0439\u0434\u043E\u0440\u043E\u0436\u0447\u0438\u0445 \u0456\u0437 ${group.cases.length}.</p>` : ""}`;
  return `<details class="group-block depth-${depth}"${depth === 0 && group.cases.length <= 40 ? " open" : ""}>
  <summary>
    <span class="g-name">${esc(readableName(group.bucket.label))}</span>
    <span class="g-meta">${group.cases.length} ${plural(group.cases.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 ${shortMoney(group.value)}</span>
  </summary>
  <div class="g-body">
    ${group.bucket.href ? `<p class="hint" style="margin:0 0 .6rem"><a href="${esc(group.bucket.href)}">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043F\u043E\u0432\u043D\u0435 \u0434\u043E\u0441\u044C\u0454 \u2192</a></p>` : ""}
    ${inner}
  </div>
</details>`;
}
var bounds = null;
function datasetBounds() {
  const ds = dataset();
  if (bounds && bounds.of === ds) return bounds;
  let earliest = "";
  let latest = "";
  let lo = Infinity;
  let hi = 0;
  const regionSet = /* @__PURE__ */ new Set();
  for (const x of ds.cases) {
    const d = x.tender_date ?? "";
    if (d) {
      if (!earliest || d < earliest) earliest = d;
      if (d > latest) latest = d;
    }
    if (x.region) regionSet.add(x.region);
    const n = x.value_amount ?? 0;
    if (n > 0) {
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
  }
  bounds = {
    of: ds,
    earliest,
    latest,
    regions: [...regionSet].sort(),
    rangeHint: hi > 0 ? `\u0443 \u0431\u0430\u0437\u0456 \u0432\u0456\u0434 ${shortMoney(lo)} \u0434\u043E ${shortMoney(hi)}` : ""
  };
  return bounds;
}
function filterPanel(action, c, opts = {}, extra = "") {
  const { earliest, latest, regions } = datasetBounds();
  const selected = (v, current2) => v === current2 ? " selected" : "";
  const active = activeCount(c);
  return `<form class="filters" method="get" action="${esc(action)}">
 <input type="hidden" name="q" value="${esc(c.q)}"><input type="hidden" name="sort" value="${esc(c.sort)}"><input type="hidden" name="group" value="${esc(c.group)}"><input type="hidden" name="then" value="${esc(c.then)}">${extra}
 <details class="filters-more"><summary>\u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0438 \u043F\u043E\u0448\u0443\u043A${active ? ` <span class="badge">${active}</span>` : ""}</summary>
 <div class="filter-fieldsets">
 <fieldset><legend>\u0414\u0435 \u0448\u0443\u043A\u0430\u0442\u0438</legend><label>\u041E\u0431\u043B\u0430\u0441\u0442\u044C<select name="region"><option value="">\u0423\u0441\u044F \u0423\u043A\u0440\u0430\u0457\u043D\u0430</option>${regions.map((r) => `<option value="${esc(r)}"${selected(r, c.region)}>${esc(r)}</option>`).join("")}</select></label>
 ${opts.hideRail ? "" : `<label class="check"><input type="checkbox" name="rail" value="1"${c.railOnly ? " checked" : ""}>\u041B\u0438\u0448\u0435 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0457</label>`}</fieldset>
 <fieldset><legend>\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438</legend><label>\u041E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443<select name="risk"><option value="">\u0411\u0443\u0434\u044C-\u044F\u043A\u0430 \u043E\u0437\u043D\u0430\u043A\u0430</option>${dataset().rules.map((r) => `<option value="${esc(r.risk_id)}"${selected(r.risk_id, c.risk)}>${esc(shortRisk(r.risk_id))}</option>`).join("")}</select></label>
 <label>\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0438<select name="audit"><option value="">\u0411\u0443\u0434\u044C-\u044F\u043A\u0438\u0439 \u0430\u0431\u043E \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u0456\u0439</option><option value="violation"${selected("violation", c.audit)}>\u0414\u0410\u0421\u0423 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F</option><option value="clear"${selected("clear", c.audit)}>\u0414\u0410\u0421\u0423 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C</option></select></label>
 <label class="check"><input type="checkbox" name="solo" value="1"${c.soloOnly ? " checked" : ""}>\u041E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A</label>${opts.hidePrice ? "" : `<label class="check"><input type="checkbox" name="price" value="1"${c.priceOnly ? " checked" : ""}>\u0404 \u0446\u0456\u043D\u043E\u0432\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B</label>`}</fieldset>
 <fieldset><legend>\u041A\u043E\u043B\u0438 \u043E\u043F\u0443\u0431\u043B\u0456\u043A\u043E\u0432\u0430\u043D\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E</legend><label>\u0412\u0456\u0434 \u0434\u0430\u0442\u0438<input type="date" name="from" value="${esc(c.dateFrom)}" min="${esc(earliest)}" max="${esc(latest)}"></label><label>\u0414\u043E \u0434\u0430\u0442\u0438<input type="date" name="to" value="${esc(c.dateTo)}" min="${esc(earliest)}" max="${esc(latest)}"></label></fieldset>
 <fieldset><legend>\u0421\u0443\u043C\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0433\u0440\u043D</legend><label>\u041C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430<input type="number" name="min" min="0" step="any" inputmode="decimal" value="${c.min || ""}" placeholder="\u0411\u0435\u0437 \u043E\u0431\u043C\u0435\u0436\u0435\u043D\u043D\u044F"></label><label>\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430<input type="number" name="max" min="0" step="any" inputmode="decimal" value="${c.max || ""}" placeholder="\u0411\u0435\u0437 \u043E\u0431\u043C\u0435\u0436\u0435\u043D\u043D\u044F"></label></fieldset>
 </div><div class="filter-actions"><button type="submit">\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0442\u0438 \u0444\u0456\u043B\u044C\u0442\u0440\u0438</button><a href="${esc(action)}">\u0421\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0456 \u0444\u0456\u043B\u044C\u0442\u0440\u0438</a></div>
 </details></form>`;
}
function appliedFilters(action, c) {
  const chips = [];
  if (c.q) chips.push([`\u041F\u043E\u0448\u0443\u043A: ${c.q}`, { q: "" }]);
  if (c.region) chips.push([c.region, { region: "" }]);
  if (c.railOnly) chips.push(["\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F", { rail: "" }]);
  if (c.risk) chips.push([shortRisk(c.risk), { risk: "" }]);
  if (c.audit) chips.push([c.audit === "violation" ? "\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0410\u0421\u0423: \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F" : "\u0412\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0414\u0410\u0421\u0423: \u0431\u0435\u0437 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C", { audit: "" }]);
  if (c.priceOnly) chips.push(["\u0426\u0456\u043D\u043E\u0432\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B", { price: "" }]);
  if (c.soloOnly) chips.push(["\u041E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A", { solo: "" }]);
  if (c.dateFrom || c.dateTo) chips.push([`${c.dateFrom || "\u041F\u043E\u0447\u0430\u0442\u043E\u043A"} \u2014 ${c.dateTo || "\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456"}`, { from: "", to: "" }]);
  if (c.min || c.max) chips.push([`\u0421\u0443\u043C\u0430: ${c.min || 0} \u2014 ${c.max || "\u0431\u0435\u0437 \u043C\u0435\u0436\u0456"} \u0433\u0440\u043D`, { min: "", max: "" }]);
  return chips.length ? `<div class="applied-filters" aria-label="\u0417\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0430\u043D\u0456 \u0444\u0456\u043B\u044C\u0442\u0440\u0438"><span>\u0412\u0438 \u043E\u0431\u0440\u0430\u043B\u0438:</span>${chips.map(([label, over]) => `<a href="${esc(keepControls(action, c, { ...over, page: "1" }))}" aria-label="${esc("\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0444\u0456\u043B\u044C\u0442\u0440: " + label)}">${esc(label)} <span aria-hidden="true"> \xD7</span></a>`).join("")}</div>` : "";
}
function controlBar(action, c, opts = {}, params = {}) {
  const active = activeCount(c);
  const presets = params.url ? presetBar(action, params.url, c) : "";
  const extra = params.extra ?? "";
  return `<div class="control-panel">
  ${sortBar(action, c, extra)}
  ${presets}
  ${appliedFilters(action, c)}
  ${filterPanel(action, c, opts, extra)}
</div>`;
}
function resultLine(list, c, groupCount) {
  const value = list.reduce((sum2, x) => sum2 + (x.value_amount ?? 0), 0);
  const base = isFiltered(c) ? `\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u043D\u0430 ${shortMoney(value)}.` : `\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u043D\u0430 ${shortMoney(value)}.`;
  return `<p class="hint">${base}${c.group ? ` \u0417\u0433\u0440\u0443\u043F\u043E\u0432\u0430\u043D\u043E \u0443 <strong>${groupCount}</strong> ${plural(groupCount, "\u0433\u0440\u0443\u043F\u0443", "\u0433\u0440\u0443\u043F\u0438", "\u0433\u0440\u0443\u043F")}.` : ""}</p>`;
}
function listBody(list, c, action, rowOpts = {}, extra = {}) {
  const link = (over) => keepControls(action, c, { ...extra, ...over });
  const extraHidden = Object.entries(extra).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  if (list.length === 0) {
    const dropSearch = c.q ? ` <a href="${esc(keepControls(action, c, { q: "" }))}">\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0448\u0443\u043A \xAB${esc(c.q)}\xBB</a> \xB7` : "";
    return `<div class="empty">\u0417\u0430 \u0446\u0438\u043C\u0438 \u0443\u043C\u043E\u0432\u0430\u043C\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u043E\u0441\u044F.<br>${dropSearch} <a href="${esc(action)}">\u0421\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0456 \u0444\u0456\u043B\u044C\u0442\u0440\u0438</a></div>`;
  }
  if (c.group) {
    const groups2 = buildGroups(list, c.group, c.then, shortRisk);
    const shown = groups2.slice(0, MAX_GROUPS);
    const hidden = groups2.length - shown.length;
    return `${resultLine(list, c, groups2.length)}${shown.map((g) => groupBlock(g, 0)).join("")}${hidden > 0 ? `<p class="note">\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${MAX_GROUPS} \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 ${plural(MAX_GROUPS, "\u0433\u0440\u0443\u043F\u0443", "\u0433\u0440\u0443\u043F\u0438", "\u0433\u0440\u0443\u043F")} \u0456\u0437 ${groups2.length.toLocaleString("uk-UA")}. \u0417\u0432\u0443\u0437\u044C\u0442\u0435 \u0432\u0438\u0431\u0456\u0440\u043A\u0443 \u0444\u0456\u043B\u044C\u0442\u0440\u0430\u043C\u0438, \u0449\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0440\u0435\u0448\u0442\u0443.</p>` : ""}`;
  }
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page3 = Math.min(c.page, pages);
  const slice = list.slice((page3 - 1) * PAGE_SIZE, page3 * PAGE_SIZE);
  return `${resultLine(list, c, 0)}
<div class="rows">${slice.map((x) => caseRow(x, rowOpts)).join("")}</div>
${pages > 1 ? `<nav class="pager compact-pager" aria-label="\u0421\u0442\u043E\u0440\u0456\u043D\u043A\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456\u0432">
  ${page3 > 1 ? `<a class="page-step" href="${link({ page: String(page3 - 1) })}" aria-label="\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430">\u2190</a>` : '<span class="page-step" aria-disabled="true">\u2190</span>'}
  <form class="jump" method="get" action="${esc(action)}">${hiddenControls(c, esc)}${extraHidden}<label><input type="number" name="page" value="${page3}" min="1" max="${pages}" aria-label="\u041D\u043E\u043C\u0435\u0440 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438"><span> / ${pages.toLocaleString("uk-UA")}</span></label><button type="submit" aria-label="\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0434\u043E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438" title="\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0434\u043E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438">\u21B5</button></form>
  ${page3 < pages ? `<a class="page-step" href="${link({ page: String(page3 + 1) })}" aria-label="\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0430 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430">\u2192</a>` : '<span class="page-step" aria-disabled="true">\u2192</span>'}
</nav>` : ""}`;
}

// server/pages/feed.ts
function feedPage(url) {
  const c = readControls(url);
  const ds = dataset();
  const list = applyControls(ds.cases, c, RAILWAY_EDRPOU);
  const latest = [...ds.runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const scope = c.railOnly ? "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F" : c.region || "\u0423\u0441\u044F \u0423\u043A\u0440\u0430\u0457\u043D\u0430";
  const scopes = [
    { label: "\u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0430", region: REGION, rail: "", active: c.region === REGION && !c.railOnly },
    { label: "\u0423\u043A\u0440\u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F", region: "", rail: "1", active: c.railOnly && !c.region },
    { label: "\u0423\u0441\u044F \u0423\u043A\u0440\u0430\u0457\u043D\u0430", region: "", rail: "", active: !c.region && !c.railOnly }
  ];
  const full = list.filter((x) => x.detailed).length;
  const signals = list.reduce((n, x) => n + x.findings.length, 0);
  return layout({ title: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", nav: "feed", body: `
<section class="studio-hero">
 <div class="studio-copy"><span class="studio-eyebrow">\u0422\u0435\u043D\u0434\u043EScope / \u041C\u041E\u041D\u0406\u0422\u041E\u0420\u0418\u041D\u0413 \u0417\u0410\u041A\u0423\u041F\u0406\u0412\u0415\u041B\u042C</span><h1>\u041F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u043A\u043E\u0448\u0442\u0438.<br><span>\u041F\u0440\u043E\u0437\u043E\u0440\u0456 \u0440\u0456\u0448\u0435\u043D\u043D\u044F.</span></h1><p>\u0417\u043D\u0430\u0439\u0434\u0456\u0442\u044C \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0441\u0438\u0433\u043D\u0430\u043B\u0438 \u0440\u0438\u0437\u0438\u043A\u0443 \u0442\u0430 \u0432\u0456\u0434\u043A\u0440\u0438\u0439\u0442\u0435 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E.</p><a class="studio-help" href="/about">\u042F\u043A \u043F\u0440\u0430\u0446\u044E\u0454 \u0440\u0430\u0434\u0430\u0440 <span aria-hidden="true">\u2197</span></a></div>
 <div class="studio-visual" aria-label="\u0414\u0430\u043D\u0456 \u043F\u043E\u0442\u043E\u0447\u043D\u043E\u0457 \u0432\u0438\u0431\u0456\u0440\u043A\u0438"><div class="studio-orbit" aria-hidden="true"></div><div class="studio-stat"><span>\u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u0406 \u0412 \u041F\u041E\u0422\u041E\u0427\u041D\u0406\u0419 \u0412\u0418\u0411\u0406\u0420\u0426\u0406</span><strong>${list.length.toLocaleString("uk-UA")}</strong><small>\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0434\u0430\u043D\u0456 \u0434\u043B\u044F \u0432\u0430\u0448\u043E\u0457 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438</small><div class="studio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="studio-signal"><span class="studio-dot" aria-hidden="true"></span><div><strong>${signals.toLocaleString("uk-UA")} \u0446\u0456\u043D\u043E\u0432\u0438\u0445 \u0441\u0438\u0433\u043D\u0430\u043B\u0456\u0432</strong><small>\u0421\u0438\u0433\u043D\u0430\u043B \u2014 \u043F\u0440\u0438\u0432\u0456\u0434 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438, \u0430 \u043D\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F</small></div></div></div>
</section>
<section class="studio-workspace" aria-label="\u041F\u043E\u0448\u0443\u043A \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C">
<div class="results-heading"><h2 id="results-heading">\u0417\u043D\u0430\u0439\u0434\u0456\u0442\u044C \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E</h2><span>\u0412\u0456\u0434 \u043F\u043E\u0448\u0443\u043A\u0443 \u0434\u043E \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u0430</span></div>
<nav class="scope-nav" aria-label="\u0422\u0435\u0440\u0438\u0442\u043E\u0440\u0456\u044F \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443">${scopes.map((s) => `<a href="${esc(keepControls("/", c, { region: s.region, rail: s.rail, page: "1" }))}"${s.active ? ' aria-current="page"' : ""}>${s.label}</a>`).join("")}</nav>
<div class="scope-caption"><span>${esc(scope)} \xB7 \u043F\u043E\u0442\u043E\u0447\u043D\u0430 \u0432\u0438\u0431\u0456\u0440\u043A\u0430</span><a href="/updates">${latest ? `\u041E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 \u0437\u0430\u043F\u0443\u0441\u043A: ${shortDate(latest.started_at)}${latest.status !== "ok" || latest.errors ? " \xB7 \u0454 \u043F\u043E\u043C\u0438\u043B\u043A\u0438" : ""}` : "\u0406\u0441\u0442\u043E\u0440\u0456\u044F \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u044C"}</a></div>

<section class="radar-results" aria-labelledby="results-heading">

${controlBar("/", c, {}, { url })}
<details class="data-overview"><summary>\u041E\u0433\u043B\u044F\u0434 \u0434\u0430\u043D\u0438\u0445: \u0441\u0443\u043C\u0438, \u0441\u0438\u0433\u043D\u0430\u043B\u0438 \u0442\u0430 \u043F\u043E\u0432\u043D\u043E\u0442\u0430 \u043A\u0430\u0440\u0442\u043E\u043A</summary><section class="radar-metrics" aria-label="\u041F\u043E\u043A\u0430\u0437\u043D\u0438\u043A\u0438 \u043F\u043E\u0442\u043E\u0447\u043D\u043E\u0457 \u0432\u0438\u0431\u0456\u0440\u043A\u0438">
 <div><span>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0443 \u0432\u0438\u0431\u0456\u0440\u0446\u0456</span><strong>${list.length.toLocaleString("uk-UA")}</strong><small>\u0417 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u0442\u0430 \u0431\u0435\u0437 \u043D\u0438\u0445</small></div>
 <div><span>\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C</span><strong>${shortMoney(list.reduce((n, x) => n + (x.value_amount ?? 0), 0))}</strong><small>\u041E\u0431\u0441\u044F\u0433 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C, \u043D\u0435 \u0437\u0431\u0438\u0442\u043A\u0438</small></div>
 <div><span>\u0426\u0456\u043D\u043E\u0432\u0456 \u0441\u0438\u0433\u043D\u0430\u043B\u0438</span><strong>${signals.toLocaleString("uk-UA")}</strong><small>\u041F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0430\u043D\u0430\u043B\u043E\u0433\u0456\u0432</small></div>
 <div><span>\u0417 \u0434\u0435\u0442\u0430\u043B\u044F\u043C\u0438 \u0443 \u0441\u043F\u0438\u0441\u043A\u0443</span><strong>${full.toLocaleString("uk-UA")} <em>/ ${list.length.toLocaleString("uk-UA")}</em></strong><small>${full === list.length ? "\u0414\u0435\u0442\u0430\u043B\u0456 \u0454 \u0434\u043B\u044F \u0432\u0441\u0456\u0454\u0457 \u0432\u0438\u0431\u0456\u0440\u043A\u0438" : "\u0420\u0435\u0448\u0442\u0430 \u043C\u043E\u0436\u0443\u0442\u044C \u043C\u0430\u0442\u0438 \u043D\u0435\u043F\u043E\u0432\u043D\u0456 \u0434\u0430\u043D\u0456"}</small></div>
</section></details>
${c.risk ? riskCard(c.risk) : ""}
${listBody(list, c, "/")}
</section></section>` });
}

// src/documents/types.ts
function allowedDocumentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (["public-docs.prozorro.gov.ua", "swift-prod.prozorro.gov.ua"].includes(url.hostname) || url.hostname === "public-api.prozorro.gov.ua" && /^\/api\/2\.5\/contracts\/[a-f0-9]{32}\/documents\/[a-f0-9]{32}$/.test(url.pathname)) && !url.username && !url.password && (!url.port || url.port === "443");
  } catch {
    return false;
  }
}

// server/components/document-prices.ts
function documentPriceSection(checks) {
  if (!checks.length) return "";
  const link = (url) => {
    try {
      return new URL(url).origin === "https://market-api.prozorro.gov.ua";
    } catch {
      return false;
    }
  };
  return `<section class="document-results"><h2>\u0426\u0456\u043D\u0438 \u0437 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432</h2><p class="hint">\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u043E\u0440\u0456\u0454\u043D\u0442\u0438\u0440 Prozorro Market. \u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0435 \u0454 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u043C \u0437\u0431\u0438\u0442\u043A\u043E\u043C.</p>${checks.map((r) => `<details class="detail-fold"><summary><span><small>${r.status === "signal" ? "\u041C\u043E\u0436\u043B\u0438\u0432\u0435 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043D\u044F" : r.status === "limited" ? "\u041C\u0430\u043B\u0430 \u0432\u0438\u0431\u0456\u0440\u043A\u0430 \xB7 \u043B\u0438\u0448\u0435 \u0434\u043E\u0432\u0456\u0434\u043A\u043E\u0432\u0438\u0439 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A" : r.status === "compared" ? "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043E \xB7 \u043F\u043E\u0440\u0456\u0433 \u0441\u0438\u0433\u043D\u0430\u043B\u0443 \u043D\u0435 \u043F\u0435\u0440\u0435\u0432\u0438\u0449\u0435\u043D\u043E" : "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043D\u044C\u043E \u0434\u0430\u043D\u0438\u0445 \u0434\u043B\u044F \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F"}</small><strong>${esc(r.description)}</strong></span></summary><div class="detail-fold-body">${r.reference ? `<dl class="facts"><dt>\u0426\u0456\u043D\u0430 \u0434\u043B\u044F \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F</dt><dd>${money(r.unit_price ?? null)} / ${esc(r.unit ?? "")}</dd><dt>\u041C\u0435\u0434\u0456\u0430\u043D\u0430 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443</dt><dd>${money(r.reference.median)}</dd><dt>\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C</dt><dd>${r.quantity}</dd><dt>\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E</dt><dd>${money(r.difference_per_unit ?? null)}</dd><dt>\u0420\u0456\u0437\u043D\u0438\u0446\u044F \xD7 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C</dt><dd>${money(r.comparison_difference ?? null)} (${r.difference_percent}%)</dd><dt>\u041F\u0414\u0412</dt><dd>${r.vat ? "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0432 \u043E\u0431\u0438\u0434\u0432\u0456 \u0446\u0456\u043D\u0438" : "\u041E\u0431\u0438\u0434\u0432\u0456 \u0446\u0456\u043D\u0438 \u0431\u0435\u0437 \u041F\u0414\u0412"}</dd><dt>\u041E\u0440\u0456\u0454\u043D\u0442\u0438\u0440 \u0432\u0456\u0434</dt><dd>${esc(r.reference.date.slice(0, 10))} \xB7 ${r.reference.sample_size} \u0441\u043F\u043E\u0441\u0442\u0435\u0440\u0435\u0436\u0435\u043D\u044C</dd></dl><p>${link(r.reference.source_url) ? `<a href="${esc(r.reference.source_url)}" target="_blank" rel="noopener">\u0414\u0436\u0435\u0440\u0435\u043B\u043E \u0446\u0456\u043D\u0438 \u2197</a>` : ""} \xB7 ${link(r.reference.product_url) ? `<a href="${esc(r.reference.product_url)}" target="_blank" rel="noopener">\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u0442\u043E\u0432\u0430\u0440\u0443 \u2197</a>` : ""}</p>` : ""}${r.normalization ? `<p>\u0423 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456: ${r.document_unit_price} \u20B4/\u043E\u0434. \u0414\u043B\u044F \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F: ${r.unit_price} \u20B4/\u043E\u0434.</p>` : ""}${r.contract_url && /^https:\/\/public-api\.prozorro\.gov\.ua\/api\/2\.5\/contracts\/[a-f0-9]{32}$/.test(r.contract_url) ? `<p><a href="${esc(r.contract_url)}" target="_blank" rel="noopener">\u0414\u0430\u043D\u0456 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443: \u0442\u043E\u0432\u0430\u0440, \u0432\u0430\u043B\u044E\u0442\u0430 \u0442\u0430 \u041F\u0414\u0412 \u2197</a></p>` : ""}${r.reasons.map((s) => `<p>${esc(s)}</p>`).join("")}${allowedDocumentUrl(r.document_url) ? `<p><a href="${esc(r.document_url)}" target="_blank" rel="noopener">${esc(r.document_title)} \u2197</a></p>` : ""}<details><summary>\u0426\u0438\u0442\u0430\u0442\u0438 \u0434\u043B\u044F \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043A\u0443</summary>${r.quotes.filter((c) => ["unit_price", "quantity", "unit", "currency", "vat"].includes(c.field)).map((c) => `<blockquote>${esc(c.quote)}<br><small>${r.locator_kind === "fragment" ? "\u0424\u0440\u0430\u0433\u043C\u0435\u043D\u0442" : "\u0421\u0442\u043E\u0440."} ${c.page}${c.method === "ocr" ? " \xB7 OCR" : ""}</small></blockquote>`).join("")}</details></div></details>`).join("")}</section>`;
}

// server/components/documents.ts
function documentSection(rows) {
  const labels = { description: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442", quantity: "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C", unit: "\u041E\u0434\u0438\u043D\u0438\u0446\u044F", unit_price: "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E", currency: "\u0412\u0430\u043B\u044E\u0442\u0430", vat: "\u041F\u0414\u0412", delivery: "\u041F\u043E\u0441\u0442\u0430\u0432\u043A\u0430", specification: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438" };
  const statuses = { ready: "\u0412\u0438\u0442\u044F\u0433 \u0433\u043E\u0442\u043E\u0432\u0438\u0439", partial: "\u0427\u0430\u0441\u0442\u043A\u043E\u0432\u0438\u0439 \u0432\u0438\u0442\u044F\u0433", error: "\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043E\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438", unsupported: "\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u044C\u0442\u0435 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B" };
  return `<section class="document-results"><h2>\u0424\u0430\u043A\u0442\u0438 \u0437 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432</h2><p class="hint">${rows.length ? "\u0426\u0438\u0442\u0430\u0442\u0438 \u0437\u0432\u0456\u0440\u0435\u043D\u043E \u0437 \u0432\u0438\u0442\u044F\u0433\u043D\u0443\u0442\u0438\u043C \u0442\u0435\u043A\u0441\u0442\u043E\u043C. \u0417\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0442\u0430 OCR \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0432 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B\u0456." : "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0449\u0435 \u043D\u0435 \u043E\u043F\u0440\u0430\u0446\u044C\u043E\u0432\u0430\u043D\u0456."}</p>${rows.map((row) => `<details class="detail-fold"><summary><span><small>${statuses[row.status]} \xB7 ${row.processed_pages}/${row.page_count || "?"} ${row.locator_kind === "fragment" ? "\u0444\u0440\u0430\u0433\u043C." : "\u0441\u0442\u043E\u0440."}</small><strong>${esc(row.document.title)}</strong></span></summary><div class="detail-fold-body"><p>${esc(row.status === "error" ? "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0435 \u043E\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E. \u0412\u0456\u0434\u043A\u0440\u0438\u0439\u0442\u0435 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B." : row.message)}</p>${row.claims.length ? row.claims.map((c) => `<div class="document-fact"><strong>${esc(labels[c.field] ?? c.field)}: ${esc(c.value)}</strong><p class="hint">\u041F\u043E\u0437\u0438\u0446\u0456\u044F ${esc(c.item_id)} \xB7 ${row.locator_kind === "fragment" ? "\u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442" : "\u0441\u0442\u043E\u0440."} ${c.page}${c.method === "ocr" ? " \xB7 OCR \u2014 \u0437\u0432\u0456\u0440\u0442\u0435 \u0437\u0456 \u0441\u043A\u0430\u043D\u043E\u043C" : ""}</p><blockquote>${esc(c.quote)}</blockquote>${allowedDocumentUrl(row.document.url) ? `<a href="${esc(row.document.url)}${row.locator_kind === "fragment" ? "" : "#page=" + c.page}" target="_blank" rel="noopener">${row.locator_kind === "fragment" ? "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B\u0456" : "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443"} \u2197</a>` : ""}</div>`).join("") : "<p>\u041D\u0435\u043C\u0430\u0454 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0438\u0445 \u0432\u0438\u0442\u044F\u0433\u043E\u043C \u0444\u0430\u043A\u0442\u0456\u0432. \u0426\u0435 \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u043E\u0441\u0442\u0456 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0435\u0439.</p>"}${allowedDocumentUrl(row.document.url) ? `<p><a href="${esc(row.document.url)}" target="_blank" rel="noopener">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B \u2197</a></p>` : ""}</div></details>`).join("")}</section>`;
}

// server/components/verdict.ts
function qualificationBlock(entry) {
  const q = buildQualification(entry, dataset().ruleById);
  return `<p class="caution">${esc(q.caution)}</p>

<h3 class="block-head">\u041D\u043E\u0440\u043C\u0438, \u044F\u043A\u0456 \u0437\u0430\u0447\u0435\u043F\u043B\u0435\u043D\u0456</h3>
${q.norms.map(
    (n) => `<div class="card">
  <p class="${n.source === "state" ? "legal" : "legal reading"}"><strong>${n.source === "state" ? "\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430" : "\u041D\u043E\u0440\u043C\u0430 \u2014 \u043D\u0430\u0448\u0435 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F"}:</strong> ${esc(n.norm)}</p>
  ${n.note ? `<p class="faint">${esc(n.note)}</p>` : ""}
  <p class="faint">\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${n.from.map((f) => esc(f)).join(" \xB7 ")}</p>
</div>`
  ).join("")}

<h3 class="block-head">\u0429\u043E \u0437 \u0446\u044C\u043E\u0433\u043E \u0432\u0438\u043F\u043B\u0438\u0432\u0430\u0454 \u0437\u0430 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h3>
${q.consequences.map(
    (c) => `<div class="card">
  <h3>${esc(c.norm)}</h3>
  <p class="lead">${esc(c.effect)}</p>
</div>`
  ).join("")}

<h3 class="block-head">\u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456\u0441\u0442\u044C</h3>
${q.admin.map(
    (a) => `<div class="card">
  <h3>\u0421\u0442\u0430\u0442\u0442\u044F 164-14 \u041A\u0423\u043F\u0410\u041F, ${esc(a.part)}</h3>
  <p class="lead">${esc(a.conduct)}</p>
  <dl class="facts">
    <dt>\u0421\u0430\u043D\u043A\u0446\u0456\u044F</dt><dd><strong>${esc(a.fine)}</strong> \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u0442\u0430 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0438\u0445 \u043E\u0441\u0456\u0431 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430</dd>
    <dt>\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430</dt><dd>${a.from.map((f) => esc(f)).join(" \xB7 ")}</dd>
  </dl>
  <p class="faint">\u0420\u043E\u0437\u043C\u0456\u0440 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u0432 \u043D\u0435\u043E\u043F\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0443\u0432\u0430\u043D\u0438\u0445 \u043C\u0456\u043D\u0456\u043C\u0443\u043C\u0430\u0445 \u0434\u043E\u0445\u043E\u0434\u0456\u0432 \u0433\u0440\u043E\u043C\u0430\u0434\u044F\u043D; \u0434\u043B\u044F \u0448\u0442\u0440\u0430\u0444\u0456\u0432 \u0446\u044F \u043E\u0434\u0438\u043D\u0438\u0446\u044F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C 17 \u0433\u0440\u043D.</p>
</div>`
  ).join("")}

<h3 class="block-head">\u041A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u043E-\u043F\u0440\u0430\u0432\u043E\u0432\u0456 \u043D\u0430\u043F\u0440\u044F\u043C\u0438</h3>
<p class="hint">\u0414\u043B\u044F \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043D\u0430\u043F\u0440\u044F\u043C\u0443 \u2014 \u0449\u043E \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u0438 \u0456 \u044F\u043A\u0438\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438.</p>
${q.criminal.map(
    (c) => `<div class="card">
  <h3>\u0421\u0442\u0430\u0442\u0442\u044F ${esc(c.code)} \u041A\u041A\u0423 \u2014 ${esc(c.title)}</h3>
  <p class="lead">${esc(c.summary)}</p>
  <p><strong>\u0427\u043E\u043C\u0443 \u0446\u0435\u0439 \u043D\u0430\u043F\u0440\u044F\u043C \u0432\u0438\u043D\u0438\u043A\u0430\u0454 \u0441\u0430\u043C\u0435 \u0442\u0443\u0442:</strong></p>
  <ul>${c.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
  <details class="sub">
    <summary>\u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E \u0442\u0430 \u044F\u043A\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438</summary>
    <div class="inner">
      <p><strong>\u0421\u043A\u043B\u0430\u0434:</strong></p>
      <ul>${c.elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <p><strong>\u0414\u043E\u043A\u0430\u0437\u0438:</strong></p>
      <ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>
  </details>
</div>`
  ).join("")}`;
}

// server/pages/static.ts
function starredPage(saved, url) {
  const tenders = saved.filter((f) => f.kind === "tender").map((f) => dataset().byTender.get(f.id)).filter((c2) => Boolean(c2));
  const missingTenders = saved.filter((f) => f.kind === "tender").length - tenders.length;
  const c = readControls(url);
  const filteredTenders = applyControls(tenders, c, RAILWAY_EDRPOU);
  const companyRows = saved.filter((f) => f.kind === "entity" || f.kind === "supplier").map((f) => {
    const list = f.kind === "entity" ? dataset().cases.filter((c2) => c2.entity_edrpou === f.id) : dataset().cases.filter((c2) => c2.winner_edrpou === f.id);
    const name = f.kind === "entity" ? list.find((c2) => c2.entity_name)?.entity_name : list.find((c2) => c2.winner_name)?.winner_name;
    return {
      fav: f,
      href: `/${f.kind === "entity" ? "entity" : "supplier"}/${encodeURIComponent(f.id)}`,
      name: readableName(name ?? "") || f.id,
      role: f.kind === "entity" ? "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A" : "\u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A",
      count: list.length,
      value: list.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0)
    };
  });
  const officerRows2 = saved.filter((f) => f.kind === "officer").map((f) => {
    const list = dataset().cases.filter((c2) => c2.officer_key === f.id);
    return {
      fav: f,
      href: `/officer/${encodeURIComponent(f.id)}`,
      name: list.find((c2) => c2.officer_name)?.officer_name ?? f.id,
      entity: readableName(list.find((c2) => c2.entity_name)?.entity_name ?? ""),
      count: list.length,
      value: list.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0)
    };
  });
  const section = (title, count, inner) => count === 0 ? "" : `<h2>${esc(title)} \u2014 ${count}</h2>${inner}`;
  return layout({
    title: "\u041E\u0431\u0440\u0430\u043D\u0435",
    nav: "starred",
    body: `
<h1>\u041E\u0431\u0440\u0430\u043D\u0435</h1>
<p class="sub">\u0423\u0441\u0435, \u0449\u043E \u0432\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0438 \u0437\u0456\u0440\u043E\u0447\u043A\u043E\u044E: \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438, \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0438, \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456. \u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0443 \u0432\u0430\u0448\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456 \u0439 \u043D\u0435 \u043F\u0440\u0438\u0432'\u044F\u0437\u0430\u043D\u0438\u0439 \u0434\u043E \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0441\u0443.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" placeholder="\u0417\u043D\u0430\u0439\u0442\u0438 \u043F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u043E \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423 \u2014 \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 00131954" aria-label="\u0404\u0414\u0420\u041F\u041E\u0423" inputmode="numeric">
    <button type="submit">\u0417\u043D\u0430\u0439\u0442\u0438</button>
  </div>
</form>

${saved.length === 0 ? `<div class="empty">\u041F\u043E\u043A\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u043E. \u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u2606 \u0431\u0456\u043B\u044F \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457 \u0447\u0438 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u044F.</div>` : ""}

${section(
      "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
      tenders.length,
      `${controlBar("/starred", c)}${listBody(filteredTenders, c, "/starred")}${missingTenders > 0 ? `<p class="note">${missingTenders} ${plural(missingTenders, "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u0430", "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u0456", "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E")} \u0432 \u0431\u0430\u0437\u0456.</p>` : ""}`
    )}

${section(
      "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u0457",
      companyRows.length,
      `<div class="rows">${companyRows.map(
        (r) => `<div class="row">
  <div class="who">
    <div class="name">${star(r.fav.kind, r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(r.fav.id)} \xB7 ${esc(r.role)} \xB7 ${r.count} ${plural(r.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
      ).join("")}</div>`
    )}

${section(
      "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
      officerRows2.length,
      `<div class="rows">${officerRows2.map(
        (r) => `<div class="row">
  <div class="who">
    <div class="name">${star("officer", r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${esc(r.entity)} \xB7 ${r.count} ${plural(r.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
      ).join("")}</div>`
    )}
`
  });
}
function indicatorsPage() {
  const counted = new Map(rankRisks(dataset().cases));
  const ranked = dataset().rules.map((r) => [r.risk_id, counted.get(r.risk_id) ?? 0]).sort((a, b) => b[1] - a[1]);
  return layout({
    title: "\u0429\u043E \u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u043C\u043E",
    nav: "indicators",
    body: `
<h1>\u0429\u043E \u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u043C\u043E</h1>
<p class="sub">${dataset().rules.length} \u043E\u0437\u043D\u0430\u043A, \u0437\u0430 \u044F\u043A\u0438\u043C\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u043A\u043E\u0436\u043D\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E. \u041D\u0438\u0436\u0447\u0435 \u2014 \u0449\u043E \u043A\u043E\u0436\u043D\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u043E\u044E \u043C\u043E\u0432\u043E\u044E \u0456 \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0440\u0430\u0437\u0456\u0432 \u0432\u043E\u043D\u0430 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0430 \u043F\u043E \u0432\u0441\u0456\u0439 \u0423\u043A\u0440\u0430\u0457\u043D\u0456.</p>
${groupedRiskCards(ranked)}
`
  });
}
function aboutPage() {
  return layout({
    title: "\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
    nav: "about",
    body: `
<h1>\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443</h1>
<p class="sub">\u0429\u043E \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u0446\u0435\u0439 \u0441\u0430\u0439\u0442, \u0437\u0432\u0456\u0434\u043A\u0438 \u0431\u0435\u0440\u0435 \u0434\u0430\u043D\u0456 \u0456 \u0447\u043E\u0433\u043E \u043D\u0435 \u0440\u043E\u0431\u0438\u0442\u044C.</p>

<div class="card">
  <h3>\u0417\u0432\u0456\u0434\u043A\u0438 \u0434\u0430\u043D\u0456</h3>
  <p class="lead">\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u0440\u0438\u0437\u0438\u043A\u0443 Prozorro \u2014 \u043D\u0430\u043A\u0430\u0437 \u041C\u0456\u043D\u0444\u0456\u043D\u0443 \u2116 476 \u0432\u0456\u0434 27 \u0432\u0435\u0440\u0435\u0441\u043D\u044F 2024 \u0440\u043E\u043A\u0443. \u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u043A\u043E\u0436\u043D\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0437\u0430 \u0447\u0438\u043D\u043D\u0438\u043C \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u043E\u043C \u043E\u0437\u043D\u0430\u043A \u0456 \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E.</p>
  <p>\u041C\u0438 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u043C\u043E \u0446\u0435\u0439 \u043C\u0430\u0441\u0438\u0432 \u043F\u043E \u0432\u0441\u0456\u0439 \u0423\u043A\u0440\u0430\u0457\u043D\u0456 \u0439 \u0434\u043E\u043F\u043E\u0432\u043D\u044E\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u043A\u0430\u043C\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 Prozorro \u2014 \u0437\u0432\u0456\u0434\u043A\u0438 \u0431\u0435\u0440\u0435\u043C\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0443 \u043E\u0441\u043E\u0431\u0443, \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0456 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F. \u041A\u0430\u0440\u0442\u043A\u0438 \u0432\u0436\u0435 \u0454 \u0434\u043B\u044F ${esc(REGION)} \u0442\u0430 \u0444\u0456\u043B\u0456\u0439 \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB, \u0440\u0435\u0448\u0442\u0430 \u043A\u0440\u0430\u0457\u043D\u0438 \u0434\u043E\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u043F\u043E\u0441\u0442\u0443\u043F\u043E\u0432\u043E; \u043F\u043E\u043A\u0438 \u043A\u0430\u0440\u0442\u043A\u0438 \u043D\u0435\u043C\u0430\u0454, \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u043B\u0438\u0448\u0435 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u0438.</p>
</div>

<div class="card">
  <h3>\u0422\u0440\u0438 \u0440\u0456\u0432\u043D\u0456 \u0434\u043E\u0441\u0442\u043E\u0432\u0456\u0440\u043D\u043E\u0441\u0442\u0456</h3>
  <p><span class="tier confirmed">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430 \u043F\u0440\u043E\u0432\u0435\u043B\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0456 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
  <p><span class="tier state">\u041F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;\u0421\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438. \u0426\u0435 \u043F\u0456\u0434\u043E\u0437\u0440\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F\u043C \u043D\u0430 \u043D\u043E\u0440\u043C\u0443 \u0437\u0430\u043A\u043E\u043D\u0443 \u2014 \u0441\u0430\u043C\u0435 \u0446\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043E \u043D\u0430 \u0441\u0430\u0439\u0442\u0456 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456.</p>
  <p><span class="tier own">\u041F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043C\u0438</span> &nbsp;\u041D\u0430\u0448 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A: \u0446\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u043F\u0440\u043E\u0442\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0436\u043D\u043E\u0457. \u041F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u0454\u0442\u044C\u0441\u044F \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u043C \u0435\u0442\u0430\u043F\u043E\u043C.</p>
  <p>\u041D\u0438\u0436\u0447\u0438\u0439 \u0440\u0456\u0432\u0435\u043D\u044C \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u043F\u043E\u0434\u0430\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0432\u0438\u0449\u0438\u0439.</p>
</div>

<div class="card">
  <h3>\u041F\u0440\u043E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456\u0432</h3>
  <p>\u0406\u043C'\u044F, \u043F\u043E\u0448\u0442\u0430 \u0439 \u0442\u0435\u043B\u0435\u0444\u043E\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0432\u0437\u044F\u0442\u0456 \u0437 \u043A\u0430\u0440\u0442\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u0457\u0445 \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454. \u041E\u0434\u043D\u0443 \u043B\u044E\u0434\u0438\u043D\u0443 \u043C\u0456\u0436 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0437\u0430 \u043F\u043E\u0448\u0442\u043E\u044E, \u0431\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0456\u043C\u0435\u043D\u0456 \u0440\u0456\u0437\u043D\u0438\u0442\u044C\u0441\u044F.</p>
  <p>\u0421\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u044F \u043F\u043E\u043A\u0430\u0437\u0443\u0454, \u0443 \u0441\u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u0439\u043E\u0433\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u0456 \u0437\u0430 \u044F\u043A\u0438\u043C\u0438 \u043D\u043E\u0440\u043C\u0430\u043C\u0438 \u0437\u0430\u043A\u043E\u043D\u0443. <strong>\u0426\u0435 \u043D\u0435 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0432\u0438\u043D\u0430.</strong></p>
</div>

<div class="card">
  <h3>\u0427\u043E\u043C\u0443 \u0442\u0443\u0442 \u043D\u0435\u043C\u0430\u0454 \u0441\u0443\u0434\u0438\u043C\u043E\u0441\u0442\u0435\u0439</h3>
  <p>\u0404\u0434\u0438\u043D\u0438\u0439 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0439 \u0440\u0435\u0454\u0441\u0442\u0440 \u0441\u0443\u0434\u043E\u0432\u0438\u0445 \u0440\u0456\u0448\u0435\u043D\u044C \u0437\u0430\u043A\u0440\u0438\u0442\u0438\u0439 CAPTCHA, \u0430 \u0432 \u0442\u0435\u043A\u0441\u0442\u0430\u0445 \u043A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u0438\u0445 \u0440\u0456\u0448\u0435\u043D\u044C \u0456\u043C\u0435\u043D\u0430 \u0437\u0430\u043C\u0456\u043D\u0435\u043D\u0456 \u043D\u0430 \xAB\u041E\u0421\u041E\u0411\u0410_1\xBB \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E \u0434\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u0445\u0438\u0441\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445. \u0417\u0456\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456\u0437 \u043B\u044E\u0434\u0438\u043D\u043E\u044E \u0437\u0430 \u0437\u0431\u0456\u0433\u043E\u043C \u043F\u0440\u0456\u0437\u0432\u0438\u0449\u0430 \u043D\u0435\u043C\u043E\u0436\u043B\u0438\u0432\u043E \u043D\u0430\u0434\u0456\u0439\u043D\u043E, \u0430 \u043F\u043E\u043C\u0438\u043B\u043A\u0430 \u0442\u0443\u0442 \u2014 \u0446\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F \u043D\u0435\u0432\u0438\u043D\u043D\u043E\u0433\u043E.</p>
  <p>\u0422\u043E\u043C\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u043B\u0438\u0448\u0435 \u0442\u0435, \u0449\u043E \u043C\u043E\u0436\u043D\u0430 \u0434\u043E\u0432\u0435\u0441\u0442\u0438: \u044F\u043A\u0456 \u043E\u0437\u043D\u0430\u043A\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0432\u0438\u044F\u0432\u0438\u043B\u0430 \u0432 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.</p>
</div>

<div class="card">
  <h3>\u0427\u043E\u0433\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0435 \u0440\u043E\u0431\u0438\u0442\u044C</h3>
  <p>\u0412\u043E\u043D\u0430 \u043D\u0435 \u043E\u0433\u043E\u043B\u043E\u0448\u0443\u0454 \u0432\u0438\u043D\u0443 \u0456 \u043D\u0435 \u043D\u0430\u0437\u0438\u0432\u0430\u0454 \u0436\u043E\u0434\u043D\u0443 \u0444\u0456\u0440\u043C\u0443 \u0447\u0438 \u043B\u044E\u0434\u0438\u043D\u0443 \u0437\u043B\u043E\u0447\u0438\u043D\u0446\u0435\u043C. \u0412\u043E\u043D\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u043E\u0437\u043D\u0430\u043A\u0438 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0456 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0456 \u0437\u0430\u0432\u0436\u0434\u0438 \u0434\u0430\u0454 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E, \u0449\u043E\u0431 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043C\u043E\u0436\u043D\u0430 \u0431\u0443\u043B\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432\u0440\u0443\u0447\u043D\u0443.</p>
</div>
`
  });
}
function notFound() {
  return layout({
    title: "\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
    body: `<h1>\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E</h1>
<p class="sub">\u0422\u0430\u043A\u043E\u0457 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438 \u043D\u0435\u043C\u0430\u0454 \u2014 \u043C\u043E\u0436\u043B\u0438\u0432\u043E, \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u043B\u043E \u0430\u0431\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0449\u0435 \u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E.</p>
<div class="actions">
  <a class="action primary" href="/">\u0423\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
  <a class="action" href="/lookup">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423</a>
  <a class="action" href="/updates">\u0429\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u0432 \u0431\u0430\u0437\u0456</a>
</div>`
  });
}

// src/store/db.ts
function loadDbConfig(env = process.env) {
  const url = env.TURSO_DATABASE_URL;
  const token = env.TURSO_AUTH_TOKEN;
  return url && token ? { url, token } : null;
}
function pipelineEndpoint(url) {
  return url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "") + "/v2/pipeline";
}
function encode(value) {
  if (value === null) return { type: "null" };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
  }
  return { type: "text", value };
}
function decode(cell) {
  switch (cell.type) {
    case "null":
      return null;
    case "integer":
      return Number(cell.value);
    case "float":
      return cell.value;
    case "text":
      return cell.value;
    case "blob":
      return cell.base64;
  }
}
async function query(config, statements, fetchImpl = fetch) {
  const res = await fetchImpl(pipelineEndpoint(config.url), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...statements.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args ?? []).map(encode) } })),
        { type: "close" }
      ]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Database returned ${res.status}${detail ? ` \u2014 ${detail.slice(0, 300)}` : ""}`);
  }
  const { results } = await res.json();
  return statements.map((s, i) => {
    const r = results[i];
    if (!r) throw new Error(`Database returned no result for statement ${i + 1}`);
    if (r.type === "error") throw new Error(`Database error: ${r.error.message} \u2014 in: ${s.sql.slice(0, 80)}`);
    if (r.response.type !== "execute") return [];
    const { cols, rows } = r.response.result;
    return rows.map((row) => Object.fromEntries(cols.map((c, j) => [c.name, decode(row[j])])));
  });
}

// src/store/cards.ts
async function getCard(config, id, fetchImpl = fetch) {
  const [rows] = await query(config, [{ sql: "SELECT card FROM cards WHERE id = ?", args: [id] }], fetchImpl);
  const row = rows[0];
  return row ? JSON.parse(String(row.card)) : null;
}

// server/pages/tender.ts
async function tenderPage(tenderId, url) {
  const base = dataset().byTender.get(tenderId);
  if (!base) return notFound();
  const from = url?.searchParams.get("from") ?? "";
  const back = /^\/(?!\/)[^\s]*$/.test(from) ? from : "/";
  let entry = base;
  if (!entry.detailed) {
    const config = loadDbConfig();
    if (config) {
      try {
        const card = await getCard(config, tenderId);
        if (card) entry = mergeCardDetail(base, card);
      } catch (err) {
        console.error(`card fetch failed for ${tenderId} \u2014 ${err.message}`);
      }
    }
  }
  const sameEntity = dataset().cases.filter((c) => c.entity_edrpou && c.entity_edrpou === entry.entity_edrpou);
  const sameOfficer = entry.officer_key ? dataset().cases.filter((c) => c.officer_key === entry.officer_key) : [];
  const sameWinner = entry.winner_edrpou ? dataset().cases.filter((c) => c.winner_edrpou === entry.winner_edrpou) : [];
  const others = (list) => list.filter((c) => c.tender_id !== entry.tender_id);
  const otherOfficer = others(sameOfficer);
  const otherWinner = others(sameWinner);
  const officerValue = otherOfficer.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const winnerValue = otherWinner.reduce((sum2, c) => sum2 + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const title = entry.title || readableName(entry.entity_name) || "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F";
  const signals = alarms(entry);
  const prozorro = `https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}`;
  const buyer = readableName(entry.entity_name);
  const conclusion = buildConclusion({ entry, sameEntity, sameOfficer, sameWinner });
  return layout({
    // The tab and any link preview name the thing, not just its number.
    title: `${trim(title, 60)} \xB7 ${shortMoney(entry.value_amount)}`,
    description: `${buyer ? `${buyer} \xB7 ` : ""}${money(entry.value_amount)} \xB7 ${signals[0] ?? (entry.risks.length ? `${entry.risks.length} ${plural(entry.risks.length, "\u043E\u0437\u043D\u0430\u043A\u0430", "\u043E\u0437\u043D\u0430\u043A\u0438", "\u043E\u0437\u043D\u0430\u043A")} \u0440\u0438\u0437\u0438\u043A\u0443` : "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438")} \xB7 ${entry.tender_ref || entry.tender_id}`,
    body: `
<article class="tender-detail">
<div class="detail-toolbar"><a class="back" href="${esc(back)}">\u2190 \u0414\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443</a>${star("tender", entry.tender_id, url ? url.pathname + url.search : "/tender/" + encodeURIComponent(entry.tender_id), { label: true })}</div>
<header class="detail-heading"><p class="detail-ref">${esc(entry.tender_ref || entry.tender_id)}</p><h1>${esc(title)}</h1><p class="detail-buyer">${esc(buyer)}</p></header>
<section class="detail-overview" id="facts" aria-label="\u041E\u0441\u043D\u043E\u0432\u043D\u0456 \u0434\u0430\u043D\u0456"><div><span>\u0421\u0443\u043C\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</span><strong>${shortMoney(entry.value_amount)}</strong></div><div><span>\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432</span><strong>${entry.detailed ? entry.bidders ?? "\u041D\u0435\u043C\u0430\u0454 \u0434\u0430\u043D\u0438\u0445" : "\u041D\u0435\u043C\u0430\u0454 \u0434\u0430\u043D\u0438\u0445"}</strong></div><div><span>\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</span><strong>${date(entry.tender_date)}</strong></div></section>
<div class="detail-source"><a href="${prozorro}" target="_blank" rel="noopener">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0432 Prozorro <span aria-hidden="true">\u2197</span></a><span>\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0442\u0430 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E</span></div>
${reviewEditor({ id: entry.tender_id, title, ref: entry.tender_ref })}
${documentPriceSection((dataset().documentPrices ?? []).filter((d) => d.tender_id === entry.tender_id))}
${documentSection((dataset().documents ?? []).filter((d) => d.tender_id === entry.tender_id))}
<div class="detail-columns"><section class="detail-signals" id="signals"><h2>\u0429\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u0443\u0432\u0430\u0433\u0438 <span>${entry.risks.length + entry.findings.length}</span></h2><p class="detail-caution">\u0421\u0438\u0433\u043D\u0430\u043B \u043D\u0435 \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
${entry.bidders === 1 ? '<p class="detail-competition">\u041E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A \u2014 \u043D\u0435\u043C\u0430\u0454 \u0456\u043D\u0448\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u0434\u043B\u044F \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F.</p>' : ""}
${entry.risks.map((r) => `<details class="detail-fold signal-fold"><summary><span><small>\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0439 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440</small><strong>${esc(shortRisk(r))}</strong></span></summary><div class="detail-fold-body"><p>${esc(dataset().ruleById.get(r)?.name ?? r)}</p><p class="detail-caution">\u0426\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0430 \u043E\u0437\u043D\u0430\u043A\u0430. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u0442\u0430 \u0437\u043C\u0456\u043D\u0438 \u0434\u043E \u043D\u044C\u043E\u0433\u043E \u0432 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u0456.</p><a href="${prozorro}" target="_blank" rel="noopener">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u2197</a><p class="detail-ref">\u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 ${esc(r)} \xB7 <a href="/?risk=${encodeURIComponent(r)}">\u0406\u043D\u0448\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u0446\u0456\u0454\u044E \u043E\u0437\u043D\u0430\u043A\u043E\u044E</a></p></div></details>`).join("")}
${entry.findings.length ? `<details class="detail-fold"><summary><span><small>\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0441\u0438\u0441\u0442\u0435\u043C\u0438</small><strong>\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F \u0446\u0456\u043D \xB7 ${entry.findings.length}</strong></span></summary><div class="detail-fold-body">${entry.findings.length ? `<h2>\u0421\u043A\u0456\u043B\u044C\u043A\u0438 \u0446\u0435 \u043A\u043E\u0448\u0442\u0443\u0454 \u0432 \u0456\u043D\u0448\u0438\u0445</h2>
<p class="hint">\u0420\u0430\u0445\u0443\u0432\u0430\u043B\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430, \u043D\u0435 \u0434\u0435\u0440\u0436\u0430\u0432\u0430. \u041D\u0438\u0436\u0447\u0435 \u2014 \u0447\u0438\u0441\u043B\u0430.</p>
${entry.findings.map((f) => {
      const e = f.evidence;
      const rows = Object.entries({
        "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E": typeof e.unit_price === "number" ? `${unitMoney(e.unit_price)}` : null,
        "\u041C\u0435\u0434\u0456\u0430\u043D\u0430 Prozorro Market": typeof e.market_median === "number" ? money(e.market_median) : null,
        "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u0437 \u043E\u0440\u0456\u0454\u043D\u0442\u0438\u0440\u043E\u043C (\u043D\u0435 \u0437\u0431\u0438\u0442\u043E\u043A)": typeof e.comparison_difference === "number" ? money(e.comparison_difference) : null,
        "\u0422\u0438\u043F\u043E\u0432\u0430 \u0446\u0456\u043D\u0430 (\u043C\u0435\u0434\u0456\u0430\u043D\u0430)": typeof e.peer_median === "number" ? `${unitMoney(e.peer_median)}` : null,
        "\u0421\u0435\u0440\u0435\u0434\u043D\u044F \u043F\u043E\u043B\u043E\u0432\u0438\u043D\u0430 \u0446\u0456\u043D": typeof e.peer_p25 === "number" && typeof e.peer_p75 === "number" ? `${unitMoney(e.peer_p25)} \u2014 ${unitMoney(e.peer_p75)}` : null,
        "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043E \u0456\u0437 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438": typeof e.peer_count === "number" ? String(e.peer_count) : null,
        "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0446\u0456\u043D\u0430 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430": typeof e.previous_price === "number" ? `${unitMoney(e.previous_price)}` : null,
        "\u0417\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F": typeof e.growth === "number" ? `${Math.round(e.growth * 100)}%` : null,
        "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C": typeof e.quantity === "number" ? `${e.quantity.toLocaleString("uk-UA")} ${esc(String(e.unit_code ?? ""))}` : null,
        "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E": typeof e.overpayment === "number" ? money(e.overpayment) : typeof e.extra_cost === "number" ? money(e.extra_cost) : null,
        "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0432\u0456\u0434": e.basis === "award" ? "\u0441\u0443\u043C\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443" : e.basis === "expected" ? "\u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0457 \u0432\u0430\u0440\u0442\u043E\u0441\u0442\u0456" : null
      }).filter(([, v]) => v !== null);
      return `<div class="card">
  <h3><span class="tier own">\u041F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043C\u0438</span> &nbsp;${esc(f.title)}</h3>
  <p class="lead">${esc(f.explanation)}</p>
  ${typeof e.source_url === "string" && e.source_url.startsWith("https://market-api.prozorro.gov.ua/api/prices/") ? `<p><a href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0446\u0456\u043D\u0438 \u2197</a></p>` : ""}
  <dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
</div>`;
    }).join("")}` : ""}

</div></details>` : ""}
${!entry.risks.length && !entry.findings.length ? "<p>\u0414\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0441\u0438\u0433\u043D\u0430\u043B\u0456\u0432 \u0443 \u043F\u043E\u0442\u043E\u0447\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445 \u043D\u0435\u043C\u0430\u0454.</p>" : ""}
${entry.audit ? `<details class="detail-fold"><summary><span><small>\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430</small><strong>${entry.audit.violation ? "\u0412\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F" : "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E"}</strong></span></summary><div class="detail-fold-body">${auditSection(entry)}</div></details>` : ""}
</section><section class="detail-next" id="conclusion"><h2>\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u0430\u043B\u0456</h2><ol>${conclusion.nextSteps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol><details class="detail-fold"><summary>\u0427\u043E\u043C\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0454 \u0446\u0456 \u043A\u0440\u043E\u043A\u0438</summary><div class="detail-fold-body">${conclusion.observations.map((o) => `<p><strong>${esc(o.title)}</strong><br>${esc(o.detail)}</p>`).join("")}<p class="detail-caution">\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0438\u0439 \u0430\u043D\u0430\u043B\u0456\u0437 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p></div></details></section></div>
<section class="detail-reference" aria-label="\u0414\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456">
<details class="detail-fold" id="participants"><summary><span><strong>\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0438 \u0442\u0430 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0438</strong><small>${entry.winner_name ? "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C: " + esc(readableName(entry.winner_name)) : "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A, \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0430 \u043E\u0441\u043E\u0431\u0430"}</small></span></summary><div class="detail-fold-body"><h3>\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0430 \u043E\u0441\u043E\u0431\u0430 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430</h3>${entry.officer_name ? `<div class="card">
  <h3><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></h3>
  <p class="lead">${otherOfficer.length ? `\u0426\u0435\u0439 \u043A\u043E\u043D\u0442\u0430\u043A\u0442 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0449\u0435 \u0443 <strong>${otherOfficer.length}</strong> ${plural(otherOfficer.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0440\u0430\u0437\u043E\u043C \u043D\u0430 <strong>${shortMoney(officerValue)}</strong>.` : "\u0406\u043D\u0448\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u0437\u0430 \u0446\u0456\u0454\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0432 \u0431\u0430\u0437\u0456 \u043D\u0435\u043C\u0430\u0454."}</p>
  <dl class="facts">
    <dt>\u041F\u043E\u0448\u0442\u0430</dt><dd>${esc(entry.officer_email ?? "\u2014")}</dd>
    <dt>\u0422\u0435\u043B\u0435\u0444\u043E\u043D</dt><dd>${esc(entry.officer_phone ?? "\u2014")}</dd>
  </dl>
  <p style="margin-top:.9rem"><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u0446\u0438\u043C \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043E\u043C \u2192</a></p>
</div>` : `<div class="card"><p>\u041A\u0430\u0440\u0442\u043A\u0443 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0449\u0435 \u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E, \u0442\u043E\u043C\u0443 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0456 \u0434\u0430\u043D\u0456 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0456.</p><p><a href="${prozorro}" target="_blank" rel="noopener">\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442 \u0432 Prozorro \u2192</a></p></div>`}

<h2>\u0425\u0442\u043E \u0432\u0438\u0433\u0440\u0430\u0432</h2>
${entry.winner_name ? `<div class="card">
  <h3><a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a></h3>
  <p class="lead">${otherWinner.length ? `\u0426\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u043B\u0430 \u0449\u0435 \u0443 <strong>${otherWinner.length}</strong> ${plural(otherWinner.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0440\u0430\u0437\u043E\u043C \u043D\u0430 <strong>${shortMoney(winnerValue)}</strong>.` : "\u0406\u043D\u0448\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u0437\u0430 \u0446\u0456\u0454\u044E \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0454\u044E \u0432 \u0431\u0430\u0437\u0456 \u043D\u0435\u043C\u0430\u0454."}</p>
  <dl class="facts">
    <dt>\u0404\u0414\u0420\u041F\u041E\u0423</dt><dd>${esc(entry.winner_edrpou ?? "\u2014")}</dd>
    <dt>\u0421\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443</dt><dd>${money(entry.winner_amount)}</dd>
  </dl>
</div>` : `<div class="card"><p>\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0430\u0431\u043E \u043A\u0430\u0440\u0442\u043A\u0443 \u0449\u0435 \u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E.</p><p><a href="${prozorro}" target="_blank" rel="noopener">\u041F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0432 Prozorro \u2192</a></p></div>`}

</div></details>
<details class="detail-fold"><summary>\u0423\u0441\u0456 \u0440\u0435\u043A\u0432\u0456\u0437\u0438\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</summary><div class="detail-fold-body"><div class="card">
  <dl class="facts">
    <dt>\u0421\u0443\u043C\u0430</dt><dd><strong>${money(entry.value_amount)}</strong> <span class="faint">(${shortMoney(entry.value_amount)})</span></dd>
    <dt>\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a><br><span class="faint">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(entry.entity_edrpou ?? "\u2014")}</span></dd>
    <dt>\u0420\u0435\u0433\u0456\u043E\u043D</dt><dd>${entry.region ? `<a href="/?region=${encodeURIComponent(entry.region)}">${esc(entry.region)}</a>` : "\u2014"}</dd>
    ${entry.method ? `<dt>\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430</dt><dd>${esc(procedureLabel(entry.method) ?? "\u2014")}</dd>` : ""}
    ${entry.detailed ? `<dt>\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432</dt><dd>${entry.bidders === 1 ? "<strong>\u043E\u0434\u0438\u043D</strong> \u2014 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E" : entry.bidders || "\u2014"}</dd>` : ""}
    <dt>\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</dt><dd>${date(entry.tender_date)}</dd>
    <dt>\u041F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u043E\u044E</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043A\u0430\u0440\u0442\u043A\u0443 \u0432 Prozorro \u2192</a></dd>
  </dl>
</div>

<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">\u0414\u043E\u0441\u044C\u0454 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430 \xB7 ${sameEntity.length} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u2192</a></div></details>
<details class="detail-fold"><summary><span><strong>\u041F\u0440\u0430\u0432\u043E\u0432\u0430 \u0434\u043E\u0432\u0456\u0434\u043A\u0430</strong><small>\u041D\u043E\u0440\u043C\u0438 \u0442\u0430 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u0434\u043B\u044F \u0444\u0430\u0445\u0456\u0432\u0446\u0456\u0432</small></span></summary><div class="detail-fold-body">${qualificationBlock(entry)}</div></details>
<details class="detail-fold"><summary>\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0430\u0431\u043E \u043D\u0430\u0434\u0440\u0443\u043A\u0443\u0432\u0430\u0442\u0438 \u0437\u0432\u0456\u0442</summary><div class="detail-fold-body detail-downloads"><a href="/tender/${encodeURIComponent(entry.tender_id)}/report">\u0414\u043B\u044F \u0434\u0440\u0443\u043A\u0443 \u0442\u0430 PDF</a><a href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">\u0422\u0435\u043A\u0441\u0442\u043E\u0432\u0438\u0439 \u0444\u0430\u0439\u043B</a></div></details>
</section></article>
`
  });
}

// server/pages/entity.ts
function entityPage(edrpou, url) {
  const dossierAction = `/entity/${encodeURIComponent(edrpou)}`;
  const list = dataset().cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  const officers = /* @__PURE__ */ new Map();
  for (const entry of list) {
    if (!entry.officer_key) continue;
    const acc = officers.get(entry.officer_key) ?? { name: entry.officer_name ?? entry.officer_key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    officers.set(entry.officer_key, acc);
  }
  const rankedOfficers = [...officers.entries()].sort((a, b) => b[1].value - a[1].value);
  const SHOW_OFFICERS = 8;
  const officerRow = ([key, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/officer/${encodeURIComponent(key)}">${esc(acc.name)}</a></div>
    <div class="meta">${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`;
  const officersBlock = rankedOfficers.length === 0 ? "" : `<h2>\u0425\u0442\u043E \u0432\u0456\u0432 \u0446\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
<div class="rows">${rankedOfficers.slice(0, SHOW_OFFICERS).map(officerRow).join("")}</div>
${rankedOfficers.length > SHOW_OFFICERS ? `<details class="sub"><summary>\u0429\u0435 ${rankedOfficers.length - SHOW_OFFICERS} ${plural(rankedOfficers.length - SHOW_OFFICERS, "\u043E\u0441\u043E\u0431\u0430", "\u043E\u0441\u043E\u0431\u0438", "\u043E\u0441\u0456\u0431")}</summary>
  <div class="inner"><div class="rows">${rankedOfficers.slice(SHOW_OFFICERS).map(officerRow).join("")}</div></div>
</details>` : ""}`;
  return layout({
    title: readableName(name),
    nav: "entities",
    description: `\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \xB7 \u0404\u0414\u0420\u041F\u041E\u0423 ${edrpou} \xB7 ${list.length} ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u043D\u0430 ${shortMoney(value)}`,
    body: `
<a class="back" href="/entities">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432</a>
<h1 class="long">${esc(readableName(name))}</h1>
<p class="sub">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)}${RAILWAY_EDRPOU.has(edrpou) ? " \xB7 \u0444\u0456\u043B\u0456\u044F \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB" : ""}</p>
${star("entity", edrpou, "/entity/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043F\u0456\u0434 \u043F\u0438\u0442\u0430\u043D\u043D\u044F\u043C \xB7
  <b>${shortMoney(value)}</b> \u0437\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \xB7
  <b>${solo}</b> \u0437 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${rankedOfficers.length}</b> \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u0445 \u043E\u0441\u0456\u0431
</p>

${officersBlock}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${controlBar(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showEntity: false })}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430</h2>
<p class="hint">\u041E\u0437\u043D\u0430\u043A\u0438, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430, \u0437\u0433\u0440\u0443\u043F\u043E\u0432\u0430\u043D\u0456 \u0437\u0430 \u0437\u043C\u0456\u0441\u0442\u043E\u043C.</p>
${groupedRiskCards(ranked)}
`
  });
}

// server/pages/officer.ts
function officerPage(key, url) {
  const dossierAction = `/officer/${encodeURIComponent(key)}`;
  const list = dataset().cases.filter((c) => c.officer_key === key);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.officer_name)?.officer_name ?? key;
  const email = list.find((c) => c.officer_email)?.officer_email ?? null;
  const phone = list.find((c) => c.officer_phone)?.officer_phone ?? null;
  const entity = list.find((c) => c.entity_name)?.entity_name ?? null;
  const entityEdrpou = list.find((c) => c.entity_edrpou)?.entity_edrpou ?? "";
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  return layout({
    title: name,
    nav: "officers",
    description: `\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430${entity ? ` \xB7 ${readableName(entity)}` : ""} \xB7 ${list.length} ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u043D\u0430 ${shortMoney(value)}`,
    body: `
<a class="back" href="/officers">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456\u0432</a>
${star("officer", key, "/officer/" + encodeURIComponent(key), { label: true })}
<h1>${esc(name)}</h1>
<p class="sub">\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445${entity ? ` \u2014 ${esc(readableName(entity))}` : ""}.</p>

<p class="statline">
  <b>${list.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043F\u0456\u0434 \u043F\u0438\u0442\u0430\u043D\u043D\u044F\u043C \xB7
  <b>${shortMoney(value)}</b> \u0437\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \xB7
  <b>${solo}</b> \u0437 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${ranked.length}</b> \u0440\u0456\u0437\u043D\u0438\u0445 \u043E\u0437\u043D\u0430\u043A
</p>

<div class="card">
  <dl class="facts">
    <dt>\u041F\u043E\u0448\u0442\u0430</dt><dd>${esc(email ?? "\u2014")}</dd>
    <dt>\u0422\u0435\u043B\u0435\u0444\u043E\u043D</dt><dd>${esc(phone ?? "\u2014")}</dd>
    <dt>\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0430</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(readableName(entity))}</a></dd>
  </dl>
  <p class="faint" style="margin-top:.9rem">\u0414\u0430\u043D\u0456 \u0432\u0437\u044F\u0442\u043E \u0437 \u043A\u0430\u0440\u0442\u043E\u043A \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0443 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0443 \u043E\u0441\u043E\u0431\u0443. \u041E\u0434\u043D\u0443 \u043B\u044E\u0434\u0438\u043D\u0443 \u043C\u0456\u0436 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0437\u0430 \u043F\u043E\u0448\u0442\u043E\u044E \u2014 \u0432\u043E\u043D\u0430 \u0441\u0442\u0430\u0431\u0456\u043B\u044C\u043D\u0456\u0448\u0430 \u0437\u0430 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0456\u043C\u0435\u043D\u0456.</p>
</div>

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${controlBar(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showOfficer: false })}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0457\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
<p class="hint">\u041F\u0435\u0440\u0435\u043B\u0456\u043A \u043E\u0437\u043D\u0430\u043A, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438. <strong>\u041D\u0435 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0432\u0438\u043D\u0430.</strong></p>
${groupedRiskCards(ranked)}

<p class="note">\u0426\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u043D\u0435 \u0454 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F\u043C \u043F\u0440\u043E \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437 \u0431\u043E\u043A\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0412\u043E\u043D\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454, \u0449\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0443 \u044F\u043A\u0438\u0445 \u0446\u044E \u043E\u0441\u043E\u0431\u0443 \u0432\u043A\u0430\u0437\u0430\u043D\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E.</p>
`
  });
}

// server/pages/supplier.ts
function supplierPage(edrpou, url) {
  const dossierAction = `/supplier/${encodeURIComponent(edrpou)}`;
  const list = dataset().cases.filter((c) => c.winner_edrpou === edrpou);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.winner_name)?.winner_name ?? edrpou;
  const value = list.reduce((sum2, c) => sum2 + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  const buyers = /* @__PURE__ */ new Map();
  for (const entry of list) {
    if (!entry.entity_edrpou) continue;
    const acc = buyers.get(entry.entity_edrpou) ?? { name: entry.entity_name ?? entry.entity_edrpou, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    buyers.set(entry.entity_edrpou, acc);
  }
  const rankedBuyers = [...buyers.entries()].sort((a, b) => b[1].value - a[1].value);
  const SHOW_BUYERS = 8;
  const buyerRow = ([code, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/entity/${encodeURIComponent(code)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 \u0404\u0414\u0420\u041F\u041E\u0423 ${esc(code)}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`;
  return layout({
    title: readableName(name),
    nav: "suppliers",
    description: `\u041F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A \xB7 \u0404\u0414\u0420\u041F\u041E\u0423 ${edrpou} \xB7 ${list.length} ${plural(list.length, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")} \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u043D\u0430 ${shortMoney(value)}`,
    body: `
<a class="back" href="/suppliers">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456\u0432</a>
<h1>${esc(readableName(name))}</h1>
<p class="sub">\u041F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A \xB7 \u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)}</p>
${star("supplier", edrpou, "/supplier/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> \u043F\u0435\u0440\u0435\u043C\u043E\u0433 \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \xB7
  <b>${shortMoney(value)}</b> \u0441\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0456\u0432 \xB7
  <b>${solo}</b> \u0434\u0435 \u0431\u0443\u0432 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${rankedBuyers.length}</b> \u0440\u0456\u0437\u043D\u0438\u0445 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432
</p>

${rankedBuyers.length ? `<h2>\u041A\u043E\u043C\u0443 \u043F\u0440\u043E\u0434\u0430\u0454</h2>
<div class="rows">${rankedBuyers.slice(0, SHOW_BUYERS).map(buyerRow).join("")}</div>
${rankedBuyers.length > SHOW_BUYERS ? `<details class="sub"><summary>\u0429\u0435 ${rankedBuyers.length - SHOW_BUYERS} ${plural(rankedBuyers.length - SHOW_BUYERS, "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432")}</summary>
  <div class="inner"><div class="rows">${rankedBuyers.slice(SHOW_BUYERS).map(buyerRow).join("")}</div></div>
</details>` : ""}` : ""}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${controlBar(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction)}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0446\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
${groupedRiskCards(ranked)}

<p class="note">\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C \u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u043B\u0438\u0448\u0435 \u0442\u0430\u043C, \u0434\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E \u043F\u043E\u0432\u043D\u0443 \u043A\u0430\u0440\u0442\u043A\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u2014 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456 \u0446\u0435 ${esc(REGION)} \u0442\u0430 \u0444\u0456\u043B\u0456\u0457 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456, \u0440\u0435\u0448\u0442\u0430 \u043A\u0440\u0430\u0457\u043D\u0438 \u0434\u043E\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F. \u0426\u0435 \u043D\u0435 \u043F\u043E\u0432\u043D\u0430 \u0456\u0441\u0442\u043E\u0440\u0456\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457 \u043F\u043E \u0423\u043A\u0440\u0430\u0457\u043D\u0456.</p>
`
  });
}

// server/components/directory.ts
var DIR_SORTS = [
  { value: "value", label: "\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0441\u043F\u0430\u0434\u0430\u043D\u043D\u044F" },
  { value: "value-asc", label: "\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0437\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F" },
  { value: "count", label: "\u0437\u0430 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C" },
  { value: "name", label: "\u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E, \u0410\u2013\u042F" }
];
function readDirControls(url) {
  const sort = url.searchParams.get("sort") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
    sort: DIR_SORTS.some((x) => x.value === sort) ? sort : "value"
  };
}
function applyDirControls(rows, c) {
  const needle = c.q.toLowerCase();
  const kept = needle ? rows.filter((r) => `${r.name} ${r.meta}`.toLowerCase().includes(needle)) : rows;
  const out = [...kept];
  switch (c.sort) {
    case "value-asc":
      out.sort((a, b) => a.value - b.value);
      break;
    case "count":
      out.sort((a, b) => b.count - a.count || b.value - a.value);
      break;
    case "name":
      out.sort((a, b) => a.name.localeCompare(b.name, "uk"));
      break;
    default:
      out.sort((a, b) => b.value - a.value);
  }
  return out;
}
function dirBar(action, c) {
  const dirty = c.q !== "" || c.sort !== "value";
  return `<form class="sortbar dir" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="\u041D\u0430\u0437\u0432\u0430 \u0430\u0431\u043E \u0404\u0414\u0420\u041F\u041E\u0423" aria-label="\u041F\u043E\u0448\u0443\u043A">
  <button class="go" type="submit">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438</button>
  <label>\u0421\u043E\u0440\u0442.
    <select name="sort" onchange="this.form.submit()">${DIR_SORTS.map(
    (x) => `<option value="${x.value}"${x.value === c.sort ? " selected" : ""}>${esc(x.label)}</option>`
  ).join("")}</select>
  </label>
  ${dirty ? `<a class="reset" href="${esc(action)}">\u0441\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0435</a>` : ""}
</form>`;
}
function directoryPage(opts) {
  const c = readDirControls(opts.url);
  const rows = applyDirControls(opts.rows, c);
  const total = rows.reduce((sum2, r) => sum2 + r.value, 0);
  const PAGE = 100;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page3 = Math.min(pages, Math.max(1, Math.floor(Number(opts.url.searchParams.get("page") ?? 1) || 1)));
  const slice = rows.slice((page3 - 1) * PAGE, page3 * PAGE);
  const pageHref = (n) => {
    const p = new URLSearchParams();
    if (c.q) p.set("q", c.q);
    if (c.sort !== "value") p.set("sort", c.sort);
    if (n > 1) p.set("page", String(n));
    const q = p.toString();
    return q ? `${opts.action}?${q}` : opts.action;
  };
  return layout({
    title: opts.title,
    nav: opts.nav,
    body: `
<h1>${esc(opts.heading)}</h1>
<p class="sub">${opts.intro}</p>
${dirBar(opts.action, c)}
<p class="hint">${c.q ? "\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E" : "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E"} <strong>${rows.length.toLocaleString("uk-UA")}</strong> ${plural(rows.length, "\u0437\u0430\u043F\u0438\u0441", "\u0437\u0430\u043F\u0438\u0441\u0438", "\u0437\u0430\u043F\u0438\u0441\u0456\u0432")} \u043D\u0430 ${shortMoney(total)}.</p>
${rows.length === 0 ? `<div class="empty">\u0417\u0430 \u0446\u0438\u043C \u0437\u0430\u043F\u0438\u0442\u043E\u043C \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u043E\u0441\u044F.<br><a href="${esc(opts.action)}">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438 \u0432\u0441\u0456\u0445</a> \xB7 <a href="/lookup${c.q ? `?edrpou=${encodeURIComponent(c.q)}` : ""}">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423</a></div>` : `<div class="rows">
${slice.map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${r.kind && r.id ? star(r.kind, r.id, currentPath() || r.href) : ""}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${r.meta}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
    ).join("")}
</div>`}
${pages > 1 ? `<div class="pager">
  ${page3 > 1 ? `<a href="${esc(pageHref(1))}" aria-label="\u041F\u0435\u0440\u0448\u0430 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430">\xAB</a><a href="${esc(pageHref(page3 - 1))}">\u2190 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456</a>` : ""}
  <span>\u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 ${page3} \u0437 ${pages}</span>
  ${page3 < pages ? `<a href="${esc(pageHref(page3 + 1))}">\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0456 \u2192</a><a href="${esc(pageHref(pages))}" aria-label="\u041E\u0441\u0442\u0430\u043D\u043D\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430">\xBB</a>` : ""}
</div>` : ""}
`
  });
}

// server/pages/entities.ts
function entityRows() {
  const byEntity = /* @__PURE__ */ new Map();
  for (const entry of dataset().cases) {
    const key = entry.entity_edrpou ?? "";
    if (!key) continue;
    const acc = byEntity.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byEntity.set(key, acc);
  }
  return [...byEntity.entries()].map(([edrpou, acc]) => ({
    kind: "entity",
    id: edrpou,
    href: `/entity/${encodeURIComponent(edrpou)}`,
    name: readableName(acc.name),
    meta: `\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}${RAILWAY_EDRPOU.has(edrpou) ? " \xB7 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F" : ""}`,
    value: acc.value,
    count: acc.count
  }));
}
function entitiesPage(url) {
  return directoryPage({
    title: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438",
    nav: "entities",
    heading: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438",
    intro: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438, \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u044F\u043A\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438.",
    action: "/entities",
    url,
    rows: perDataset("entities", entityRows)
  });
}

// server/pages/officers.ts
function officerRows() {
  const byOfficer = /* @__PURE__ */ new Map();
  for (const entry of dataset().cases) {
    if (!entry.officer_key) continue;
    const acc = byOfficer.get(entry.officer_key) ?? {
      name: entry.officer_name ?? entry.officer_key,
      entity: entry.entity_name ?? "",
      count: 0,
      value: 0
    };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byOfficer.set(entry.officer_key, acc);
  }
  return [...byOfficer.entries()].map(([key, acc]) => ({
    kind: "officer",
    id: key,
    href: `/officer/${encodeURIComponent(key)}`,
    name: acc.name,
    meta: `${esc(readableName(acc.entity))} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}`,
    value: acc.value,
    count: acc.count
  }));
}
function officersPage(url) {
  return directoryPage({
    title: "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
    nav: "officers",
    heading: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
    intro: "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0456 \u043E\u0441\u043E\u0431\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438. \u041D\u0435 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u043E\u0437\u0440\u044E\u0432\u0430\u043D\u0438\u0445 \u2014 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0442\u043E\u0433\u043E, \u0449\u043E \u0432\u0430\u0440\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438.",
    action: "/officers",
    url,
    rows: perDataset("officers", officerRows)
  });
}

// server/pages/suppliers.ts
function supplierRows() {
  const bySupplier = /* @__PURE__ */ new Map();
  for (const entry of dataset().cases) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = bySupplier.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    bySupplier.set(key, acc);
  }
  return [...bySupplier.entries()].map(([edrpou, acc]) => ({
    kind: "supplier",
    id: edrpou,
    href: `/supplier/${encodeURIComponent(edrpou)}`,
    name: readableName(acc.name),
    meta: `\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")}${acc.solo ? ` \xB7 ${acc.solo} \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : ""}`,
    value: acc.value,
    count: acc.count
  }));
}
function suppliersPage(url) {
  return directoryPage({
    title: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456",
    nav: "suppliers",
    heading: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C",
    intro: "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u0457, \u044F\u043A\u0456 \u0432\u0438\u0433\u0440\u0430\u043B\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438.",
    action: "/suppliers",
    url,
    rows: perDataset("suppliers", supplierRows)
  });
}

// server/pages/railway.ts
function railwayBlocks() {
  const by = /* @__PURE__ */ new Map();
  for (const entry of dataset().cases) {
    const scope = railwayScope(entry);
    if (!scope) continue;
    const list = by.get(scope) ?? [];
    list.push(entry);
    by.set(scope, list);
  }
  const blocks = [
    {
      scope: "southern",
      heading: "\u0420\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F \xAB\u041F\u0456\u0432\u0434\u0435\u043D\u043D\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB",
      note: `\u0412\u043B\u0430\u0441\u043D\u0435 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438 \u2014 \u0440\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB \u0437 \u043E\u0441\u0456\u0434\u043A\u043E\u043C \u0443 \u0425\u0430\u0440\u043A\u043E\u0432\u0456, \u0404\u0414\u0420\u041F\u041E\u0423 ${SOUTHERN_RAILWAY_EDRPOU}.`,
      list: by.get("southern") ?? []
    },
    {
      scope: "branch",
      heading: "\u0406\u043D\u0448\u0456 \u0444\u0456\u043B\u0456\u0457 \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB",
      note: "\u0426\u0435\u043D\u0442\u0440\u0430\u043B\u0456\u0437\u043E\u0432\u0430\u043D\u0456 \u0444\u0456\u043B\u0456\u0457, \u044F\u043A\u0456 \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u044E\u0442\u044C \u0434\u043B\u044F \u0432\u0441\u0456\u0454\u0457 \u043C\u0435\u0440\u0435\u0436\u0456, \u0437\u043E\u043A\u0440\u0435\u043C\u0430 \u0439 \u0434\u043B\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0433\u043E \u0432\u0443\u0437\u043B\u0430. \u0417\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u043F\u043E\u0437\u0430 \u043C\u0435\u0436\u0430\u043C\u0438 \u043E\u0431\u043B\u0430\u0441\u0442\u0456, \u0442\u043E\u043C\u0443 \u043C\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u0454\u043C\u043E \u0457\u0445 \u043E\u043A\u0440\u0435\u043C\u043E, \u0430 \u043D\u0435 \u0437\u043C\u0456\u0448\u0443\u0454\u043C\u043E \u0437 \u0445\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0438\u043C\u0438.",
      list: by.get("branch") ?? []
    },
    {
      scope: "local",
      heading: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u0437\u0430\u043A\u043B\u0430\u0434\u0438 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438",
      note: "\u041E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0457 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0444\u0456\u043B\u044E, \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u0456: \u0443\u043D\u0456\u0432\u0435\u0440\u0441\u0438\u0442\u0435\u0442, \u043B\u0456\u0446\u0435\u0439, \u0446\u0435\u043D\u0442\u0440 \u043F\u0440\u043E\u0444\u0435\u0441\u0456\u0439\u043D\u043E\u0457 \u043E\u0441\u0432\u0456\u0442\u0438.",
      list: by.get("local") ?? []
    }
  ];
  return blocks.filter((b) => b.list.length > 0);
}
function railwayPage(url) {
  const blocks = railwayBlocks();
  const all = blocks.flatMap((b) => b.list);
  const value = all.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0);
  const solo = all.filter((c2) => c2.bidders === 1).length;
  const southern = blocks.find((b) => b.scope === "southern")?.list ?? [];
  const c = readControls(url);
  const filtered = applyControls(all, c, RAILWAY_EDRPOU, { hideRail: true });
  const suppliers = /* @__PURE__ */ new Map();
  for (const entry of all) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = suppliers.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    suppliers.set(key, acc);
  }
  const topSuppliers = [...suppliers.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 15);
  return layout({
    title: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456",
    nav: "railway",
    body: `
<header class="railway-heading"><div><h1>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456</h1><p class="sub">\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456 \u0442\u0430 \u043F\u043E\u0432\u2019\u044F\u0437\u0430\u043D\u0438\u0445 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0439.</p></div><span class="railway-count">${all.length.toLocaleString("uk-UA")} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C</span></header>
<details class="railway-about"><summary>\u041F\u0440\u043E \u0440\u043E\u0437\u0434\u0456\u043B</summary><div class="railway-about-grid"><p><strong>\u041F\u0456\u0432\u0434\u0435\u043D\u043D\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</strong><br>\u0420\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F, \u0449\u043E \u043E\u0431\u0441\u043B\u0443\u0433\u043E\u0432\u0443\u0454 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0443.</p><p><strong>\u0406\u043D\u0448\u0456 \u0444\u0456\u043B\u0456\u0457 \u0423\u043A\u0440\u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456</strong><br>\u0426\u0435\u043D\u0442\u0440\u0430\u043B\u0456\u0437\u043E\u0432\u0430\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0434\u043B\u044F \u0432\u0441\u0456\u0454\u0457 \u043C\u0435\u0440\u0435\u0436\u0456. \u041D\u0435 \u043B\u0438\u0448\u0435 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0430.</p><p><strong>\u041C\u0456\u0441\u0446\u0435\u0432\u0456 \u0437\u0430\u043A\u043B\u0430\u0434\u0438</strong><br>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u043E\u0441\u0432\u0456\u0442\u043D\u0456 \u0442\u0430 \u043D\u0430\u0443\u043A\u043E\u0432\u0456 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456.</p></div></details>
${controlBar("/railway", c, { hideRail: true }, { url })}
${listBody(filtered, c, "/railway")}

<details class="railway-analysis"><summary>\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438, \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0438 \u0442\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430</summary><div class="railway-analysis-body"><h2>\u0425\u0442\u043E \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u0454</h2>
${blocks.map((block) => {
      const blockValue = block.list.reduce((sum2, x) => sum2 + (x.value_amount ?? 0), 0);
      const entities = /* @__PURE__ */ new Map();
      for (const entry of block.list) {
        const key = entry.entity_edrpou ?? "";
        const acc = entities.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
        acc.count++;
        acc.value += entry.value_amount ?? 0;
        entities.set(key, acc);
      }
      return `
<details class="group-block">
  <summary>
    <span class="g-name">${esc(block.heading)}</span>
    <span class="g-meta">${block.list.length} ${plural(block.list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 ${shortMoney(blockValue)} \xB7 ${entities.size} ${plural(entities.size, "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432")}</span>
  </summary>
  <div class="g-body">
<p class="hint">${esc(block.note)}</p>
<div class="rows">
${[...entities.entries()].sort((a, b) => b[1].value - a[1].value).map(
        ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("entity", edrpou, "/railway")}<a href="/entity/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`
      ).join("")}
</div>
  </div>
</details>`;
    }).join("")}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
${groupedRiskCards(rankRisks(all))}

<h2>\u0425\u0442\u043E \u0432\u0438\u0433\u0440\u0430\u0454 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u0442\u0435\u043D\u0434\u0435\u0440\u0438</h2>
<p class="hint">\u041F'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u044C \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456\u0432.</p>
<div class="rows">
${topSuppliers.map(
      ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("supplier", edrpou, "/railway")}<a href="/supplier/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")}${acc.solo ? ` \xB7 ${acc.solo} \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : ""}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`
    ).join("")}
</div>

</div></details><p class="note">\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0426\u0435 \u043E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
`
  });
}

// server/pages/article.ts
function articlePage(code, url) {
  const article = ARTICLES[code];
  if (!article) return notFound();
  const relevant = new Set(article.links.map((l) => l.risk_id));
  const jointOnly = url.searchParams.get("at") === "1";
  const articleAction = `/article/${article.code}`;
  const jointHidden = jointOnly ? '<input type="hidden" name="at" value="1">' : "";
  const ctrl = readControls(url);
  let list = dataset().cases.filter(
    (c) => c.region === REGION && c.risks.some((r) => relevant.has(r))
  );
  if (jointOnly) list = list.filter((c) => isJointStock(c.entity_name) || isJointStock(c.winner_name));
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const officers = new Set(list.map((c) => c.officer_key).filter(Boolean));
  const score = (entry) => entry.risks.filter((r) => relevant.has(r)).length;
  const sorted = [...list].sort(
    (a, b) => score(b) - score(a) || (b.value_amount ?? 0) - (a.value_amount ?? 0)
  );
  let shown = applyControls(sorted, ctrl, RAILWAY_EDRPOU);
  if (!url.searchParams.get("sort")) {
    const keep = new Set(shown);
    shown = sorted.filter((x) => keep.has(x));
  }
  return layout({
    title: `\u0421\u0442\u0430\u0442\u0442\u044F ${article.code}`,
    nav: `article-${article.code}`,
    body: `
<h1>\u041F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432</h1>
<p class="sub">\u0420\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430\u0445, \u0443\u0433\u043E\u0434\u0430\u0445 \u0456 \u0437\u0432\u0456\u0442\u0430\u0445 \u2014 \u0442\u0435, \u0449\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u044E\u0442\u044C \u0437\u0430 \u0441\u0442\u0430\u0442\u0442\u0435\u044E ${esc(article.code)}. \u041B\u0438\u0448\u0435 ${esc(REGION)}: \u0446\u0435\u0439 \u0432\u0456\u0434\u0431\u0456\u0440 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u043E\u0432\u043D\u0438\u0445 \u043A\u0430\u0440\u0442\u043E\u043A \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C, \u044F\u043A\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E \u0434\u043B\u044F \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0442\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456.</p>

<p class="statline">
  <b>${list.length.toLocaleString("uk-UA")}</b> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7
  <b>${shortMoney(value)}</b> \xB7
  <b>${solo}</b> \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \xB7
  <b>${officers.size}</b> ${plural(officers.size, "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430", "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456 \u043E\u0441\u043E\u0431\u0438", "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u0445 \u043E\u0441\u0456\u0431")}
</p>

<p class="caution">\u0426\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F: \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0445, \u0430 \u0443\u043C\u0438\u0441\u0435\u043B \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0441\u0443\u0434.</p>

<details class="help">
  <summary>\u0429\u043E \u043A\u0430\u0436\u0435 \u0441\u0442\u0430\u0442\u0442\u044F ${esc(article.code)}</summary>
  <div class="inner">
    <p class="lead">${esc(article.summary)}</p>
    <p><strong>\u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E:</strong></p>
    <ul>
      ${article.elements.map((e) => `<li>${esc(e)}</li>`).join("")}
    </ul>
    <p class="faint">\u041D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u044F\u043A \u0434\u043E\u0432\u0456\u0434\u043A\u0443 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430. \u0426\u0435 \u043D\u0435 \u043F\u0440\u0430\u0432\u043E\u0432\u0430 \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0456\u044F \u0456 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0447\u0438\u0457\u0445\u043E\u0441\u044C \u0434\u0456\u0439.</p>
  </div>
</details>

<details class="help">
  <summary>\u0427\u043E\u043C\u0443 \u0441\u0430\u043C\u0435 \u0446\u0456 \u043E\u0437\u043D\u0430\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0456 \u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u044C</summary>
  <div class="inner">
    <p>\u0406\u0437 \u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u0434\u043B\u044F \u0446\u0456\u0454\u0457 \u0441\u0442\u0430\u0442\u0442\u0456 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u0456 ${article.links.length}. \u0420\u0435\u0448\u0442\u0430 \u0441\u0442\u043E\u0441\u0443\u044E\u0442\u044C\u0441\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u0442\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438, \u0430 \u043D\u0435 \u0437\u043C\u0456\u0441\u0442\u0443 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432.</p>
    ${article.links.map((link) => {
      const label = RISK_LABELS[link.risk_id];
      const hits = list.filter((c) => c.risks.includes(link.risk_id)).length;
      return `<p><strong>${esc(label?.short ?? link.risk_id)}</strong> <span class="faint">\u2014 ${hits} ${plural(hits, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</span><br>${esc(link.why)}</p>`;
    }).join("")}
  </div>
</details>

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438</h2>
<form class="filters" method="get" action="/article/${esc(article.code)}">
  ${hiddenControls(ctrl, esc, ["at"])}
  <div class="filter-row">
    <label class="check"><input type="checkbox" name="at" value="1"${jointOnly ? " checked" : ""}> \u043B\u0438\u0448\u0435 \u0430\u043A\u0446\u0456\u043E\u043D\u0435\u0440\u043D\u0456 \u0442\u043E\u0432\u0430\u0440\u0438\u0441\u0442\u0432\u0430 (\u0410\u0422)</label>
    <button type="submit">\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0442\u0438</button>
    ${jointOnly ? `<a class="reset" href="/article/${esc(article.code)}">\u0441\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0435</a>` : ""}
  </div>
</form>
${controlBar(articleAction, ctrl, {}, { extra: jointHidden })}
${listBody(shown, ctrl, articleAction, {}, jointOnly ? { at: "1" } : {})}

<p class="note">\u041F\u0435\u0440\u0435\u043B\u0456\u043A \u0441\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0437\u0430 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430\u043C\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0444\u0430\u043A\u0442 \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0456 \u043D\u0435 \u0454 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F\u043C \u0449\u043E\u0434\u043E \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0447\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457. \u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u043A\u0440\u043E\u043A \u2014 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0439 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0457\u0445.</p>
`
  });
}

// server/pages/updates.ts
function updatesPage(url) {
  const runs = [...dataset().runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = runs[0];
  const newIds = new Set(latest?.new_tender_ids ?? []);
  const freshAll = dataset().cases.filter((x) => newIds.has(x.tender_id));
  const c = readControls(url);
  const fresh = applyControls(freshAll, c, RAILWAY_EDRPOU);
  return layout({
    title: "\u0429\u043E \u043D\u043E\u0432\u043E\u0433\u043E",
    nav: "updates",
    body: `
<h1>\u0429\u043E \u043D\u043E\u0432\u043E\u0433\u043E</h1>
<p class="sub">\u0429\u043E\u0434\u043D\u044F \u0437\u0432\u0456\u0440\u044F\u0454\u043C\u043E\u0441\u044F \u0437 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u043C \u043C\u0430\u0441\u0438\u0432\u043E\u043C \u0456 \u0434\u043E\u0434\u0430\u0454\u043C\u043E \u043D\u043E\u0432\u0435.</p>

${latest ? `<p class="statline">
  <b>${latest.new_tenders}</b> \u043D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0432\u043E\u0441\u0442\u0430\u043D\u043D\u0454 \xB7
  <b>${latest.new_flags}</b> \u043D\u043E\u0432\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C \xB7
  <b>${date(latest.started_at)}</b> \u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \xB7
  <b>${runs.length}</b> ${plural(runs.length, "\u0437\u0430\u043F\u0443\u0441\u043A", "\u0437\u0430\u043F\u0443\u0441\u043A\u0438", "\u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432")}
</p>` : '<div class="empty">\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u044C \u0449\u0435 \u043D\u0435 \u0431\u0443\u043B\u043E \u2014 \u0431\u0430\u0437\u0430 \u043D\u0430\u043F\u043E\u0432\u043D\u0438\u0442\u044C\u0441\u044F \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0448\u043E\u0433\u043E \u0449\u043E\u0434\u0435\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0443.</div>'}

${freshAll.length > 0 ? `<h2>\u041D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F</h2>
${controlBar("/updates", c)}
${listBody(fresh, c, "/updates")}` : latest ? `<h2>\u041D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F</h2><div class="empty">\u041D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043D\u0435 \u0437\u2019\u044F\u0432\u0438\u043B\u043E\u0441\u044F. \u0426\u0435 \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u2014 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u0449\u043E\u0434\u043D\u044F \u0434\u043E\u0434\u0430\u0454 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438.</div>` : ""}

<h2>\u0406\u0441\u0442\u043E\u0440\u0456\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432</h2>
<div class="rows">
${runs.slice(0, 30).map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${date(r.started_at)}${r.status === "failed" ? ' <span class="flag alarm">\u0437\u0431\u0456\u0439</span>' : ""}</div>
    <div class="meta">${r.new_tenders} ${plural(r.new_tenders, "\u043D\u043E\u0432\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u043D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u043D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 ${r.new_flags} ${plural(r.new_flags, "\u043D\u043E\u0432\u0435 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u043D\u043E\u0432\u0456 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u043D\u043E\u0432\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C")} \xB7 ${r.details_fetched} ${plural(r.details_fetched, "\u043A\u0430\u0440\u0442\u043A\u0430", "\u043A\u0430\u0440\u0442\u043A\u0438", "\u043A\u0430\u0440\u0442\u043E\u043A")} \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E${r.errors ? ` \xB7 ${r.errors} ${plural(r.errors, "\u043F\u043E\u043C\u0438\u043B\u043A\u0430", "\u043F\u043E\u043C\u0438\u043B\u043A\u0438", "\u043F\u043E\u043C\u0438\u043B\u043E\u043A")}` : ""}</div>
    ${r.message ? `<div class="meta">${esc(r.message)}</div>` : ""}
  </div>
  <div class="amount"><span class="big">${r.status === "ok" ? "\u2713" : "\u2715"}</span></div>
</div>`
    ).join("")}
</div>

<p class="note">\u0411\u0430\u0437\u0430 \u043E\u043D\u043E\u0432\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0449\u043E\u0440\u0430\u043D\u043A\u0443. \u0423\u0441\u0435, \u0449\u043E \u0432\u0436\u0435 \u0454, \u043D\u0435 \u0434\u0443\u0431\u043B\u044E\u0454\u0442\u044C\u0441\u044F, \u0430 \u043F\u0435\u0440\u0435\u0440\u0432\u0430\u043D\u0435 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0434\u043D\u044F. \u041F\u0456\u0434\u043F\u0438\u0441\u043D\u0438\u043A\u0438 \u0431\u043E\u0442\u0430 \u043E\u0442\u0440\u0438\u043C\u0443\u044E\u0442\u044C \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F.</p>
`
  });
}

// server/pages/prices.ts
function pricesPage(url) {
  const withFindings = dataset().cases.filter((c2) => c2.findings.length > 0);
  const gapOf = (c2) => c2.findings.reduce((total, f) => {
    const e = f.evidence;
    return Math.max(total, e.overpayment ?? e.extra_cost ?? e.comparison_difference ?? 0);
  }, 0);
  const totalGap = withFindings.reduce((t, c2) => t + gapOf(c2), 0);
  const peer = withFindings.filter((c2) => c2.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c2) => c2.findings.some((f) => f.detector_key === "own_price_growth")).length;
  const market = withFindings.filter((c2) => c2.findings.some((f) => ["market_price", "document_market_price"].includes(f.detector_key))).length;
  const c = readControls(url);
  const list = applyControls(withFindings, c, RAILWAY_EDRPOU, { hidePrice: true });
  return layout({
    title: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0430 \u0446\u0456\u043D",
    nav: "prices",
    body: `
<h1>\u0414\u0435 \u0446\u0456\u043D\u0430 \u0432\u0438\u0433\u043B\u044F\u0434\u0430\u0454 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E</h1>
<p class="sub">\u041F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u0437 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u043C\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438 \u0442\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u043E\u044E Prozorro Market. \u041A\u043E\u0436\u0435\u043D \u0441\u0438\u0433\u043D\u0430\u043B \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0443\u043C\u043E\u0432.</p>

<p class="statline">
  <b>${withFindings.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \xB7
  <b>${shortMoney(totalGap)}</b> \u0441\u0443\u043C\u0430 \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0435\u0439 \u043F\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \xB7
  <b>${peer}</b> \u0434\u043E\u0440\u043E\u0436\u0447\u0435, \u043D\u0456\u0436 \u0432 \u0456\u043D\u0448\u0438\u0445 \xB7
  <b>${growth}</b> \u0434\u043E\u0440\u043E\u0436\u0447\u0435 \u0437\u0430 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \xB7
  <b>${market}</b> \u0441\u0438\u0433\u043D\u0430\u043B\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443
</p>

<details class="help">
  <summary>\u042F\u043A \u043C\u0438 \u0446\u0435 \u0440\u0430\u0445\u0443\u0454\u043C\u043E</summary>
  <div class="inner">
    <p>\u0414\u043B\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0431\u0435\u0440\u0435\u043C\u043E \u043B\u0438\u0448\u0435 \u044F\u0432\u043D\u043E \u0432\u043A\u0430\u0437\u0430\u043D\u0443 \u0446\u0456\u043D\u0443 \u043E\u0434\u0438\u043D\u0438\u0446\u0456 \u0437 \u0446\u0438\u0442\u0430\u0442\u043E\u044E, \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C, \u043E\u0434\u0438\u043D\u0438\u0446\u044E, \u0432\u0430\u043B\u044E\u0442\u0443 \u0442\u0430 \u041F\u0414\u0412. \u0421\u0438\u0433\u043D\u0430\u043B \u0432\u0438\u043D\u0438\u043A\u0430\u0454 \u0432\u0456\u0434 50% \u043F\u043E\u043D\u0430\u0434 \u0432\u0435\u0440\u0445\u043D\u0456\u0439 \u043A\u0432\u0430\u0440\u0442\u0438\u043B\u044C \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443. \u0420\u0456\u0437\u043D\u0438\u0446\u044F \u0440\u0430\u0445\u0443\u0454\u0442\u044C\u0441\u044F \u0432\u0456\u0434 \u043C\u0435\u0434\u0456\u0430\u043D\u0438. \u0426\u0435 \u043F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u043E\u0440\u0456\u0454\u043D\u0442\u0438\u0440, \u043D\u0435 \u0446\u0456\u043D\u0430 \u043D\u0430 \u0434\u0430\u0442\u0443 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0456 \u043D\u0435 \u0437\u0431\u0438\u0442\u043E\u043A.</p>
    <p>\u0414\u043B\u044F \u0434\u0430\u043D\u0438\u0445 API \u0440\u0430\u0445\u0443\u0454\u043C\u043E \u0446\u0456\u043D\u0443 \u043E\u0434\u0438\u043D\u0438\u0446\u0456 \u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u0434\u043D\u0456\u0454\u044E \u043F\u043E\u0437\u0438\u0446\u0456\u0454\u044E \u0442\u0430 \u043E\u0434\u043D\u0438\u043C \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u043C \u0440\u0456\u0448\u0435\u043D\u043D\u044F\u043C \u043F\u0440\u043E \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F. \u041E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u0438\u0439 \u0431\u044E\u0434\u0436\u0435\u0442 \u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u043C\u043E.</p>
    <p>\u0414\u0430\u043B\u0456 \u0448\u0443\u043A\u0430\u0454\u043C\u043E, \u0437\u0430 \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0442\u0435 \u0441\u0430\u043C\u0435 \u043A\u0443\u043F\u0443\u0432\u0430\u043B\u0438 \u0456\u043D\u0448\u0456, \u0456 \u0431\u0435\u0440\u0435\u043C\u043E \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0443. \u042F\u043A\u0449\u043E \u0446\u0456\u043D\u0430 \u043F\u043E\u043C\u0456\u0442\u043D\u043E \u0432\u0438\u0449\u0430 \u0437\u0430 \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0443 \u2014 \u043F\u043E\u043A\u0430\u0437\u0443\u0454\u043C\u043E.</p>
    <p>\u0414\u043B\u044F \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u043C\u043E \u0434\u0430\u0442\u0443, \u043E\u0434\u043D\u0430\u043A\u043E\u0432\u0438\u0439 \u043E\u043F\u0438\u0441, \u043E\u0434\u0438\u043D\u0438\u0446\u044E, \u0432\u0430\u043B\u044E\u0442\u0443 \u0442\u0430 \u041F\u0414\u0412. \u0414\u043B\u044F \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0430 \u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u043D\u0430\u0437\u0432\u0438 \u0442\u0430 \u0446\u0456\u043D\u0430 \u043D\u0435 \u043F\u0456\u0437\u043D\u0456\u0448\u0435 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0434\u0430\u0432\u043D\u0456\u0441\u0442\u044E \u0434\u043E 30 \u0434\u043D\u0456\u0432, \u0456\u0437 \u0432\u0438\u0431\u0456\u0440\u043A\u0438 \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 5 \u0441\u043F\u043E\u0441\u0442\u0435\u0440\u0435\u0436\u0435\u043D\u044C. \u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430, \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430\u0446\u0456\u044F \u0439 \u0443\u043C\u043E\u0432\u0438 \u043E\u043F\u043B\u0430\u0442\u0438 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043E\u043A\u0440\u0435\u043C\u043E\u0457 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438.</p>
    <p><strong>\u041C\u0438 \u043C\u043E\u0432\u0447\u0438\u043C\u043E, \u043A\u043E\u043B\u0438 \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0447\u0435\u0441\u043D\u043E \u043D\u0435 \u043C\u043E\u0436\u043D\u0430.</strong> \u0420\u0435\u043C\u043E\u043D\u0442\u0438 \u0439 \u043F\u043E\u0441\u043B\u0443\u0433\u0438 \u043D\u0435 \u043F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u2014 \u043A\u043E\u0436\u0435\u043D \u043E\u0431'\u0454\u043A\u0442 \u0441\u0432\u0456\u0439. \u041D\u0435 \u043F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u0439 \u0442\u043E\u0432\u0430\u0440\u0438 \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u043D\u0430\u0434\u0442\u043E \u0448\u0438\u0440\u043E\u043A\u043E\u0433\u043E \u043A\u043E\u0434\u0443: \u043F\u0456\u0434 \u043E\u0434\u043D\u0438\u043C \u043A\u043E\u0434\u043E\u043C \u043C\u043E\u0436\u0443\u0442\u044C \u0431\u0443\u0442\u0438 \u0456 \u043F\u0440\u043E\u043A\u043B\u0430\u0434\u043A\u0430 \u0437\u0430 400 \u0433\u0440\u043D, \u0456 \u0440\u0435\u0434\u0443\u043A\u0442\u043E\u0440 \u0437\u0430 \u043C\u0456\u043B\u044C\u0439\u043E\u043D.</p>
  </div>
</details>

${controlBar("/prices", c, { hidePrice: true }, { url })}

${listBody(list, c, "/prices")}

<p class="note">\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u0432 \u0446\u0456\u043D\u0456 \u2014 \u0446\u0435 \u0449\u0435 \u043D\u0435 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F. \u0412\u043E\u043D\u0430 \u043C\u043E\u0436\u0435 \u043C\u0430\u0442\u0438 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F: \u0456\u043D\u0448\u0456 \u0443\u043C\u043E\u0432\u0438 \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043D\u043D\u044F, \u0456\u043D\u0448\u0438\u0439 \u0447\u0430\u0441, \u0456\u043D\u0448\u0430 \u044F\u043A\u0456\u0441\u0442\u044C. \u041D\u0430\u0448\u0435 \u0437\u0430\u0432\u0434\u0430\u043D\u043D\u044F \u2014 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0438, \u0434\u0435 \u0446\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u0432\u0430\u0440\u0442\u043E \u0437\u0430\u043F\u0438\u0442\u0430\u0442\u0438.</p>
`
  });
}

// server/pages/lookup.ts
function profileOf(edrpou) {
  const asBuyer = dataset().cases.filter((c) => c.entity_edrpou === edrpou);
  const asWinner = dataset().cases.filter((c) => c.winner_edrpou === edrpou);
  const name = asBuyer.find((c) => c.entity_name)?.entity_name ?? asWinner.find((c) => c.winner_name)?.winner_name ?? null;
  return { asBuyer, asWinner, name };
}
function lookupPage(code, typed) {
  const profile = code ? profileOf(code) : null;
  const found = Boolean(profile && (profile.asBuyer.length > 0 || profile.asWinner.length > 0));
  const cases = profile ? [...new Map([...profile.asBuyer, ...profile.asWinner].map((c) => [c.tender_id, c])).values()].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0)) : [];
  const invalid = Boolean(typed && !code);
  return layout({
    title: "\u0417\u043D\u0430\u0439\u0442\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044E",
    nav: "lookup",
    body: `<section class="company-search">
<header class="company-search-heading"><span class="company-eyebrow">\u041A\u041E\u041C\u041F\u0410\u041D\u0406\u0407</span><h1>\u0417\u043D\u0430\u0439\u0442\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044E</h1><p>\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0457\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438 \u0437\u0430 \u043A\u043E\u0434\u043E\u043C \u0404\u0414\u0420\u041F\u041E\u0423.</p></header>
<form class="company-search-form" method="get" action="/lookup">
<label for="company-code">\u041A\u043E\u0434 \u0404\u0414\u0420\u041F\u041E\u0423</label><div class="company-search-input"><input id="company-code" type="search" name="edrpou" value="${esc(typed)}" placeholder="\u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 40081347" inputmode="numeric" autocomplete="off" aria-describedby="company-code-hint${invalid ? " company-error" : ""}"${invalid ? ' aria-invalid="true"' : ""}><button type="submit">\u0417\u043D\u0430\u0439\u0442\u0438 <span aria-hidden="true">\u2192</span></button></div>
<p id="company-code-hint">\u0412\u0456\u0434 6 \u0434\u043E 10 \u0446\u0438\u0444\u0440. \u041F\u043E\u0448\u0443\u043A \u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E \u043F\u043E\u043A\u0438 \u043D\u0435 \u043F\u0456\u0434\u0442\u0440\u0438\u043C\u0443\u0454\u0442\u044C\u0441\u044F.</p>
${invalid ? '<p class="company-error" id="company-error" role="alert">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u043A\u043E\u0434: \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u0432\u0456\u0434 6 \u0434\u043E 10 \u0446\u0438\u0444\u0440.</p>' : ""}
</form>
${!typed ? `<div class="company-search-guide"><h2>\u0429\u043E \u043C\u043E\u0436\u043D\u0430 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438</h2><div><p><strong>\u042F\u043A \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A</strong><span>\u0429\u043E \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044F \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u0454 \u0442\u0430 \u044F\u043A\u0456 \u0454 \u0441\u0438\u0433\u043D\u0430\u043B\u0438 \u0440\u0438\u0437\u0438\u043A\u0443.</span></p><p><strong>\u042F\u043A \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A</strong><span>\u0423 \u044F\u043A\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0432\u043E\u043D\u0430 \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u043B\u0430.</span></p></div><a href="/lookup?edrpou=40081347">\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u043F\u0440\u0438\u043A\u043B\u0430\u0434 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457 \u2192</a></div>` : ""}
${code && !found ? `<section class="company-empty" aria-live="polite"><h2>\u0423 \u043F\u043E\u0442\u043E\u0447\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044E \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E</h2><p>\u041A\u043E\u0434 <strong>${esc(code)}</strong>. \u041D\u0430\u0448\u0430 \u0431\u0430\u0437\u0430 \u043E\u0445\u043E\u043F\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0447\u0430\u0441\u0442\u0438\u043D\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0412\u0456\u0434\u0441\u0443\u0442\u043D\u0456\u0441\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u0443 \u043D\u0435 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0443\u0454 \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u0456\u0441\u0442\u044C \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u044C.</p><a href="https://prozorro.gov.ua/search/tenders?edrpou=${encodeURIComponent(code)}" target="_blank" rel="noopener">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432 Prozorro \u2197</a></section>` : ""}
</section>
${found && profile ? `<section class="company-results" aria-label="\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0448\u0443\u043A\u0443"><header class="company-profile"><div><p class="company-eyebrow">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(code)}</p><h2>${esc(readableName(profile.name))}</h2></div>${star(profile.asBuyer.length ? "entity" : "supplier", code, "/lookup?edrpou=" + encodeURIComponent(code), { label: true })}</header>
<div class="company-roles">${profile.asBuyer.length ? `<a href="/entity/${encodeURIComponent(code)}"><span>\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A</span><strong>${profile.asBuyer.length} ${plural(profile.asBuyer.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</strong><span>\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0434\u043E\u0441\u044C\u0454 \u2192</span></a>` : ""}${profile.asWinner.length ? `<a href="/supplier/${encodeURIComponent(code)}"><span>\u041F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A</span><strong>${profile.asWinner.length} ${plural(profile.asWinner.length, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")}</strong><span>\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0434\u043E\u0441\u044C\u0454 \u2192</span></a>` : ""}</div>
<div class="company-list-heading"><h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457</h2><span>${cases.length > 6 ? "6 \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 \u0437\u0430 \u0441\u0443\u043C\u043E\u044E \xB7 \u043F\u043E\u0432\u043D\u0438\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0443 \u0434\u043E\u0441\u044C\u0454" : cases.length + " \u0443 \u043F\u043E\u0442\u043E\u0447\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445"}</span></div><div class="rows">${cases.slice(0, 6).map((c) => caseRow(c)).join("")}</div></section>` : ""}`
  });
}

// server/app.ts
async function render(url, saved = []) {
  setStarred(saved);
  setCurrentPath(url.pathname + url.search);
  setRenderPath(url.pathname + url.search);
  const path = decodeURIComponent(url.pathname);
  if (path === "/lookup") {
    const code = normaliseEdrpou(url.searchParams.get("edrpou") ?? "");
    if (!code) return { status: 200, body: lookupPage(null, url.searchParams.get("edrpou") ?? "") };
    return { status: 200, body: lookupPage(code, code) };
  }
  if (path === "/review") return { status: 200, body: reviewPage() };
  if (path === "/starred") return { status: 200, body: starredPage(saved, url) };
  if (path === "/") return { status: 200, body: feedPage(url) };
  if (path === "/entities") return { status: 200, body: entitiesPage(url) };
  if (path === "/officers") return { status: 200, body: officersPage(url) };
  if (path === "/suppliers") return { status: 200, body: suppliersPage(url) };
  if (path === "/railway") return { status: 200, body: railwayPage(url) };
  if (path === "/updates") return { status: 200, body: updatesPage(url) };
  if (path === "/prices") return { status: 200, body: pricesPage(url) };
  if (path === "/indicators") return { status: 200, body: indicatorsPage() };
  if (path === "/about") return { status: 200, body: aboutPage() };
  if (path.startsWith("/article/")) return page(articlePage(path.slice("/article/".length), url));
  if (path.startsWith("/tender/")) {
    const rest = path.slice("/tender/".length);
    if (rest.endsWith("/report") || rest.endsWith("/report.txt")) {
      const asText = rest.endsWith(".txt");
      const id = rest.slice(0, rest.lastIndexOf("/report"));
      const entry = dataset().byTender.get(id);
      if (!entry) return { status: 404, body: notFound() };
      const sameEntity = dataset().cases.filter((x) => x.entity_edrpou && x.entity_edrpou === entry.entity_edrpou);
      const sameOfficer = entry.officer_key ? dataset().cases.filter((x) => x.officer_key === entry.officer_key) : [];
      const sameWinner = entry.winner_edrpou ? dataset().cases.filter((x) => x.winner_edrpou === entry.winner_edrpou) : [];
      const ctx = {
        entry,
        rules: dataset().ruleById,
        sameEntity: sameEntity.length,
        sameOfficer: sameOfficer.length,
        sameWinner: sameWinner.length,
        conclusion: buildConclusion({ entry, sameEntity, sameOfficer, sameWinner }),
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return asText ? {
        status: 200,
        body: reportText(ctx),
        contentType: "text/plain; charset=utf-8",
        filename: `${entry.tender_ref || entry.tender_id}.txt`
      } : { status: 200, body: reportHtml(ctx) };
    }
    return page(await tenderPage(rest, url));
  }
  if (path.startsWith("/entity/")) return page(entityPage(path.slice("/entity/".length), url));
  if (path.startsWith("/officer/")) return page(officerPage(path.slice("/officer/".length), url));
  if (path.startsWith("/supplier/")) return page(supplierPage(path.slice("/supplier/".length), url));
  return { status: 404, body: notFound() };
}
function page(body) {
  return { status: body === notFound() ? 404 : 200, body };
}

// server/auth-pages.ts
var SHELL_STYLES = `
:root{
  color-scheme:dark;
  /* Same tokens as the site (server/html.ts) \u2014 kept local rather than shared
     because this shell has no import path back to that stylesheet. */
  --s1:.25rem; --s2:.5rem; --s3:.75rem; --s4:1rem;
  --s5:1.5rem; --s6:2rem;  --s7:3rem;   --s8:4rem;
  --paper:#0A0E1A;--surface:#10152A;--ink:#E2E8F0;--ink-soft:#9AA5B8;
  --line:#252C42;--accent:#4F7CFF;--accent-bg:#1B2547;--alarm:#FF6B6B;--alarm-bg:#2A1620;
  --shadow:0 16px 40px -20px rgba(0,0,0,.6);--radius:12px;
  --f-display:"DM Sans","Segoe UI",system-ui,sans-serif;--f-body:"DM Sans","Segoe UI",system-ui,sans-serif}
:root[data-theme="light"]{color-scheme:light;--paper:#FBFBFD;--surface:#FFFFFF;--ink:#14181A;--ink-soft:#565B60;
  --line:#E4E6EE;--accent:#3D5FE0;--accent-bg:#EAEEFF;--alarm:#C0392B;--alarm-bg:#FBEAE7;
  --shadow:0 12px 32px -20px rgba(20,24,26,.28)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:var(--paper);color:var(--ink);font-family:var(--f-body);padding:var(--s5)}
.box{max-width:26rem;width:100%;background:var(--surface);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--s6) var(--s5);text-align:center}
h1{font-family:var(--f-display);font-weight:700;font-size:1.4rem;margin:0 0 var(--s3)}
p{color:var(--ink-soft);font-size:.96rem;line-height:1.55;margin:0 0 var(--s5)}
p.denied{background:var(--alarm-bg);color:var(--alarm);border-radius:var(--radius);padding:var(--s3) var(--s4);font-size:.9rem}
a.btn{display:inline-flex;align-items:center;gap:var(--s3);background:var(--accent);color:#fff;
text-decoration:none;font-weight:500;padding:var(--s3) var(--s5);border-radius:var(--radius)}
a.btn:hover{filter:brightness(1.08)}
`;
function shell(title, body) {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} \u2014 \u0422\u0435\u043D\u0434\u043EScope</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${SHELL_STYLES}</style>
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}</script></head>
<body><div class="box">${body}</div></body></html>`;
}
function loginPage() {
  return shell(
    "\u0412\u0445\u0456\u0434",
    `<h1>\u0422\u0435\u043D\u0434\u043EScope</h1>
<p>\u0414\u043E\u0441\u0442\u0443\u043F \u0434\u043E \u0441\u0430\u0439\u0442\u0443 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0435\u043D\u0438\u0445 \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0438\u0445 \u0437\u0430\u043F\u0438\u0441\u0456\u0432. \u0423\u0432\u0456\u0439\u0434\u0456\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Google, \u0449\u043E\u0431 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0438\u0442\u0438.</p>
<a class="btn" href="/auth/login">\u0423\u0432\u0456\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google</a>`
  );
}
function deniedPage(message) {
  return shell(
    "\u0414\u043E\u0441\u0442\u0443\u043F \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E",
    `<h1>\u0414\u043E\u0441\u0442\u0443\u043F \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E</h1>
<p class="denied">${esc(message)}</p>
<a class="btn" href="/auth/login">\u0421\u043F\u0440\u043E\u0431\u0443\u0432\u0430\u0442\u0438 \u0449\u0435 \u0440\u0430\u0437</a>`
  );
}

// server/auth.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var SESSION_COOKIE = "tr_session";
var STATE_COOKIE = "tr_oauth_state";
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var STATE_TTL_SECONDS = 600;
function loadAuthConfig(env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.SESSION_SECRET;
  const allowedRaw = env.ALLOWED_EMAILS;
  if (!clientId || !clientSecret || !sessionSecret || !allowedRaw) return null;
  const allowedEmails = new Set(
    allowedRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  if (allowedEmails.size === 0) return null;
  return { clientId, clientSecret, sessionSecret, allowedEmails };
}
function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
function cookieAttrs(secure) {
  return `HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}
function randomState() {
  return randomBytes(16).toString("base64url");
}
function setStateCookie(state, secure) {
  return `${STATE_COOKIE}=${state}; ${cookieAttrs(secure)}; Max-Age=${STATE_TTL_SECONDS}`;
}
function clearStateCookie(secure) {
  return `${STATE_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}
function createSessionCookie(email, secret, secure) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${email}|${expires}`;
  const value = encodeURIComponent(`${payload}|${sign(payload, secret)}`);
  return `${SESSION_COOKIE}=${value}; ${cookieAttrs(secure)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`;
}
function clearSessionCookie(secure) {
  return `${SESSION_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}
function readSessionEmail(cookieHeader, secret) {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresStr, signature] = parts;
  const expected = sign(`${email}|${expiresStr}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(expiresStr)) || Date.now() > Number(expiresStr)) return null;
  return email;
}
function authorizeUrl(config, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeCode(config, code, redirectUri) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) return null;
  const token = await tokenRes.json();
  if (!token.id_token) return null;
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`);
  if (!infoRes.ok) return null;
  const claims = await infoRes.json();
  if (claims.aud !== config.clientId || !claims.email) return null;
  return { email: claims.email.toLowerCase(), emailVerified: claims.email_verified === "true" };
}

// src/notify/webhook.ts
var START_REPLY = "\u0413\u043E\u0442\u043E\u0432\u043E \u2014 \u0432\u0438 \u043F\u0456\u0434\u043F\u0438\u0441\u0430\u043D\u0456 \u043D\u0430 \u0449\u043E\u0434\u0435\u043D\u043D\u0438\u0439 \u043E\u0433\u043B\u044F\u0434 Tender Radar.\n\n\u0429\u043E\u0434\u043D\u044F \u043D\u0430\u0434\u0441\u0438\u043B\u0430\u0442\u0438\u043C\u0443 \u043A\u043E\u0440\u043E\u0442\u043A\u0443 \u0437\u0432\u0435\u0434\u0435\u043D\u043D\u044F: \u0449\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u0434\u043E\u0434\u0430\u043B\u043E\u0441\u044F \u0442\u0430 \u043A\u0456\u043B\u044C\u043A\u0430 \u043D\u0430\u0439\u043F\u043E\u043C\u0456\u0442\u043D\u0456\u0448\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0429\u043E\u0431 \u0432\u0456\u0434\u043F\u0438\u0441\u0430\u0442\u0438\u0441\u044F, \u043D\u0430\u0434\u0456\u0448\u043B\u0456\u0442\u044C /stop.";
var STOP_REPLY = "\u0412\u0438 \u0432\u0456\u0434\u043F\u0438\u0441\u0430\u043D\u0456. \u0429\u043E\u0431 \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044F, \u043D\u0430\u0434\u0456\u0448\u043B\u0456\u0442\u044C /start.";
function parseCommand(payload) {
  if (typeof payload !== "object" || payload === null) return null;
  const message = payload.message;
  if (typeof message !== "object" || message === null) return null;
  const chatId = message.chat?.id;
  const text = message.text;
  if (typeof chatId !== "number" || typeof text !== "string") return null;
  const word = text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (word === "/start") return { chatId, kind: "start" };
  if (word === "/stop") return { chatId, kind: "stop" };
  return null;
}

// src/store/subscribers.ts
function loadSubscriberConfig(env = process.env) {
  return loadDbConfig(env);
}
function createSubscriberStore(config, fetchImpl = fetch) {
  return {
    // Upsert makes a repeat /start idempotent, and clearing unsubscribed_at
    // is what lets someone come back after /stop.
    async add(chatId) {
      await query(config, [{
        sql: `INSERT INTO tg_subscribers (chat_id, subscribed_at, unsubscribed_at) VALUES (?, ?, NULL)
              ON CONFLICT(chat_id) DO UPDATE SET unsubscribed_at = NULL`,
        args: [chatId, (/* @__PURE__ */ new Date()).toISOString()]
      }], fetchImpl);
    },
    // Soft delete: the row stays so the history of who left survives.
    async remove(chatId) {
      await query(config, [{
        sql: "UPDATE tg_subscribers SET unsubscribed_at = ? WHERE chat_id = ?",
        args: [(/* @__PURE__ */ new Date()).toISOString(), chatId]
      }], fetchImpl);
    },
    async listActive() {
      const [rows] = await query(config, [{
        sql: "SELECT chat_id FROM tg_subscribers WHERE unsubscribed_at IS NULL ORDER BY chat_id"
      }], fetchImpl);
      return rows.map((row) => Number(row.chat_id));
    }
  };
}

// src/notify/telegram.ts
function loadTelegramConfig(env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}
function postMessage(config, chatId, text) {
  return fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
}
async function sendTelegramTo(config, chatId, text) {
  try {
    const res = await postMessage(config, chatId, text);
    if (!res.ok) return { sent: false, reason: `Telegram returned ${res.status}` };
    const body = await res.json();
    return body.ok ? { sent: true } : { sent: false, reason: body.description ?? "Telegram rejected the message" };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

// server/router.ts
function page2(status, body, headers = {}) {
  return { status, body, headers: { "content-type": "text/html; charset=utf-8", ...headers } };
}
function redirect(location, setCookie) {
  const headers = { location };
  if (setCookie) headers["set-cookie"] = setCookie;
  return { status: 302, body: "", headers };
}
function safeBack(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/starred";
  return value;
}
async function handleTelegramWebhook(req, deps) {
  const ok = { status: 200, body: "", headers: { "content-type": "text/plain" } };
  const offered = req.headers?.["x-telegram-bot-api-secret-token"];
  if (!deps.secret) {
    console.error("telegram webhook rejected \u2014 TELEGRAM_WEBHOOK_SECRET is not configured");
    return { status: 401, body: "", headers: { "content-type": "text/plain" } };
  }
  if (offered !== deps.secret) {
    console.error("telegram webhook rejected \u2014 wrong secret token offered");
    return { status: 401, body: "", headers: { "content-type": "text/plain" } };
  }
  if (!deps.store) return ok;
  try {
    const command = parseCommand(JSON.parse(req.body ?? "null"));
    if (!command) return ok;
    if (command.kind === "start") {
      await deps.store.add(command.chatId);
      await deps.reply?.(command.chatId, START_REPLY);
    } else {
      await deps.store.remove(command.chatId);
      await deps.reply?.(command.chatId, STOP_REPLY);
    }
  } catch (err) {
    console.error(`telegram webhook failed \u2014 ${err.message}`);
  }
  return ok;
}
async function handle(req) {
  if (req.url.pathname === "/telegram/webhook") {
    if ((req.method ?? "GET").toUpperCase() !== "POST") {
      return { status: 405, body: "", headers: { "content-type": "text/plain" } };
    }
    const supabase = loadSubscriberConfig();
    const telegram = loadTelegramConfig();
    return handleTelegramWebhook(req, {
      store: supabase ? createSubscriberStore(supabase) : null,
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      reply: telegram ? (chatId, text) => sendTelegramTo(telegram, String(chatId), text).then(() => {
      }) : void 0
    });
  }
  const config = loadAuthConfig();
  const secure = req.url.protocol === "https:";
  const saved = parseFavourites(readCookie(req.cookieHeader, FAVOURITES_COOKIE));
  async function serve() {
    if (req.url.pathname === "/starred/toggle" && (req.method ?? "GET").toUpperCase() === "POST") {
      const form = new URLSearchParams(req.body ?? "");
      const kind = form.get("kind") ?? "";
      const id = (form.get("id") ?? "").trim();
      const back = safeBack(form.get("back"));
      if (!isFavKind(kind) || !id) return redirect(back);
      return redirect(back, favouritesCookie(toggleFavourite(saved, kind, id), secure));
    }
    const rendered = await render(req.url, saved);
    if (rendered.contentType) {
      return {
        status: rendered.status,
        body: rendered.body,
        headers: {
          "content-type": rendered.contentType,
          ...rendered.filename ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(rendered.filename)}` } : {}
        }
      };
    }
    return page2(rendered.status, rendered.body);
  }
  if (!config) return await serve();
  const redirectUri = `${req.url.origin}/auth/callback`;
  if (req.url.pathname === "/auth/login") {
    const state = randomState();
    return redirect(authorizeUrl(config, redirectUri, state), setStateCookie(state, secure));
  }
  if (req.url.pathname === "/auth/logout") {
    return redirect("/auth/login", clearSessionCookie(secure));
  }
  if (req.url.pathname === "/auth/callback") {
    const code = req.url.searchParams.get("code");
    const returnedState = req.url.searchParams.get("state");
    const expectedState = readCookie(req.cookieHeader, STATE_COOKIE);
    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      return page2(400, deniedPage("\u041D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0442 \u043D\u0430 \u0432\u0445\u0456\u0434. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437."), {
        "set-cookie": clearStateCookie(secure)
      });
    }
    const identity = await exchangeCode(config, code, redirectUri);
    const clearState = clearStateCookie(secure);
    if (!identity || !identity.emailVerified) {
      return page2(403, deniedPage("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u043F\u043E\u0448\u0442\u0443 Google."), { "set-cookie": clearState });
    }
    if (!config.allowedEmails.has(identity.email)) {
      return page2(403, deniedPage(`\u0414\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F ${identity.email} \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E. \u0417\u0432\u0435\u0440\u043D\u0456\u0442\u044C\u0441\u044F \u0434\u043E \u0432\u043B\u0430\u0441\u043D\u0438\u043A\u0430 \u0441\u0430\u0439\u0442\u0443.`), {
        "set-cookie": clearState
      });
    }
    return redirect("/", [createSessionCookie(identity.email, config.sessionSecret, secure), clearState]);
  }
  const email = readSessionEmail(req.cookieHeader, config.sessionSecret);
  if (!email || !config.allowedEmails.has(email)) {
    return page2(200, loginPage());
  }
  return await serve();
}

// api-src/handler.ts
async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);
  let payload = "";
  if (req.method === "POST") {
    for await (const chunk of req) payload += chunk;
  }
  const { status, body, headers } = await handle({
    url,
    cookieHeader: req.headers.cookie ?? null,
    method: req.method,
    body: payload,
    headers: req.headers
  });
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("vary", "Cookie");
  res.end(body);
}
export {
  handler as default
};
