const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 30000;

// 使用 body-parser 中间件来解析 JSON 数据
app.use(bodyParser.json());

// 定义 /observer 接口
// 通过 service 区分不同用户
app.post('/observer', (req, res) => {
  console.log('observer Received data:', JSON.stringify(req.body, null, 2));

  res.send('OK');
});

// 定义 /auth 接口
app.post('/auth', (req, res) => {
  console.log('auth Received data:', req.body);
  console.log('req.body.username : ', req.body.username);
  if (req.body.username === 'test' && req.body.password === 'testtest') {
    res.json({ ok: true, id: 'test' });
  } else {
    res.json({ ok: false });
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});