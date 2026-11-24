// Send only to the configured company inbox; the visitor cannot select a recipient.
export async function sendNewsletterNotification(signup){
 const key=process.env.RESEND_API_KEY,from=process.env.NEWSLETTER_FROM,to=process.env.NEWSLETTER_NOTIFY_TO||'realprohomesng@gmail.com';
 if(!key||!from)return {status:'not_configured'};
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`newsletter/${signup._id}`},
  body:JSON.stringify({from,to:[to],subject:'New newsletter signup | RealProHomesNG',text:`A new visitor has subscribed to the RealProHomesNG newsletter.\n\nEmail address: ${signup.email}\nSigned up: ${signup.created}\n\nYou can also view this signup in your admin dashboard.`}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error('Email provider rejected notification');
 const result=await response.json();if(!result.id)throw Error('Email provider did not confirm acceptance');
 return {status:'sent',id:result.id};
}
