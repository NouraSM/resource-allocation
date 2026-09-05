-- One-off data update: re-point all 18 demo work_requests to senior Saudi
-- government councils / central bodies as the Requesting Entity, per the
-- approved institutional mapping. Ministries/authorities/agencies move to
-- the description text as coordinating stakeholders — they are no longer
-- requesting entities.
--
-- ID-preserving: only `title`, `description`, and `requesting_entity` are
-- touched, matched by the existing fixed row id (and request_number as a
-- belt-and-suspenders check). No rows are deleted or recreated, so every
-- assignment, request_skill, risk, deliverable, notification, and audit_log
-- reference (all pointing at request_id) stays intact automatically.
--
-- Safe to run more than once (idempotent UPDATEs).

begin;

update public.work_requests set
  title = 'National Healthcare Sector Strategy Review',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support strategy study objectives, in coordination with Ministry of Health and National Center for Government Excellence.'
where id = '044aef90-7716-4ce4-a6d5-e52752b2b733' and request_number = 'REQ-2026-0001';

update public.work_requests set
  title = 'International Competitiveness Benchmarking — National Transport & Logistics Sector',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support benchmarking objectives, in coordination with Ministry of Transport and Ministry of Investment.'
where id = '656e8702-85e1-4d25-a085-dfd8cfceb8b7' and request_number = 'REQ-2026-0002';

update public.work_requests set
  title = 'Government Operating Model Review — Cross-Ministerial Restructuring',
  requesting_entity = 'Council of Ministers',
  description = 'Requested by Council of Ministers to support operating model objectives, in coordination with General Secretariat of the Council of Ministers and National Center for Government Excellence.'
where id = '414e5814-256a-48f5-801c-40de9056444b' and request_number = 'REQ-2026-0003';

update public.work_requests set
  title = 'Economic Impact Assessment — National Special Economic Zones Program',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support economic study objectives, in coordination with Ministry of Investment and Ministry of Economy and Planning.'
where id = 'e539060c-fa06-4741-93dd-b74d6cd904d3' and request_number = 'REQ-2026-0004';

update public.work_requests set
  title = 'National Cabinet Performance Dashboard Development',
  requesting_entity = 'General Secretariat of the Council of Ministers',
  description = 'Requested by General Secretariat of the Council of Ministers to support data & analytics objectives, in coordination with National Center for Government Excellence and Ministry of Economy and Planning.'
where id = 'fc93ec77-bd69-4508-a606-bab1c01e84ef' and request_number = 'REQ-2026-0005';

update public.work_requests set
  title = 'Legislative Policy Evaluation — National Labor Market Reform',
  requesting_entity = 'Shura Council',
  description = 'Requested by Shura Council to support policy study objectives, in coordination with Ministry of Human Resources and Social Development.'
where id = '4289ceef-5dbd-4aa0-995d-51d1217d95d0' and request_number = 'REQ-2026-0006';

update public.work_requests set
  title = 'National Citizen Services Transformation Assessment',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support transformation objectives, in coordination with Digital Government Authority and Ministry of Interior and Ministry of Human Resources and Social Development.'
where id = '90394544-2251-4616-8cc7-233c4cab6fc6' and request_number = 'REQ-2026-0007';

update public.work_requests set
  title = 'National Government Digital Maturity Review',
  requesting_entity = 'General Secretariat of the Council of Ministers',
  description = 'Requested by General Secretariat of the Council of Ministers to support digital transformation objectives, in coordination with Digital Government Authority and National Center for Government Excellence.'
where id = '36d0cae7-6a27-41d1-93df-b2603d61d615' and request_number = 'REQ-2026-0008';

update public.work_requests set
  title = 'National Strategic KPI Framework Design — Cabinet Performance Monitoring',
  requesting_entity = 'General Secretariat of the Council of Ministers',
  description = 'Requested by General Secretariat of the Council of Ministers to support strategy study objectives, in coordination with National Center for Government Excellence and Ministry of Economy and Planning.'
where id = '905aa893-13af-41d9-9c80-fc7eb682cd52' and request_number = 'REQ-2026-0009';

update public.work_requests set
  title = 'National Productivity & Resource Optimization Study',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support operations objectives, in coordination with Ministry of Economy and Planning and National Center for Government Excellence.'
where id = '6794cc11-0383-4b92-9f70-9654873a6796' and request_number = 'REQ-2026-0010';

update public.work_requests set
  title = 'National Data Governance Strategy Alignment',
  requesting_entity = 'Royal Court',
  description = 'Requested by Royal Court to support strategy study objectives, in coordination with Ministry of Communications and Information Technology and Digital Government Authority and Ministry of Economy and Planning.'
where id = '01ac6b0b-39ab-47be-b685-36545a227bec' and request_number = 'REQ-2026-0011';

update public.work_requests set
  title = 'Cross-Ministerial Change Management Program',
  requesting_entity = 'Council of Ministers',
  description = 'Requested by Council of Ministers to support change management objectives, in coordination with National Center for Government Excellence.'
where id = 'fd66373e-d3cd-4ad2-91b3-37bcc1de4bc0' and request_number = 'REQ-2026-0012';

update public.work_requests set
  title = 'Regulatory Impact Study — National Fintech Regulatory Framework',
  requesting_entity = 'Shura Council',
  description = 'Requested by Shura Council to support policy study objectives, in coordination with Ministry of Finance and Ministry of Investment.'
where id = 'aa28675c-0bf7-4b4d-92b6-7da63b36265b' and request_number = 'REQ-2026-0013';

update public.work_requests set
  title = 'National Public & Stakeholder Consultation Framework',
  requesting_entity = 'Shura Council',
  description = 'Requested by Shura Council to support strategy study objectives, in coordination with General Secretariat of the Council of Ministers and National Center for Government Excellence.'
where id = 'ccfbbedb-0529-43f6-a880-fe1452aab560' and request_number = 'REQ-2026-0014';

update public.work_requests set
  title = 'National Resilience Program Governance Health Check',
  requesting_entity = 'Council of Political and Security Affairs',
  description = 'Requested by Council of Political and Security Affairs to support program management objectives, in coordination with Ministry of Interior and Presidency of State Security.'
where id = 'e255c0b4-7a15-475b-8de0-d19076487be7' and request_number = 'REQ-2026-0015';

update public.work_requests set
  title = 'National PPP Program Feasibility Study — Priority Sectors',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support economic study objectives, in coordination with Ministry of Investment and Ministry of Finance.'
where id = 'd19b5b40-3ba9-4764-87dc-79667f91d441' and request_number = 'REQ-2026-0016';

update public.work_requests set
  title = 'National Security Sector Workforce Planning Model Update',
  requesting_entity = 'Council of Political and Security Affairs',
  description = 'Requested by Council of Political and Security Affairs to support operations objectives, in coordination with Ministry of Interior and Ministry of Defense.'
where id = '18661aa8-7ca3-4ef3-8ac4-b42fe6c80aeb' and request_number = 'REQ-2026-0017';

update public.work_requests set
  title = 'National Sector Competitiveness Benchmark — Vision 2030 Priority Sectors',
  requesting_entity = 'Council of Economic and Development Affairs',
  description = 'Requested by Council of Economic and Development Affairs to support benchmarking objectives, in coordination with Ministry of Investment and Ministry of Economy and Planning.'
where id = 'cd99783e-7d3d-404e-bbdf-29c1c26fe377' and request_number = 'REQ-2026-0018';

commit;

-- Verification: run after commit — should return 18 rows, all with a senior
-- council/central body in requesting_entity and none with a ministry/authority/agency.
select request_number, title, requesting_entity
from public.work_requests
where organization_id = '11111111-1111-1111-1111-111111111111'
order by request_number;
