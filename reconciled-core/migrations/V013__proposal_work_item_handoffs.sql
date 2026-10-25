-- B006 transactional M03 -> Platform work-item handoffs.
ALTER TABLE platform.work_item
  DROP CONSTRAINT work_item_object_type_check;
ALTER TABLE platform.work_item
  ADD CONSTRAINT work_item_object_type_check CHECK(object_type IN ('strategy','portfolio','demand'));
ALTER TABLE platform.work_item ADD COLUMN workflow_kind text NOT NULL DEFAULT 'manual'
  CHECK(workflow_kind IN ('manual','proposal_review','proposal_correction'));
ALTER TABLE platform.work_item ADD COLUMN case_revision_id uuid;
ALTER TABLE platform.work_item ADD CONSTRAINT work_item_case_revision_fk
  FOREIGN KEY(tenant_id,case_revision_id) REFERENCES m03_demand.case_revision(tenant_id,id);
ALTER TABLE platform.work_item ADD CONSTRAINT workflow_revision_required
  CHECK ((workflow_kind='proposal_review')=(case_revision_id IS NOT NULL));
CREATE UNIQUE INDEX one_open_proposal_review_per_revision
 ON platform.work_item(tenant_id,case_revision_id) WHERE workflow_kind='proposal_review';
CREATE OR REPLACE FUNCTION platform.validate_work_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.object_type='strategy' AND NOT EXISTS
   (SELECT 1 FROM m01_strategy.strategy WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id)
 THEN RAISE EXCEPTION 'Missing strategy target'; END IF;
 IF NEW.object_type='portfolio' AND NOT EXISTS
   (SELECT 1 FROM m02_portfolio.portfolio WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id)
 THEN RAISE EXCEPTION 'Missing portfolio target'; END IF;
 IF NEW.object_type='demand' AND NOT EXISTS
   (SELECT 1 FROM m03_demand.demand WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id)
 THEN RAISE EXCEPTION 'Missing demand target'; END IF;
 IF NEW.workflow_kind<>'manual' AND NEW.object_type<>'demand' THEN
   RAISE EXCEPTION 'Proposal task must refer to demand'; END IF;
 IF NEW.workflow_kind='proposal_review' AND NOT EXISTS(
   SELECT 1 FROM m03_demand.case_revision cr
   JOIN m03_demand.business_case bc ON bc.tenant_id=cr.tenant_id AND bc.id=cr.business_case_id
   WHERE cr.tenant_id=NEW.tenant_id AND cr.id=NEW.case_revision_id AND bc.demand_id=NEW.object_id)
 THEN RAISE EXCEPTION 'Revision does not belong to demand'; END IF;
 IF NOT EXISTS (SELECT 1 FROM platform.tenant_member WHERE tenant_id=NEW.tenant_id
   AND principal_id=NEW.assignee_id AND active) THEN
   RAISE EXCEPTION 'Assignee must be active in tenant'; END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.state<>'open' THEN RAISE EXCEPTION 'Closed work item is immutable'; END IF;
   IF NEW.object_id<>OLD.object_id OR NEW.object_type<>OLD.object_type
     OR NEW.created_by<>OLD.created_by OR NEW.workflow_kind<>OLD.workflow_kind
     OR NEW.case_revision_id IS DISTINCT FROM OLD.case_revision_id
   THEN RAISE EXCEPTION 'Work item origin immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
-- Lifecycle task completion must follow domain transitions rather than the generic task API.
