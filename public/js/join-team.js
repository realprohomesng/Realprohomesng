(()=>{
 const form=document.getElementById('joinTeamForm'),status=document.getElementById('joinTeamStatus');
 if(!form||!status)return;
 const button=form.querySelector('button[type="submit"]');
 function message(text,error=false){status.textContent=text;status.classList.toggle('rph-error',error)}
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled||!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  button.disabled=true;message('Submitting application…');
  try{
   const response=await fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,kind:'application'}),signal:AbortSignal.timeout(30000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok||!result?.ok)throw Error(result?.error||'Unable to submit. Please try again.');
   form.reset();message('Application submitted successfully. Our recruitment team will contact you.');
  }catch(error){message(error.name==='TimeoutError'?'The request timed out. Please try again.':error.message||'Unable to submit. Please try again.',true)}
  finally{button.disabled=false}
 });
})();
