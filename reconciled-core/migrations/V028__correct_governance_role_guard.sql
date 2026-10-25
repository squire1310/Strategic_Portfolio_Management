-- B011 correction: superusers satisfy pg_has_role for every role; they are not app logins.
CREATE FUNCTION platform.is_app_login() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname=current_user AND NOT r.rolsuper)
   AND pg_has_role(current_user,'spm_app','member')
$$;

CREATE OR REPLACE FUNCTION m06_governance.guard_committee_session_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE required_quorum integer; chair uuid;
BEGIN
 IF platform.is_app_login() THEN
   SELECT quorum_required,chair_id INTO required_quorum,chair
   FROM m06_governance.decision_body
   WHERE tenant_id=NEW.tenant_id AND id=NEW.decision_body_id;
   IF NEW.tenant_id IS DISTINCT FROM platform.current_tenant()
      OR NEW.recorded_by IS DISTINCT FROM platform.current_actor()
      OR NEW.recorded_by IS DISTINCT FROM chair
      OR NEW.held_at>statement_timestamp()
      OR NEW.quorum_required<required_quorum THEN
     RAISE EXCEPTION 'Authorised chair and valid committee session required';
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION m06_governance.guard_committee_participant_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM m06_governance.committee_finalisation f
   WHERE f.tenant_id=NEW.tenant_id AND f.session_id=NEW.session_id) THEN
   RAISE EXCEPTION 'Finalised committee participants are immutable';
 END IF;
 IF platform.is_app_login() AND NOT EXISTS (
   SELECT 1 FROM m06_governance.committee_session s
   WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.session_id
     AND s.recorded_by=platform.current_actor()) THEN
   RAISE EXCEPTION 'Committee recorder required';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION m06_governance.guard_committee_finalisation_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s m06_governance.committee_session%ROWTYPE; tally record; summary jsonb;
BEGIN
 IF platform.is_app_login() THEN
   SELECT * INTO s FROM m06_governance.committee_session
   WHERE tenant_id=NEW.tenant_id AND id=NEW.session_id;
   SELECT * INTO tally FROM m06_governance.validated_committee_ballot(NEW.tenant_id,NEW.session_id);
   summary:=NEW.evidence_snapshot->'summary';
   IF s.id IS NULL OR NEW.finalised_by IS DISTINCT FROM platform.current_actor()
      OR NEW.finalised_by IS DISTINCT FROM s.recorded_by
      OR tally.eligible_present<s.quorum_required
      OR summary IS NULL OR summary->>'quorumMet'<>'true'
      OR (summary->>'required')::integer IS DISTINCT FROM s.quorum_required
      OR (summary->>'eligiblePresent')::integer IS DISTINCT FROM tally.eligible_present
      OR (summary->>'forVotes')::integer IS DISTINCT FROM tally.for_votes
      OR (summary->>'against')::integer IS DISTINCT FROM tally.against_votes
      OR (summary->>'abstentions')::integer IS DISTINCT FROM tally.abstentions
      OR (summary->>'recused')::integer IS DISTINCT FROM tally.recused_count THEN
     RAISE EXCEPTION 'Finalisation requires matching committee ballot evidence';
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION m05_investment.require_app_decision_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF platform.is_app_login() AND NOT EXISTS (
   SELECT 1 FROM m05_investment.committee_decision_evidence e
   WHERE e.tenant_id=NEW.tenant_id AND e.decision_id=NEW.id) THEN
   RAISE EXCEPTION 'Application decision requires finalised committee evidence';
 END IF;
 RETURN NULL;
END $$;
