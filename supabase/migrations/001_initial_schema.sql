-- 001_initial_schema.sql
-- Ameen: initial database schema, RLS policies, and functions

-- =============================================================================
-- 1. Custom types (CHECK constraints used instead of enums for flexibility)
-- =============================================================================
-- All type constraints are inline on columns below.

-- =============================================================================
-- 2. profiles
-- =============================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'reviewer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. duas
-- =============================================================================
CREATE TABLE public.duas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL CHECK (char_length(text) <= 500),
  category text NOT NULL CHECK (category IN ('health', 'guidance', 'hardship', 'gratitude', 'family', 'general')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. ameen_interactions
-- =============================================================================
CREATE TABLE public.ameen_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dua_id uuid NOT NULL REFERENCES public.duas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('ameen', 'pass')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dua_id, user_id)
);

-- =============================================================================
-- 5. dua_stats view
-- =============================================================================
CREATE OR REPLACE VIEW public.dua_stats AS
SELECT
  d.id AS dua_id,
  COUNT(ai.id) FILTER (WHERE ai.action = 'ameen') AS ameen_count
FROM duas d
LEFT JOIN ameen_interactions ai ON ai.dua_id = d.id
GROUP BY d.id;

-- =============================================================================
-- 6. handle_new_user() trigger — auto-create profile on auth signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 7. updated_at trigger for duas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_duas_updated_at
  BEFORE UPDATE ON public.duas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 8. get_feed RPC function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_feed(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  text text,
  category text,
  created_at timestamptz,
  ameen_count bigint
) AS $$
SELECT
  d.id,
  d.text,
  d.category,
  d.created_at,
  COALESCE(s.ameen_count, 0) AS ameen_count
FROM duas d
LEFT JOIN dua_stats s ON s.dua_id = d.id
WHERE d.status = 'approved'
  AND d.author_id != p_user_id
  AND NOT EXISTS (
    SELECT 1 FROM ameen_interactions ai
    WHERE ai.dua_id = d.id AND ai.user_id = p_user_id
  )
ORDER BY (
  SELECT COUNT(*) FROM ameen_interactions ai2 WHERE ai2.dua_id = d.id
) ASC, d.created_at ASC
LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 9. Enable RLS on all tables
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ameen_interactions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 10. RLS Policies
-- =============================================================================

-- profiles --
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Reviewers can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'reviewer'
    )
  );

-- duas --
CREATE POLICY "Anyone can read approved duas"
  ON public.duas FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Authors can read own duas"
  ON public.duas FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Authenticated users can create duas"
  ON public.duas FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Authors can update own duas"
  ON public.duas FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Reviewers can update dua status"
  ON public.duas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'reviewer'
    )
    AND author_id != auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'reviewer'
    )
    AND author_id != auth.uid()
  );

CREATE POLICY "Authors can delete own duas"
  ON public.duas FOR DELETE
  USING (author_id = auth.uid());

-- ameen_interactions --
CREATE POLICY "Users can read own interactions"
  ON public.ameen_interactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create interactions on approved duas"
  ON public.ameen_interactions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.duas d
      WHERE d.id = dua_id AND d.status = 'approved'
    )
  );

CREATE POLICY "Users can undo pass interactions"
  ON public.ameen_interactions FOR DELETE
  USING (
    user_id = auth.uid()
    AND action = 'pass'
  );

-- =============================================================================
-- 11. Indexes
-- =============================================================================
CREATE INDEX idx_duas_status ON public.duas(status);
CREATE INDEX idx_duas_author_id ON public.duas(author_id);
CREATE INDEX idx_ameen_interactions_dua_id ON public.ameen_interactions(dua_id);
CREATE INDEX idx_ameen_interactions_user_id ON public.ameen_interactions(user_id);

-- =============================================================================
-- 12. Grant access to authenticated and anon roles
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.duas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.duas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ameen_interactions TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.dua_stats TO anon, authenticated;
