export type NavTab = 'feed' | 'search' | 'add' | 'gallery' | 'profile';

export type VisibilityLevel = 'public' | 'followers' | 'limited' | 'unlisted' | 'private';
export type PhotoPrivacy = VisibilityLevel;
export type CollectionPrivacy = VisibilityLevel;

export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  avatar_url: string;
  is_verified?: boolean;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  privacy?: CollectionPrivacy;
  allowed_user_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  collection_id: string | null;
  title: string;
  image_url: string;
  storage_path: string | null;
  privacy: PhotoPrivacy;
  allowed_user_ids?: string[] | null;
  tags: string[];
  photo_date: string;
  created_at: string;
}

export interface PhotoWithAuthor extends Photo {
  profiles?: Pick<Profile, 'id' | 'name' | 'username' | 'avatar_url' | 'is_verified'> | null;
  collections?: Pick<Collection, 'id' | 'name' | 'privacy' | 'allowed_user_ids'> | null;
  likes_count?: number;
  liked_by_me?: boolean;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  actor_id: string | null;
  action_type: 'upload' | 'collection' | 'like' | 'subscribe' | 'save_collection' | 'save_photo' | 'achievement';
  target_id: string | null;
  description: string;
  is_public: boolean;
  created_at: string;
}

export interface SavedPhotoItem {
  id: string;
  user_id: string;
  photo_id: string;
  created_at: string;
  photos?: PhotoWithAuthor | null;
}

export interface SavedCollectionItem {
  id: string;
  user_id: string;
  collection_id: string;
  created_at: string;
  collections?: (Collection & {
    profiles?: Pick<Profile, 'id' | 'name' | 'username' | 'avatar_url'> | null;
    preview_photos?: Photo[];
    photo_count?: number;
  }) | null;
}

export interface CinemaPhoto {
  id: string;
  title: string;
  image_url: string;
  subtitle?: string;
}
