// Frontend API Testing Script
// Add this to your frontend console or create a test component

// First, make sure you're logged in to get the auth token
const testQuizAPI = async () => {
  console.log('🚀 Starting Quiz API Tests from Frontend...');

  try {
    // Get the auth token from localStorage or wherever you store it
    const token =
      localStorage.getItem('accessToken') ||
      sessionStorage.getItem('accessToken') ||
      'your-jwt-token-here';

    console.log('Using token:', token ? 'Token found' : 'No token found');

    // Test 1: Health Check (no auth needed)
    console.log('\n=== Test 1: Health Check ===');
    try {
      const response = await fetch('http://localhost:3000/api/quizzes');
      const data = await response.json();
      console.log('✅ Health Check Success:', data);
    } catch (error) {
      console.log('❌ Health Check Failed:', error);
    }

    // Test 2: Get all quizzes (may need auth)
    console.log('\n=== Test 2: List All Quizzes ===');
    try {
      const response = await fetch('http://localhost:3000/api/quizzes', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      console.log('✅ List Quizzes Success:', data);
    } catch (error) {
      console.log('❌ List Quizzes Failed:', error);
    }

    // Test 3: Get quizzes by thread (needs thread ID)
    const threadId = 'your-thread-id-here'; // Replace with actual thread ID
    console.log('\n=== Test 3: Get Quizzes by Thread ===');
    if (threadId !== 'your-thread-id-here') {
      try {
        const response = await fetch(
          `http://localhost:3000/api/threads/${threadId}/quizzes`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        const data = await response.json();
        console.log('✅ Thread Quizzes Success:', data);
      } catch (error) {
        console.log('❌ Thread Quizzes Failed:', error);
      }
    } else {
      console.log('⏭️ Skipping - Replace threadId with actual value');
    }

    // Test 4: Create a quiz (needs auth and thread ID)
    console.log('\n=== Test 4: Create Quiz ===');
    if (threadId !== 'your-thread-id-here' && token !== 'your-jwt-token-here') {
      const quizData = {
        title: 'Frontend Test Quiz',
        description: 'Created from frontend testing',
        timeAllocated: 30,
        questions: [
          {
            questionText: 'What is React?',
            marks: 10,
            options: [
              { text: 'A JavaScript library', isCorrect: true },
              { text: 'A database', isCorrect: false },
              { text: 'A server', isCorrect: false },
              { text: 'An operating system', isCorrect: false },
            ],
          },
        ],
        tags: ['react', 'frontend'],
        resourceTags: ['test'],
      };

      try {
        const response = await fetch(
          `http://localhost:3000/api/threads/${threadId}/quizzes/create`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(quizData),
          },
        );
        const data = await response.json();
        console.log('✅ Create Quiz Success:', data);

        // Store the created quiz ID for further tests
        window.testQuizId = data.quizId;
      } catch (error) {
        console.log('❌ Create Quiz Failed:', error);
      }
    } else {
      console.log('⏭️ Skipping - Need valid thread ID and token');
    }

    console.log('\n🎯 Test Complete!');
    console.log('Next steps:');
    console.log('1. Update threadId with actual thread ID from your database');
    console.log("2. Make sure you're logged in to get valid JWT token");
    console.log('3. Check browser console for detailed responses');
  } catch (error) {
    console.error('Test suite failed:', error);
  }
};

// Instructions for running this test
console.log('📋 Frontend API Testing Instructions:');
console.log(
  '1. Copy this entire script to your browser console on your frontend page',
);
console.log("2. Make sure you're logged in to your application");
console.log('3. Run: testQuizAPI()');
console.log('4. Check the console output for results');

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testQuizAPI };
}
