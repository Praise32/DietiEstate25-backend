ALTER TABLE "posts" ADD COLUMN "location" "geography(Point, 4326)" NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "listing_type" "listing_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "rooms" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "floor" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "has_elevator" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "energy_class" text;--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "longitude";