import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Fail closed. Never permit this test to authenticate to hosted Supabase.
const url=process.env.NHS_LOCAL_SUPABASE_URL;
const pub=process.env.NHS_LOCAL_SUPABASE_PUBLIC_KEY;
const secret=process.env.NHS_LOCAL_SUPABASE_ADMIN_KEY;
if(process.env.CI!=="true"||!/^http:\/\/(localhost|127\.0\.0\.1):54321\/?$/.test(url||"")||
 !pub||!secret||process.env.SUPABASE_ACCESS_TOKEN||process.env.SUPABASE_DB_PASSWORD){
 throw Error("Refusing non-local Supabase integration target or remote project credentials");
}
const base={auth:{persistSession:false,autoRefreshToken:false}};
const srv=createClient(url,secret,base);
const password="SyntheticOnly-"+randomUUID();
const names=["admin","a","b"];
const ids={};
const userClients={};
function got(result,what){assert.equal(result.error,null,what+": "+(result.error?.message||""));return result.data;}
for(const k of names){
 const email="nhs-ci-"+k+"-"+randomUUID()+"@example.invalid";
 const role=k==="admin"?"admin":"client";
 const created=got(await srv.auth.admin.createUser({
  email,password,email_confirm:true,app_metadata:{role}
 }),"local Auth create "+k);
 ids[k]=created.user.id;
 const profile=got(await srv.from("profiles").select("role,active").eq("id",ids[k]).single(),"profile trigger "+k);
 assert.equal(profile.role,role);assert.equal(profile.active,true);
 const client=createClient(url,pub,base);
 const auth=got(await client.auth.signInWithPassword({email,password}),"GoTrue sign-in "+k);
 assert.equal(auth.user.id,ids[k]);
 userClients[k]=client;
}
const A=userClients.a,B=userClients.b,Admin=userClients.admin;
const clientA=randomUUID(),clientB=randomUUID(),projectA=randomUUID(),projectB=randomUUID();
got(await srv.from("clients").insert([{id:clientA,name:"Synthetic CI A"},{id:clientB,name:"Synthetic CI B"}]).select("id"),"client fixture");
got(await srv.from("client_memberships").insert([
 {client_id:clientA,profile_id:ids.a,member_role:"client"},
 {client_id:clientB,profile_id:ids.b,member_role:"client"}
]).select("client_id"),"membership fixture");
got(await srv.from("projects").insert([
 {id:projectA,client_id:clientA,name:"Synthetic CI Project A"},
 {id:projectB,client_id:clientB,name:"Synthetic CI Project B"}
]).select("id"),"project fixture");
const [approve,decline,finished,other]=Array.from({length:4},()=>randomUUID());
got(await srv.from("approvals").insert([
 {id:approve,project_id:projectA,title:"Pending A",status:"pending",requested_by:ids.admin},
 {id:decline,project_id:projectA,title:"Decline A",status:"pending",requested_by:ids.admin},
 {id:finished,project_id:projectA,title:"Completed A",status:"approved",requested_by:ids.admin},
 {id:other,project_id:projectB,title:"Pending B",status:"pending",requested_by:ids.admin}
]).select("id"),"approval fixture");
const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log("PASS",name);}
async function deny(result,label){
 if(result.error)return;
 assert.equal((result.data||[]).length,0,label+" was not denied");
}
async function currentApproval(){return got(await srv.from("approvals").select("*").eq("id",approve).single(),"approval row");}
async function denyChange(data,label){
 const before=await currentApproval();
 await deny(await A.from("approvals").update(data).eq("id",approve).select("id"),label);
 assert.deepEqual(await currentApproval(),before,label+" changed persisted row");
}
await check("Real GoTrue user creation, profile roles and JWT sessions",async()=>{
 for(const k of names)assert.ok(got(await userClients[k].auth.getUser(),"getUser "+k).user);
});
await check("Client A/B cross-project approvals denied by PostgREST",async()=>{
 assert.equal(got(await A.from("approvals").select("id").eq("id",other),"A->B").length,0);
 assert.equal(got(await B.from("approvals").select("id").eq("id",approve),"B->A").length,0);
 assert.equal(got(await A.from("approvals").select("id").eq("id",approve),"A->A").length,1);
});
await check("Approval title, project and immutable timestamps cannot be tampered",async()=>{
 await denyChange({status:"approved",decided_by:ids.a,title:"Forged"},"title");
 await denyChange({status:"approved",decided_by:ids.a,project_id:projectB},"project");
 await denyChange({status:"approved",decided_by:ids.a,requested_at:"2001-01-01T00:00:00Z"},"request timestamp");
 await denyChange({status:"approved",decided_by:ids.a,requested_by:ids.b},"requested by");
});
await check("Approval owner forgery and oversized comment rejected",async()=>{
 await denyChange({status:"approved",decided_by:ids.b},"decision owner");
 await denyChange({status:"approved",decided_by:ids.a,client_comment:"x".repeat(281)},"comment size");
});
await check("Legitimate approve/decline and server timestamp both succeed",async()=>{
 const row=got(await A.from("approvals").update({
  status:"approved",decided_by:ids.a,decided_at:"2001-01-01T00:00:00Z",client_comment:"Approved by CI"
 }).eq("id",approve).select("id,status,decided_at,decided_by"),"approve")[0];
 assert.equal(row.status,"approved");assert.equal(row.decided_by,ids.a);
 assert.ok(Math.abs(Date.now()-Date.parse(row.decided_at))<120000,"Timestamp must be assigned by DB");
 const declined=got(await A.from("approvals").update({
  status:"declined",decided_by:ids.a
 }).eq("id",decline).select("status,decided_at"),"decline")[0];
 assert.equal(declined.status,"declined");assert.ok(declined.decided_at);
});
await check("Redecision and cross-client decision blocked",async()=>{
 await deny(await A.from("approvals").update({status:"declined",decided_by:ids.a}).eq("id",approve).select("id"),"redecision");
 await deny(await A.from("approvals").update({status:"approved",decided_by:ids.a}).eq("id",other).select("id"),"A->B update");
 await deny(await B.from("approvals").update({status:"approved",decided_by:ids.b}).eq("id",decline).select("id"),"B->A update");
});
await check("Message sender forgery and cross-project insert rejected",async()=>{
 const [valid,spoof,cross]=Array.from({length:3},()=>randomUUID());
 got(await A.from("messages").insert({id:valid,project_id:projectA,sender_id:ids.a,body:"Valid CI message"}).select("id"),"valid message");
 await deny(await A.from("messages").insert({id:spoof,project_id:projectA,sender_id:ids.b,body:"Spoofed"}).select("id"),"spoofed message");
 await deny(await A.from("messages").insert({id:cross,project_id:projectB,sender_id:ids.a,body:"Cross project"}).select("id"),"cross message");
 assert.equal(got(await srv.from("messages").select("id").in("id",[valid,spoof,cross]),"persisted messages").length,1);
 assert.equal(got(await B.from("messages").select("id").eq("id",valid),"client B message isolation").length,0);
});
await check("Admin legitimate approval edit and messages accepted",async()=>{
 const row=got(await Admin.from("approvals").update({title:"Admin authored"}).eq("id",other).select("title"),"admin update")[0];
 assert.equal(row.title,"Admin authored");
 assert.equal(got(await Admin.from("messages").insert({id:randomUUID(),project_id:projectB,sender_id:ids.admin,body:"Admin CI"}).select("id"),"admin message").length,1);
});
await check("Anonymous request cannot read approvals or messages",async()=>{
 const anon=createClient(url,pub,base);
 for(const table of ["approvals","messages"]){
  const r=await anon.from(table).select("id").limit(5);
  if(!r.error)assert.equal(r.data?.length,0,table+" leaked anonymously");
 }
});
console.log("PASS "+checks.length+" full local Supabase Auth + PostgREST integration cases, synthetic accounts only");
