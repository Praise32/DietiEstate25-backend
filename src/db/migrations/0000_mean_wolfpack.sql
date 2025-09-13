CREATE TABLE "cats" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"race" text,
	"address" text,
	"city" text,
	"cap" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" serial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"phone_verified" boolean,
	"email" text,
	"email_verified" boolean,
	"confirmation_code" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cats" ADD CONSTRAINT "cats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;