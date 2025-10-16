// Quick health check script for all services
const axios = require('axios');

async function checkService(name, url) {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    console.log(`✅ ${name}: Status ${response.status} - OK`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`❌ ${name}: Service not running (connection refused)`);
    } else if (error.response) {
      console.log(
        `⚠️  ${name}: Status ${error.response.status} - ${error.response.statusText}`,
      );
    } else {
      console.log(`❌ ${name}: ${error.message}`);
    }
    return false;
  }
}

async function checkAllServices() {
  console.log('🔍 Checking service health...\n');

  const services = [
    { name: 'API Gateway', url: 'http://localhost:3000' },
    { name: 'API Gateway Health', url: 'http://localhost:3000/api/quizzes' },
    { name: 'Quiz Service (if exposed)', url: 'http://localhost:3001' },
    { name: 'Auth Service (if exposed)', url: 'http://localhost:3002' },
    { name: 'Workspaces Service (if exposed)', url: 'http://localhost:3003' },
  ];

  const results = [];
  for (const service of services) {
    const isUp = await checkService(service.name, service.url);
    results.push({ ...service, isUp });
  }

  console.log('\n📊 Service Status Summary:');
  console.log('─'.repeat(40));

  const upCount = results.filter((r) => r.isUp).length;
  const totalCount = results.length;

  results.forEach((service) => {
    const status = service.isUp ? '🟢' : '🔴';
    console.log(`${status} ${service.name}`);
  });

  console.log('─'.repeat(40));
  console.log(`Total: ${upCount}/${totalCount} services running`);

  if (upCount === 0) {
    console.log(
      '\n🚨 No services are running! Please start your backend services first.',
    );
    console.log('Run: npm run start:dev or npm start');
  } else if (upCount < totalCount) {
    console.log(
      "\n⚠️  Some services may not be running. This might be normal if they're not exposed individually.",
    );
  } else {
    console.log('\n🎉 All checked services are running!');
  }

  return results;
}

if (require.main === module) {
  checkAllServices().catch(console.error);
}

module.exports = { checkAllServices, checkService };
