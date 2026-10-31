import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { verifyDeepScanLeaseLocal } from "./verify-deep-scan-supabase-local.mjs";

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
 assert.equal(profile.active,true);
 if(k==="admin" && profile.role==="client"){
  // The live signup trigger can run before GoTrue persists app_metadata.
  // Promote only this disposable CI account through the local service role,
  // mirroring a trusted explicit provisioning step. Report separately.
  const promoted=got(await srv.from("profiles").update({role:"admin"}).eq("id",ids[k]).select("role").single(),"CI-only trusted admin promotion");
  assert.equal(promoted.role,"admin");
  console.log("NOTE: Admin role required explicit trusted profile promotion in local GoTrue");
 } else assert.equal(profile.role,role);
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
await check("Muse plans are admin-owner-only and clients cannot apply them",async()=>{
 const planId=randomUUID();
 const plan={summary:"Synthetic verified guide plan",tasks:[{
  title:"Build the synthetic deliverable",description:"Complete the bounded synthetic parent task.",
  definition_of_done:"The parent and its subtask are recorded.",priority:"high",due_date:null,
  estimated_minutes:60,client_visible:false,subtasks:[{
   title:"Complete the synthetic step",description:"Perform one isolated CI-only step.",
   definition_of_done:"The isolated step is marked ready.",priority:"normal",due_date:null,
   estimated_minutes:30,client_visible:false
  }]
 }]};
 got(await Admin.from("muse_project_plans").insert({
  id:planId,project_id:projectA,objective:"Verify Muse plan application",summary:plan.summary,plan,
  source_model:"synthetic-ci",evidence_checked_at:new Date().toISOString(),created_by:ids.admin
 }).select("id,status"),"admin Muse plan draft");
 assert.equal(got(await A.from("muse_project_plans").select("id").eq("id",planId),"client A plan read").length,0);
 assert.equal(got(await B.from("muse_project_plans").select("id").eq("id",planId),"client B plan read").length,0);
 // Exact revision 1 must be captured by a database-owned trigger.
 const initial=got(await Admin.from("muse_project_plan_revisions").select("revision,plan").eq("plan_id",planId),"original plan ledger");
 assert.equal(initial.length,1);assert.equal(initial[0].revision,1);
 assert.deepEqual(initial[0].plan,plan);
 assert.equal(got(await A.from("muse_project_plan_revisions").select("revision").eq("plan_id",planId),"client ledger denial").length,0);
 assert.equal(got(await B.from("muse_project_plan_revisions").select("revision").eq("plan_id",planId),"cross-client ledger denial").length,0);
 const directChange=await Admin.from("muse_project_plans").update({summary:"Forbidden direct update"}).eq("id",planId).select("id");
 assert.ok(directChange.error,"Admin REST must not update a plan outside the ledger RPC");
 const directDelete=await Admin.from("muse_project_plans").delete().eq("id",planId).select("id");
 assert.ok(directDelete.error,"Admin REST must not delete a versioned plan");
 const forgedLedger=await Admin.from("muse_project_plan_revisions").insert({
  plan_id:planId,revision:2,plan,change_summary:"Spoofed revision",created_by:ids.admin,
 }).select("revision");
 assert.ok(forgedLedger.error,"Admin REST must not insert version history");

 // A save must be owner-checked, atomic and version-bound; the original remains.
 const revised={...plan,summary:"An explicitly reviewed synthetic revision."};
 const saved=got(await Admin.rpc("save_muse_project_plan_revision",{
  target_plan_id:planId,target_project_id:projectA,expected_revision:1,
  updated_plan:revised,change_note:"Review and adjust plan summary",
 }),"save exact revision one");
 assert.equal(saved[0].saved_plan_id,planId);
 assert.equal(saved[0].saved_project_id,projectA);
 assert.equal(saved[0].saved_revision,2);
 assert.equal(saved[0].saved_plan.summary,revised.summary);
 const history=got(await Admin.from("muse_project_plan_revisions").select("revision,plan").eq("plan_id",planId).order("revision"),"immutable plan history");
 assert.deepEqual(history.map(x=>x.revision),[1,2]);assert.deepEqual(history[0].plan,plan);

 const [editX,editY]=await Promise.all([
  Admin.rpc("save_muse_project_plan_revision",{
   target_plan_id:planId,target_project_id:projectA,expected_revision:2,
   updated_plan:{...revised,summary:"Competing edit one."},change_note:"Competing synthetic edit X",
  }),
  Admin.rpc("save_muse_project_plan_revision",{
   target_plan_id:planId,target_project_id:projectA,expected_revision:2,
   updated_plan:{...revised,summary:"Competing edit two."},change_note:"Competing synthetic edit Y",
  }),
 ]);
 assert.equal([editX,editY].filter(r=>!r.error).length,1,"exactly one concurrent save must win");
 assert.equal([editX,editY].filter(r=>r.error).length,1,"stale concurrent save must fail");
 const latest=got(await Admin.from("muse_project_plans").select("plan,current_revision").eq("id",planId).single(),"latest stored revision");
 assert.equal(latest.current_revision,3);
 assert.equal(got(await Admin.from("muse_project_plan_revisions").select("revision").eq("plan_id",planId),"immutable history count").length,3);

 const argumentsForApply={target_plan_id:planId,target_project_id:projectA,expected_revision:3,expected_count:2};
 const oldRpc=await Admin.rpc("apply_muse_project_plan",{target_plan_id:planId});
 assert.ok(oldRpc.error,"old unversioned RPC signature must no longer be callable");
 const clientApply=await A.rpc("apply_muse_project_plan",argumentsForApply);
 assert.ok(clientApply.error,"client must not apply Muse plan");
 const staleApply=await Admin.rpc("apply_muse_project_plan",{...argumentsForApply,expected_revision:2});
 assert.ok(staleApply.error,"stale revision must not apply");
 const mismatchCount=await Admin.rpc("apply_muse_project_plan",{...argumentsForApply,expected_count:1});
 assert.ok(mismatchCount.error,"incorrect task count must not apply");
 const mismatchProject=await Admin.rpc("apply_muse_project_plan",{...argumentsForApply,target_project_id:projectB});
 assert.ok(mismatchProject.error,"wrong project must not apply");
 assert.equal(got(await Admin.from("tasks").select("id").eq("muse_plan_id",planId),"no tasks from failed approval").length,0);
 const applied=got(await Admin.rpc("apply_muse_project_plan",argumentsForApply),"admin applies exact verified revision");
 assert.equal(applied[0].applied_plan_id,planId);assert.equal(applied[0].applied_project_id,projectA);
 assert.equal(applied[0].applied_revision,3);assert.equal(applied[0].created_count,2);
 const repeat=await Admin.rpc("apply_muse_project_plan",argumentsForApply);
 assert.ok(repeat.error,"duplicate approval must be rejected");
 const savedPlan=got(await Admin.from("muse_project_plans").select("status,approved_at,applied_at").eq("id",planId).single(),"applied plan receipt");
 assert.equal(savedPlan.status,"applied");assert.ok(savedPlan.approved_at);assert.ok(savedPlan.applied_at);
 const created=got(await Admin.from("tasks").select("id,parent_task_id,source,muse_plan_id,client_visible").eq("muse_plan_id",planId).order("position"),"Muse tasks");
 const parent=created.find(task=>task.parent_task_id===null);const child=created.find(task=>task.parent_task_id!==null);
 assert.equal(created.length,2);assert.ok(parent);assert.ok(child);assert.equal(child.parent_task_id,parent.id);
 assert.ok(created.every(task=>task.source==="muse"&&task.muse_plan_id===planId&&!task.client_visible));
 assert.equal(got(await A.from("tasks").select("id").eq("muse_plan_id",planId),"client hidden Muse tasks").length,0);
 const nested=await Admin.from("tasks").insert({project_id:projectA,parent_task_id:child.id,title:"Forbidden nested step"}).select("id");
 assert.ok(nested.error,"third task level must be rejected");
 const parentDelete=await Admin.from("tasks").delete().eq("id",parent.id).select("id");
 assert.ok(parentDelete.error,"parent with subtasks must be protected from deletion");
 const activity=got(await Admin.from("activities").select("event_type,metadata").eq("project_id",projectA).eq("event_type","muse_plan_applied"),"Muse audit activity");
 assert.equal(activity.length,1);assert.equal(activity[0].metadata.created_count,2);
 assert.equal(activity[0].metadata.applied_revision,3);
});
console.log("PASS "+checks.length+" full local Supabase Auth + PostgREST integration cases, synthetic accounts only");
await verifyDeepScanLeaseLocal({
  admin: Admin, clientA: A, clientB: B,
  anonymous: createClient(url, pub, base), adminId: ids.admin,
});
