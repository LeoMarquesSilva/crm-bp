-- Preferências e detalhes por área + armazenamento do PPT final no lead

ALTER TABLE due_diligence_areas
  ADD COLUMN IF NOT EXISTS area_chart_options jsonb,
  ADD COLUMN IF NOT EXISTS area_detail_config jsonb,
  ADD COLUMN IF NOT EXISTS manual_process_slides jsonb,
  ADD COLUMN IF NOT EXISTS skipped_presentation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN due_diligence_areas.area_chart_options IS 'Quais gráficos/slides desta área entram (merge com prefs globais)';
COMMENT ON COLUMN due_diligence_areas.area_detail_config IS 'Processos escolhidos para slide de detalhe + textos manuais';
COMMENT ON COLUMN due_diligence_areas.manual_process_slides IS 'Cível: processos críticos (números + texto)';
COMMENT ON COLUMN due_diligence_areas.skipped_presentation IS 'Área marcada para pular na apresentação (diferente de no_processes)';

ALTER TABLE due_diligence_leads
  ADD COLUMN IF NOT EXISTS final_ppt_url text,
  ADD COLUMN IF NOT EXISTS final_ppt_file_id text;

COMMENT ON COLUMN due_diligence_leads.final_ppt_url IS 'Link webView do PPT final no Google Drive';
COMMENT ON COLUMN due_diligence_leads.final_ppt_file_id IS 'ID do arquivo no Google Drive';
