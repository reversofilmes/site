-- Migration 0017: separate project category from service_types
ALTER TABLE projects ADD COLUMN category TEXT;
