import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const folder = new URL("../docs/security/", import.meta.url);
const freeze=readFileSync(new URL("issue71-authorized-staging-public-freeze.sql",folder),"utf8");
const rollback=readFileSync(new URL("issue71-authorized-staging-public-rollback.sql",folder),"utf8");
const baseline=readFileSync(new URL("issue71-authorized-staging-public-acl-baseline.md",folder),"utf8");

for(const s of [freeze,rollback,baseline]){
  assert.match(s,/qihwmfwlhsetxwggaesd/);
  assert.match(s,/rquscwgdrqkzwjukiqtk/);
}
assert.match(freeze,/c70aa64cc9e8244d5f861dbbaf19d696/);
assert.match(rollback,/51aaa671a3b066963ebb0c040aa6fe49/);
const match=baseline.match(/```json\n([\s\S]*?)\n```/);
assert.ok(match,"Expected exact JSON ACL evidence");
const data=JSON.parse(match[1]);
assert.equal(data.stageProject,"qihwmfwlhsetxwggaesd");
assert.equal(data.productionProjectMustNeverTarget,"rquscwgdrqkzwjukiqtk");
assert.equal(data.app.length,32);
assert.equal(data.routines.length,8);
assert.equal(data.columnACLs,0);
assert.ok(data.app.every(t=>t.owner==="postgres" && t.rls===true));
assert.ok(data.routines.every(t=>t.owner==="postgres"));
const getOps=(file)=>file.split("\n").map(x=>x.trim()).filter(x=>x&&!x.startsWith("--"));
const revoke=getOps(freeze), restore=getOps(rollback);
assert.equal(revoke.length,57);
assert.equal(restore.length,57);
for(const [i,s] of revoke.entries()){
  assert.match(s,/^REVOKE (?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|MAINTAIN|EXECUTE)/);
  assert.match(s,/\bpublic\.[a-z_]+\b/);
  assert.ok(s.endsWith(" RESTRICT;"));
  const restored=restore[i];
  const rep=s.replace(/^REVOKE /,"GRANT ").replace(/ FROM (anon|authenticated) RESTRICT;$/, " TO $1;");
  assert.equal(restored,rep,"Rollback must mirror exact revoked rights: statement "+i);
}
for(const file of [freeze,rollback]){
  const commands=getOps(file).join("\n");
  assert.doesNotMatch(commands, /\b(?:storage|auth|service_role|supabase_admin|postgres|public\.(?:handle_new_user|set_updated_at)|ALTER|DROP|DELETE FROM|UPDATE .* SET|INSERT INTO|ALL TABLES|ALL FUNCTIONS|CASCADE|DEFAULT PRIVILEGES)\b/i);
}
const tableOps=revoke.filter(x=>x.includes(" ON TABLE "));
const functionOps=revoke.filter(x=>x.includes(" ON FUNCTION "));
assert.equal(tableOps.length,51);
assert.equal(functionOps.length,6);
assert.equal(new Set(tableOps.map(x=>x.match(/ON TABLE (public\.[a-z_]+)/)[1])).size,32);
const expectedFns=data.routines.filter(x=>x.acl?.includes("authenticated=X/postgres"));
assert.equal(expectedFns.length,6);
for(const f of expectedFns) assert.ok(functionOps.some(x=>x.includes(f.name)));
console.log("PASS: 57 exact, paired public-only stage ACL operations; 32 table identities, six RPCs, zero Storage/Auth/default rights touched; source only");
