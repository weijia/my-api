# MQTT 行情接口文档（Price Server）

## 概述

本文档描述 Price Server（股票行情服务器）的 MQTT 行情接口：远程取行情、订阅实时价推送。

与 [MQTT-Commands-API.md](./MQTT-Commands-API.md) 是**两条互不相干的通道**，只是共用同一套信封与加密约定：

| | 行情通道（本文档） | 下单通道（MQTT-Commands-API.md） |
|---|---|---|
| 用途 | 取行情、订阅实时价 | 券商条件单/下单 |
| 默认 topic | `secure/stock-price-mqtt` | `secure/stock-condition-order` |
| 默认密码 | `stock_price_mqtt_S3cret` | 另一套（见该文档） |
| 服务端 | Price Server（Python / Go） | 条件单 Agent |
| 命令 | `realtime`/`batch`/`subscribe`/`quote_push` … | `get_holdings`/`buy`/`sell`/`create` … |

服务端实现：

- Python：`stock/instock/server/mqtt_protocol.py`、`mqtt_crypto.py`
- Go：`go-stock-server/internal/core/mqtt.go`、`mqtt_crypto.go`

两端协议一致。设计文档见 `stock/docs/price_server_mqtt_design.md`，
排障与结论记录见 `go-stock-server/docs/mqtt-and-data-source.md`。

---

## 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| broker | `wss://broker.emqx.io:8084/mqtt` | 公共 EMQX 集群；支持 `wss`/`ws`/`mqtt`/`mqtts`，端口缺省 8084/8084/1883/8883 |
| topic | `secure/stock-price-mqtt` | 订阅与发布同一 topic |
| password | `stock_price_mqtt_S3cret` | AES 密钥，须与控制端一致 |
| clientId | `ps_` + 6 位随机 hex（服务端）/ 自定义（控制端） | 用于自消息过滤 |
| pushInterval | `5` | 订阅推送周期（秒） |
| pushOnlyTrading | `false` | 为 true 时仅交易时段推送 |

覆盖方式（优先级：命令行 > 环境变量 > 默认值）：

```
# Go 版
go-stock-server -mqtt-broker wss://x:8084/mqtt -mqtt-topic t -mqtt-password p -mqtt-push-interval 5
MQTT_BROKER=... MQTT_TOPIC=... MQTT_PASSWORD=... go-stock-server

# Python 版
python stock_price_server.py --mqtt --mqtt-broker ... --mqtt-topic ... --mqtt-password ...
```

默认开关：

| 实现 | MQTT 默认 | TDX 默认 |
|---|---|---|
| Go（`go-stock-server`） | **开启** | **开启** |
| Python（`stock/instock`） | 关闭 | 由数据源配置决定 |

> ⚠️ 公共 broker 上没有任何账号鉴权，消息体加密是唯一屏障。私有化部署时
> `broker` / `topic` / `password` 三者应同时更换，并同步更新控制端配置。

---

## 通信协议

### 消息加密

OpenSSL 兼容格式，与 CryptoJS 默认行为一致：

```
密文 = base64( "Salted__" ‖ salt(8B) ‖ AES-256-CBC( PKCS7( utf8(plaintext) ) ) )
密钥派生：EVP_BytesToKey(MD5, 1 次迭代) → key = D1‖D2 (32B)，iv = D3 (16B)
```

- 服务端：`encrypt(plaintext, password)` / `decrypt(ciphertext_b64, password)`
- 浏览器端：`CryptoJS.AES.encrypt(text, password).toString()` /
  `CryptoJS.AES.decrypt(cipher, password).toString(CryptoJS.enc.Utf8)`（需引入 crypto-js）

解密失败（密钥不匹配 / 格式错）服务端丢弃并记「解密失败（密钥不匹配?）」。

### 消息格式

所有消息经 AES 加密传输，解密后的 payload（信封）结构如下：

```json
{
  "id": "客户端ID（用于忽略自己的消息）",
  "msgId": "消息ID（用于去重）",
  "user": "用户标识",
  "msg": "命令内容（JSON字符串）",
  "time": 1700000000000
}
```

- **自消息过滤**：`id` 等于自身 clientId 的消息忽略。
- **去重**：5 秒内相同 `msgId` 只处理一次。
- **响应回显**：`response` 的 `msgId` 复用请求方的 `msgId`，控制端据此配对请求与响应；
  `ping`/`pong`/`quote_push`/`status` 各自生成带后缀的唯一 `msgId`。

### 命令格式

`msg` 字段解析后的命令结构：

```json
{
  "action": "命令名称",
  "data": {
    // 命令特定参数
  }
}
```

> **参数一律放在内层 `data`**（与下单通道一致）。早期设计稿时序图里出现过
> `codes` 与 `action` 同级的扁平写法，已废弃；服务端可选择性兼容，新实现一律按嵌套 `data` 读取。
> `codes` 既接受数组 `["000001","600000"]`，也接受逗号分隔字符串 `"000001,600000"`。

### 响应格式

服务端响应同样放在 `msg` 中，`action` 恒为 `"response"`，原始命令名放在 `data.action`：

```json
{
  "action": "response",
  "data": {
    "action": "原始命令名称（如 realtime）",
    "status": "success|error",
    "code": "000001",
    "data": {
      // 命令特定的响应数据
    },
    "message": "错误信息（仅 error 时）"
  }
}
```

> 完整链路：
> ```
> MQTT Payload (AES加密)
>   └─> { id, msgId, user, msg, time }
>         └─> msg = JSON.parse(payload.msg)
>               └─> { action: "response", data: { action: "subscribe", status: "success", data: { subscribed: [...] } } }
>                     ├─> msgData.data.action  → "subscribe"
>                     ├─> msgData.data.status  → "success"
>                     └─> msgData.data.data    → 实际业务数据
> ```

### 心跳

- `msg` 为字符串 `"ping"` / `"pong"`，或 `{"action":"ping"}` / `{"action":"pong"}` 形式，双向兼容。
- 服务端连接成功后立即发一次 ping，之后每 30 秒一次；收到 ping 自动回 pong。

### 主动推送的消息

除命令响应外，服务端还会主动推送两类消息，控制端应按 `action` 分流、非关心的直接忽略：

| action | 频率 | 说明 |
|---|---|---|
| `quote_push` | 每 `pushInterval` 秒，每只订阅代码一条 | 实时价推送（见下文） |
| `status` | 每 60 秒 | 数据源运行状态 + `extra.{version, uptime_seconds}` |

---

## 命令列表

| action | data | 说明 |
|---|---|---|
| `realtime` | `{code}` | 单只实时行情 |
| `batch` | `{codes}` | 批量实时行情，并写入 `quote_cache` |
| `kline` | `{code, days?}` | 日 K（默认 30 天） |
| `qfq` | `{code, days?}` | 前复权日 K（默认 30 天） |
| `minute` | `{code, period?, minutes?}` | 分钟 K 棒（period 默认 7=1分，minutes 默认 300） |
| `intraday` | `{code}` | 分时（由 1 分钟 K 构造） |
| `name` | `{code}` | 股票名称 |
| `quote_cache` | `{codes?}` | 实时价缓存（不带 codes 返回全部） |
| `health` | `{}` | 健康/版本/运行时长 |
| `config` | `{}` | 配置/数据源能力/命令清单 |
| `subscribe` | `{codes, interval?}` | 新增订阅，开始推送 |
| `unsubscribe` | `{codes?}` | 取消订阅（不带 codes 则清空） |
| `list_subs` | `{}` | 当前订阅列表 + 推送间隔 |
| `ping` | `{}` | 心跳 |

---

## 行情命令

### realtime - 单只实时行情

请求：

```json
{ "action": "realtime", "data": { "code": "000001" } }
```

响应（`data.data`）：

```json
{
  "name": "平安银行",
  "code": "000001",
  "price": 11.32,
  "open": 11.20,
  "prev_close": 11.25,
  "high": 11.40,
  "low": 11.18,
  "change_pct": 0.62
}
```

> 昨收键为 `prev_close`。早期文档/Python 侧曾使用 `last_close`，客户端建议
> `q.prev_close ?? q.last_close` 兜底。

### batch - 批量实时行情

请求：`{ "action": "batch", "data": { "codes": ["000001", "600519"] } }`

响应 `data.data` 为 `{ data: [<QuoteRecord>…], stale: false }`——注意是**双层**：

```json
{
  "action": "batch",
  "status": "success",
  "data": {
    "data": [
      { "code": "000001", "name": "平安银行", "price": 11.32, "prev_close": 11.25, "stale": false }
    ],
    "stale": false
  }
}
```

### quote_cache - 实时价缓存

请求：`{ "action": "quote_cache", "data": { "codes": ["000001"] } }`（不带 codes 返回全部）

响应 `data.data` 为 `code → QuoteRecord` 的对象。

### kline / qfq / minute / intraday / name

| action | 响应 `data.data` 关键字段 |
|---|---|
| `kline` | `code, name, count, data[], stale, source, price_ts` |
| `qfq` | `code, name, count, data[], stale, price_ts, source, unadjusted` |
| `minute` | `code, count, data[]` |
| `intraday` | `stock_code, name, date, count, pre_close, data[{time, price, volume, avg_price}]` |
| `name` | `code, name` |

`minute` / `intraday` 依赖通达信数据源（TDX），TDX 不可用时返回
`status:"error", message:"无可用分钟数据源…"`。

### health / config

```json
// health
{ "status": "ok", "version": "x.y.z", "uptime": "1h 2m 3s", "uptime_seconds": 3723 }

// config
{
  "server": { "version": "x.y.z", "data_source": "通达信TCP优先 + 腾讯HTTP回退" },
  "sources": { "mootdx_tcp": true, "tencent_http": true },
  "capabilities": { "realtime_single": true, "kline_historical": true, "intraday_minutes": true, "mqtt": true },
  "mqtt_commands": ["realtime", "batch", "...", "subscribe", "unsubscribe", "list_subs"]
}
```

---

## 实时价订阅（发布/订阅）

### subscribe

请求：

```json
{ "action": "subscribe", "data": { "codes": ["000001", "600519"], "interval": 5 } }
```

响应：

```json
{
  "action": "response",
  "data": {
    "action": "subscribe",
    "status": "success",
    "data": { "subscribed": ["000001", "600519"], "count": 2, "push_interval": 5 }
  }
}
```

- `codes` 解析后并入订阅表（幂等）；`interval >= 1` 时覆盖本会话推送间隔。
- `codes` 缺失或为空时返回 `status:"error", message:"缺少 codes"`。

### unsubscribe / list_subs

```json
{ "action": "unsubscribe", "data": { "codes": ["000001"] } }   // 不带 codes 则清空订阅表
{ "action": "list_subs", "data": {} }
```

响应 `data.data`：`{ subscribed: [...], count: N, push_interval: 5 }`。

### quote_push - 实时价推送

订阅后服务端每 `pushInterval` 秒对每只订阅代码发一条：

```json
{
  "action": "quote_push",
  "data": {
    "code": "600519",
    "name": "贵州茅台",
    "price": 1312.97,
    "open": 1286.0,
    "prev_close": 1286.0,
    "high": 1317.76,
    "low": 1282.0,
    "change_pct": 2.0972,
    "price_ts": 1792094887,
    "push_time": 1792094887,
    "stale": false
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `code` / `name` | 代码 / 名称 |
| `price` | **当前价**（控制端读这个） |
| `prev_close` | 昨收 |
| `open` / `high` / `low` | 今开 / 最高 / 最低 |
| `change_pct` | 涨跌幅(%)，服务端按 `(price - prev_close) / prev_close * 100` 计算 |
| `price_ts` / `push_time` | 行情时间 / 推送时间（Unix 秒） |
| `stale` | 是否为过期兜底值；取数失败的代码本周期跳过，不推送 |

推送语义要点：

- 推送为**增量行情**，一帧一只；丢帧无妨（服务端 QoS 0）。
- 取数统一走 `fetch_batch_quotes`：TDX 优先、腾讯 HTTP 兜底。**TDX 不可用时仍应推送**
  （腾讯价被视为实时价，`stale=false`）；若某实现因 TDX 不可用而静默不推，属实现缺陷。
- `push_only_trading=true` 时，非交易时段（工作日 9:15–11:30 / 13:00–15:00 之外）不推送。
- 推送前同样写入 `quote_cache`，与 `/api/quote_cache` 同源。

---

## 错误处理

| 场景 | 响应 |
|---|---|
| 缺少必填参数 | `status:"error", message:"缺少 code"` / `"缺少 codes"` |
| 未知命令 | `status:"error", message:"未知命令: xxx"` |
| 行情源不可用 | `status:"error", message:"无可用数据源: …"` |
| 解密失败 | 不响应，服务端记日志丢弃 |
| 非行情命令（下单等） | 静默忽略，不回响应（避免污染同 topic 的其它通道） |

---

## 客户端接入示例（浏览器，CryptoJS）

```js
const TOPIC = 'secure/stock-price-mqtt'
const PWD = 'stock_price_mqtt_S3cret'
const clientId = 'myquant_price_' + Math.random().toString(16).slice(2, 8)

function buildMsgId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

function publish(cmd) {
  const envelope = {
    id: clientId,
    msgId: buildMsgId(),
    user: 'myquant',
    msg: JSON.stringify(cmd),   // 参数放内层 data
    time: Date.now()
  }
  const body = CryptoJS.AES.encrypt(JSON.stringify(envelope), PWD).toString()
  client.publish(TOPIC, body, { qos: 0 })
}

// 订阅（codes 用数组或逗号串均可）
publish({ action: 'subscribe', data: { codes: ['000001', '600519'], interval: 5 } })

// 消费
client.on('message', (_topic, payload) => {
  const text = CryptoJS.AES.decrypt(payload.toString(), PWD).toString(CryptoJS.enc.Utf8)
  if (!text) return
  const envelope = JSON.parse(text)
  if (envelope.id === clientId) return              // 自消息过滤
  const inner = JSON.parse(envelope.msg)
  if (inner.action === 'quote_push') {
    const q = inner.data
    console.log(`${q.name} ${q.code} 现价=${q.price} 昨收=${q.prev_close} 涨幅=${q.change_pct}%`)
  }
  // response / status / ping 按需要分流，其余忽略
})
```

接入注意：

- 取单次价格用 `realtime`（请求/响应，`msgId` 配对）；持续跟价用 `subscribe` + 消费 `quote_push`。
- 控制端在 MQTT **已连接状态下变更订阅列表时，必须重新发送 `subscribe`**
  （连接建立时的那次订阅不会自动更新）。
- 下单通道与行情通道可能共用 broker，控制端务必按 `action` 分流，并用 topic 隔离。

---

## 排障

| 现象 | 排查 |
|---|---|
| 收不到任何消息 | 服务端是否启用 MQTT（Go 版默认开，Python 版需 `--mqtt`）；broker / topic / password 三处是否与服务端一致；解密失败会在服务端记日志 |
| `subscribe` 返回「缺少 codes」 | 参数未放在内层 `data`，或 `codes` 为空数组 |
| 订阅成功但无 `quote_push` | 检查 `push_only_trading`、当前是否交易时段、订阅列表是否非空；确认实现没有「TDX 不可用则不推送」的门禁 |
| 只收到部分代码 | 该代码取数失败会本周期跳过；`quote_cache` 可查服务端缓存 |
| 响应无法配对请求 | 用信封的 `msgId`（服务端回显请求 msgId）配对，不要用 `data.action` |

## 相关文档

- 设计：`stock/docs/price_server_mqtt_design.md`
- 需求：`stock/docs/price_server_mqtt_requirements.md`
- 排障与结论记录：`go-stock-server/docs/mqtt-and-data-source.md`
- 下单通道：[MQTT-Commands-API.md](./MQTT-Commands-API.md)
- Agent 协议（信封/加密来源）：`vue-dialog-userscript/docs/protocols/mqtt-agent-protocol.md`
