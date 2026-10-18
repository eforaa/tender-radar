// Same validator runs in Node tests and in the browser. Never interprets imported HTML.
export function validReviewRows(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 2000 && value.every(r => r && typeof r === "object" &&
    typeof r.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(r.id) &&
    typeof r.title === "string" && r.title.length <= 2000 &&
    typeof r.ref === "string" && r.ref.length <= 100 &&
    typeof r.note === "string" && r.note.length <= 10000 &&
    ["to_review", "in_progress", "needs_documents", "explained"].includes(r.status) &&
    typeof r.updated_at === "string" && Number.isFinite(Date.parse(r.updated_at))) &&
    new Set(value.map(r => r.id)).size === value.length;
}

export const REVIEW_SCRIPT = `<script>
(()=>{
const editor=document.querySelector('[data-review-editor]'), list=document.getElementById('review-list');
if(!editor&&!list)return;
const valid=${validReviewRows.toString()}, key='tendoscope-review-v1';
const labels={to_review:'Потрібно перевірити',in_progress:'У роботі',needs_documents:'Потрібні документи',explained:'Є пояснення'};
const message=document.getElementById('review-message');let loadedVersion=null;
function say(text){message.textContent=text;}
function read(){const rows=JSON.parse(localStorage.getItem(key)||'[]');if(!valid(rows))throw Error('invalid');return rows;}
function save(rows){if(!valid(rows))throw Error('invalid');localStorage.setItem(key,JSON.stringify(rows));}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function draw(){if(!list)return;const rows=read(),status=document.getElementById('review-filter').value,query=document.getElementById('review-search').value.toLocaleLowerCase();list.replaceChildren();
const selected=rows.filter(r=>(!status||r.status===status)&&[r.title,r.ref,r.note].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
document.getElementById('review-count').textContent=selected.length+' із '+rows.length;
if(!selected.length){list.append(node('p',rows.length?'За цими умовами нічого немає.':'Відкрийте закупівлю та натисніть «Моя перевірка», щоб додати її сюди.'));return;}
selected.forEach(r=>{const card=node('article','');card.className='review-card';card.append(node('small',labels[r.status]));const title=node('a',r.title);title.href='/tender/'+encodeURIComponent(r.id)+'?from=%2Freview';card.append(title,node('span',r.ref));if(r.note){const note=node('p',r.note);note.className='review-note';card.append(note);}card.append(node('small','Оновлено '+new Date(r.updated_at).toLocaleString('uk-UA')));list.append(card);});}
function loadEditor(){if(!editor)return;const meta=JSON.parse(editor.dataset.reviewEditor), row=read().find(r=>r.id===meta.id);loadedVersion=row?.updated_at||null;editor.elements.status.value=row?.status||'to_review';editor.elements.note.value=row?.note||'';}
try{loadEditor();draw();}catch{say('Не вдалося прочитати локальну чергу. Збереження недоступне; наявні дані не змінено.');}
editor?.addEventListener('submit',event=>{event.preventDefault();try{const rows=read(),meta=JSON.parse(editor.dataset.reviewEditor),current=rows.find(r=>r.id===meta.id);if((current?.updated_at||null)!==loadedVersion){say('Запис змінився в іншій вкладці. Скопіюйте нотатку та оновіть сторінку перед збереженням.');return;}const row={...meta,status:editor.elements.status.value,note:editor.elements.note.value,updated_at:new Date().toISOString()};save([...rows.filter(r=>r.id!==row.id),row]);loadedVersion=row.updated_at;say('Збережено у цьому браузері.');}catch{say('Не вдалося зберегти. Перевірте доступ до сховища браузера або експортуйте чергу.');}});
for(const id of ['review-filter','review-search'])document.getElementById(id)?.addEventListener('input',()=>{try{draw();}catch{say('Не вдалося прочитати чергу.');}});
document.getElementById('review-export')?.addEventListener('click',()=>{try{const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a','');a.href=url;a.download='tendoscope-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Резервну копію підготовлено. Вона містить ваші нотатки.');}catch{say('Не вдалося експортувати чергу.');}});
document.getElementById('review-import')?.addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>5000000)throw Error('size');const incoming=JSON.parse(await file.text());if(!valid(incoming))throw Error('invalid');const merged=new Map(read().map(r=>[r.id,r]));incoming.forEach(r=>{const old=merged.get(r.id);if(!old||Date.parse(r.updated_at)>Date.parse(old.updated_at))merged.set(r.id,r);});save([...merged.values()]);draw();say('Копію відновлено. Для збігів залишено новіший запис.');}catch{say('Не вдалося імпортувати: перевірте формат, розмір файлу та доступ до сховища.');}finally{event.target.value='';}});
window.addEventListener('storage',event=>{if(event.key===key){try{draw();if(editor)say('Черга змінилася в іншій вкладці. Оновіть сторінку перед редагуванням.');}catch{say('Не вдалося прочитати змінену чергу.');}}});
})();</script>`;

export const REVIEW_STYLES = `<style>
.review-editor{display:grid;gap:.8rem;padding:1rem 0}.review-editor label{display:grid;gap:.4rem}.review-editor textarea{min-height:6rem;resize:vertical}.review-editor input,.review-editor select,.review-editor textarea,.review-tools input,.review-tools select{font:inherit;max-width:100%;width:100%;min-width:0;padding:.65rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink)}
.review-actions,.review-tools{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}.review-actions button,.review-tools button{min-height:44px;padding:.5rem .85rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--accent);font:inherit;cursor:pointer}.review-tools label{flex:1;min-width:12rem;display:grid;gap:.35rem}.review-card{display:grid;gap:.5rem;padding:1rem 0;border-bottom:1px solid var(--line);min-width:0}.review-card>a{font-weight:600;font-size:1.05rem}.review-card small,.review-card>span{color:var(--ink-soft)}.review-note{white-space:pre-wrap;max-height:8rem;overflow:auto;margin:0}.review-card,.document-fact{overflow-wrap:anywhere}.document-fact{padding:1rem 0;border-bottom:1px solid var(--line)}.document-fact blockquote{margin:.5rem 0;padding-left:.8rem;border-left:2px solid var(--line);white-space:pre-wrap;font-size:.9rem}.document-results{margin:1.5rem 0}#review-message:empty{display:none}
@media(max-width:44rem){.review-tools{align-items:stretch}.review-tools label{flex-basis:100%}.review-editor select,.review-editor textarea,.review-tools input,.review-tools select{font-size:16px}}
</style>`;
