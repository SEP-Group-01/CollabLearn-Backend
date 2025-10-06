/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateReplyDto } from '../dto/create-reply.dto';
import { ToggleLikeDto } from '../dto/toggle-like.dto';
import { MessageType, ReplyType, Author } from '../entities/forum.interfaces';
import {
  DbForumMessage,
  DbForumReply,
  DbMessageLike,
  DbReplyLike,
} from '../entities/database.types';

@Injectable()
export class ForumService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getGroupMessages(
    groupId: number,
    userId: string, // UUID string
  ): Promise<MessageType[]> {
    const supabase = this.supabaseService.getClient();

    // First, get all messages (parent messages only)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('workspace_id', groupId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });

    if (messagesError) {
      throw new BadRequestException(
        'Failed to fetch messages: ' + messagesError.message,
      );
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Get all replies for these messages
    const messageIds = messages.map((msg) => msg.id);
    const { data: replies } = await supabase
      .from('messages')
      .select('*')
      .in('parent_id', messageIds)
      .order('created_at', { ascending: true });

    // Get message likes
    const { data: messageLikes } = await supabase
      .from('message_likes')
      .select('message_id, user_id')
      .in('message_id', [...messageIds, ...(replies?.map((r) => r.id) || [])]);

    if (!messages) {
      return [];
    }

    // Get all unique user IDs from messages and replies
    const userIds = new Set<string>();
    messages.forEach((message: any) => {
      userIds.add(message.author_id);
    });

    replies?.forEach((reply: any) => {
      userIds.add(reply.author_id);
    });

    // Get user auth data
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', Array.from(userIds));

    // Get user profiles
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .in('id', Array.from(userIds));

    // Create maps for quick lookup
    const userMap = new Map();
    const userProfileMap = new Map();

    users?.forEach((user: any) => {
      userMap.set(user.id, user);
    });

    userProfiles?.forEach((profile: any) => {
      userProfileMap.set(profile.id, profile);
    });

    // Create likes maps
    const messageLikesMap = new Map<number, any[]>();
    messageLikes?.forEach((like: any) => {
      if (!messageLikesMap.has(like.message_id)) {
        messageLikesMap.set(like.message_id, []);
      }
      messageLikesMap.get(like.message_id)?.push(like);
    });

    // Group replies by parent message
    const repliesMap = new Map<number, any[]>();
    replies?.forEach((reply: any) => {
      if (!repliesMap.has(reply.parent_id)) {
        repliesMap.set(reply.parent_id, []);
      }
      repliesMap.get(reply.parent_id)?.push(reply);
    });

    // Transform the data to match frontend interface
    return messages.map((message: any) => {
      const userAuth = userMap.get(message.author_id);
      const userProfile = userProfileMap.get(message.author_id);
      const messageLikes = messageLikesMap.get(message.id) || [];
      const messageReplies = repliesMap.get(message.id) || [];

      return {
        id: message.id,
        content: message.content,
        author: {
          id: userAuth?.id || message.author_id,
          name:
            userProfile?.display_name ||
            `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
            'Unknown User',
          avatar:
            userProfile?.avatar ||
            `/placeholder.svg?height=40&width=40&text=${(userProfile?.display_name || userAuth?.first_name || 'U').charAt(0)}`,
          role: userProfile?.role || 'member',
        } as Author,
        timestamp: message.created_at,
        isPinned: false, // Your schema doesn't have is_pinned
        likes: messageLikes.length,
        isLiked: messageLikes.some((like: any) => like.user_id === userId),
        image: undefined, // Your schema doesn't have image_url
        groupId: message.workspace_id,
        replies: messageReplies.map((reply: any) => {
          const replyUserAuth = userMap.get(reply.author_id);
          const replyUserProfile = userProfileMap.get(reply.author_id);
          const replyLikes = messageLikesMap.get(reply.id) || [];

          return {
            id: reply.id,
            content: reply.content,
            author: {
              id: replyUserAuth?.id || reply.author_id,
              name:
                replyUserProfile?.display_name ||
                `${replyUserAuth?.first_name || ''} ${replyUserAuth?.last_name || ''}`.trim() ||
                'Unknown User',
              avatar:
                replyUserProfile?.avatar ||
                `/placeholder.svg?height=32&width=32&text=${(replyUserProfile?.display_name || replyUserAuth?.first_name || 'U').charAt(0)}`,
              role: replyUserProfile?.role || 'member',
            } as Author,
            timestamp: reply.created_at,
            likes: replyLikes.length,
            isLiked: replyLikes.some((like: any) => like.user_id === userId),
          };
        }),
      } as MessageType;
    });
  }

  async createMessage(
    createMessageDto: CreateMessageDto,
  ): Promise<MessageType> {
    const supabase = this.supabaseService.getClient();

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content: createMessageDto.content,
        workspace_id: createMessageDto.groupId,
        author_id: createMessageDto.authorId,
        parent_id: null, // For now, we'll handle replies separately
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        'Failed to create message: ' + error.message,
      );
    }

    if (!message) {
      throw new BadRequestException(
        'Failed to create message: No data returned',
      );
    }

    // Get user auth data
    const { data: userAuth } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('id', message.author_id)
      .single();

    // Get user profile for the author
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .eq('id', message.author_id)
      .single();

    return {
      id: message.id,
      content: message.content,
      author: {
        id: userAuth?.id || message.author_id,
        name:
          userProfile?.display_name ||
          `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
          'Unknown User',
        avatar:
          userProfile?.avatar ||
          `/placeholder.svg?height=40&width=40&text=${(userProfile?.display_name || userAuth?.first_name || 'U').charAt(0)}`,
        role: userProfile?.role || 'member',
      },
      timestamp: message.created_at,
      isPinned: false, // Your schema doesn't have is_pinned, so default to false
      likes: 0,
      isLiked: false,
      image: undefined, // Your schema doesn't have image_url
      groupId: message.workspace_id,
      replies: [],
    };
  }

  async createReply(createReplyDto: CreateReplyDto): Promise<ReplyType> {
    const supabase = this.supabaseService.getClient();

    // Check if message exists and get workspace_id
    const { data: messageExists } = await supabase
      .from('messages')
      .select('id, workspace_id')
      .eq('id', createReplyDto.messageId)
      .single();

    if (!messageExists) {
      throw new NotFoundException('Message not found');
    }

    const { data: reply, error } = await supabase
      .from('messages')
      .insert({
        content: createReplyDto.content,
        parent_id: createReplyDto.messageId,
        author_id: createReplyDto.authorId,
        workspace_id: (messageExists as any).workspace_id,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException('Failed to create reply: ' + error.message);
    }

    // Get user auth data
    const { data: userAuth } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('id', reply.author_id)
      .single();

    // Get user profile for the author
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .eq('id', reply.author_id)
      .single();

    return {
      id: reply.id,
      content: reply.content,
      author: {
        id: userAuth?.id || reply.author_id,
        name:
          userProfile?.display_name ||
          `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
          'Unknown User',
        avatar:
          userProfile?.avatar ||
          '/placeholder.svg?height=32&width=32&text=' +
            (userProfile?.display_name || userAuth?.first_name || 'U').charAt(
              0,
            ),
        role: userProfile?.role || 'member',
      },
      timestamp: reply.created_at,
      likes: 0,
      isLiked: false,
    };
  }

  async toggleMessageLike(
    toggleLikeDto: ToggleLikeDto,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const supabase = this.supabaseService.getClient();

    // Check if message exists
    const { data: messageExists } = await supabase
      .from('messages')
      .select('id')
      .eq('id', toggleLikeDto.messageId)
      .single();

    if (!messageExists) {
      throw new NotFoundException('Message not found');
    }

    // Check if user already liked this message
    const { data: existingLike } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', toggleLikeDto.messageId)
      .eq('user_id', toggleLikeDto.userId)
      .single();

    let liked = false;

    if (existingLike) {
      // Unlike the message
      await supabase.from('message_likes').delete().eq('id', existingLike.id);
      liked = false;
    } else {
      // Like the message
      await supabase.from('message_likes').insert({
        message_id: toggleLikeDto.messageId,
        user_id: toggleLikeDto.userId,
        created_at: new Date().toISOString(),
      });
      liked = true;
    }

    // Get updated like count
    const { data: likes, error } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', toggleLikeDto.messageId);

    if (error) {
      throw new BadRequestException(
        'Failed to get like count: ' + error.message,
      );
    }

    return {
      liked,
      likeCount: likes?.length || 0,
    };
  }

  async toggleReplyLike(
    messageId: number,
    replyId: number,
    userId: string, // UUID string
  ): Promise<{ liked: boolean; likeCount: number }> {
    const supabase = this.supabaseService.getClient();

    // Check if reply exists (replies are also in messages table with parent_id)
    const { data: replyExists } = await supabase
      .from('messages')
      .select('id')
      .eq('id', replyId)
      .eq('parent_id', messageId)
      .single();

    if (!replyExists) {
      throw new NotFoundException('Reply not found');
    }

    // Check if user already liked this reply (same table as message likes)
    const { data: existingLike } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', replyId)
      .eq('user_id', userId)
      .single();

    let liked = false;

    if (existingLike) {
      // Unlike the reply
      await supabase.from('message_likes').delete().eq('id', existingLike.id);
      liked = false;
    } else {
      // Like the reply
      await supabase.from('message_likes').insert({
        message_id: replyId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      liked = true;
    }

    // Get updated like count
    const { data: likes, error } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', replyId);

    if (error) {
      throw new BadRequestException(
        'Failed to get like count: ' + error.message,
      );
    }

    return {
      liked,
      likeCount: likes?.length || 0,
    };
  }

  async pinMessage(
    messageId: number,
    userId: string, // UUID string
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if user has admin role (using user_profiles table)
    const { data: user } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Only admins can pin messages');
    }

    // Your schema doesn't have is_pinned column, so we'll just return success
    // You can add is_pinned column to messages table if you want this functionality
    return { success: true };
  }

  async unpinMessage(
    messageId: number,
    userId: string, // UUID string
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if user has admin role
    const { data: user } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Only admins can unpin messages');
    }

    // Your schema doesn't have is_pinned column, so we'll just return success
    // You can add is_pinned column to messages table if you want this functionality
    return { success: true };
  }
}
