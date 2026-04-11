CREATE TABLE IF NOT EXISTS public.collector_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot TEXT NOT NULL DEFAULT 'off' CHECK (slot IN ('full', 'am', 'pm', 'off')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collector_id, date)
);

ALTER TABLE public.collector_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.collector_availability
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
