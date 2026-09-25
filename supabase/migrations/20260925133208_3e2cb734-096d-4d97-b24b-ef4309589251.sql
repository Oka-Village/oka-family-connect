-- Lock down execution of SECURITY DEFINER helpers.
-- handle_new_user() is a trigger function only: nobody should call it directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role() must stay callable by signed-in users because RLS policies
-- evaluate it as the querying role. Anonymous callers have no need for it.
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;

-- generate_invite_code() is only used as a column default.
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated, service_role;
