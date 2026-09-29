ALTER TABLE "bond_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bond_uploads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bond_reports" CASCADE;--> statement-breakpoint
DROP TABLE "bond_uploads" CASCADE;--> statement-breakpoint
ALTER TABLE "bond_records" DROP CONSTRAINT "bond_records_upload_id_bond_uploads_id_fk";
--> statement-breakpoint
ALTER TABLE "bond_records" ALTER COLUMN "bank_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_records" DROP COLUMN "upload_id";--> statement-breakpoint
ALTER TABLE "bond_records" DROP COLUMN "raw_data";