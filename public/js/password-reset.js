(()=>{
 for(const button of document.querySelectorAll('[data-password-toggle]')){const input=document.getElementById(button.dataset.passwordToggle);button.addEventListener('click',()=>{const visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'Hide password':'Show password';button.setAttribute('aria-pressed',String(visible))})}
 const forgot=document.getElementById('forgot-form');if(!forgot)return;
 const reset=document.getElementById('reset-form'),notice=document.getElementById('reset-notice');
 const token=location.hash.slice(1);if(token){history.replaceState(null,'',location.pathname);document.getElementById('forgot-panel').hidden=true;document.getElementById('reset-panel').hidden=false}
 formSubmit(forgot,async d=>{try{const r=await api('account/forgot-password',d);showMessage(notice,r.message);forgot.reset()}catch(e){showMessage(notice,e.message,true)}});
 formSubmit(reset,async d=>{if(d.password!==d.confirmation)return showMessage(notice,'Passwords do not match.',true);try{await api('account/reset-password',{token,password:d.password});reset.reset();document.getElementById('reset-panel').hidden=true;showMessage(notice,'Your password has been reset. Sign in using your new password.')}catch(e){showMessage(notice,e.message,true)}});
})();
