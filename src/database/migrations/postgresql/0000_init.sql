CREATE TABLE "bond_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer NOT NULL,
	"bank_name" varchar(255),
	"branch_name" varchar(255),
	"ads_code" varchar(100),
	"lc_year" varchar(20),
	"lc_nature" varchar(100),
	"lc_serial" varchar(100),
	"lc_id" varchar(150),
	"lc_value" numeric(20, 2) DEFAULT '0',
	"currency" varchar(20) DEFAULT 'USD',
	"lc_date" timestamp with time zone,
	"lc_expiry_date" timestamp with time zone,
	"bb_usanse_period" varchar(100),
	"last_ship_date" timestamp with time zone,
	"proceeds_date" timestamp with time zone,
	"applicant_name" varchar(255),
	"irc" varchar(100),
	"exporter_info" text,
	"export_lc_number" varchar(150),
	"beneficiary_bank" varchar(255),
	"beneficiary_branch" varchar(255),
	"beneficiary_name" varchar(255),
	"beneficiary_address" text,
	"beneficiary_irc" varchar(100),
	"beneficiary_erc" varchar(100),
	"pi_number" varchar(150),
	"pi_date" timestamp with time zone,
	"bond_license" varchar(150),
	"accepted" varchar(50),
	"cancel_yn" varchar(20) DEFAULT 'N',
	"cancel_cause" text,
	"entry_date" timestamp with time zone,
	"raw_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bond_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer,
	"title" varchar(255) NOT NULL,
	"report_type" varchar(100) DEFAULT 'summary' NOT NULL,
	"summary_metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bond_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bond_records" ADD CONSTRAINT "bond_records_upload_id_bond_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."bond_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_reports" ADD CONSTRAINT "bond_reports_upload_id_bond_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."bond_uploads"("id") ON DELETE cascade ON UPDATE no action;