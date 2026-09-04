create table "account_new" (
	"id" text not null primary key,
	"accountId" text not null,
	"providerId" text not null,
	"issuer" text not null,
	"userId" text not null references "user" ("id") on delete cascade,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" date,
	"refreshTokenExpiresAt" date,
	"scope" text,
	"password" text,
	"createdAt" date not null,
	"updatedAt" date not null
);

insert into "account_new" (
	"id",
	"accountId",
	"providerId",
	"issuer",
	"userId",
	"accessToken",
	"refreshToken",
	"idToken",
	"accessTokenExpiresAt",
	"refreshTokenExpiresAt",
	"scope",
	"password",
	"createdAt",
	"updatedAt"
)
select
	"id",
	"accountId",
	"providerId",
	case when "providerId" = 'github' then 'local:oauth:github' end,
	"userId",
	"accessToken",
	"refreshToken",
	"idToken",
	"accessTokenExpiresAt",
	"refreshTokenExpiresAt",
	"scope",
	"password",
	"createdAt",
	"updatedAt"
from "account";

drop table "account";
alter table "account_new" rename to "account";

create index "account_userId_idx" on "account" ("userId");
create unique index "account_issuer_accountId_uidx" on "account" ("issuer", "accountId");
