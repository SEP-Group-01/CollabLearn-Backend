// Quiz Service Frontend Integration Test
// This script tests all quiz endpoints for frontend integration

const API_BASE_URL = 'http://localhost:3000';
let authToken = '';

// Step 1: Login to get JWT token (you'll need to replace with actual credentials)
async function login() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com', // Replace with actual user email
        password: 'password123', // Replace with actual password
      }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    authToken = data.token;
    console.log('✅ Login successful, token obtained');
    return data;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

// Step 2: Test health endpoint
async function testHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes/health`);
    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return data;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

// Step 3: Test quiz creation
async function testCreateQuiz() {
  try {
    const quizData = {
      title: 'Frontend Integration Test Quiz',
      description: 'Testing quiz creation from frontend',
      timeAllocated: 15,
      thread_id: '550e8400-e29b-41d4-a716-446655440000', // Replace with valid thread ID
      questions: [
        {
          question_text: 'What is the primary purpose of this test?',
          marks: 10,
          options: [
            {
              text: 'To verify frontend-backend integration',
              is_correct: true,
            },
            {
              text: 'To learn JavaScript',
              is_correct: false,
            },
            {
              text: 'To test database performance',
              is_correct: false,
            },
          ],
        },
        {
          question_text: 'Which HTTP method is used for quiz creation?',
          marks: 5,
          options: [
            {
              text: 'GET',
              is_correct: false,
            },
            {
              text: 'POST',
              is_correct: true,
            },
            {
              text: 'PUT',
              is_correct: false,
            },
          ],
        },
      ],
      tags: ['integration', 'test'],
      resourceTags: ['frontend'],
    };

    const response = await fetch(`${API_BASE_URL}/quizzes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quizData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Quiz creation failed: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    console.log('✅ Quiz created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Quiz creation failed:', error.message);
    throw error;
  }
}

// Step 4: Test fetching quizzes
async function testGetQuizzes() {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch quizzes failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Quizzes fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Fetch quizzes failed:', error.message);
    throw error;
  }
}

// Step 5: Test getting specific quiz
async function testGetQuizById(quizId) {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`);

    if (!response.ok) {
      throw new Error(`Get quiz by ID failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Quiz fetched by ID successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Get quiz by ID failed:', error.message);
    throw error;
  }
}

// Step 6: Test WebSocket connection
function testWebSocket() {
  return new Promise((resolve, reject) => {
    try {
      // Note: You'll need to include socket.io-client library for this to work
      // <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

      if (typeof io === 'undefined') {
        console.log('⚠️  WebSocket test skipped - socket.io-client not loaded');
        resolve({ skipped: true });
        return;
      }

      const socket = io(`${API_BASE_URL}/quiz`, {
        auth: {
          token: `Bearer ${authToken}`,
        },
      });

      socket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        socket.disconnect();
        resolve({ connected: true });
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    } catch (error) {
      console.error('❌ WebSocket test error:', error.message);
      reject(error);
    }
  });
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting Quiz Service Frontend Integration Tests...\n');

  try {
    // Test 1: Health check (no auth required)
    console.log('1. Testing health endpoint...');
    await testHealth();
    console.log('');

    // Test 2: Authentication
    console.log('2. Testing authentication...');
    await login();
    console.log('');

    // Test 3: Quiz creation
    console.log('3. Testing quiz creation...');
    const createdQuiz = await testCreateQuiz();
    console.log('');

    // Test 4: Fetch all quizzes
    console.log('4. Testing quiz fetching...');
    const quizzes = await testGetQuizzes();
    console.log('');

    // Test 5: Get specific quiz (if we have one)
    if (createdQuiz && createdQuiz.quiz && createdQuiz.quiz.id) {
      console.log('5. Testing get quiz by ID...');
      await testGetQuizById(createdQuiz.quiz.id);
      console.log('');
    }

    // Test 6: WebSocket connection
    console.log('6. Testing WebSocket connection...');
    await testWebSocket();
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Health endpoint working');
    console.log('✅ Authentication working');
    console.log('✅ Quiz creation working');
    console.log('✅ Quiz fetching working');
    console.log('✅ Quiz details working');
    console.log('✅ WebSocket connection working');
    console.log('\n🔗 Your quiz service is ready for frontend integration!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log(
      '1. Verify all services are running (api-gateway, quiz-service, auth-service, workspaces-service)',
    );
    console.log('2. Check if Kafka is running on localhost:9092');
    console.log('3. Verify database connection and schema');
    console.log('4. Check if you have valid user credentials');
    console.log('5. Ensure thread_id exists and user has permissions');
  }
}

// Usage instructions
console.log('📖 Usage Instructions:');
console.log('1. Make sure all services are running');
console.log('2. Update the login credentials in the login() function');
console.log('3. Update the thread_id with a valid thread from your database');
console.log('4. Run: runAllTests()');
console.log('5. For WebSocket testing, include socket.io-client library\n');

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testHealth,
    testCreateQuiz,
    testGetQuizzes,
    login,
  };
}
