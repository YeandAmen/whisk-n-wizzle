import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { otpEnabled,isAdmin } from './access.js';
import {sendEmail} from './email.js';
import {notifyNewSignup,notifySignIn} from './notifications.js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
neonConfig.webSocketConstructor = WebSocket;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 12000 });
let instance;
export function getAuth(){
 if(!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length<32) throw new Error('Authentication is not configured');
 return instance ||= betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL || 'https://fyield-services.vercel.app',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.BETTER_AUTH_URL || 'https://fyield-services.vercel.app'],
  emailAndPassword: { enabled: !otpEnabled(), minPasswordLength: 12, maxPasswordLength: 128 },
  plugins: otpEnabled() ? [emailOTP({
   otpLength:6, expiresIn:300, allowedAttempts:3, storeOTP:'hashed',
   rateLimit:{window:60,max:3},
   async sendVerificationOTP({email,otp}){
    await sendEmail({to:email,subject:'Your Sinnogram verification code',text:`Your Sinnogram code is ${otp}. It expires in 5 minutes. Never share this code. If you did not request it, ignore this email.`});
   }
  })] : [],
  hooks:{after:createAuthMiddleware(async ctx=>{
   if(['/sign-in/email','/sign-in/email-otp'].includes(ctx.path)&&ctx.context.newSession)await notifySignIn();
  })},
  databaseHooks:{
   user:{create:{after:async()=>{await notifyNewSignup();}}},
   session:{create:{before:async session=>{
    const {rows}=await pool.query('SELECT email,"emailVerified" FROM "user" WHERE id=$1',[session.userId]);
    if(isAdmin(rows[0]))return {data:{...session,expiresAt:new Date(Date.now()+15*60*1000)}};
   }}}
  },
  session: { expiresIn: 60*60*24*7, updateAge: 60*60*24, disableSessionRefresh:true },
  rateLimit: { enabled:true, storage:'database', window:60, max:80, customRules:{'/sign-up/email':{window:3600,max:5},'/sign-in/email':{window:60,max:8}} },
  advanced: { useSecureCookies: process.env.NODE_ENV === 'production' }
 });
}
