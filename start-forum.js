const { spawn } = require('child_process');

console.log('🚀 Starting Forum Service...');
console.log(
  '📁 Project path:',
  'c:\\Users\\94764\\Desktop\\study\\CollabLearn-Backend',
);

const projectPath = 'c:\\Users\\94764\\Desktop\\study\\CollabLearn-Backend';

try {
  process.chdir(projectPath);
  console.log('✅ Changed to project directory');
} catch (error) {
  console.error('❌ Error changing directory:', error.message);
  process.exit(1);
}

console.log('🔧 Running: npm run start:dev:forum-service');

const child = spawn('npm', ['run', 'start:dev:forum-service'], {
  stdio: 'inherit',
  shell: true,
  cwd: projectPath,
});

child.on('error', (error) => {
  console.error('❌ Error starting service:', error.message);
  console.error('💡 Try running manually: npm run start:dev:forum-service');
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Service exited successfully');
  } else {
    console.log(`❌ Service exited with code ${code}`);
    console.log('💡 Check the error messages above for troubleshooting');
  }
});

console.log('⏳ Forum service should be starting...');
console.log('🌐 Once started, visit: http://localhost:3003/health');
