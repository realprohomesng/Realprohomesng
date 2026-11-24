export async function sendContactNotification(inquiry){
 const key=process.env.RESEND_API_KEY,from=process.env.CONTACT_FROM||process.env.NEWSLETTER_FROM,to=process.env.CONTACT_NOTIFY_TO||'realprohomesng@gmail.com';
 if(!key||!from)return {status:'not_configured'};
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`contact/${inquiry._id}`},body:JSON.stringify({from,to:[to],reply_to:inquiry.email,subject:'New contact enquiry | RealProHomesNG',text:`Name: ${inquiry.name}\nEmail: ${inquiry.email}\nPhone: ${inquiry.phone||'Not provided'}\nDate: ${inquiry.created}\n\nMessage:\n${inquiry.message}`}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Email provider rejected notification');const result=await response.json();if(!result.id)throw Error('Email provider did not confirm acceptance');return {status:'sent',id:result.id};
}
