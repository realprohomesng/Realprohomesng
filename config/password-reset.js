export function resetEmailConfigured(){return Boolean(process.env.RESEND_API_KEY&&(process.env.PASSWORD_RESET_FROM||process.env.NEWSLETTER_FROM))}

export async function sendPasswordReset({email,link}){
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({from:process.env.PASSWORD_RESET_FROM||process.env.NEWSLETTER_FROM,to:[email],subject:'Reset your RealProHomesNG password',text:`A password reset was requested for your RealProHomesNG property partner account.\n\nOpen this link to choose a new password (valid for 30 minutes, one use only):\n${link}\n\nIf you did not request this, ignore this email. Your current password remains unchanged.`}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error('Password reset email was not accepted');
 const result=await response.json();if(!result.id)throw Error('Password reset email was not accepted');
}
