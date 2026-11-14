# Staging-only exact targeted ACL baseline

DO NOT MERGE OR APPLY TO PRODUCTION. Project `qihwmfwlhsetxwggaesd`; prohibited production project `rquscwgdrqkzwjukiqtk`.

This source-controlled reference records **catalog metadata only** for the targeted public tables and functions, not client rows, credentials, or a complete backup. Stage-only permission freeze is separately approved by the owner in chat. It excludes Storage, global defaults, and Auth.

```json
{
  "stageProject": "qihwmfwlhsetxwggaesd",
  "stageName": "nhs-os-staging-preview",
  "productionProjectMustNeverTarget": "rquscwgdrqkzwjukiqtk",
  "parentCommit": "f14d0ce783995de7024ccf8a30367562cbc5661e",
  "appHashBefore": "c70aa64cc9e8244d5f861dbbaf19d696",
  "rpcHashBefore": "51aaa671a3b066963ebb0c040aa6fe49",
  "tableCount": 32,
  "routineCount": 8,
  "columnACLs": 0,
  "app": [
    {
      "name": "public.activities",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.approvals",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.automation_runs",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.automations",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.change_orders",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.client_memberships",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.clients",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.contracts",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.deep_scan_jobs",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arw/postgres}",
      "rls": true
    },
    {
      "name": "public.documents",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.feedback_pins",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.files",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.form_submissions",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.form_templates",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.launch_items",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.lead_search_requests",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.lead_search_results",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.leads",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.messages",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.milestones",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.muse_drafts",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.muse_project_plans",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.notifications",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.opportunities",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.profiles",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.projects",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.proposals",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.prospects",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.revision_rounds",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.sent_emails",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.tasks",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    },
    {
      "name": "public.templates",
      "owner": "postgres",
      "acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "rls": true
    }
  ],
  "routines": [
    {
      "name": "public.apply_muse_project_plan(target_plan_id uuid)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.cancel_deep_scan_job(p_id uuid)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.claim_deep_scan_batch(p_id uuid)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.finish_deep_scan_batch(p_id uuid, p_lease uuid, p_processed integer, p_created integer, p_refreshed integer, p_held integer, p_conflicts integer)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.handle_new_user()",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,service_role=X/postgres}",
      "securityDefiner": true
    },
    {
      "name": "public.pause_deep_scan_batch(p_id uuid, p_lease uuid, p_error text)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.renew_deep_scan_batch(p_id uuid, p_lease uuid)",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    },
    {
      "name": "public.set_updated_at()",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,service_role=X/postgres}",
      "securityDefiner": false
    }
  ]
}
```

The restore operations should only be used if the stage-only postcondition is verified; recheck grantor and object identity and inspect drift before rollback.
