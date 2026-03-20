-- Adiciona área Reestruturação ao enum de áreas da Due Diligence
ALTER TYPE due_diligence_area_enum ADD VALUE IF NOT EXISTS 'reestruturacao';
