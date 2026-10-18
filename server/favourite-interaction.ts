/** Progressive enhancement: the original POST forms remain usable without JS. */
export const FAVOURITE_SCRIPT = `<script>
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
      button.title=on?'Прибрати з обраного':'Додати до обраного';
      button.setAttribute('aria-label',button.title);
      if(button.firstChild && button.firstChild.nodeType===3)button.firstChild.textContent=on?'★':'☆';
      if(label)label.textContent=on?'В обраному':'До обраного';
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
      announce(wanted?'Збережено в обраному':'Прибрано з обраного');
    }catch(error){
      announce('Не вдалося змінити обране. Перевірте з’єднання та спробуйте ще раз.');
    }finally{
      sync();busy=false;form.removeAttribute('aria-busy');
      buttons.forEach(function(button){button.removeAttribute('aria-disabled');});
    }
  });
  window.addEventListener('pageshow',sync);
  window.addEventListener('focus',function(){if(!busy)sync();});
})();
</script>`;
