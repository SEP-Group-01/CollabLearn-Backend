export interface Author {
  id: string; // UUID string
  name: string;
  avatar: string;
  role: 'admin' | 'member';
}

export interface ReplyType {
  id: number;
  content: string;
  author: Author;
  timestamp: string;
  likes: number;
  isLiked: boolean;
}

export interface MessageType {
  id: number;
  content: string;
  author: Author;
  timestamp: string;
  isPinned: boolean;
  likes: number;
  replies: ReplyType[];
  isLiked: boolean;
  image?: string;
  workspaceId: string; // Changed from groupId number to workspaceId string
}

export interface Group {
  id: number;
  name: string;
  description: string;
}
