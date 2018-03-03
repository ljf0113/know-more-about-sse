# 服务器推送 SSE 了解一下？

hello~亲爱的看官老爷们大家好~过完年第一周已经结束了，是时候开始制定新的工作计划。主要负责的项目是数据可视化平台，使用中如果服务器能有推送能力让页端得到相关通知的话，整体体验会好很多。鉴于项目中 Node 端已经正式投入使用，前端拥有了自己的服务器，搞事情起来自然方便很多。

## 技术选型：SSE（Server-sent Events） or WebSocket

若干年前，服务器并没有主动推送的能力，主要是通过轮询的方式来达到近似于服务器推送的能力。现在不需要这么麻烦了，轮询只作为向下兼容的方案即可，当前主流的服务器推送是使用 SSE 或者 WebSocket 来实现的。两者对比如下：

 &emsp; | 是否基于新协议 | 是否双向通信 | 是否支持跨域 | 接入成本
:-: | :-: | :-: | :-: | :-: 
SSE | 否（`Http`）| 否（服务器单向） | 否（Firefox 支持跨域） | 低
WebSocket | 是（`ws`） | 是 | 是 | 高

需要稍微解释一下的是接入成本。SSE 是相对轻量级的协议，（Node）代码实现上比较简单，而 WebSocket 是比较复杂的协议，虽然也有类库可以套用，也许页端方面两者代码量差不多，但服务器方面实现就复杂不少了。同时，要实现 WebSocket，是需要另起一个服务的，而 SSE 并不需要。

比较之后，对 SSE 与 WebSocket 有了大致的理解。项目对服务器推送的要求是发送通知，而未来可能需要接入实时同步的功能，结合项目实际情况与接入成本后，选择了 SSE。 

最后看一下浏览器支持情况以作参考：

![](https://user-gold-cdn.xitu.io/2018/3/3/161e9d9d392e301c?w=1276&h=486&f=png&s=49908)

`IE` 就 `let it go`吧，日常不支持~其他浏览器还是绿油油的，支持度还是挺高的。

## 示例

### Node端

项目中使用 Egg 作为框架，底层是 Koa2 的，因而使用 Koa2 作为示例。Node 端关键代码如下：
    
    app.use(async (ctx) => {
      const { res, request: { url } } = ctx;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', // 服务器声明接下来发送的是事件流
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
      }, 1000);
    
      stream.on('close', function() {
        console.log('closed.')
        clearInterval(timer);
      })
    
      ctx.body = stream;
    });
    
服务器告诉客户端，返回的类型是事件流（text/event-stream），查阅 [MDN](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/Using_server-sent_events) 文档可知：事件流仅仅是一个简单的文本数据流，文本应该使用UTF- 8格式的编码。每条消息后面都由一个空行作为分隔符。以冒号开头的行为注释行，会被忽略。

之后就是消息主体了，尽管例子使用 `setInterval` 模拟不断发送推送，但换成任意条件触发推送也是可以的。`stream.write` 调用了5次，对应规范中的各个字段，理解如下：

* `event` 为消息的事件类型。客户端在 `EventSource` 中可以通过 `addEventListener` 收听相关的消息。该字段可省略，省略后客户端触发 `message` 事件。
* `id` 为事件 ID。作为客户端内部的“最后一个事件 ID ”的属性值，用于重连，不可省略。
* `data` 为消息的数据字段，简单说就是客户端监听时间后，通过`e.data` 拿到的数据。
* `retry` 为重连时间，可省略该参数。
* 最后是结束该次通知的 `\n\n`，不可省略。除了上面规定的字段名，其他所有的字段名都会被忽略。

更详细的解释可以查阅 [MDN](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/Using_server-sent_events) 文档。有一个小细节需要注意，在 SSE 的草案中提到，"text/event-stream" 的 MIME 类型传输应当在静置 15 秒后自动断开。但实测（仅用了 Chrome）后发现，即使静置时间超过 15 秒，浏览器与客户端均不会断开连接。查阅了不少文章，均建议维护一套发送 `\n\n` 的心跳机制。个人认为此举有助于提高客户端程序的健壮性，但不是必须的。

最后是监听事件流的 `close` 事件，用于结束此次的链接。测试后发现，无论是让客户端调用 `close` 方法（下文有例子~），还是异常结束流程，包括关闭窗口、关闭程序等，都能触发服务器的 `close` 事件。

### 客户端

客户端代码更简单，示例如下：
    
    const source = new EventSource('http://localhost:3000/test');

    source.addEventListener('open', () => {
      console.log('Connected');
    }, false);

    source.addEventListener('message', e => {
      console.log(e.data);
    }, false);

    source.addEventListener('pause', e => {
      source.close();
    }, false);

前端童鞋对于这样的代码应该挺熟悉的，一切都是事件触发，根据不同的事件执行对应的代码。稍微说明一下 `EventSource` 拥有的属性和方法，相信大家就可以愉快地使用了。

`EventSource` 有三个默认的事件，分别是：

* `open`：在连接打开时被调用。
* `message`：收到一个没有 event 属性的消息时被调用。
* `error`：当发生错误时被调用。

两个只读属性：

* `readyState `：代表连接状态。可能值是CONNECTING (0), OPEN (1), 或者 CLOSED (2)。
* `url`：代表连接的 URL。

一个方法：

* `close`：调用后关闭连接（也就是上文所提及的）。 

更详细的解释可以查阅 [MDN](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/EventSource) 文档

## 小结

关于服务器 SSE 的简单介绍就到此为止了，其实还能进一步进行优化的。如为了减轻服务器开销，可以建立一套机制有目的地断开与重连等，大家可以自行实现。

相关的代码已经丢到 [Github]() 上，欢迎查阅。

感谢各位看官大人看到这里，知易行难，希望本文对你有所帮助~谢谢！

## 参考资料


 [20 行代码写一个数据推送服务](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/Using_server-sent_events)
 
[使用服务器发送事件](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/Using_server-sent_events)

[EventSource](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/EventSource)


