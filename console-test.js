// SIMPLE API TEST - Copy and paste this entire code into your browser console

// Step 1: Set your JWT token here (replace YOUR_TOKEN_HERE with your actual token)
const AUTH_TOKEN = 'Bearer YOUR_TOKEN_HERE';

// Step 2: Test function - copy and paste this entire function
const testAPI = async () => {
  console.log('🚀 Testing Quiz API...');

  // Test 1: Health Check (no authentication needed)
  console.log('\n=== Test 1: Health Check ===');
  try {
    const response = await fetch('http://localhost:3000/api/quizzes');
    const data = await response.json();
    console.log('✅ SUCCESS:', data);
  } catch (error) {
    console.log('❌ FAILED:', error.message);
  }

  // Test 2: List all quizzes (with authentication)
  console.log('\n=== Test 2: List All Quizzes ===');
  try {
    const response = await fetch('http://localhost:3000/api/quizzes', {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    console.log('✅ SUCCESS:', data);
  } catch (error) {
    console.log('❌ FAILED:', error.message);
  }

  // Test 3: Create a sample quiz (needs authentication)
  console.log('\n=== Test 3: Create Sample Quiz ===');

  // First, you'll need a thread ID. Let's try to get one from your existing data
  // Replace 'your-thread-id-here' with an actual thread ID from your database
  const THREAD_ID = 'your-thread-id-here';

  if (THREAD_ID !== 'your-thread-id-here') {
    const quizData = {
      title: 'Console Test Quiz',
      description: 'This quiz was created from browser console',
      timeAllocated: 30,
      questions: [
        {
          questionText: 'What is 2 + 2?',
          marks: 5,
          options: [
            { text: '3', isCorrect: false },
            { text: '4', isCorrect: true },
            { text: '5', isCorrect: false },
          ],
        },
      ],
      tags: ['test'],
      resourceTags: ['console-test'],
    };

    try {
      const response = await fetch(
        `http://localhost:3000/api/threads/${THREAD_ID}/quizzes/create`,
        {
          method: 'POST',
          headers: {
            Authorization: AUTH_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quizData),
        },
      );
      const data = await response.json();
      console.log('✅ Quiz Created:', data);

      // Store the quiz ID for further testing
      if (data.quizId) {
        window.testQuizId = data.quizId;
        console.log('📝 Quiz ID saved for further tests:', data.quizId);
      }
    } catch (error) {
      console.log('❌ Create Quiz Failed:', error.message);
    }
  } else {
    console.log('⏭️ Skipping quiz creation - please set THREAD_ID first');
    console.log('💡 To get thread ID, run: getThreadIds()');
  }

  console.log('\n🎉 API Tests Complete!');
};

// Helper function to get thread IDs from your database
const getThreadIds = async () => {
  console.log('📋 Available threads in your system:');

  // This assumes you have an endpoint to get threads, or you can check your database directly
  try {
    const response = await fetch('http://localhost:3000/api/threads', {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    console.log('Threads:', data);
  } catch (error) {
    console.log('❌ Could not fetch threads:', error.message);
    console.log('💡 You can get thread IDs from your database with:');
    console.log('   SELECT id, name FROM threads LIMIT 5;');
  }
};

// Quick test function for existing quiz
const testExistingQuiz = async (quizId) => {
  console.log(`🔍 Testing existing quiz: ${quizId}`);

  try {
    const response = await fetch(
      `http://localhost:3000/api/quizzes/${quizId}`,
      {
        headers: {
          Authorization: AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );
    const data = await response.json();
    console.log('✅ Quiz Details:', data);
  } catch (error) {
    console.log('❌ Failed to get quiz:', error.message);
  }
};

console.log('📝 Instructions:');
console.log(
  '1. Replace YOUR_TOKEN_HERE in AUTH_TOKEN with your actual JWT token',
);
console.log('2. Run: testAPI()');
console.log('3. To get thread IDs: getThreadIds()');
console.log('4. To test existing quiz: testExistingQuiz("quiz-id-here")');
