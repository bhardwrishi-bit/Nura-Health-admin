CREATE TABLE IF NOT EXISTS public.collector_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_runs INTEGER DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  pdf_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.collector_payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.collector_payslips
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
