// Simple WebSocket test script
const io = require('socket.io-client');

console.log('🔌 Connecting to forum WebSocket...');

// Use a valid UUID format for userId
const testUserId = '19644cb1-58ef-48c2-b01f-0545bf77cc12'; // Valid UUID format

// Connect to the forum namespace
const socket = io('http://localhost:3000/forum', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', function () {
  console.log('✅ Connected to forum WebSocket!');
  console.log('Socket ID:', socket.id);

  // Test joining a group
  console.log('📝 Testing join-group...');
  socket.emit('join-group', { groupId: 1, userId: testUserId });
});

socket.on('connect_error', function (error) {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', function () {
  console.log('🔌 Disconnected from WebSocket');
});

// Forum-specific event handlers
socket.on('group-joined', function (data) {
  console.log('🎉 Successfully joined group:', data);

  // Test sending a message
  console.log('📨 Testing send-message...');
  socket.emit('send-message', {
    groupId: 1,
    userId: testUserId,
    content: 'Hello from WebSocket test!',
  });
});

socket.on('group-left', function (data) {
  console.log('👋 Left group:', data);
});

socket.on('new-message', function (data) {
  console.log('📩 New message received:', data);

  // Test typing indicator
  console.log('⌨️ Testing typing indicator...');
  socket.emit('typing', {
    groupId: 1,
    userId: testUserId,
    isTyping: true,
  });

  setTimeout(() => {
    socket.emit('typing', {
      groupId: 1,
      userId: testUserId,
      isTyping: false,
    });
  }, 2000);
});

socket.on('message-sent', function (data) {
  console.log('✅ Message sent confirmation:', data);
});

socket.on('user-joined', function (data) {
  console.log('👤 User joined:', data);
});

socket.on('user-left', function (data) {
  console.log('👤 User left:', data);
});

socket.on('user-typing', function (data) {
  console.log('⌨️ User typing:', data);
});

socket.on('error', function (data) {
  console.error('❌ Forum error:', data);
});

// Test sequence with timeout
setTimeout(() => {
  console.log('📋 Testing get-messages...');
  socket.emit('get-messages', { groupId: 1, userId: testUserId });
}, 3000);

setTimeout(() => {
  console.log('👋 Testing leave-group...');
  socket.emit('leave-group', { groupId: 1, userId: testUserId });
}, 5000);

setTimeout(() => {
  console.log('✅ Test completed! Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 7000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  socket.disconnect();
  process.exit(0);
});
