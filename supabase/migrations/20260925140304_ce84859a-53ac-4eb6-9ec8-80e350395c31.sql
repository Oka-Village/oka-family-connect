-- One-time data migration: grant 'admin' to the existing user with email danieleviathan@gmail.com.
-- The handle_new_user trigger keeps auto-granting admin on future sign-ins with daniel@zoe.garden.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE lower(u.email) = 'danieleviathan@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;