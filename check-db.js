const db = require('./backend/utils/database');

db.all('SELECT id, group_id, group_name, status FROM groups', (err, rows) => {
  if (err) {
    console.error('查询失败:', err);
    process.exit(1);
  } else {
    console.log('数据库中的群聊记录:');
    console.log(JSON.stringify(rows, null, 2));
    console.log(`\n共 ${rows.length} 条记录`);
    process.exit(0);
  }
});
