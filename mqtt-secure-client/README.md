# MQTT Secure Client

基于 MQTT.js + CryptoJS 的加密通信封装，适用于浏览器环境。

## 特性

- **WebSocket 连接** - 支持 `wss://` 和 `ws://`
- **AES-256-CBC 加密** - 兼容 CryptoJS 的加密格式
- **自动重连** - 连接断开后自动重试
- **消息去重** - 防止重复接收自己发送的消息
- **Promise-free API** - 基于回调，简单直观

## 依赖

```bash
npm install mqtt crypto-js
```

## 快速开始

```javascript
import MqttSecureClient from './mqtt-client.js';

const client = new MqttSecureClient({
    broker: 'wss://broker.emqx.io:8084/mqtt',
    topic: 'secure/chat/room1',
    password: 'your_secret_password',
    onConnect: () => {
        console.log('已连接');
        client.send('Hello World!');
    },
    onMessage: (sender, text, meta) => {
        console.log(`${sender}: ${text}`);
    },
    onError: (err) => {
        console.error('错误:', err.message);
    }
});

client.connect();
```

## API 参考

### 构造函数

```javascript
new MqttSecureClient(options)
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `broker` | string | 是 | MQTT Broker URL，如 `wss://broker.emqx.io:8084/mqtt` |
| `topic` | string | 是 | 订阅/发布的主题 |
| `password` | string | 是 | AES 加密密码（所有客户端必须相同） |
| `clientId` | string | 否 | 自定义客户端 ID，默认随机生成 |
| `reconnectPeriod` | number | 否 | 重连间隔(ms)，默认 5000 |
| `onConnect` | Function | 否 | 连接成功回调 `() => void` |
| `onDisconnect` | Function | 否 | 断开连接回调 `() => void` |
| `onMessage` | Function | 否 | 收到消息回调 `(sender, text, meta) => void` |
| `onError` | Function | 否 | 错误回调 `(error) => void` |

### 方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `connect()` | 建立连接 | void |
| `disconnect()` | 断开连接 | void |
| `send(text, metadata)` | 发送加密消息 | boolean |

### send 方法

```javascript
client.send('消息内容', {
    user: 'MyName'  // 自定义发送者名称
});
```

## 消息格式

加密前的消息 JSON 格式：

```json
{
  "id": "客户端唯一ID",
  "msgId": "消息唯一ID",
  "user": "发送者名称",
  "msg": "消息内容",
  "time": 1700000000000
}
```

加密方式：CryptoJS AES.encrypt(JSON.stringify(payload), password)

## 完整示例

见 [example.html](./example.html)，可直接在浏览器中打开使用。

## 与 MQTT Hub 兼容

此封装与 [MQTT Hub](https://github.com/weijia/mqtthub) 网页聊天工具完全兼容：
- 相同的 AES 加密方式
- 相同的消息格式
- 使用相同的 broker/topic/password 即可互通
