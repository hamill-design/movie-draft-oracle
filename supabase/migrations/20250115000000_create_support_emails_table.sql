-- Create support_emails table to store incoming support emails
CREATE TABLE IF NOT EXISTS public.support_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email TEXT NOT NULL,
  to_email TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  forwarded_to TEXT,
  auto_replied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.support_emails ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view support emails
CREATE POLICY "Support emails are viewable by authenticated users"
  ON public.support_emails
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index on received_at for querying recent emails
CREATE INDEX IF NOT EXISTS idx_support_emails_received_at 
  ON public.support_emails(received_at DESC);

-- Create index on from_email for querying emails from specific senders
CREATE INDEX IF NOT EXISTS idx_support_emails_from_email 
  ON public.support_emails(from_email);

