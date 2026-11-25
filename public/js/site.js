const api=async(path,data,method='POST')=>{
 const r=await fetch('/api/'+path,data===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j
};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const cash=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);
const link=(text,href,cls='rph-button')=>{const a=el('a',text,cls);a.href=href;return a};
function showMessage(n,msg,error=false){n.textContent=msg;n.classList.toggle('rph-error',error)}
function formSubmit(form,handler){form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('button[type=submit],button:not([type])');if(btn)btn.disabled=true;try{await handler(Object.fromEntries(new FormData(form)))}finally{if(btn)btn.disabled=false}})}
const footer=document.querySelector('footer');
if(footer){const box=el('div',undefined,'col');box.append(el('h4','Online services'),link('Pay an invoice','pay.html',''),link('Admin dashboard','admin.html',''));footer.append(box)}
const navbar=document.querySelector('.navigation>ul');
if(navbar){const li=el('li'),account=el('li');li.append(link('Pay invoice','pay.html',''));account.append(link('My dashboard','agent-dashboard.html',''));navbar.append(li,account)}
if(navbar){
 const dropdowns=[...navbar.children].filter(li=>li.querySelector(':scope > ul'));
 dropdowns.forEach((li,index)=>{const menu=li.querySelector(':scope > ul'),label=li.querySelector(':scope > a')?.textContent.trim()||'Navigation',toggle=el('button','▾','nav-submenu-toggle');li.classList.add('has-submenu');menu.id='nav-submenu-'+index;toggle.type='button';toggle.setAttribute('aria-label','Toggle '+label+' submenu');toggle.setAttribute('aria-controls',menu.id);toggle.setAttribute('aria-expanded','false');li.insertBefore(toggle,menu);const setOpen=open=>{li.classList.toggle('submenu-open',open);toggle.setAttribute('aria-expanded',String(open))};toggle.addEventListener('click',()=>setOpen(!li.classList.contains('submenu-open')));document.addEventListener('click',e=>{if(!li.contains(e.target))setOpen(false)});li.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);toggle.focus()}})});
}
const menuBar=document.querySelector('#bar');if(menuBar){menuBar.classList.remove('fas','far','fa','fa-outdent','fa-bars');menuBar.textContent='☰';menuBar.setAttribute('aria-label','Open navigation');menuBar.setAttribute('role','button');menuBar.tabIndex=0;menuBar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();menuBar.click()}})}
const closeNav=document.querySelector('#close');if(closeNav)closeNav.textContent='✕';
const listing=document.querySelector('#propertylistings');
function renderPropertyCards(target,rows){
 target.replaceChildren();
 if(!rows.length)target.append(el('p','No current listings. Contact us for new opportunities.'));
 rows.forEach(p=>{const card=el('article',undefined,'rph-card rph-property-card');const img=el('img');img.src=p.image;img.alt=p.title;img.loading='lazy';card.append(img,el('span',p.status,'rph-tag'),el('h2',p.title),el('p',p.location),el('h3',cash(p.price)));if(p.description)card.append(el('p',p.description,'rph-property-description'));const actions=el('div',undefined,'rph-property-actions');if(p.status==='Available')actions.append(link('Request inspection','Bookinspection.html?property='+encodeURIComponent(p.title)));const phone=/^[1-9][0-9]{7,14}$/.test(p.whatsapp)?p.whatsapp:'2348149113567';const photo=new URL(p.image,location.href).href;const preview=new URL('/property-share/'+encodeURIComponent(p.id),location.origin).href;const message=`Hello RealProHomesNG, I would like to enquire about ${p.title} in ${p.location} (${cash(p.price)}). Property reference: ${p.id}.\n${preview}`;const whatsapp=link('WhatsApp','https://wa.me/'+phone+'?text='+encodeURIComponent(message),'rph-button rph-whatsapp');whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';whatsapp.setAttribute('aria-label','Chat on WhatsApp about '+p.title);const icon=el('i',undefined,'fab fa-whatsapp');icon.setAttribute('aria-hidden','true');whatsapp.prepend(icon);actions.append(whatsapp);
  const photoLink=link('View photo',photo,'rph-button secondary');photoLink.target='_blank';photoLink.rel='noopener noreferrer';
  if(navigator.share&&navigator.canShare){const share=el('button','Share photo','rph-button secondary');share.type='button';let file;share.addEventListener('click',async()=>{try{if(!file){share.disabled=true;share.textContent='Preparing photo…';const r=await fetch(photo);if(!r.ok)throw Error();const blob=await r.blob();const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[blob.type];if(!ext)throw Error();file=new File([blob],'realpro-property.'+ext,{type:blob.type});if(!navigator.canShare({files:[file]}))throw Error();}if(navigator.userActivation&&!navigator.userActivation.isActive){share.textContent='Tap to share photo';return}await navigator.share({files:[file],title:p.title,text:`${p.title} — ${p.location} — ${cash(p.price)}`});share.textContent='Share photo'}catch(e){if(e.name!=='AbortError'){share.replaceWith(photoLink)}else share.textContent='Share photo'}finally{share.disabled=false}});actions.append(share)}else actions.append(photoLink);
  card.append(actions);target.append(card)})
}
if(listing){
 listing.className='rph-wrap rph-grid';
 const paginations=[...document.querySelectorAll('#pagination-top, #pagination')];
 const groups=paginations.map(pagination=>{
  const previous=el('button','← Previous','rph-page-button'),next=el('button','Next →','rph-page-button'),pageStatus=el('span','Loading…','rph-page-status');
  previous.type=next.type='button';pageStatus.setAttribute('role','status');
  pagination.replaceChildren(previous,pageStatus,next);
  return {previous,next,pageStatus};
 });
 let current=1,totalPages=1,loading=false;
 const controls=()=>{for(const {previous,next} of groups){previous.disabled=loading||current<=1;next.disabled=loading||current>=totalPages}};
 const updateStatus=text=>groups.forEach(({pageStatus})=>pageStatus.textContent=text);
 async function loadProperties(page,scroll=false){
  if(loading)return;loading=true;controls();
  listing.setAttribute('aria-busy','true');
  try{
   const result=await api('properties?page='+page);
   current=result.page;totalPages=result.totalPages;
   renderPropertyCards(listing,result.items);
   updateStatus(result.total?'Page '+current+' of '+totalPages+' · '+result.total+' properties':'No properties');
   if(scroll)(paginations[0]||listing).scrollIntoView({behavior:'smooth',block:'start'});
  }catch{
   if(!listing.querySelector('.rph-property-card'))listing.replaceChildren(el('p','Listings unavailable. Please try again.'));
   updateStatus('Unable to load page. Please refresh or try again.');
  }finally{loading=false;controls();listing.setAttribute('aria-busy','false')}
 }
 for(const {previous,next} of groups){
  previous.addEventListener('click',()=>loadProperties(current-1,true));
  next.addEventListener('click',()=>loadProperties(current+1,true));
 }
 listing.replaceChildren(el('p','Loading properties…'));loadProperties(1);
}
const path=location.pathname.toLowerCase();
for(const form of document.querySelectorAll('form[action^="mailto:"],#smartinvest-contact')){
 if(!/bookinspection|contact|email-us|customersupport|smartinvest/.test(path))continue;
 const status=el('p','','rph-message');form.append(status);form.removeAttribute('action');form.removeAttribute('enctype');
 const text=form.querySelector('textarea');if(text)text.name='details';
 formSubmit(form,async d=>{try{await api('inquiry',{kind:path.includes('bookinspection')?'inspection':'contact',name:d.name,email:d.email,phone:d['Phone-number']||d.phone,message:[d.subject,d.message,d.details].filter(Boolean).join(' — ')});form.reset();showMessage(status,'Thank you! Our team will contact you.')}catch(e){showMessage(status,e.message,true)}});
 if(path.includes('bookinspection')&&text&&new URLSearchParams(location.search).has('property'))text.value='Property: '+new URLSearchParams(location.search).get('property');
}
for(const box of document.querySelectorAll('#newsletter .form')){
 const input=box.querySelector('input'),button=box.querySelector('button');if(!input||!button)continue;input.type='email';input.required=true;input.maxLength=250;input.autocomplete='email';input.setAttribute('aria-label','Newsletter email address');button.type='button';const status=el('p','','rph-message');status.setAttribute('role','status');box.after(status);async function subscribe(){if(button.disabled||!input.reportValidity())return;button.disabled=true;try{await api('inquiry',{kind:'newsletter',email:input.value});input.value='';showMessage(status,'Subscribed. Thank you!')}catch(e){showMessage(status,e.message,true)}finally{button.disabled=false}}button.addEventListener('click',subscribe);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();subscribe()}})
}
const signup=document.querySelector('#signup-form');
if(signup){const pw=signup.querySelector('.input-wrapper');if(pw)pw.remove();signup.querySelector('#name').name='name';signup.querySelector('#email').name='email';const status=el('p','','rph-message');signup.append(status);formSubmit(signup,async d=>{try{await api('inquiry',{...d,kind:'interest',message:'Interested in RealProHomesNG updates'});signup.reset();showMessage(status,'Thank you! We will be in touch.')}catch(e){showMessage(status,e.message,true)}})}
const details=document.querySelector('.property-details');
if(details){details.querySelectorAll('input,br').forEach(n=>n.remove());const b=details.querySelector('button');if(b){b.replaceWith(link('Book inspection','Bookinspection.html?property='+encodeURIComponent(details.querySelector('h6')?.textContent||'')));}}
const hero=document.querySelector('#hero');
if(hero){const actions=el('div',undefined,'rph-home-actions');const existing=hero.querySelector('button');if(existing)actions.append(existing);actions.append(link('Explore available properties','property-listing.html','rph-button secondary'));hero.append(actions);
 const intro=el('section',undefined,'rph-wrap');intro.append(el('span','HOME FOR ALL','rph-tag'),el('h2','Invest with confidence','rph-title'));const grid=el('div',undefined,'rph-grid');
 for(const [heading,description,href] of [['Find your home','Explore available homes and investment opportunities.','property-listing.html'],['Book an inspection','Speak with our team and arrange a visit.','Bookinspection.html'],['Pay securely','Use the invoice reference supplied by our team.','pay.html']]){const c=el('article',undefined,'rph-card');c.append(el('h3',heading),el('p',description),link('Learn more',href));grid.append(c)}intro.append(grid);hero.after(intro);
}


document.getElementById('opportunityForm')
?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const status = document.getElementById('applicationStatus');
    const button = this.querySelector('button[type="submit"]');
    const data = new FormData(this);

    status.textContent = 'Submitting application...';
    button.disabled = true;

    try {
        const response = await fetch('/api/inquiry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kind: 'interest',
                name: data.get('fullname'),
                email: data.get('email'),
                phone: data.get('phone'),
                message: 'Opportunity: ' +
                    data.get('opportunity') + '\n' +
                    data.get('message')
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Submission failed');
        }

        status.style.color = 'green';
        status.textContent = 'Application submitted successfully!';
        this.reset();

    } catch (error) {
        status.style.color = 'red';
        status.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

