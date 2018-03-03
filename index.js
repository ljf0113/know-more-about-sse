const Koa = require('koa');
const app = new Koa();
const serve = require('koa-static');
const PassThrough = require('stream').PassThrough;

app.use(serve(__dirname + '/static/'));

app.use(async (ctx) => {
  const { res, request: { url } } = ctx;
  if (url === '/favicon.ico') {
    return;
  }
  // 服务器声明接下来发送的是事件流
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
  });
  let stream = new PassThrough();
  let i = 0;
  let timer = setInterval(() => {
    if (i === 5) {
      stream.write('event: pause\n'); // 事件类型
    } else {
      stream.write('event: test\n'); // 事件类型
    }
    stream.write(`id: ${+new Date()}\n`); // 消息ID
    stream.write(`data: ${i}\n`); // 消息数据
    stream.write('retry: 10000\n'); // 重连时间
    stream.write('\n\n'); // 消息结束
    i++;
  }, 60000);

  stream.on('close', function() {
    console.log('closed.');
    clearInterval(timer);
  });

  stream.write(`id: ${+new Date()}\n`); // 消息ID
  stream.write(`data: ${i}\n`); // 消息数据
  stream.write('retry: 10000\n'); // 重连时间
  stream.write('\n\n'); // 消息结束

  ctx.body = stream;
});

app.listen(3000);