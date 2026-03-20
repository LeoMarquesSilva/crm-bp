-- Políticas RLS para Due Diligence (permite uso com chave anon do frontend)
-- Execute no SQL Editor do Supabase se aparecer erro de permissão ao criar lead.

ALTER TABLE due_diligence_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Due Diligence leads: allow all" ON due_diligence_leads;
CREATE POLICY "Due Diligence leads: allow all" ON due_diligence_leads
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Due Diligence areas: allow all" ON due_diligence_areas;
CREATE POLICY "Due Diligence areas: allow all" ON due_diligence_areas
  FOR ALL USING (true) WITH CHECK (true);
