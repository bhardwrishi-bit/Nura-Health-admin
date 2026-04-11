CREATE TABLE IF NOT EXISTS public.collector_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring', 'expired', 'missing')),
  file_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.collector_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.collector_documents
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
