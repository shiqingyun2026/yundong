const handler = require('./index.js').main;
const event = {
  "ip": "8.8.8.8"
};
const context = {};

handler(event, context)
  .then(result => {
    console.log('✅ 测试成功');
    console.log('返回结果:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 测试失败');
    console.error('错误:', error.message);
    console.error('堆栈:', error.stack);
    process.exit(1);
  });