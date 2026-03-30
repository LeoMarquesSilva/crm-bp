-- Preferências globais do deck (blocos, ordem, layout) por lead — persistem no servidor
ALTER TABLE due_diligence_leads
  ADD COLUMN IF NOT EXISTS ppt_chart_options jsonb;

COMMENT ON COLUMN due_diligence_leads.ppt_chart_options IS 'Opções globais do PPTX (blocos habilitados, ordem, chartAlign, etc.) para este lead';
