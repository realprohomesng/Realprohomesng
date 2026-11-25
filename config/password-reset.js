// Keep transactional password resets on the company's confirmed sender.
// Legacy newsletter or PASSWORD_RESET_FROM settings must not override it.
export const PASSWORD_RESET_SENDER='RealProHomesNG <info@realprohomesng.com>';
export function resetEmailConfigured(){return Boolean(process.env.RESEND_API_KEY?.trim())}

export async function sendPasswordReset({email,link}){
 if(!resetEmailConfigured())throw Object.assign(Error('Resend API key missing'),{providerCode:'RESEND_API_KEY missing'});
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY.trim()}`,'Content-Type':'application/json'},
  body:JSON.stringify({from:PASSWORD_RESET_SENDER,to:[email],subject:'Reset your RealProHomesNG password',text:`A password reset was requested for your RealProHomesNG property partner account.\n\nOpen this link to choose a new password (valid for 30 minutes, one use only):\n${link}\n\nIf you did not request this, ignore this email. Your current password remains unchanged.`}),signal:AbortSignal.timeout(15000)
 });
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.id){
  const code=typeof result?.name==='string'&&/^[a-z_]{1,60}$/.test(result.name)?result.name:'unconfirmed';
  throw Object.assign(Error('Password reset email was not accepted'),{providerCode:`HTTP ${response.status} (${code})`});
 }
 return {status:'accepted',id:result.id};
}
