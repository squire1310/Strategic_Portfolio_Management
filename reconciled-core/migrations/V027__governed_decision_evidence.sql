-- B011: protect application-issued decisions against missing or mismatched M06 evidence.
-- Governance mandate configuration is provisioned by the database owner, not the app role.
REVOKE INSERT,UPDATE,DELETE ON m06_governance.decision_body,m06_governance.delegation FROM spm_app;

CREATE FUNCTION m06_governance.guard_committee_session_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE required_quorum integer; chair uuid;
BEGIN
 IF pg_has_role(current_user,'spm_app','member') THEN
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
CREATE TRIGGER committee_session_insert_guard BEFORE INSERT ON m06_governance.committee_session
 FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_committee_session_insert();

CREATE FUNCTION m06_governance.guard_committee_participant_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM m06_governance.committee_finalisation f
   WHERE f.tenant_id=NEW.tenant_id AND f.session_id=NEW.session_id) THEN
   RAISE EXCEPTION 'Finalised committee participants are immutable';
 END IF;
 IF pg_has_role(current_user,'spm_app','member') AND NOT EXISTS (
   SELECT 1 FROM m06_governance.committee_session s
   WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.session_id
     AND s.recorded_by=platform.current_actor()) THEN
   RAISE EXCEPTION 'Committee recorder required';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER committee_participant_insert_guard BEFORE INSERT ON m06_governance.committee_participant
 FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_committee_participant_insert();

CREATE FUNCTION m06_governance.validated_committee_ballot(p_tenant uuid,p_session uuid)
RETURNS TABLE(eligible_present integer,for_votes integer,against_votes integer,abstentions integer,recused_count integer)
LANGUAGE sql STABLE AS $$
 SELECT count(*) FILTER (WHERE p.attended AND NOT p.recused AND eligible)::integer,
        count(*) FILTER (WHERE p.attended AND NOT p.recused AND eligible AND p.vote='for')::integer,
        count(*) FILTER (WHERE p.attended AND NOT p.recused AND eligible AND p.vote='against')::integer,
        count(*) FILTER (WHERE p.attended AND NOT p.recused AND eligible AND p.vote='abstain')::integer,
        count(*) FILTER (WHERE p.recused)::integer
 FROM (
   SELECT cp.*,EXISTS (SELECT 1 FROM m06_governance.delegation d
     JOIN m06_governance.committee_session s ON s.tenant_id=d.tenant_id
       AND s.decision_body_id=d.decision_body_id
     WHERE s.tenant_id=cp.tenant_id AND s.id=cp.session_id
       AND d.delegate_id=cp.principal_id AND d.effective_during @> s.held_at) AS eligible
   FROM m06_governance.committee_participant cp
   WHERE cp.tenant_id=p_tenant AND cp.session_id=p_session
 ) p
$$;

CREATE FUNCTION m06_governance.guard_committee_finalisation_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s m06_governance.committee_session%ROWTYPE; tally record; summary jsonb;
BEGIN
 IF pg_has_role(current_user,'spm_app','member') THEN
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
      OR (summary->>'againstVotes')::integer IS DISTINCT FROM tally.against_votes
      OR (summary->>'abstentions')::integer IS DISTINCT FROM tally.abstentions
      OR (summary->>'recused')::integer IS DISTINCT FROM tally.recused_count THEN
     RAISE EXCEPTION 'Finalisation requires matching committee ballot evidence';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER committee_finalisation_insert_guard BEFORE INSERT ON m06_governance.committee_finalisation
 FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_committee_finalisation_insert();

CREATE FUNCTION m05_investment.guard_committee_decision_link() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s record; tally record;
BEGIN
 SELECT cs.investment_id,cs.decision_body_id AS session_body_id,cs.held_at,cs.quorum_required,
   d.investment_id AS decision_investment_id,d.decision_body_id AS decision_body_id,
   d.decided_at,d.decision_type
   INTO s FROM m06_governance.committee_session cs
   JOIN m06_governance.committee_finalisation f
     ON f.tenant_id=cs.tenant_id AND f.session_id=cs.id
   JOIN m05_investment.investment_decision d
     ON d.tenant_id=cs.tenant_id AND d.id=NEW.decision_id
   WHERE cs.tenant_id=NEW.tenant_id AND cs.id=NEW.session_id;
 SELECT * INTO tally FROM m06_governance.validated_committee_ballot(NEW.tenant_id,NEW.session_id);
 IF s.investment_id IS NULL OR s.investment_id IS DISTINCT FROM s.decision_investment_id
    OR s.session_body_id IS DISTINCT FROM s.decision_body_id
    OR s.held_at>s.decided_at OR tally.eligible_present<s.quorum_required
    OR (s.decision_type='approve' AND tally.for_votes<=tally.against_votes) THEN
   RAISE EXCEPTION 'Decision must cite matching finalised committee evidence';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER committee_decision_link_guard BEFORE INSERT ON m05_investment.committee_decision_evidence
 FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_committee_decision_link();

CREATE FUNCTION m05_investment.require_app_decision_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF pg_has_role(current_user,'spm_app','member') AND NOT EXISTS (
   SELECT 1 FROM m05_investment.committee_decision_evidence e
   WHERE e.tenant_id=NEW.tenant_id AND e.decision_id=NEW.id) THEN
   RAISE EXCEPTION 'Application decision requires finalised committee evidence';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER app_decision_evidence_guard AFTER INSERT ON m05_investment.investment_decision
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m05_investment.require_app_decision_link();
