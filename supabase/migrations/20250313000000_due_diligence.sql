-- Due Diligence: leads incluídos na página e áreas por lead
-- Execute no SQL Editor do Supabase (uma vez).
-- Depois crie o bucket de Storage: Dashboard > Storage > New bucket > nome "due-diligence" (público ou RLS conforme necessidade).

-- Tabela de leads em Due Diligence (incluídos pelo gestor)
CREATE TABLE IF NOT EXISTS due_diligence_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  id_registro text,
  deal_id text,
  razao_social text NOT NULL,
  cnpj text,
  nome_lead text,
  UNIQUE(id_registro, deal_id)
);

-- Índice para listagem
CREATE INDEX IF NOT EXISTS idx_due_diligence_leads_created_at ON due_diligence_leads(created_at DESC);

-- Tabela de áreas por lead (uma linha por lead + área)
CREATE TYPE due_diligence_area_enum AS ENUM ('civel', 'trabalhista', 'tributario', 'recuperacao_creditos');
CREATE TYPE due_diligence_area_status_enum AS ENUM ('pending', 'no_processes', 'done');

CREATE TABLE IF NOT EXISTS due_diligence_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES due_diligence_leads(id) ON DELETE CASCADE,
  area due_diligence_area_enum NOT NULL,
  status due_diligence_area_status_enum NOT NULL DEFAULT 'pending',
  file_name text,
  file_url text,
  parsed_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(lead_id, area)
);

CREATE INDEX IF NOT EXISTS idx_due_diligence_areas_lead_id ON due_diligence_areas(lead_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS due_diligence_leads_updated_at ON due_diligence_leads;
CREATE TRIGGER due_diligence_leads_updated_at
  BEFORE UPDATE ON due_diligence_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS due_diligence_areas_updated_at ON due_diligence_areas;
CREATE TRIGGER due_diligence_areas_updated_at
  BEFORE UPDATE ON due_diligence_areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE due_diligence_leads IS 'Leads incluídos na página Due Diligence (havera_due_diligence = Sim)';
COMMENT ON TABLE due_diligence_areas IS 'Status e arquivo por área (Cível, Trabalhista, Tributário, Recuperação de Créditos) por lead';
