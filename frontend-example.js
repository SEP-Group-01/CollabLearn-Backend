/* 
Frontend Y.js Integration Example

This is an example of how to integrate with the Y.js WebSocket backend.
Install these packages in your frontend:
npm install yjs y-websocket

Then use this code as a starting point:
*/

import * as Y from 'yjs';

class CollaborativeEditor {
  constructor(documentId, userId, wsUrl = 'ws://localhost:3000') {
    this.documentId = documentId;
    this.userId = userId;
    this.wsUrl = wsUrl;
    
    // Create Y.js document
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('content');
    
    // WebSocket connection
    this.ws = null;
    this.isConnected = false;
    
    // Awareness for user presence
    this.awareness = new Map();
    
    this.connect();
    this.setupEventListeners();
  }

  connect() {
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
      this.isConnected = true;
      this.joinDocument();
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.isConnected = false;
      // Implement reconnection logic here
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  joinDocument() {
    this.send('document:join', {
      documentId: this.documentId,
      userId: this.userId
    });
  }

  setupEventListeners() {
    // Listen to Y.js document updates
    this.ydoc.on('update', (update) => {
      // Send Y.js updates to server
      this.send('yjs:update', {
        documentId: this.documentId,
        userId: this.userId,
        update: update // ArrayBuffer
      });
    });

    // Listen to text changes
    this.ytext.observe((event) => {
      console.log('Text changed:', this.ytext.toString());
      // Update your editor UI here
      this.updateEditorContent(this.ytext.toString());
    });
  }

  handleMessage(message) {
    const { event, data } = message;
    
    switch (event) {
      case 'document:joined':
        console.log('Successfully joined document');
        // Initial sync - request document state
        this.requestSync();
        break;
        
      case 'yjs:update':
        // Apply incoming Y.js update
        if (data.userId !== this.userId) {
          const updateArray = new Uint8Array(data.update);
          Y.applyUpdate(this.ydoc, updateArray);
        }
        break;
        
      case 'yjs:sync-update':
        // Apply sync update from server
        const syncUpdate = new Uint8Array(data.update);
        Y.applyUpdate(this.ydoc, syncUpdate);
        break;
        
      case 'awareness:update':
        // Handle user presence updates
        this.updateAwareness(data.userId, data.awareness);
        break;
        
      case 'collaborator:joined':
        console.log(`User ${data.userId} joined the document`);
        break;
        
      case 'collaborator:left':
        console.log(`User ${data.userId} left the document`);
        this.removeUserAwareness(data.userId);
        break;
        
      case 'error':
        console.error('Server error:', data.message);
        break;
    }
  }

  requestSync() {
    // Request sync with current state vector
    const stateVector = Y.encodeStateVector(this.ydoc);
    
    this.send('yjs:sync-request', {
      documentId: this.documentId,
      stateVector: Array.from(stateVector)
    });
  }

  insertText(index, text) {
    // Insert text at specified index
    this.ytext.insert(index, text);
  }

  deleteText(index, length) {
    // Delete text from specified index
    this.ytext.delete(index, length);
  }

  updateCursor(position) {
    // Update user cursor position
    this.send('awareness:update', {
      documentId: this.documentId,
      userId: this.userId,
      awareness: {
        cursor: position,
        user: {
          name: this.userId,
          color: this.generateUserColor()
        }
      }
    });
  }

  updateAwareness(userId, awareness) {
    this.awareness.set(userId, awareness);
    // Update UI to show user cursors/selections
    this.renderUserCursors();
  }

  removeUserAwareness(userId) {
    this.awareness.delete(userId);
    this.renderUserCursors();
  }

  renderUserCursors() {
    // Implement cursor rendering in your editor
    console.log('Active users:', Array.from(this.awareness.keys()));
  }

  generateUserColor() {
    // Generate a color for the user
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
    return colors[this.userId.charCodeAt(0) % colors.length];
  }

  updateEditorContent(content) {
    // Update your editor's content
    // This should be implemented based on your editor framework
    console.log('Document content:', content);
  }

  send(event, data) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, ...data }));
    }
  }

  disconnect() {
    this.send('document:leave', {
      documentId: this.documentId,
      userId: this.userId
    });
    
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage example:
// const editor = new CollaborativeEditor('doc123', 'user456');

// When user types in editor:
// editor.insertText(position, text);
// editor.deleteText(position, length);

// When user moves cursor:
// editor.updateCursor(position);

export default CollaborativeEditor;