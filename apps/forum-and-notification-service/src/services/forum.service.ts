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

@Injectable()
export class ForumService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getGroupMessages(
    workspaceId: string, // UUID string
    userId: string, // UUID string
  ): Promise<MessageType[]> {
    const supabase = this.supabaseService.getClient();

    // First, get all messages (only main messages, no parent_id)
    // Order by ascending (oldest first) so newest appear at bottom in chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, reply_count')
      .eq('workspace_id', workspaceId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new BadRequestException(
        'Failed to fetch messages: ' + messagesError.message,
      );
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Get all replies from the dedicated replies table
    const messageIds = messages.map((msg) => msg.id);
    console.log('📝 Fetching replies for message IDs:', messageIds);
    
    const { data: replies } = await supabase
      .from('replies')
      .select('*')
      .in('parent_message_id', messageIds)
      .order('created_at', { ascending: true });

    console.log('💬 Found replies:', replies?.length || 0, replies);

    // Get all unique user IDs from messages and replies
    const userIds = new Set<string>();
    messages.forEach((message: any) => {
      userIds.add(message.author_id);
    });

    replies?.forEach((reply: any) => {
      userIds.add(reply.user_id); // Changed from author_id to user_id for replies table
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

    // Get message likes for main messages only (replies don't have likes in this implementation)
    const { data: messageLikes } = await supabase
      .from('message_likes')
      .select('message_id, user_id')
      .in('message_id', messageIds);

    // Create likes maps
    const messageLikesMap = new Map<number, any[]>();
    messageLikes?.forEach((like: any) => {
      if (!messageLikesMap.has(like.message_id)) {
        messageLikesMap.set(like.message_id, []);
      }
      messageLikesMap.get(like.message_id)?.push(like);
    });

    // Group replies by parent message ID
    const repliesMap = new Map<string, any[]>();
    replies?.forEach((reply: any) => {
      if (!repliesMap.has(reply.parent_message_id)) {
        repliesMap.set(reply.parent_message_id, []);
      }
      repliesMap.get(reply.parent_message_id)?.push(reply);
    });

    // Transform the data to match frontend interface
    const result = messages.map((message: any) => {
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
        isPinned: false,
        likes: messageLikes.length,
        isLiked: messageLikes.some((like: any) => like.user_id === userId),
        image: undefined,
        workspaceId: message.workspace_id,
        reply_count: message.reply_count || messageReplies.length,
        replies: messageReplies.map((reply: any) => {
          const replyUserAuth = userMap.get(reply.user_id); // Changed from author_id to user_id
          const replyUserProfile = userProfileMap.get(reply.user_id); // Changed from author_id to user_id

          return {
            id: reply.id,
            content: reply.content,
            author: {
              id: replyUserAuth?.id || reply.user_id, // Changed from author_id to user_id
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
            likes: 0, // Replies don't have likes in current implementation
            isLiked: false,
          };
        }),
      } as MessageType;
    });

    console.log(
      '🎯 Final messages with replies:',
      result.map((msg) => ({
        id: msg.id,
        content: msg.content.substring(0, 50) + '...',
        replies: msg.replies.length,
        repliesData: msg.replies.map(r => ({ id: r.id, content: r.content.substring(0, 20) }))
      })),
    );

    return result;
  }

  async createMessage(
    createMessageDto: CreateMessageDto,
  ): Promise<MessageType> {
    const supabase = this.supabaseService.getClient();

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content: createMessageDto.content,
        workspace_id: createMessageDto.workspaceId,
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
      workspaceId: message.workspace_id, // Changed from groupId to workspaceId
      replies: [],
    };
  }

  async createReply(createReplyDto: CreateReplyDto): Promise<ReplyType> {
    const supabase = this.supabaseService.getClient();

    // First, verify that the parent message exists
    const { data: messageExists, error: messageError } = await supabase
      .from('messages')
      .select('id, workspace_id')
      .eq('id', createReplyDto.messageId)
      .single();

    if (messageError || !messageExists) {
      throw new NotFoundException('Parent message not found');
    }

    // Insert reply into the dedicated replies table
    const { data: reply, error } = await supabase
      .from('replies')
      .insert({
        content: createReplyDto.content,
        parent_message_id: createReplyDto.messageId,
        user_id: createReplyDto.authorId,
        workspace_id: messageExists.workspace_id,
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
      .eq('id', reply.user_id)
      .single();

    // Get user profile for the author
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .eq('id', reply.user_id)
      .single();

    return {
      id: reply.id,
      content: reply.content,
      author: {
        id: userAuth?.id || reply.user_id,
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

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if message exists and belongs to user
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, author_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is the author or admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAuthor = message.author_id === userId;
    const isAdmin = userProfile?.role === 'admin';

    if (!isAuthor && !isAdmin) {
      throw new BadRequestException('You can only delete your own messages');
    }

    // Delete all replies first (from replies table)
    await supabase
      .from('replies')
      .delete()
      .eq('parent_message_id', messageId);

    // Delete all likes for this message
    await supabase
      .from('message_likes')
      .delete()
      .eq('message_id', messageId);

    // Delete the message
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      throw new BadRequestException('Failed to delete message: ' + deleteError.message);
    }

    return { success: true };
  }

  async deleteReply(
    replyId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if reply exists and belongs to user (in replies table)
    const { data: reply, error: replyError } = await supabase
      .from('replies')
      .select('id, user_id')
      .eq('id', replyId)
      .single();

    if (replyError || !reply) {
      throw new NotFoundException('Reply not found');
    }

    // Check if user is the author or admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAuthor = reply.user_id === userId;
    const isAdmin = userProfile?.role === 'admin';

    if (!isAuthor && !isAdmin) {
      throw new BadRequestException('You can only delete your own replies');
    }

    // Delete the reply
    const { error: deleteError } = await supabase
      .from('replies')
      .delete()
      .eq('id', replyId);

    if (deleteError) {
      throw new BadRequestException('Failed to delete reply: ' + deleteError.message);
    }

    return { success: true };
  }
}
