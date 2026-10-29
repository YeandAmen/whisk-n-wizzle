import nodemailer from 'nodemailer';
import {emailProvider,emailReady,gmailPassword} from './mail-config.js';
let gmailTransport;
export async function sendEmail({to,subject,text}){
 if(!emailReady())throw new Error('Email delivery is not configured.');
 if(emailProvider()==='gmail'){
  gmailTransport ||= nodemailer.createTransport({
   host:'smtp.gmail.com',port:465,secure:true,
   auth:{user:process.env.GMAIL_USER,pass:gmailPassword()},
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
   disableFileAccess:true,disableUrlAccess:true
  });
  try{
   const result=await gmailTransport.sendMail({from:{name:'Sinnogram',address:process.env.GMAIL_USER},to,subject,text});
   if(!result.accepted?.length||result.rejected?.length)throw new Error('Recipient rejected');
  }catch{throw new Error('Email delivery is temporarily unavailable.');}
  return;
 }
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',signal:AbortSignal.timeout(10000),
  headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({from:`Sinnogram <${process.env.EMAIL_FROM.match(/<([^<>]+)>/)?.[1]||process.env.EMAIL_FROM}>`,to:[to],subject,text})
 });
 if(!response.ok)throw new Error('Email delivery is temporarily unavailable.');
}
