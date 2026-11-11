-- Field visit questionnaires. Safe to run more than once.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FieldVisitFormType') THEN
    CREATE TYPE "FieldVisitFormType" AS ENUM ('NEW_BENEFICIARY', 'FOLLOW_UP');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "field_visit_submissions" (
  "id" text NOT NULL,
  "formType" "FieldVisitFormType" NOT NULL,
  "formVersion" integer NOT NULL DEFAULT 1,
  "followUpStage" integer,
  "fieldPartner" text NOT NULL,
  "businessName" text NOT NULL,
  "location" text NOT NULL,
  "respondentName" text NOT NULL,
  "visitDate" date NOT NULL,
  "currency" text NOT NULL,
  "answers" jsonb NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_visit_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "field_visit_submissions_followUpStage_check" CHECK ("followUpStage" IS NULL OR "followUpStage" IN (3, 6, 9))
);

CREATE INDEX IF NOT EXISTS "field_visit_submissions_formType_idx" ON "field_visit_submissions" ("formType");
CREATE INDEX IF NOT EXISTS "field_visit_submissions_businessName_idx" ON "field_visit_submissions" ("businessName");
CREATE INDEX IF NOT EXISTS "field_visit_submissions_visitDate_idx" ON "field_visit_submissions" ("visitDate");
CREATE INDEX IF NOT EXISTS "field_visit_submissions_createdAt_idx" ON "field_visit_submissions" ("createdAt");

COMMIT;
