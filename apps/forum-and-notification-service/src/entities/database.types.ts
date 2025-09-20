// Database types for Supabase
export interface DbUserProfile {
  id: string; // UUID in Supabase, references users table
  display_name: string;
  avatar?: string;
  role: 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

export interface DbUserAuth {
  id: string; // UUID
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface DbGroup {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DbForumMessage {
  id: number;
  content: string;
  author_id: string; // UUID reference to users
  group_id: number;
  image_url?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user_profiles?: DbUserProfile;
  users?: DbUserAuth;
  likes?: DbMessageLike[];
  replies?: Array<
    DbForumReply & {
      user_profiles?: DbUserProfile;
      users?: DbUserAuth;
      likes: DbReplyLike[];
    }
  >;
}

export interface DbForumReply {
  id: number;
  content: string;
  author_id: string; // UUID reference to users
  message_id: number;
  created_at: string;
  updated_at: string;
  user_profiles?: DbUserProfile;
  users?: DbUserAuth;
  likes?: DbReplyLike[];
}

export interface DbMessageLike {
  id: number;
  user_id: string; // UUID reference to users
  message_id: number;
  created_at: string;
}

export interface DbReplyLike {
  id: number;
  user_id: string; // UUID reference to users
  reply_id: number;
  created_at: string;
}

export interface DbGroupMember {
  id: number;
  user_id: string; // UUID reference to users
  group_id: number;
  joined_at: string;
}
