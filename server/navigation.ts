/** Task-based navigation, shared by desktop and mobile. */
const groups = [
 {title:"Знайти та зберегти", items:[
  {href:"/", nav:"feed", label:"Закупівлі", hint:"Пошук за назвою, регіоном або замовником", icon:"⌕"},
  {href:"/railway", nav:"railway", label:"Залізниця", hint:"Закупівлі залізничних організацій", icon:"↔"},
  {href:"/starred", nav:"starred", label:"Обране", hint:"Закупівлі й компанії, які ви зберегли", icon:"☆"}]},
 {title:"Перевірити", items:[
  {href:"/lookup", nav:"lookup", label:"Знайти компанію", hint:"Введіть її код ЄДРПОУ", icon:"⌕"},
  {href:"/prices", nav:"prices", label:"Цінові сигнали", hint:"Порівняння цін, які потребують перевірки", icon:"₴"},
  {href:"/article/366", nav:"article-366", label:"Розбіжності в документах", hint:"Сигнали та пояснення для перевірки", icon:"≡"}]},
 {title:"Учасники закупівель", items:[
  {href:"/entities", nav:"entities", label:"Замовники", hint:"Хто закуповує товари, роботи й послуги", icon:"↗"},
  {href:"/suppliers", nav:"suppliers", label:"Постачальники", hint:"Компанії, зазначені у результатах закупівель", icon:"↗"},
  {href:"/officers", nav:"officers", label:"Контактні особи", hint:"Контакти, зазначені в закупівлях", icon:"↗"}]},
 {title:"Допомога та дані", items:[
  {href:"/about", nav:"about", label:"Як користуватися радаром", hint:"Звідки дані та як читати результати", icon:"?"},
  {href:"/indicators", nav:"indicators", label:"Що означають сигнали", hint:"Пояснення ознак ризику простими словами", icon:"?"},
  {href:"/updates", nav:"updates", label:"Оновлення даних", hint:"Коли і як оновлювалася база", icon:"↻"}]}];

export function navigationContent(current = ""): string {
 return groups.map((group,i)=>`<section class="menu-section" aria-labelledby="menu-group-${i}"><h3 id="menu-group-${i}">${group.title}</h3><ul>${group.items.map(item=>`<li><a href="${item.href}"${current===item.nav?' aria-current="page"':''}><span class="menu-icon" aria-hidden="true">${item.icon}</span><span><strong>${item.label}</strong><small>${item.hint}</small></span>${current===item.nav?'<span class="menu-current">Ви тут</span>':''}</a></li>`).join('')}</ul></section>`).join('');
}
export function navigationDialog(current = ""): string {
 return `<dialog class="site-menu" id="site-menu" aria-labelledby="site-menu-title"><div class="menu-header"><div><h2 id="site-menu-title">Куди перейти?</h2><p>Оберіть, що хочете зробити</p></div><button type="button" class="menu-close" data-menu-close aria-label="Закрити меню">×</button></div><nav aria-label="Усі розділи">${navigationContent(current)}</nav><p class="menu-footnote">Сигнал ризику не означає доведене порушення.</p></dialog><noscript><details class="no-script-menu"><summary>Меню — усі розділи</summary><nav>${navigationContent(current)}</nav></details></noscript>`;
}
export const NAVIGATION_SCRIPT = `<script>
(()=>{const dialog=document.getElementById('site-menu');if(!dialog)return;let opener=null;
const triggers=[...document.querySelectorAll('[data-menu-open]')];
triggers.forEach(button=>button.addEventListener('click',()=>{opener=button;dialog.showModal();triggers.forEach(t=>t.setAttribute('aria-expanded','true'));document.body.classList.add('menu-open');dialog.querySelector('[data-menu-close]').focus();}));
dialog.querySelector('[data-menu-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.classList.remove('menu-open');triggers.forEach(t=>t.setAttribute('aria-expanded','false'));if(opener)opener.focus();});
})();</script>`;
export const NAVIGATION_STYLES = `
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
