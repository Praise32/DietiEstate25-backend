ALTER TABLE "agencies" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "cap" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "phone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "agency_id" integer;