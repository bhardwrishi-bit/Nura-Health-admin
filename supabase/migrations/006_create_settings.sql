CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT DEFAULT 'Nura Health',
  abn TEXT,
  contact_email TEXT DEFAULT 'hello@nurahealth.com.au',
  contact_phone TEXT,
  service_area TEXT,
  pricing JSONB DEFAULT '{"home-visit": 0, "corporate": 0, "aged-care": 0, "ndis": 0}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.settings
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.settings (business_name) VALUES ('Nura Health') ON CONFLICT DO NOTHING;
