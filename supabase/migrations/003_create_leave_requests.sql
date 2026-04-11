CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'Annual Leave',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  submitted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.leave_requests
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
