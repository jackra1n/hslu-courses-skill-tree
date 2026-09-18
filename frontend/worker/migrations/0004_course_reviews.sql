-- recommendation and content interest: 1-5 stars, higher is more positive.
-- difficulty: 1 = very easy, 5 = very hard.
-- workload: 1 = very low, 5 = very high.
-- difficulty and workload are descriptive, not overall quality scores.
-- course IDs reference the static catalog, not a D1 courses table.
create table "reviews" (
	"id" text not null primary key,
	"course_id" text not null,
	"user_id" text not null references "user" ("id") on delete cascade,
	"recommendation" integer not null check (typeof("recommendation") = 'integer' and "recommendation" between 1 and 5),
	"content_interest" integer not null check (typeof("content_interest") = 'integer' and "content_interest" between 1 and 5),
	"difficulty" integer not null check (typeof("difficulty") = 'integer' and "difficulty" between 1 and 5),
	"workload" integer not null check (typeof("workload") = 'integer' and "workload" between 1 and 5),
	-- an empty string represents a rating-only review.
	"text" text not null default '',
	-- unix timestamps in milliseconds, matching user_data.updated_at.
	"created_at" integer not null,
	"updated_at" integer not null,
	unique ("course_id", "user_id")
);

create index "reviews_user_id_idx" on "reviews" ("user_id");
