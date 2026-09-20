-- Better Auth 1.7.3+ identifies accounts by providerId/accountId again.
-- Abort on duplicate identities rather than merging different users' accounts.
create unique index "account_providerId_accountId_uidx" on "account" ("providerId", "accountId");

drop index "account_issuer_accountId_uidx";
alter table "account" drop column "issuer";
