CREATE TABLE "college_role_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "college_role_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"college_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"clerk_id" text NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "college_role_assign_unique" UNIQUE("role_id","clerk_id")
);
--> statement-breakpoint
CREATE TABLE "college_role_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "college_role_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"role_id" integer NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "college_role_perm_unique" UNIQUE("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "college_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "college_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"college_id" integer NOT NULL,
	"name" text NOT NULL,
	"member_type" text DEFAULT 'STUDENT' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "college_roles_college_name_unique" UNIQUE("college_id","name")
);
--> statement-breakpoint
CREATE TABLE "college_settings" (
	"college_id" integer PRIMARY KEY NOT NULL,
	"allow_student_create" boolean DEFAULT true NOT NULL,
	"open_join" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "college_members" ADD COLUMN "member_type" text DEFAULT 'STUDENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "college_members" ADD COLUMN "member_status" text DEFAULT 'VERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "college_role_assignments" ADD CONSTRAINT "college_role_assignments_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "college_role_assignments" ADD CONSTRAINT "college_role_assignments_role_id_college_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."college_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "college_role_permissions" ADD CONSTRAINT "college_role_permissions_role_id_college_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."college_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "college_roles" ADD CONSTRAINT "college_roles_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "college_settings" ADD CONSTRAINT "college_settings_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "college_role_assign_college_idx" ON "college_role_assignments" USING btree ("college_id");--> statement-breakpoint
CREATE INDEX "college_role_assign_clerk_idx" ON "college_role_assignments" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "college_role_perm_role_idx" ON "college_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "college_roles_college_idx" ON "college_roles" USING btree ("college_id");