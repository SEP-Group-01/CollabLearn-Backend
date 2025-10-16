const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'Bearer your-jwt-token'; // Replace with actual token
const TEST_THREAD_ID = 'your-thread-uuid'; // Replace with actual thread ID
const TEST_USER_ID = 'your-user-uuid'; // Replace with actual user ID

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null, customHeaders = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: AUTH_TOKEN,
    ...customHeaders,
  };

  try {
    logInfo(`${method.toUpperCase()} ${url}`);
    if (data) {
      logInfo(`Request body: ${JSON.stringify(data, null, 2)}`);
    }

    const config = { method, url, headers };
    if (data) config.data = data;

    const response = await axios(config);

    logSuccess(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      console.log(
        'Error response:',
        JSON.stringify(error.response.data, null, 2),
      );
      return {
        success: false,
        error: error.response.data,
        status: error.response.status,
      };
    }
    return { success: false, error: error.message };
  }
}

// Test functions
async function testHealthCheck() {
  log('\n=== Testing Health Check ===', 'yellow');
  return await makeRequest('GET', '/quizzes');
}

async function testCreateQuiz() {
  log('\n=== Testing Create Quiz ===', 'yellow');

  const quizData = {
    title: 'API Test Quiz',
    description: 'This quiz was created via API testing script',
    timeAllocated: 30,
    questions: [
      {
        questionText: 'What is 2 + 2?',
        marks: 5,
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false },
          { text: '6', isCorrect: false },
        ],
      },
      {
        questionText: 'What is the capital of France?',
        marks: 5,
        options: [
          { text: 'London', isCorrect: false },
          { text: 'Berlin', isCorrect: false },
          { text: 'Paris', isCorrect: true },
          { text: 'Madrid', isCorrect: false },
        ],
      },
      {
        questionText:
          "Which programming language is known for 'Write Once, Run Anywhere'?",
        marks: 10,
        options: [
          { text: 'Python', isCorrect: false },
          { text: 'Java', isCorrect: true },
          { text: 'C++', isCorrect: false },
          { text: 'JavaScript', isCorrect: false },
        ],
      },
    ],
    tags: ['test', 'api', 'demo'],
    resourceTags: ['backend-test'],
  };

  return await makeRequest(
    'POST',
    `/threads/${TEST_THREAD_ID}/quizzes/create`,
    quizData,
  );
}

async function testListQuizzes() {
  log('\n=== Testing List All Quizzes ===', 'yellow');
  return await makeRequest('GET', '/quizzes');
}

async function testListQuizzesByThread() {
  log('\n=== Testing List Quizzes by Thread ===', 'yellow');
  return await makeRequest('GET', `/threads/${TEST_THREAD_ID}/quizzes`);
}

async function testGetQuiz(quizId) {
  log('\n=== Testing Get Quiz by ID ===', 'yellow');
  return await makeRequest('GET', `/quizzes/${quizId}`);
}

async function testStartQuiz(quizId) {
  log('\n=== Testing Start Quiz ===', 'yellow');
  return await makeRequest('POST', `/quizzes/${quizId}/start`, {
    workspaceId: 'test-workspace',
  });
}

async function testGetActiveAttempt(quizId) {
  log('\n=== Testing Get Active Attempt ===', 'yellow');
  return await makeRequest('GET', `/quizzes/${quizId}/active-attempt`);
}

async function testSubmitQuiz(quizId, attemptId, questions) {
  log('\n=== Testing Submit Quiz ===', 'yellow');

  // Create demo answers based on the questions
  const answers = questions.map((question, index) => {
    // For demo, select the first correct option
    const correctOption = question.quiz_options?.find((opt) => opt.is_correct);
    return {
      questionId: question.id,
      selectedOptionIds: correctOption ? [correctOption.id] : [],
    };
  });

  const submitData = {
    attemptId: attemptId,
    answers: answers,
  };

  return await makeRequest('POST', `/quizzes/${quizId}/attempts`, submitData);
}

async function testViewMyResults(quizId) {
  log('\n=== Testing View My Results ===', 'yellow');
  return await makeRequest('GET', `/quizzes/${quizId}/attempts/me`);
}

async function testViewAllResults(quizId) {
  log('\n=== Testing View All Results (Admin) ===', 'yellow');
  return await makeRequest(
    'GET',
    `/quizzes/${quizId}/attempts?userId=${TEST_USER_ID}`,
  );
}

// Main testing function
async function runAllTests() {
  log('🚀 Starting Quiz Service API Tests', 'blue');
  log(`API Base: ${API_BASE}`, 'blue');
  log(`Thread ID: ${TEST_THREAD_ID}`, 'blue');
  log(`User ID: ${TEST_USER_ID}`, 'blue');

  const results = {};
  let createdQuizId = null;
  let attemptId = null;
  let quizQuestions = [];

  try {
    // 1. Health Check
    results.health = await testHealthCheck();

    // 2. Create Quiz
    results.createQuiz = await testCreateQuiz();
    if (results.createQuiz.success) {
      createdQuizId =
        results.createQuiz.data.quizId || results.createQuiz.data.quiz?.id;
      logSuccess(`Created quiz with ID: ${createdQuizId}`);
    }

    // 3. List All Quizzes
    results.listAll = await testListQuizzes();

    // 4. List Quizzes by Thread
    results.listByThread = await testListQuizzesByThread();

    // 5. Get Quiz Details (if we have a quiz ID)
    if (createdQuizId) {
      results.getQuiz = await testGetQuiz(createdQuizId);
      if (results.getQuiz.success) {
        quizQuestions = results.getQuiz.data.quiz_questions || [];
      }
    } else {
      logWarning('Skipping Get Quiz test - no quiz ID available');
    }

    // 6. Start Quiz (if we have a quiz ID)
    if (createdQuizId) {
      results.startQuiz = await testStartQuiz(createdQuizId);
      if (results.startQuiz.success) {
        attemptId = results.startQuiz.data.attemptId;
        logSuccess(`Started quiz attempt with ID: ${attemptId}`);
      }
    } else {
      logWarning('Skipping Start Quiz test - no quiz ID available');
    }

    // 7. Get Active Attempt
    if (createdQuizId) {
      results.getActiveAttempt = await testGetActiveAttempt(createdQuizId);
    } else {
      logWarning('Skipping Get Active Attempt test - no quiz ID available');
    }

    // 8. Submit Quiz (if we have attempt ID and questions)
    if (createdQuizId && attemptId && quizQuestions.length > 0) {
      results.submitQuiz = await testSubmitQuiz(
        createdQuizId,
        attemptId,
        quizQuestions,
      );
    } else {
      logWarning(
        'Skipping Submit Quiz test - missing quiz ID, attempt ID, or questions',
      );
    }

    // 9. View My Results
    if (createdQuizId) {
      results.viewMyResults = await testViewMyResults(createdQuizId);
    } else {
      logWarning('Skipping View My Results test - no quiz ID available');
    }

    // 10. View All Results (Admin)
    if (createdQuizId) {
      results.viewAllResults = await testViewAllResults(createdQuizId);
    } else {
      logWarning('Skipping View All Results test - no quiz ID available');
    }
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
  }

  // Summary
  log('\n' + '='.repeat(50), 'yellow');
  log('TEST RESULTS SUMMARY', 'yellow');
  log('='.repeat(50), 'yellow');

  let passed = 0;
  let failed = 0;

  for (const [testName, result] of Object.entries(results)) {
    if (result && result.success) {
      logSuccess(`${testName}: PASSED`);
      passed++;
    } else if (result) {
      logError(`${testName}: FAILED`);
      failed++;
    } else {
      logWarning(`${testName}: SKIPPED`);
    }
  }

  log(
    `\nTotal: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`,
    'blue',
  );

  if (failed === 0) {
    logSuccess('🎉 All tests passed!');
  } else {
    logError(`❌ ${failed} test(s) failed`);
  }

  return results;
}

// Check if this is the main module
if (require.main === module) {
  // Check if required environment variables are set
  if (
    TEST_THREAD_ID === 'your-thread-uuid' ||
    TEST_USER_ID === 'your-user-uuid'
  ) {
    logError(
      'Please update TEST_THREAD_ID and TEST_USER_ID with actual values before running tests',
    );
    process.exit(1);
  }

  if (AUTH_TOKEN === 'Bearer your-jwt-token') {
    logWarning(
      'Please update AUTH_TOKEN with actual JWT token for authentication tests',
    );
  }

  runAllTests().catch((error) => {
    logError(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  makeRequest,
  testHealthCheck,
  testCreateQuiz,
  testListQuizzes,
  testGetQuiz,
  testStartQuiz,
  testSubmitQuiz,
  testViewMyResults,
};
