import axios from 'axios';
import type { MessageType, ReplyType } from '../types/ForumInterfaces';
import { getAccessToken, getUserData } from './authApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance with auth header
const createAuthenticatedRequest = () => {
  const token = getAccessToken();
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
};

// Get current user ID from stored user data
const getCurrentUserId = (): string => {
  const userData = getUserData();
  if (!userData || !userData.id) {
    throw new Error('User not authenticated or user ID not found');
  }
  return userData.id.toString(); // Ensure it's a string
};

// Forum API Functions
// Check if backend is available
let isBackendAvailable: boolean | null = null;

const checkBackendAvailability = async (): Promise<boolean> => {
  if (isBackendAvailable !== null) return isBackendAvailable;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      import.meta.env.VITE_API_URL || 'http://localhost:3000',
      {
        method: 'HEAD',
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    isBackendAvailable = response.ok;
    return isBackendAvailable;
  } catch {
    isBackendAvailable = false;
    return false;
  }
};

export const getForumMessages = async (
  workspaceId: string,
): Promise<MessageType[]> => {
  try {
    const api = createAuthenticatedRequest();
    const response = await api.get(
      `/api/workspaces/${workspaceId}/forum/messages`,
    );
    console.log('✅ Successfully connected to backend API');
    isBackendAvailable = true;
    return response.data;
  } catch (error: any) {
    console.error('Error fetching forum messages:', error);

    // Check if this is a network/backend issue
    const backendDown =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ERR_NETWORK' ||
      error.response?.status >= 500 ||
      !error.response;

    if (backendDown && workspaceId === '09700b1d-ebc5-4d53-ba83-2434505fd21a') {
      console.log(
        '🎭 Backend unavailable - Using mock data fallback for testing',
      );
      isBackendAvailable = false;
      return [
        {
          id: 1,
          content:
            'Welcome to the Web Design workspace! This is mock data while your backend is being set up.',
          author: {
            id: 1,
            name: 'System',
            avatar: '/src/assets/profile_img_1.png',
            role: 'admin',
          },
          timestamp: new Date().toISOString(),
          isPinned: true,
          likes: 0,
          replies: [],
          isLiked: false,
        },
      ];
    }

    // For other errors, throw them
    throw error;
  }
};

export const createForumMessage = async (
  workspaceId: string,
  content: string,
  image?: File,
): Promise<MessageType> => {
  try {
    const api = createAuthenticatedRequest();
    const authorId = getCurrentUserId(); // Get current user ID

    if (image) {
      // Handle image upload
      const formData = new FormData();
      formData.append('content', content);
      formData.append('authorId', authorId);
      formData.append('image', image);

      const response = await api.post(
        `/api/workspaces/${workspaceId}/forum/messages`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } else {
      // Text-only message
      const response = await api.post(
        `/api/workspaces/${workspaceId}/forum/messages`,
        {
          content,
          authorId, // Include authorId as required by backend
        },
      );
      return response.data;
    }
  } catch (error: any) {
    console.error('Error creating forum message:', error);

    // Temporary mock fallback for testing
    if (workspaceId === '09700b1d-ebc5-4d53-ba83-2434505fd21a') {
      console.log('🎭 Using mock message creation for testing');
      const userData = getUserData();
      return {
        id: Date.now(), // Use timestamp as ID for uniqueness
        content,
        author: {
          id: userData ? parseInt(userData.id.toString()) : 1,
          name: userData
            ? `${userData.first_name} ${userData.last_name}`
            : 'Mock User',
          avatar: '/src/assets/profile_img2.png',
          role: 'member',
        },
        timestamp: new Date().toISOString(),
        isPinned: false,
        likes: 0,
        replies: [],
        isLiked: false,
        image: image ? URL.createObjectURL(image) : undefined,
      };
    }

    throw new Error(
      error.response?.data?.message || 'Failed to create message',
    );
  }
};

export const createReply = async (
  workspaceId: string,
  messageId: number,
  content: string,
): Promise<ReplyType> => {
  try {
    const api = createAuthenticatedRequest();
    const authorId = getCurrentUserId(); // Get current user ID

    const response = await api.post(
      `/api/workspaces/${workspaceId}/forum/messages`,
      {
        content,
        authorId,
        parentMessageId: messageId.toString(), // This creates a reply by setting parentMessageId
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating reply:', error);
    throw new Error(error.response?.data?.message || 'Failed to create reply');
  }
};

export const likeMessage = async (
  workspaceId: string,
  messageId: number,
): Promise<{ likes: number; isLiked: boolean }> => {
  try {
    const api = createAuthenticatedRequest();
    const userId = getCurrentUserId(); // Get current user ID

    const response = await api.post(
      `/api/workspaces/${workspaceId}/forum/messages/${messageId}/like`,
      {
        userId, // Include userId as required by backend
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Error liking message:', error);
    throw new Error(error.response?.data?.message || 'Failed to like message');
  }
};

export const likeReply = async (
  workspaceId: string,
  replyId: number,
): Promise<{ likes: number; isLiked: boolean }> => {
  try {
    const api = createAuthenticatedRequest();
    const userId = getCurrentUserId(); // Get current user ID

    // Note: You'll need to add this endpoint to your backend if it doesn't exist
    const response = await api.post(
      `/api/workspaces/${workspaceId}/forum/replies/${replyId}/like`,
      {
        userId,
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Error liking reply:', error);
    throw new Error(error.response?.data?.message || 'Failed to like reply');
  }
};

export const pinMessage = async (
  workspaceId: string,
  messageId: number,
): Promise<{ isPinned: boolean }> => {
  try {
    const api = createAuthenticatedRequest();
    const userId = getCurrentUserId(); // Get current user ID

    const response = await api.put(
      `/api/workspaces/${workspaceId}/forum/messages/${messageId}/pin`,
      {
        userId, // Include userId as required by backend
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Error pinning message:', error);
    throw new Error(error.response?.data?.message || 'Failed to pin message');
  }
};

export const getWorkspaceInfo = async (workspaceId: string) => {
  try {
    const api = createAuthenticatedRequest();
    const response = await api.get(`/api/workspaces/${workspaceId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching workspace info:', error);

    // Temporary mock data fallback for testing
    if (workspaceId === '09700b1d-ebc5-4d53-ba83-2434505fd21a') {
      console.log('🎭 Using mock workspace info for testing');
      return {
        id: workspaceId,
        title: 'Web Design',
        description: 'Learn web design from basics to advanced topics.',
        category: 'Design',
        members: 120,
        lightColor: '#E0F2FE',
        darkColor: '#0369A1',
        isAdmin: false,
        isMember: true,
      };
    }

    throw new Error(
      error.response?.data?.message || 'Failed to fetch workspace info',
    );
  }
};
