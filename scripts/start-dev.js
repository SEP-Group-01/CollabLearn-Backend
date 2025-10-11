#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Get the service name from command line arguments
const serviceName = process.argv[2];

// Define service mappings
const serviceMap = {
  'api-gateway': 'api-gateway',
  'forum-service': 'forum-and-notification-service',
  'auth-service': 'auth-service',
  'document-editor-service': 'document-editor-service',
  'quiz-service': 'quiz-service',
  'workspaces-service': 'workspaces-service',
  'resource-service': 'resource-service',
};

function startService(service) {
  console.log(`🚀 Starting ${service} in development mode...`);

  const nestCommand = process.platform === 'win32' ? 'nest.cmd' : 'nest';
  const args = ['start', service, '--watch'];

  const child = spawn(nestCommand, args, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  child.on('error', (error) => {
    console.error(`❌ Error starting ${service}:`, error.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ ${service} exited with code ${code}`);
      process.exit(code);
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

function showHelp() {
  console.log(`
🔧 NestJS Development Server Starter

Usage:
  npm run start:dev [service-name]

Available services:
  api-gateway              - API Gateway service
  forum-service           - Forum and Notification service
  auth-service            - Authentication service
  document-editor-service - Document Editor service
  quiz-service           - Quiz service
  workspaces-service     - Workspaces service
  resource-service       - Resource Management service

Examples:
  npm run start:dev api-gateway
  npm run start:dev forum-service
  npm run start:dev auth-service

Note: If no service is specified, starts the default NestJS application.
`);
}

// Main logic
if (!serviceName) {
  // No service specified, start default
  console.log('🚀 Starting default NestJS application...');
  const nestCommand = process.platform === 'win32' ? 'nest.cmd' : 'nest';
  const child = spawn(nestCommand, ['start', '--watch'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  child.on('error', (error) => {
    console.error('❌ Error starting application:', error.message);
    process.exit(1);
  });
} else if (serviceName === '--help' || serviceName === '-h') {
  showHelp();
} else if (serviceMap[serviceName]) {
  startService(serviceMap[serviceName]);
} else {
  console.error(`❌ Unknown service: ${serviceName}`);
  console.log('Run "npm run start:dev --help" to see available services.');
  process.exit(1);
}
