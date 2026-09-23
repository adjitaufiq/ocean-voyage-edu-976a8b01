CREATE INDEX IF NOT EXISTS idx_business_entity_links_legacy
  ON public.business_entity_links (legacy_type, legacy_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_sales_preparations_active
  ON public.sales_preparations (candidate_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_entity_match_history_status
  ON public.entity_match_history (status);

CREATE OR REPLACE VIEW public.business_entity_overview
WITH (security_invoker = on) AS
WITH links AS (
  SELECT l.business_entity_id AS entity_id,
         count(*) AS source_count,
         count(*) FILTER (WHERE l.legacy_type = 'prospect_candidate') AS candidate_links,
         count(*) FILTER (WHERE l.legacy_type = 'prospect') AS prospect_links,
         count(*) FILTER (WHERE l.legacy_type = 'consultation') AS consultation_links,
         count(*) FILTER (WHERE l.legacy_type = 'ai_conversation') AS conversation_links
  FROM public.business_entity_links l
  WHERE l.is_active
  GROUP BY 1
),
cand AS (
  SELECT l.business_entity_id AS entity_id,
         max(c.lead_score) AS lead_score,
         max(c.confidence_score) AS confidence_score,
         bool_or(c.validation_status = 'validated') AS validated,
         bool_or(c.qc_status = 'approved') AS qc_approved,
         bool_or(c.duplicate_status = 'duplicate') AS duplicate_flag,
         bool_or(c.lead_temperature IN ('hot','warm') OR c.lead_score >= 55) AS icp_qualified,
         bool_or(coalesce(c.website,'') <> '' OR coalesce(c.phone,'') <> ''
                 OR coalesce(c.contact_data,'{}'::jsonb) <> '{}'::jsonb) AS enriched,
         bool_or(c.sales_stage = 'ready_outreach') AS ready_stage,
         bool_or(c.verified_ready_at IS NOT NULL) AS verified_ready,
         max(c.contact_stage) AS contact_stage,
         max(c.google_maps_url) AS google_maps_url,
         string_agg(DISTINCT c.discovery_source, ', ') AS discovery_sources
  FROM public.business_entity_links l
  JOIN public.prospect_candidates c ON c.id = l.legacy_id
  WHERE l.is_active AND l.legacy_type = 'prospect_candidate'
  GROUP BY 1
),
prep AS (
  SELECT l.business_entity_id AS entity_id, count(*) AS active_preparations
  FROM public.business_entity_links l
  JOIN public.sales_preparations sp ON sp.candidate_id = l.legacy_id AND sp.is_active
  WHERE l.is_active AND l.legacy_type = 'prospect_candidate'
  GROUP BY 1
),
pros AS (
  SELECT l.business_entity_id AS entity_id,
         max(p.status) AS prospect_status,
         bool_or(p.contacted_at IS NOT NULL OR p.status = 'contacted') AS prospect_contacted,
         bool_or(p.replied_at IS NOT NULL) AS prospect_replied,
         bool_or(p.converted_at IS NOT NULL OR p.status IN ('won','deal','converted')) AS prospect_deal
  FROM public.business_entity_links l
  JOIN public.prospects p ON p.id = l.legacy_id
  WHERE l.is_active AND l.legacy_type = 'prospect'
  GROUP BY 1
),
dup AS (
  SELECT coalesce(h.matched_entity_id, h.candidate_entity_id) AS entity_id, count(*) AS pending_reviews
  FROM public.entity_match_history h
  WHERE h.status = 'review_required'
  GROUP BY 1
)
SELECT e.id,
       e.canonical_name,
       e.industry,
       e.city,
       e.province,
       e.website,
       e.website_domain,
       e.phone,
       e.whatsapp,
       e.email,
       e.current_stage,
       e.current_analysis_id,
       e.created_at,
       e.updated_at,
       coalesce(lk.source_count, 0) AS source_count,
       coalesce(lk.candidate_links, 0) AS candidate_links,
       coalesce(lk.prospect_links, 0) AS prospect_links,
       coalesce(lk.consultation_links, 0) AS consultation_links,
       coalesce(lk.conversation_links, 0) AS conversation_links,
       cd.lead_score,
       cd.confidence_score,
       cd.contact_stage,
       cd.google_maps_url,
       cd.discovery_sources,
       coalesce(cd.duplicate_flag, false) AS duplicate_flag,
       coalesce(dp.pending_reviews, 0) AS pending_reviews,
       pr.prospect_status,
       coalesce(pp.active_preparations, 0) AS active_preparations,
       true AS stage_found,
       coalesce(cd.enriched, false)
         OR coalesce(e.website,'') <> '' OR coalesce(e.phone,'') <> ''
         OR coalesce(e.whatsapp,'') <> '' OR coalesce(e.email,'') <> '' AS stage_enriched,
       coalesce(cd.validated, false) OR coalesce(cd.qc_approved, false) AS stage_verified,
       coalesce(cd.icp_qualified, false) AS stage_qualified,
       e.current_analysis_id IS NOT NULL AS stage_analyzed,
       coalesce(pp.active_preparations, 0) > 0 AS stage_sales_prepared,
       coalesce(cd.ready_stage, false) AND coalesce(cd.verified_ready, false) AS stage_ready_outreach,
       coalesce(cd.contact_stage IS NOT NULL, false) OR coalesce(pr.prospect_contacted, false) AS stage_contacted,
       coalesce(cd.contact_stage IN ('demo_scheduled','interested'), false)
         OR coalesce(pr.prospect_replied, false) AS stage_meeting,
       coalesce(cd.contact_stage = 'deal', false) OR coalesce(pr.prospect_deal, false) AS stage_deal
FROM public.business_entities e
LEFT JOIN links lk ON lk.entity_id = e.id
LEFT JOIN cand cd ON cd.entity_id = e.id
LEFT JOIN prep pp ON pp.entity_id = e.id
LEFT JOIN pros pr ON pr.entity_id = e.id
LEFT JOIN dup dp ON dp.entity_id = e.id;

GRANT SELECT ON public.business_entity_overview TO authenticated;
GRANT SELECT ON public.business_entity_overview TO service_role;