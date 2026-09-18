(function () {
  'use strict';
  const $ = (selector, element = document) => element.querySelector(selector);
  const $$ = (selector, element = document) => Array.from(element.querySelectorAll(selector));
  const base = document.documentElement.dataset.base || '/';
  const withBase = (path) => (base === '/' ? '/' : base.replace(/\/$/, '') + '/') + path;
  let toastTimer;
  let searchData;
  let searchPromise;
  let searchGeneration = 0;
  function toast(message) {
    const target = $('#toast');
    if (!target) return;
    target.textContent = message;
    target.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>target.classList.remove('visible'),2400);
  }
  async function copy(text, element) {
    if (!text) return toast('복사할 내용이 없습니다.');
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('클립보드에 복사했습니다.');
    } catch (_) {
      if (element instanceof HTMLTextAreaElement) { element.focus(); element.select(); toast('자동 복사가 허용되지 않습니다. 선택된 내용을 Ctrl+C로 복사하세요.'); }
      else toast('자동 복사가 허용되지 않습니다. 주소 표시줄에서 직접 복사하세요.');
    }
  }
  function themeButton() {
    const button=$('[data-toggle-theme]');
    if(!button)return;
    const dark=document.documentElement.dataset.theme==='dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label',dark?'밝은 테마로 전환':'어두운 테마로 전환');
  }
  function closeMenu() {
    $('#primary-nav')?.classList.remove('open');
    const b=$('[data-toggle-menu]');
    if(b){b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','메뉴 열기');}
  }
  async function loadSearch() {
    if(searchData)return searchData;
    if(window.__SEARCH_DATA){searchData=window.__SEARCH_DATA;return searchData;}
    if(!searchPromise){
      searchPromise=fetch(withBase('search-index.json'),{credentials:'omit'}).then(response=>{
        if(!response.ok)throw new Error('검색 인덱스를 불러올 수 없습니다.');
        return response.json();
      }).then(data=>{if(!Array.isArray(data))throw new Error('검색 데이터 형식 오류');searchData=data;return data;}).catch(error=>{searchPromise=null;throw error;});
    }
    return searchPromise;
  }
  async function search() {
    const generation=++searchGeneration;
    const result=$('#search-results');
    const query=($('#site-search')?.value || '').normalize('NFKC').toLowerCase().trim();
    if(!result)return;
    result.replaceChildren();
    if(!query){const p=document.createElement('p');p.className='search-empty';p.textContent='검색어를 입력해 주세요.';result.append(p);return;}
    try {
      const data=await loadSearch();
      if(generation!==searchGeneration)return;
      const tokens=query.split(/\s+/);
      const matches=data.map(item=>{
        const title=String(item.title).normalize('NFKC').toLowerCase();
        const haystack=[item.title,item.description,...(item.tags || []),item.body || ''].join(' ').normalize('NFKC').toLowerCase();
        return {item,match:tokens.every(token=>haystack.includes(token)),score:tokens.reduce((n,t)=>n+(title.includes(t)?5:1),0)};
      }).filter(x=>x.match).sort((a,b)=>b.score-a.score).slice(0,20);
      if(!matches.length){const p=document.createElement('p');p.className='search-empty';p.textContent='검색 결과가 없습니다.';result.append(p);}
      for(const {item} of matches){
        const a=document.createElement('a');a.className='search-result';a.href=item.url;a.dataset.route=item.route;
        const type=document.createElement('small');type.textContent=item.type;
        const strong=document.createElement('strong');strong.textContent=item.title;
        const description=document.createElement('p');description.textContent=item.description;
        a.append(type,strong,description);result.append(a);
      }
    } catch(_) {if(generation===searchGeneration){const p=document.createElement('p');p.className='search-empty';p.textContent='검색 데이터를 읽지 못했습니다. 로컬 서버 또는 정상 배포 주소에서 다시 시도하세요.';result.append(p);}}
  }
  function openSearch(){const d=$('#search-dialog');if(!d?.open)d?.showModal();$('#site-search')?.focus();search();}
  document.addEventListener('click',function(event){
    const target=event.target instanceof Element ? event.target : null;
    if(!target)return;
    if(target.closest('[data-toggle-theme]')){
      const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;
      try{localStorage.setItem('notes-works-theme',next);}catch(_){}
      themeButton();
    }
    if(target.closest('[data-toggle-menu]')){const menu=$('#primary-nav');const opened=menu?.classList.toggle('open');const b=$('[data-toggle-menu]');b?.setAttribute('aria-expanded',String(opened));b?.setAttribute('aria-label',opened?'메뉴 닫기':'메뉴 열기');}
    if(target.closest('[data-open-search]'))openSearch();
    if(target.closest('[data-close-search]'))$('#search-dialog')?.close();
    if(target.closest('[data-print]'))window.print();
    if(target.closest('[data-copy-url]'))copy(location.href);
    if(target.closest('a[data-route]')){closeMenu();$('#search-dialog')?.close();}
    if(target.matches('#search-dialog')){const r=target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)target.close();}
  });
  document.addEventListener('keydown',function(event){
    const editing=event.target instanceof Element && !!event.target.closest('input,textarea,select,[contenteditable=true]');
    if((event.key.toLowerCase()==='k'&&(event.ctrlKey||event.metaKey))||(!editing&&event.key==='/')){event.preventDefault();openSearch();}
    if(event.key==='Escape')closeMenu();
  });
  $('#site-search')?.addEventListener('input',search);
  function initFilters(){
    $$('[data-filter-list]').forEach(list=>{
      if(list.dataset.bound)return;list.dataset.bound='true';let active='all';
      function apply(){const query=($('[data-list-search]',list)?.value||'').toLowerCase().trim();let count=0;
        $$('[data-filter-item]',list).forEach(item=>{const show=(active==='all'||(item.dataset.tags||'').split('|').includes(active))&&(!query||(item.dataset.search||'').includes(query));item.hidden=!show;if(show)count++;});
        const label=$('[data-filter-count]',list);if(label)label.textContent=`${count}개의 기록`;
        const empty=$('[data-empty-filter]',list);if(empty)empty.hidden=count>0;
      }
      $$('[data-tag]',list).forEach(button=>button.addEventListener('click',()=>{active=button.dataset.tag;$$('[data-tag]',list).forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});apply();}));
      $('[data-list-search]',list)?.addEventListener('input',apply);
    });
  }
  function setStatus(text,error=false){const s=$('[data-tool-status]');if(s){s.textContent=text;s.classList.toggle('error',error);}}
  async function ensureTools(){
    if(window.PersonalTools)return;
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=withBase('assets/tool-core.js');script.onload=resolve;script.onerror=()=>reject(new Error('도구 코드를 불러오지 못했습니다.'));document.head.append(script);});
  }
  async function initTools(){
    const root=$('[data-tool]');if(!root||root.dataset.bound)return;root.dataset.bound='true';
    try{await ensureTools();}catch(error){setStatus(error.message,true);return;}
    const type=root.dataset.tool;
    if(type==='time'){
      $('[data-time-forward]',root)?.addEventListener('click',()=>{try{const result=window.PersonalTools.unixToTime($('#timestamp-input').value,$('#timestamp-unit').value);$('#time-utc').textContent=result.utc;$('#time-kst').textContent=result.korea;setStatus('UTC와 한국 시간으로 변환했습니다.');}catch(error){$('#time-utc').textContent='—';$('#time-kst').textContent='—';setStatus(error.message,true);}});
      $('[data-time-now]',root)?.addEventListener('click',()=>{$('#timestamp-input').value=String(Date.now());$('#timestamp-unit').value='milliseconds';$('[data-time-forward]',root).click();});
      $('[data-time-reverse]',root)?.addEventListener('click',()=>{try{const result=window.PersonalTools.timeToUnix($('#iso-input').value);$('#time-seconds').textContent=String(result.seconds);$('#time-milliseconds').textContent=String(result.milliseconds);setStatus('Unix 타임스탬프로 변환했습니다.');}catch(error){$('#time-seconds').textContent='—';$('#time-milliseconds').textContent='—';setStatus(error.message,true);}});
      return;
    }
    const input=$('#tool-input',root),output=$('#tool-output',root);
    $$('[data-transform]',root).forEach(button=>button.addEventListener('click',()=>{try{const result=type==='json'?window.PersonalTools.jsonTransform(input.value,button.dataset.transform):window.PersonalTools.urlTransform(input.value,button.dataset.transform);output.value=result.output;setStatus(result.message);}catch(error){output.value='';setStatus(`처리할 수 없습니다: ${error.message}`,true);}}));
    $('[data-tool-example]',root)?.addEventListener('click',()=>{input.value=type==='json'?'\{"project":"개인 사이트","tools":["JSON","URL","TIME"],"localOnly":true}':'안녕하세요 & hello world +';output.value='';setStatus('예시를 입력했습니다. 원하는 기능을 선택하세요.');});
    $('[data-tool-clear]',root)?.addEventListener('click',()=>{input.value='';output.value='';input.focus();setStatus('입력과 결과를 비웠습니다.');});
    $('[data-tool-copy]',root)?.addEventListener('click',()=>copy(output.value,output));
  }
  function init(){themeButton();initFilters();initTools();}
  document.addEventListener('personal:page-ready',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
