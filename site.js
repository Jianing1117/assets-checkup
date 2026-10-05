
const D=document,H=D.documentElement;H.classList.add('js');
const calm=matchMedia('(prefers-reduced-motion:reduce)').matches,fine=matchMedia('(hover:hover)').matches;
const on=k=>!H.classList.contains('no-'+k);
const seen=(els,fn,th=.2)=>{const o=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){fn(x.target);o.unobserve(x.target)}}),{threshold:th});els.forEach(e=>o.observe(e))};

/* 入场 */
seen(D.querySelectorAll('.rv,.ladder'),e=>e.classList.add('in'),.15);
setTimeout(()=>D.querySelectorAll('.rv').forEach(e=>e.classList.add('in')),1600);

/* 手机菜单 */
D.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',ev=>{ev.preventDefault();D.querySelector('[data-panel]').classList.toggle('open')}));

/* 一 浮雕的白 */
const R=D.querySelector('.relief');
if(R&&!calm&&fine&&on('relief')){let cx=0,cy=0,tx=0,ty=0,x=0,y=0,raf=0,ok=false;
  const aim=()=>{const r=R.getBoundingClientRect();tx=cx-r.left;ty=cy-r.top;if(!ok){x=tx;y=ty;ok=true}if(!raf)raf=requestAnimationFrame(tick)};
  const tick=()=>{x+=(tx-x)*.1;y+=(ty-y)*.1;R.style.setProperty('--mx',x+'px');R.style.setProperty('--my',y+'px');raf=Math.abs(tx-x)+Math.abs(ty-y)>.4?requestAnimationFrame(tick):0};
  addEventListener('pointermove',e=>{cx=e.clientX;cy=e.clientY;R.classList.add('on');aim()});
  addEventListener('scroll',()=>ok&&aim(),{passive:true});
  H.addEventListener('pointerleave',()=>R.classList.remove('on'))}

/* 复制微信号 */
D.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.copy,done=()=>{b.textContent='COPIED';setTimeout(()=>b.textContent='COPY',1800)};
  if(navigator.clipboard)navigator.clipboard.writeText(t).then(done,done);else{const r=D.createRange();r.selectNodeContents(b.previousElementSibling);const s=getSelection();s.removeAllRanges();s.addRange(r);try{D.execCommand('copy')}catch(e){}done()}}));

/* 三 阅读进度与目录跟随 */
const hs=[...D.querySelectorAll('.art h2[id]')],P=D.querySelector('.prog');
if(hs.length){const links=new Map([...D.querySelectorAll('.side li a')].map(a=>[a.getAttribute('href').slice(1),a.parentNode]));
  const spy=()=>{let cur=hs[0];for(const h of hs)if(h.getBoundingClientRect().top<innerHeight*.35)cur=h;links.forEach(li=>li.classList.remove('on'));links.get(cur.id)?.classList.add('on');
    P.style.transform='scaleX('+Math.min(1,H.scrollTop/(H.scrollHeight-innerHeight))+')'};
  addEventListener('scroll',spy,{passive:true});spy()}

/* 八 封面句逐字排出 */
D.querySelectorAll('[data-type]').forEach(h=>{let n=0;[...h.childNodes].forEach(nd=>{if(nd.nodeType!==3)return;const f=D.createDocumentFragment();[...nd.textContent].forEach(c=>{const s=D.createElement('span');s.className='ch';s.style.setProperty('--n',n++);s.textContent=c;f.appendChild(s)});nd.replaceWith(f)})});
seen(D.querySelectorAll('[data-type]'),e=>e.classList.add('in'),.5);
setTimeout(()=>{const h=D.querySelector('.cv [data-type]');h&&h.classList.add('in')},1200);

/* 词条库即时筛选 */
const G=D.querySelector('[data-gl]');
if(G){const rows=[...D.querySelectorAll('[data-k]')],secs=[...D.querySelectorAll('[data-g]')],C=D.querySelector('[data-glc]');
  const run=()=>{const q=G.value.trim().toLowerCase();let n=0;rows.forEach(r=>{const hit=!q||r.dataset.k.includes(q);r.style.display=hit?'':'none';n+=hit});secs.forEach(s=>s.style.display=[...s.querySelectorAll('[data-k]')].some(r=>r.style.display!=='none')?'':'none');C.textContent=String(n).padStart(2,'0')+' / '+String(rows.length).padStart(2,'0')};
  G.addEventListener('input',run);run();addEventListener('keydown',e=>{if(e.key==='/'&&D.activeElement!==G){e.preventDefault();G.focus()}})}
