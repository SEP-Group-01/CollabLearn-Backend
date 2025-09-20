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

    // Get messages with author details from user_profiles
    const { data: messages, error: messagesError } = await supabase
      .from('forum_messages')
      .select(
        `
        *,
        users!forum_messages_author_id_fkey(id, first_name, last_name, email),
        likes:forum_message_likes(user_id),
        replies:forum_replies(
          *,
          users!forum_replies_author_id_fkey(id, first_name, last_name, email),
          likes:forum_reply_likes(user_id)
        )
      `,
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (messagesError) {
      throw new BadRequestException(
        'Failed to fetch messages: ' + messagesError.message,
      );
    }

    if (!messages) {
      return [];
    }

    // Get all unique user IDs from messages and replies
    const userIds = new Set<string>();
    messages.forEach((message: any) => {
      userIds.add(message.author_id);
      message.replies?.forEach((reply: any) => {
        userIds.add(reply.author_id);
      });
    });

    // Fetch user profiles for all users
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .in('id', Array.from(userIds));

    // Create a map for quick user profile lookup
    const userProfileMap = new Map();
    userProfiles?.forEach((profile: any) => {
      userProfileMap.set(profile.id, profile);
    });

    // Transform the data to match frontend interface
    return messages.map((message: any) => {
      const dbMessage = message as DbForumMessage & {
        users: any;
        likes: DbMessageLike[];
        replies: Array<DbForumReply & { users: any; likes: DbReplyLike[] }>;
      };

      const userProfile = userProfileMap.get(dbMessage.author_id);
      const userAuth = dbMessage.users;

      return {
        id: dbMessage.id,
        content: dbMessage.content,
        author: {
          id: userAuth?.id || '',
          name:
            userProfile?.display_name ||
            `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
            'Unknown User',
          avatar:
            userProfile?.avatar ||
            `/placeholder.svg?height=40&width=40&text=${(userProfile?.display_name || userAuth?.first_name || 'U').charAt(0)}`,
          role: userProfile?.role || 'member',
        } as Author,
        timestamp: dbMessage.created_at,
        isPinned: dbMessage.is_pinned || false,
        likes: dbMessage.likes?.length || 0,
        isLiked:
          dbMessage.likes?.some((like) => like.user_id === userId) || false,
        image: dbMessage.image_url,
        groupId: dbMessage.group_id,
        replies:
          dbMessage.replies?.map((reply) => {
            const replyUserProfile = userProfileMap.get(reply.author_id);
            const replyUserAuth = reply.users;

            return {
              id: reply.id,
              content: reply.content,
              author: {
                id: replyUserAuth?.id || '',
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
              likes: reply.likes?.length || 0,
              isLiked:
                reply.likes?.some((like) => like.user_id === userId) || false,
            };
          }) || [],
      } as MessageType;
    });
  }

  async createMessage(
    createMessageDto: CreateMessageDto,
  ): Promise<MessageType> {
    const supabase = this.supabaseService.getClient();

    const { data: message, error } = await supabase
      .from('forum_messages')
      .insert({
        content: createMessageDto.content,
        group_id: createMessageDto.groupId,
        author_id: createMessageDto.authorId,
        image_url: createMessageDto.image,
        is_pinned: createMessageDto.isPinned || false,
        created_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        users!forum_messages_author_id_fkey(id, first_name, last_name, email)
      `,
      )
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

    const dbMessage = message as DbForumMessage & {
      users: any;
    };

    // Get user profile for the author
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .eq('id', dbMessage.author_id)
      .single();

    const userAuth = dbMessage.users;

    return {
      id: dbMessage.id,
      content: dbMessage.content,
      author: {
        id: userAuth?.id || '',
        name:
          userProfile?.display_name ||
          `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
          'Unknown User',
        avatar:
          userProfile?.avatar ||
          `/placeholder.svg?height=40&width=40&text=${(userProfile?.display_name || userAuth?.first_name || 'U').charAt(0)}`,
        role: userProfile?.role || 'member',
      },
      timestamp: dbMessage.created_at,
      isPinned: dbMessage.is_pinned,
      likes: 0,
      isLiked: false,
      image: dbMessage.image_url,
      groupId: dbMessage.group_id,
      replies: [],
    };
  }

  async createReply(createReplyDto: CreateReplyDto): Promise<ReplyType> {
    const supabase = this.supabaseService.getClient();

    // Check if message exists
    const { data: messageExists } = await supabase
      .from('forum_messages')
      .select('id')
      .eq('id', createReplyDto.messageId)
      .single();

    if (!messageExists) {
      throw new NotFoundException('Message not found');
    }

    const { data: reply, error } = await supabase
      .from('forum_replies')
      .insert({
        content: createReplyDto.content,
        message_id: createReplyDto.messageId,
        author_id: createReplyDto.authorId,
        created_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        users!forum_replies_author_id_fkey(id, first_name, last_name, email)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException('Failed to create reply: ' + error.message);
    }

    // Get user profile for the author
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar, role')
      .eq('id', reply.author_id)
      .single();

    const userAuth = reply.users;

    return {
      id: reply.id,
      content: reply.content,
      author: {
        id: userAuth?.id || '',
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
      .from('forum_messages')
      .select('id')
      .eq('id', toggleLikeDto.messageId)
      .single();

    if (!messageExists) {
      throw new NotFoundException('Message not found');
    }

    // Check if user already liked this message
    const { data: existingLike } = await supabase
      .from('forum_message_likes')
      .select('id')
      .eq('message_id', toggleLikeDto.messageId)
      .eq('user_id', toggleLikeDto.userId)
      .single();

    let liked = false;

    if (existingLike) {
      // Unlike the message
      await supabase
        .from('forum_message_likes')
        .delete()
        .eq('id', existingLike.id);
      liked = false;
    } else {
      // Like the message
      await supabase.from('forum_message_likes').insert({
        message_id: toggleLikeDto.messageId,
        user_id: toggleLikeDto.userId,
        created_at: new Date().toISOString(),
      });
      liked = true;
    }

    // Get updated like count
    const { data: likes, error } = await supabase
      .from('forum_message_likes')
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

    // Check if reply exists
    const { data: replyExists } = await supabase
      .from('forum_replies')
      .select('id')
      .eq('id', replyId)
      .eq('message_id', messageId)
      .single();

    if (!replyExists) {
      throw new NotFoundException('Reply not found');
    }

    // Check if user already liked this reply
    const { data: existingLike } = await supabase
      .from('forum_reply_likes')
      .select('id')
      .eq('reply_id', replyId)
      .eq('user_id', userId)
      .single();

    let liked = false;

    if (existingLike) {
      // Unlike the reply
      await supabase
        .from('forum_reply_likes')
        .delete()
        .eq('id', existingLike.id);
      liked = false;
    } else {
      // Like the reply
      await supabase.from('forum_reply_likes').insert({
        reply_id: replyId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      liked = true;
    }

    // Get updated like count
    const { data: likes, error } = await supabase
      .from('forum_reply_likes')
      .select('id')
      .eq('reply_id', replyId);

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

    const { error } = await supabase
      .from('forum_messages')
      .update({ is_pinned: true })
      .eq('id', messageId);

    if (error) {
      throw new BadRequestException('Failed to pin message: ' + error.message);
    }

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

    const { error } = await supabase
      .from('forum_messages')
      .update({ is_pinned: false })
      .eq('id', messageId);

    if (error) {
      throw new BadRequestException(
        'Failed to unpin message: ' + error.message,
      );
    }

    return { success: true };
  }
}
