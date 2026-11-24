const login=document.querySelector('#login'),dashboard=document.querySelector('#dashboard'),logout=document.querySelector('#logout'),notice=document.querySelector('#notice'),property=document.querySelector('#property-form'),created=document.querySelector('#created');
function btn(label,action){const b=el('button',label,'rph-button secondary');b.type='button';b.onclick=async()=>{b.disabled=true;try{await action()}catch(e){showMessage(notice,e.message,true)}finally{b.disabled=false}};return b}
function table(id,heads,rows){const target=document.getElementById(id),t=el('table'),thead=el('thead'),hr=el('tr'),body=el('tbody');heads.forEach(h=>hr.append(el('th',h)));thead.append(hr);t.append(thead,body);rows.forEach(row=>{const tr=el('tr');row.forEach(value=>{const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=value;tr.append(td)});body.append(tr)});target.replaceChildren(t);if(!rows.length)target.append(el('p','No records yet.'))}
function invoiceLink(id){return new URL('pay.html?id='+encodeURIComponent(id),location.href).href}
let partners=[];
let inquiryRows=[],inquiryRequest=0;
const inquiryPanel=document.getElementById('inquiry-panel'),kindFilter=document.getElementById('inquiry-kind'),statusFilter=document.getElementById('inquiry-filter'),emailSearch=document.getElementById('inquiry-search');
function updateInquiryCard(){
 const card=document.getElementById('enquiry-card');if(!card)return;
 const unread=inquiryRows.filter(i=>i.status==='new'),subscribers=inquiryRows.filter(i=>i.kind==='newsletter'),newSubscribers=subscribers.filter(i=>i.status==='new').length;
 card.classList.toggle('has-new',unread.length>0);card.querySelector('h2').textContent=String(unread.length);
 const badge=card.querySelector('.rph-inquiry-badge'),badgeText=`${newSubscribers} new subscriber${newSubscribers===1?'':'s'}`;badge.hidden=!newSubscribers;if(badge.textContent!==badgeText)badge.textContent=badgeText;
 card.querySelector('.rph-enquiry-total').textContent=`${subscribers.length} newsletter subscriber${subscribers.length===1?'':'s'} · View emails →`;
}
function renderInquiries(){
 const kind=kindFilter.value,status=statusFilter.value,search=emailSearch.value.trim().toLowerCase();
 const visible=inquiryRows.filter(i=>(kind==='all'||i.kind===kind)&&(status==='all'||i.status===status)&&(!search||String(i.email||'').toLowerCase().includes(search)));
 const subscribers=inquiryRows.filter(i=>i.kind==='newsletter'),unread=subscribers.filter(i=>i.status==='new').length;
 const summary=`${subscribers.length} total newsletter subscribers · ${unread} new · Showing ${visible.length} record${visible.length===1?'':'s'}`;
 const summaryNode=document.getElementById('inquiry-summary');if(summaryNode.textContent!==summary)summaryNode.textContent=summary;
 table('inquiries',['Type','Name','Email / phone','Message','Received','Status','Email notification'],visible.map(i=>{
  let notification='—';if(['newsletter','contact'].includes(i.kind)){notification=el('div');const status=i.notificationStatus||'not_configured';notification.append(el('p',({sent:'Sent to email provider',failed:'Failed',pending:'Pending',not_configured:'Not configured'})[status]||status));if(status!=='sent')notification.append(btn('Retry email',async()=>{const r=await api(i.kind==='contact'?'admin/contact-notify':'admin/newsletter-notify',{id:i.id});await loadInquiries();showMessage(notice,r.status==='sent'?'Email notification sent.':'Email not sent. Check your email configuration.',r.status!=='sent')}))}
  const review=el('div');if(i.status==='new')review.append(el('span','NEW','rph-unread-tag'),btn('Mark reviewed',async()=>{await api('admin/inquiry',{id:i.id});await loadInquiries()}));else review.textContent='Reviewed';
  return [({'newsletter':'Newsletter subscriber','contact':'Contact enquiry','inspection':'Inspection request','interest':'Other interest'})[i.kind]||i.kind,i.name||'—',[i.email,i.phone].filter(Boolean).join(' · '),i.message,new Date(i.created).toLocaleString('en-NG'),review,notification];
 }));
 document.querySelectorAll('#inquiries tbody tr').forEach((row,index)=>row.classList.toggle('rph-inquiry-new',visible[index].status==='new'));
}
function setInquiries(rows){const changed=JSON.stringify(rows)!==JSON.stringify(inquiryRows);inquiryRows=rows;updateInquiryCard();if(changed||!document.querySelector('#inquiries table'))renderInquiries()}
async function loadInquiries(){const request=++inquiryRequest,rows=await api('admin/inquiries');if(request!==inquiryRequest)return;setInquiries(rows);document.getElementById('inquiry-update').textContent='Last checked: '+new Date().toLocaleTimeString('en-NG')+' · Updates automatically every 15 seconds.'}
function openInquiries(){inquiryPanel.hidden=false;kindFilter.value='newsletter';statusFilter.value='all';emailSearch.value='';renderInquiries();document.getElementById('enquiry-card')?.setAttribute('aria-expanded','true');document.getElementById('inquiry-heading').focus({preventScroll:true});inquiryPanel.scrollIntoView({behavior:'smooth'});loadInquiries().catch(e=>showMessage(notice,e.message,true))}
document.getElementById('inquiry-close').onclick=()=>{inquiryPanel.hidden=true;const card=document.getElementById('enquiry-card');card?.setAttribute('aria-expanded','false');card?.focus()};
for(const filter of [kindFilter,statusFilter,emailSearch])filter.addEventListener(filter===emailSearch?'input':'change',renderInquiries);
let polling=false;setInterval(async()=>{if(dashboard.hidden||document.hidden||polling)return;polling=true;try{await loadInquiries()}catch(e){if(e.message==='Sign in required'){dashboard.hidden=true;logout.hidden=true;login.hidden=false;inquiryRows=[];document.getElementById('inquiries').replaceChildren();showMessage(document.getElementById('login-message'),'Session expired. Sign in again.',true)}else document.getElementById('inquiry-update').textContent='Unable to check for new enquiries. Retrying automatically.'}finally{polling=false}},15000);
const roleLabels={staff:'RealProHomesNG agent',landlord:'Landlord',company:'Real estate company',independent:'Independent agent'};
function renderPartners(){
 const search=document.getElementById('partner-search').value.trim().toLowerCase(),role=document.getElementById('partner-role-filter').value,status=document.getElementById('partner-status-filter').value;
 const visible=partners.filter(p=>(!search||(p.name+' '+p.email).toLowerCase().includes(search))&&(!role||p.role===role)&&(!status||((status==='suspended')===p.suspended)));
 document.getElementById('partner-results').textContent=`Showing ${visible.length} of ${partners.length} registered accounts`;
 table('partner-accounts',['Name','Email','Account type','Registered','Plan / approval','Account status','Actions'],visible.map(p=>{
  const actions=el('div');actions.style.display='flex';actions.style.flexWrap='wrap';actions.style.gap='8px';
  if(p.role==='staff')actions.append(btn(p.approved?'Revoke approval':'Approve staff',async()=>{await api('admin/account',{id:p.id,approved:!p.approved});await refresh()}));
  actions.append(btn(p.suspended?'Unsuspend account':'Suspend account',async()=>{if(!confirm(`${p.suspended?'Restore access for':'Suspend access for'} ${p.name}?`))return;await api('admin/account/suspension',{id:p.id,suspended:!p.suspended});await refresh();showMessage(notice,p.suspended?'Account unsuspended.':'Account suspended.')}));
  return [p.name,p.email,roleLabels[p.role]||p.role,p.created?new Date(p.created).toLocaleDateString('en-NG'):'—',p.role==='staff'?(p.approved?'Approved':'Pending approval'):(p.unlimited?'Premium':'Free'),el('span',p.suspended?'Suspended':'Active',p.suspended?'rph-error':'rph-tag'),actions];
 }));
}
for(const id of ['partner-search','partner-role-filter','partner-status-filter'])document.getElementById(id).addEventListener(id==='partner-search'?'input':'change',renderPartners);
async function refresh(){
 const d=await api('admin/dashboard');login.hidden=true;dashboard.hidden=false;logout.hidden=false;
 partners=await api('admin/accounts');renderPartners();
 const partnerMetrics=document.getElementById('partner-metrics');partnerMetrics.replaceChildren();
 const totals=[['Registered accounts',partners.length],['Total agents',partners.filter(p=>p.role==='staff'||p.role==='independent').length],['RealProHomesNG agents',partners.filter(p=>p.role==='staff').length],['Independent agents',partners.filter(p=>p.role==='independent').length],['Landlords',partners.filter(p=>p.role==='landlord').length],['Companies',partners.filter(p=>p.role==='company').length],['Active accounts',partners.filter(p=>!p.suspended).length],['Suspended accounts',partners.filter(p=>p.suspended).length]];
 for(const [label,value] of totals){const c=el('div',undefined,'rph-card');c.append(el('p',label),el('h2',String(value)));partnerMetrics.append(c)}
 const metrics=document.getElementById('metrics');metrics.replaceChildren();
 for(const [label,value] of [['Properties',d.properties.length],['Registered accounts',partners.length],['Verified payments',cash(d.invoices.filter(i=>i.status==='paid').reduce((sum,i)=>sum+i.amount,0))]]){const c=el('div',undefined,'rph-card');c.append(el('p',label),el('h2',String(value)));metrics.append(c)}
 const enquiryCard=el('button',undefined,'rph-card rph-enquiry-card');enquiryCard.id='enquiry-card';enquiryCard.type='button';enquiryCard.setAttribute('aria-controls','inquiry-panel');enquiryCard.setAttribute('aria-expanded',String(!inquiryPanel.hidden));enquiryCard.append(el('p','Enquiries · unread'),el('h2','0'),el('span','','rph-inquiry-badge'),el('p','','rph-enquiry-total'));enquiryCard.querySelector('.rph-inquiry-badge').setAttribute('aria-live','polite');enquiryCard.onclick=openInquiries;metrics.insertBefore(enquiryCard,metrics.lastElementChild);setInquiries(d.inquiries);
 table('properties',['Photo','Property','Location','Price','Status','Actions'],d.properties.map(p=>{const actions=el('div'),image=el('img');image.src=p.image;image.alt=p.title;image.className='rph-property-thumb';actions.append(btn('Edit',async()=>{resetProperty();for(const k of ['id','title','location','price','description','status'])property.elements[k].value=p[k]??'';property.elements.photoFile.required=false;setPreview(p.image);document.getElementById('property-heading').textContent='Edit property';document.getElementById('publish-property').textContent='Save changes';property.scrollIntoView({behavior:'smooth'});}),btn('Delete',async()=>{if(!confirm('Remove this listing from the public website?'))return;await api('admin/property',{id:p.id},'DELETE');if(property.elements.id.value===p.id)resetProperty();await refresh()}));return [image,p.title,p.location,cash(p.price),p.status,actions]}));
 table('invoices',['Customer','Purpose','Amount','Status','Reference','Actions'],d.invoices.map(i=>{const actions=el('div');actions.append(btn('Copy invoice link',async()=>{try{await navigator.clipboard.writeText(invoiceLink(i.id));showMessage(notice,'Invoice link copied')}catch{showMessage(notice,invoiceLink(i.id))}}));if(i.status!=='paid')actions.append(btn('Verify',async()=>{const p=await api('check-payment',{id:i.id});showMessage(notice,'Payment status: '+p.status);await refresh()}));return [i.name+' · '+i.email,i.purpose,cash(i.amount),i.status,i.transaction_id||'—',actions]}))
}
const passwordField=document.getElementById('admin-password'),passwordToggle=document.getElementById('password-toggle');
function setPasswordVisible(visible){
 passwordField.type=visible?'text':'password';
 const label=visible?'Hide password':'Show password';
 passwordToggle.setAttribute('aria-label',label);
 passwordToggle.title=label;
 passwordToggle.querySelector('.rph-eye-slash').toggleAttribute('hidden',!visible);
}
passwordToggle.addEventListener('click',()=>setPasswordVisible(passwordField.type==='password'));
formSubmit(document.getElementById('login-form'),async d=>{setPasswordVisible(false);try{await api('login',d);await refresh()}catch(e){showMessage(document.getElementById('login-message'),e.message,true)}});
logout.onclick=async()=>{await api('logout',{});location.reload()};
const preview=document.getElementById('property-preview'),propertyMessage=document.getElementById('property-message');
let previewUrl=null;
function setPreview(src){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}if(src){preview.src=src;preview.hidden=false}else{preview.removeAttribute('src');preview.hidden=true}}
function resetProperty(){property.reset();property.elements.photoFile.required=true;setPreview('');document.getElementById('property-heading').textContent='Post a property';document.getElementById('publish-property').textContent='Publish property';showMessage(propertyMessage,'')}
function validPhoto(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a JPG, PNG or WebP photo no larger than 5 MB.')}
function readPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read photo'));reader.readAsDataURL(file)})}
property.elements.photoFile.addEventListener('change',()=>{const file=property.elements.photoFile.files[0];if(!file)return;try{validPhoto(file);setPreview('');previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;showMessage(propertyMessage,'')}catch(e){property.elements.photoFile.value='';showMessage(propertyMessage,e.message,true)}});
document.getElementById('clear').onclick=resetProperty;
formSubmit(property,async d=>{try{const file=d.photoFile;delete d.photoFile;if(file?.size){validPhoto(file);d.photo=await readPhoto(file)}showMessage(propertyMessage,'Publishing…');await api('admin/property',d);resetProperty();showMessage(propertyMessage,'Property published successfully! It is now visible on the website.');await refresh()}catch(e){showMessage(propertyMessage,e.message,true)}});
formSubmit(document.getElementById('invoice-form'),async d=>{try{const i=await api('admin/invoice',d);const a=link('Open payment invoice',invoiceLink(i.id));a.target='_blank';a.rel='noopener';created.replaceChildren(el('p','Invoice created. Share this payment link:'),a,el('p',invoiceLink(i.id)));await refresh()}catch(e){showMessage(notice,e.message,true)}});
refresh().catch(e=>{if(e.message!=='Sign in required')showMessage(document.getElementById('login-message'),e.message,true)});
