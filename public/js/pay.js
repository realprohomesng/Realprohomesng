const lookup=document.querySelector('#lookup'),invoice=document.querySelector('#invoice'),message=document.querySelector('#message');
async function load(id){
 invoice.replaceChildren();showMessage(message,'Checking invoice…');
 try{const data=await api('invoice?id='+encodeURIComponent(id));showMessage(message,'');invoice.append(el('h2',data.purpose),el('h3',cash(data.amount)),el('p','Status: '+data.status));
 if(data.status!=='paid'){
 const pay=el('button','Pay with Flutterwave','rph-button'),check=el('button','Check payment','rph-button secondary');invoice.append(pay,document.createTextNode(' '),check);
 pay.onclick=async()=>{pay.disabled=true;try{const j=await api('pay',{id});location.assign(j.link)}catch(e){showMessage(message,e.message,true);pay.disabled=false}};
 check.onclick=async()=>{check.disabled=true;try{const j=await api('check-payment',{id});if(j.status==='paid')await load(id);else showMessage(message,'Payment is not verified yet. Contact our office if money was deducted.')}catch(e){showMessage(message,e.message,true)}finally{check.disabled=false}};
 }else showMessage(message,'Payment verified. Thank you!');
 }catch(e){showMessage(message,e.message,true)}
}
formSubmit(lookup,async({id})=>load(id.trim()));const id=new URLSearchParams(location.search).get('id');if(id){lookup.elements.id.value=id;load(id).then(async()=>{if(new URLSearchParams(location.search).has('transaction_id')){try{await api('check-payment',{id});await load(id)}catch(e){showMessage(message,e.message,true)}}})}
