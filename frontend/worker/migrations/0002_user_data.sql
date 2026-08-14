create table "user_data" (
	"user_id" text not null primary key references "user" ("id") on delete cascade,
	"version" integer not null check ("version" = 1),
	"data" text not null,
	"revision" integer not null check ("revision" > 0),
	"updated_at" integer not null
);
