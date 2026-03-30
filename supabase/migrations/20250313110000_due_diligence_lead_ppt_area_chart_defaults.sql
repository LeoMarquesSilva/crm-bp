ALTER TABLE due_diligence_leads
  ADD COLUMN IF NOT EXISTS ppt_area_chart_defaults jsonb;

COMMENT ON COLUMN due_diligence_leads.ppt_area_chart_defaults IS 'Defaults globais de gráficos PPT (estilo, tipo e título por slide) antes do merge por área';
