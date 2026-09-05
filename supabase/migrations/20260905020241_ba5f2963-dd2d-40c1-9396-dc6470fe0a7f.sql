CREATE OR REPLACE FUNCTION public.set_ops_cron_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'ops_cron_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(_value, 'ops_cron_secret', 'Shared secret for scheduled ops hooks');
  ELSE
    PERFORM vault.update_secret(existing, _value, 'ops_cron_secret', 'Shared secret for scheduled ops hooks');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ops_cron_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_ops_cron_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.set_ops_cron_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_ops_cron_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.run_ops_hook(_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  secret_value text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret';

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'ops cron secret is not configured';
  END IF;

  SELECT net.http_post(
    url := 'https://project--6128323d-d63b-4299-8400-498fb3a219b2.lovable.app/api/public/hooks/' || _path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret_value),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.run_ops_hook(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_ops_hook(text) FROM anon;
REVOKE ALL ON FUNCTION public.run_ops_hook(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_ops_hook(text) TO service_role;

SELECT cron.alter_job(
  1,
  command := $job$SELECT public.run_ops_hook('telegram-daily-brief');$job$
);