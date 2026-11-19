-- ============================================================================
-- StartOrigin — Complete Supabase SQL Schema, Functions, Triggers, RLS & Storage
-- Run this entire script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_verified = true
WHERE lower(username) = 'subnocte';

-- Case-insensitive unique username constraint
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collections_user_id_idx ON public.collections (user_id);

CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  title text NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  privacy text NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
  tags text[] NOT NULL DEFAULT '{}',
  photo_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_user_id_idx ON public.photos (user_id);
CREATE INDEX IF NOT EXISTS photos_collection_id_idx ON public.photos (collection_id);
CREATE INDEX IF NOT EXISTS photos_privacy_created_idx ON public.photos (privacy, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_tags_gin_idx ON public.photos USING GIN (tags);

CREATE TABLE IF NOT EXISTS public.photo_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, user_id)
);

CREATE INDEX IF NOT EXISTS photo_likes_photo_id_idx ON public.photo_likes (photo_id);
CREATE INDEX IF NOT EXISTS photo_likes_user_id_idx ON public.photo_likes (user_id);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, target_user_id),
  CHECK (subscriber_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_target_idx ON public.subscriptions (target_user_id);
CREATE INDEX IF NOT EXISTS subscriptions_subscriber_idx ON public.subscriptions (subscriber_id);

CREATE TABLE IF NOT EXISTS public.saved_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS saved_collections_user_idx ON public.saved_collections (user_id);

CREATE TABLE IF NOT EXISTS public.saved_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, photo_id)
);

CREATE INDEX IF NOT EXISTS saved_photos_user_idx ON public.saved_photos (user_id);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('upload', 'collection', 'like', 'subscribe', 'save_collection', 'save_photo')),
  target_id uuid,
  description text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx ON public.activity_logs (user_id, created_at DESC);

-- 3. Trigger Functions
CREATE OR REPLACE FUNCTION public.touch_collection_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collections_updated_at ON public.collections;
CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_collection_updated_at();

CREATE OR REPLACE FUNCTION public.touch_collection_on_photo_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.collection_id IS NOT NULL THEN
    UPDATE public.collections SET updated_at = now() WHERE id = NEW.collection_id;
  END IF;
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.collection_id IS NOT NULL THEN
    UPDATE public.collections SET updated_at = now() WHERE id = OLD.collection_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_photos_touch_collection ON public.photos;
CREATE TRIGGER trg_photos_touch_collection
  AFTER INSERT OR UPDATE OR DELETE ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_collection_on_photo_change();

-- Automatically create profile row when a new auth user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_username text;
BEGIN
  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1));
  v_username := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  INSERT INTO public.profiles (id, name, username, email, is_verified)
  VALUES (
    NEW.id,
    v_name,
    v_username,
    COALESCE(NEW.email, ''),
    lower(v_username) = 'subnocte'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Auth Helper RPC Functions (Case-Insensitive Username Login & Availability Check)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(username) = lower(trim(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
  );
$$;

REVOKE ALL ON FUNCTION public.check_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Collections Policies
DROP POLICY IF EXISTS "Users can view own or public collections" ON public.collections;
CREATE POLICY "Users can view own or public collections"
  ON public.collections FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.photos p
      WHERE p.collection_id = collections.id AND p.privacy = 'public'
    )
    OR EXISTS (
      SELECT 1 FROM public.saved_collections sc
      WHERE sc.collection_id = collections.id
    )
  );

DROP POLICY IF EXISTS "Users can create own collections" ON public.collections;
CREATE POLICY "Users can create own collections"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
CREATE POLICY "Users can update own collections"
  ON public.collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;
CREATE POLICY "Users can delete own collections"
  ON public.collections FOR DELETE
  USING (auth.uid() = user_id);

-- Photos Policies
DROP POLICY IF EXISTS "Public photos are viewable by all; private by owner" ON public.photos;
CREATE POLICY "Public photos are viewable by all; private by owner"
  ON public.photos FOR SELECT
  USING (privacy = 'public' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own photos" ON public.photos;
CREATE POLICY "Users can insert own photos"
  ON public.photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own photos" ON public.photos;
CREATE POLICY "Users can update own photos"
  ON public.photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own photos" ON public.photos;
CREATE POLICY "Users can delete own photos"
  ON public.photos FOR DELETE
  USING (auth.uid() = user_id);

-- Photo Likes Policies
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.photo_likes;
CREATE POLICY "Likes are viewable by everyone"
  ON public.photo_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can like photos" ON public.photo_likes;
CREATE POLICY "Authenticated users can like photos"
  ON public.photo_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own likes" ON public.photo_likes;
CREATE POLICY "Users can remove own likes"
  ON public.photo_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Subscriptions Policies
DROP POLICY IF EXISTS "Subscriptions are viewable by everyone" ON public.subscriptions;
CREATE POLICY "Subscriptions are viewable by everyone"
  ON public.subscriptions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can subscribe as themselves" ON public.subscriptions;
CREATE POLICY "Users can subscribe as themselves"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id AND subscriber_id <> target_user_id);

DROP POLICY IF EXISTS "Users can unsubscribe themselves" ON public.subscriptions;
CREATE POLICY "Users can unsubscribe themselves"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = subscriber_id);

-- Saved Collections Policies
DROP POLICY IF EXISTS "Saved collections are viewable by everyone" ON public.saved_collections;
CREATE POLICY "Saved collections are viewable by everyone"
  ON public.saved_collections FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can save collections for themselves" ON public.saved_collections;
CREATE POLICY "Users can save collections for themselves"
  ON public.saved_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave own saved collections" ON public.saved_collections;
CREATE POLICY "Users can unsave own saved collections"
  ON public.saved_collections FOR DELETE
  USING (auth.uid() = user_id);

-- Saved Photos Policies
DROP POLICY IF EXISTS "Saved photos are viewable by everyone" ON public.saved_photos;
CREATE POLICY "Saved photos are viewable by everyone"
  ON public.saved_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can save photos for themselves" ON public.saved_photos;
CREATE POLICY "Users can save photos for themselves"
  ON public.saved_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave own saved photos" ON public.saved_photos;
CREATE POLICY "Users can unsave own saved photos"
  ON public.saved_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Activity Logs Policies
DROP POLICY IF EXISTS "Public activity viewable by all; private by owner" ON public.activity_logs;
CREATE POLICY "Public activity viewable by all; private by owner"
  ON public.activity_logs FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own activity" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert own activity"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for photos bucket" ON storage.objects;
CREATE POLICY "Public read access for photos bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('photos', 'avatars'));

DROP POLICY IF EXISTS "Authenticated users can upload to own folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('photos', 'avatars')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own storage objects" ON storage.objects;
CREATE POLICY "Users can update own storage objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('photos', 'avatars')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own storage objects" ON storage.objects;
CREATE POLICY "Users can delete own storage objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('photos', 'avatars')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
