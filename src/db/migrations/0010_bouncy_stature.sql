ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_cat_id_cats_id_fk";
--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_posts_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cap" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_posts_id_posts_id_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cats" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "cats" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "cats" DROP COLUMN "cap";--> statement-breakpoint
ALTER TABLE "photos" DROP COLUMN "cat_id";