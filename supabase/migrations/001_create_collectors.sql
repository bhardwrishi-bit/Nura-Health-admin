CREATE TABLE IF NOT EXISTS public.collectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'contractor' CHECK (type IN ('contractor', 'employee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  phone TEXT,
  email TEXT,
  document_expiry DATE,
  runs_total INTEGER DEFAULT 0,
  earnings_month NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.collectors
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
