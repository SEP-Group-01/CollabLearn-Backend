// Simple test script to check quiz attempt backend functionality
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const QUIZ_ID = '699d4602-a0fa-4505-90ab-4a75af875b34';

async function testQuizAttemptFlow() {
  console.log('🧪 Testing Quiz Attempt Backend Flow...\n');
  
  try {
    // Step 1: Test get quiz
    console.log('1️⃣ Testing GET quiz...');
    const quizResponse = await axios.get(`${API_BASE}/quizzes/${QUIZ_ID}`);
    console.log('✅ Quiz fetch successful:', quizResponse.data.title);
    console.log('   Questions:', quizResponse.data.questions?.length || 'N/A');
    
    // Step 2: Test start quiz attempt
    console.log('\n2️⃣ Testing POST start quiz attempt...');
    try {
      const startResponse = await axios.post(`${API_BASE}/quizzes/${QUIZ_ID}/start`, {});
      console.log('✅ Start attempt successful:', startResponse.data);
    } catch (startError) {
      console.log('❌ Start attempt failed:', startError.response?.status, startError.response?.data?.message || startError.message);
    }
    
    // Step 3: Test get active attempt
    console.log('\n3️⃣ Testing GET active attempt...');
    try {
      const activeResponse = await axios.get(`${API_BASE}/quizzes/${QUIZ_ID}/active-attempt`);
      console.log('✅ Get active attempt successful:', activeResponse.data);
    } catch (activeError) {
      console.log('❌ Get active attempt failed:', activeError.response?.status, activeError.response?.data?.message || activeError.message);
    }
    
    // Step 4: Test submit attempt (with dummy data)
    console.log('\n4️⃣ Testing POST submit attempt...');
    try {
      const submitData = {
        attemptId: 'test-attempt-id',
        answers: [
          {
            questionId: '0413e308-c040-4e9c-ab96-5f7f4bbabdde',
            selectedOptionIds: ['8c0bb81d-7358-4f18-af35-59754555e23d']
          }
        ]
      };
      
      const submitResponse = await axios.post(`${API_BASE}/quizzes/${QUIZ_ID}/attempts`, submitData);
      console.log('✅ Submit attempt successful:', submitResponse.data);
    } catch (submitError) {
      console.log('❌ Submit attempt failed:', submitError.response?.status, submitError.response?.data?.message || submitError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testQuizAttemptFlow();