-- Drop the broad self-update policy that allowed role escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate self-update policy with WITH CHECK that locks the role column to its current value
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
);