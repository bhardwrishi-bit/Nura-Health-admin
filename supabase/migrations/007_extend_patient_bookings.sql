-- Add collector assignment and invoice tracking to patient_bookings
ALTER TABLE public.patient_bookings
  ADD COLUMN IF NOT EXISTS collector_id UUID REFERENCES public.collectors(id),
  ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'invoice_pending'
    CHECK (invoice_status IN ('invoice_pending', 'invoice_sent', 'paid'));
