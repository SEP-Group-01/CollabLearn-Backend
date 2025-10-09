# WebSocket Integration Guide for CollabLearn Frontend

## WebSocket Server Details
- **URL**: `http://localhost:3003/forum`
- **Library**: Socket.IO
- **Namespace**: `/forum`
- **CORS**: Enabled for `http://localhost:3000` and `http://localhost:5173`

## 1. Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

## 2. Frontend WebSocket Connection Setup

### Basic Connection (React/JavaScript)

```javascript
import { io } from 'socket.io-client';

// Create WebSocket connection
const socket = io('http://localhost:3003/forum', {
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to forum WebSocket:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from forum WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection error:', error);
});
```

### React Hook Implementation

```javascript
// hooks/useForumWebSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const useForumWebSocket = (workspaceId, userId) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Create connection
    socketRef.current = io('http://localhost:3003/forum', {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const socket = socketRef.current;

    // Connection handlers
    socket.on('connect', () => {
      console.log('✅ Connected to forum WebSocket:', socket.id);
      setIsConnected(true);
      
      // Join the workspace room
      socket.emit('join-group', {
        groupId: workspaceId,
        userId: userId
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from forum WebSocket');
      setIsConnected(false);
    });

    // Forum event handlers
    socket.on('new-message', (data) => {
      console.log('📩 New message received:', data);
      setMessages(prev => [data.message, ...prev]);
    });

    socket.on('new-reply', (data) => {
      console.log('💬 New reply received:', data);
      // Update the specific message with new reply
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, replies: [...(msg.replies || []), data.reply] }
            : msg
        )
      );
    });

    socket.on('like-updated', (data) => {
      console.log('👍 Like updated:', data);
      // Update like count in messages
      setMessages(prev => 
        prev.map(msg => {
          if (data.type === 'message' && msg.id === data.messageId) {
            return { ...msg, likes: data.likeCount, isLiked: data.liked };
          } else if (data.type === 'reply' && msg.id === data.messageId) {
            return {
              ...msg,
              replies: msg.replies?.map(reply =>
                reply.id === data.replyId
                  ? { ...reply, likes: data.likeCount, isLiked: data.liked }
                  : reply
              )
            };
          }
          return msg;
        })
      );
    });

    socket.on('user-typing', (data) => {
      console.log('⌨️ User typing:', data);
      // Handle typing indicator
    });

    socket.on('user-joined', (data) => {
      console.log('👋 User joined:', data);
    });

    socket.on('user-left', (data) => {
      console.log('👋 User left:', data);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.emit('leave-group', {
          groupId: workspaceId,
          userId: userId
        });
        socket.disconnect();
      }
    };
  }, [workspaceId, userId]);

  // WebSocket methods
  const sendMessage = (content) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send-message', {
        groupId: workspaceId,
        userId: userId,
        content: content
      });
    }
  };

  const sendReply = (messageId, content) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send-reply', {
        messageId: messageId,
        userId: userId,
        content: content,
        groupId: workspaceId
      });
    }
  };

  const toggleLike = (messageId, replyId = null) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('toggle-like', {
        messageId: replyId ? messageId : messageId,
        replyId: replyId,
        userId: userId,
        groupId: workspaceId,
        type: replyId ? 'reply' : 'message'
      });
    }
  };

  const sendTyping = (isTyping) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing', {
        groupId: workspaceId,
        userId: userId,
        isTyping: isTyping
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    messages,
    setMessages,
    sendMessage,
    sendReply,
    toggleLike,
    sendTyping
  };
};
```

## 3. React Component Usage

```jsx
// components/ForumChat.jsx
import React, { useState, useEffect } from 'react';
import { useForumWebSocket } from '../hooks/useForumWebSocket';

const ForumChat = ({ workspaceId, userId }) => {
  const [newMessage, setNewMessage] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  
  const {
    isConnected,
    messages,
    setMessages,
    sendMessage,
    sendReply,
    toggleLike,
    sendTyping
  } = useForumWebSocket(workspaceId, userId);

  // Load initial messages from API
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/forum/messages`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    if (workspaceId) {
      loadMessages();
    }
  }, [workspaceId, setMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleSendReply = (messageId) => {
    if (replyContent.trim()) {
      sendReply(messageId, replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
    }
  };

  const handleTyping = (isTyping) => {
    sendTyping(isTyping);
  };

  return (
    <div className="forum-chat">
      {/* Connection Status */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Messages List */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div className="message-header">
              <img src={message.author.avatar} alt={message.author.name} />
              <span className="author-name">{message.author.name}</span>
              <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
            </div>
            
            <div className="message-content">{message.content}</div>
            
            <div className="message-actions">
              <button 
                onClick={() => toggleLike(message.id)}
                className={`like-btn ${message.isLiked ? 'liked' : ''}`}
              >
                👍 {message.likes}
              </button>
              
              <button onClick={() => setReplyingTo(message.id)}>
                💬 Reply
              </button>
            </div>

            {/* Replies */}
            {message.replies?.map((reply) => (
              <div key={reply.id} className="reply">
                <div className="reply-header">
                  <img src={reply.author.avatar} alt={reply.author.name} />
                  <span className="author-name">{reply.author.name}</span>
                  <span className="timestamp">{new Date(reply.timestamp).toLocaleString()}</span>
                </div>
                <div className="reply-content">{reply.content}</div>
                <button 
                  onClick={() => toggleLike(message.id, reply.id)}
                  className={`like-btn ${reply.isLiked ? 'liked' : ''}`}
                >
                  👍 {reply.likes}
                </button>
              </div>
            ))}

            {/* Reply Form */}
            {replyingTo === message.id && (
              <div className="reply-form">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                />
                <button onClick={() => handleSendReply(message.id)}>Send</button>
                <button onClick={() => setReplyingTo(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Message Form */}
      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onFocus={() => handleTyping(true)}
          onBlur={() => handleTyping(false)}
          placeholder="Type your message..."
        />
        <button type="submit" disabled={!isConnected || !newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ForumChat;
```

## 4. Available WebSocket Events

### Outgoing Events (Frontend → Backend)
- `join-group` - Join a workspace chat room
- `leave-group` - Leave a workspace chat room  
- `send-message` - Send a new message
- `send-reply` - Reply to a message
- `toggle-like` - Like/unlike a message or reply
- `typing` - Send typing indicator
- `pin-message` - Pin/unpin message (admin only)

### Incoming Events (Backend → Frontend)
- `new-message` - New message received
- `new-reply` - New reply received
- `like-updated` - Like count updated
- `user-typing` - User typing indicator
- `user-joined` - User joined the room
- `user-left` - User left the room
- `message-pin-updated` - Message pin status updated

## 5. Integration with Your Existing API

Your WebSocket automatically integrates with your existing REST API:
- REST API endpoint: `GET/POST /api/workspaces/{id}/forum/messages`
- WebSocket provides real-time updates for the same data
- Both use the same database tables (`messages`, `message_likes`)

## 6. Testing the Connection

1. Make sure your backend is running:
   ```bash
   npm run start:dev
   ```

2. Check that the forum service is running on port 3003
3. Open browser dev tools and check WebSocket connection
4. You should see connection logs in both frontend console and backend terminal

## 7. Error Handling

```javascript
socket.on('connect_error', (error) => {
  console.error('WebSocket connection failed:', error);
  // Show user-friendly message
  // Maybe fallback to HTTP-only mode
});

// Handle WebSocket command errors
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

The WebSocket server is already configured and running. Just implement the frontend code above to connect to it!
