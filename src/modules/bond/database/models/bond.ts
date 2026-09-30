import {
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";

/**
 * Main LC & Bond License Data Table
 * Matching the 31 columns from Bangladesh Bank exports
 */
export const bondRecords = pgTable(
  "bond_records",
  {
    id: serial("id").primaryKey(),

    // Bank & Branch Details
    bankName: varchar("bank_name", { length: 255 }).notNull(),
    branchName: varchar("branch_name", { length: 255 }),
    adsCode: varchar("ads_code", { length: 100 }),

    // LC Specific Details
    lcYear: varchar("lc_year", { length: 20 }),
    lcNature: varchar("lc_nature", { length: 100 }),
    lcSerial: varchar("lc_serial", { length: 100 }),
    lcId: varchar("lc_id", { length: 150 }),
    lcValue: numeric("lc_value", { precision: 20, scale: 2 }).default("0"),
    currency: varchar("currency", { length: 20 }).default("USD"),
    lcDate: timestamp("lc_date", { withTimezone: true }),
    lcExpiryDate: timestamp("lc_expiry_date", { withTimezone: true }),
    bbUsansePeriod: varchar("bb_usanse_period", { length: 100 }),
    lastShipDate: timestamp("last_ship_date", { withTimezone: true }),
    proceedsDate: timestamp("proceeds_date", { withTimezone: true }),

    // Applicant & Exporter Info
    applicantName: varchar("applicant_name", { length: 255 }),
    irc: varchar("irc", { length: 100 }),
    exporterInfo: text("exporter_info"),
    exportLcNumber: varchar("export_lc_number", { length: 150 }),

    // Beneficiary Info
    beneficiaryBank: varchar("beneficiary_bank", { length: 255 }),
    beneficiaryBranch: varchar("beneficiary_branch", { length: 255 }),
    beneficiaryName: varchar("beneficiary_name", { length: 255 }),
    beneficiaryAddress: text("beneficiary_address"),
    beneficiaryIrc: varchar("beneficiary_irc", { length: 100 }),
    beneficiaryErc: varchar("beneficiary_erc", { length: 100 }),

    // Proforma Invoice (PI) & Bond Details
    piNumber: varchar("pi_number", { length: 150 }),
    piDate: timestamp("pi_date", { withTimezone: true }),
    bondLicense: varchar("bond_license", { length: 150 }),

    // Status & Actions
    accepted: varchar("accepted", { length: 50 }),
    cancelYn: varchar("cancel_yn", { length: 20 }).default("N"),
    cancelCause: text("cancel_cause"),
    entryDate: timestamp("entry_date", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("unique_pi_number_pi_date").on(table.piNumber, table.piDate)
  ]
);
