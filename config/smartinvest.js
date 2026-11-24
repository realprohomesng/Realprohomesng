export const investmentPlans=Object.freeze({starter:{name:'Starter',minimum:5000000,monthlyRate:2},growth:{name:'Growth',minimum:8000000,monthlyRate:5},pro:{name:'Pro',minimum:15000000,monthlyRate:8}});
export function reviewInvestment(input){
 const plan=typeof input.plan==='string'&&Object.hasOwn(investmentPlans,input.plan)?investmentPlans[input.plan]:null;
 const amount=Number(input.amount),months=Number(input.months);
 if(!plan||!Number.isSafeInteger(amount)||amount<plan.minimum||amount>1000000000||!Number.isSafeInteger(months)||months<1||months>60)return null;
 const monthlyReturn=amount*plan.monthlyRate/100,totalReturn=monthlyReturn*months;
 return {plan:plan.name,minimum:plan.minimum,amount,months,monthlyRate:plan.monthlyRate,monthlyReturn,totalReturn,projectedTotal:amount+totalReturn,currency:'NGN',paymentAvailable:false};
}
