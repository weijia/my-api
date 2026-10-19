# PouchDB 同步服务 — 账号注册接口文档

## 概述

本文档描述 PouchDB 同步服务（`pouchdb-https-server`）面向客户端的**账号注册接口**：新设备/新用户通过 API 提交注册申请，由本机管理员在管理页审批后即可用该账号登录数据端口进行同步。

服务端实现：`C:/codes/nodejs/pouchdb-https-server`（Node.js / Express，对外伪装 CouchDB 3.3.3）。

### 注册模型：审批制

注册**不等于**立刻拿到可用账号。提交注册只是创建一个「待审批申请」，本机管理员批准后才生效：

```
客户端                         数据端口(8224)                 控制端口(8225, 仅本机)
  │                                │                              │
  ├─ POST /_register ─────────────▶│ 校验+限流 → 建 pending        │
  │◀── {token, pending:true} ──────┤                              │
  │                                │                              │
  │◀─ GET /_register/status ───────┤ (轮询，state=pending)        │
  │                                │                              │
  │                          管理员在管理页点【批准】               │
  │                                │◀── POST /register/approve ────┤
  │                                │      pending → active peer 账号 │
  │◀─ GET /_register/status ───────┤ (轮询，state=approved)        │
  │                                │                              │
  ├─ 带 Basic Auth 访问数据端口 API ◀── 可用该用户名+密码登录 ──────┘
```

> 注册接口在数据端口的 Basic Auth 网关**之前**注册，因此**免鉴权**即可调用；
> 但也正因如此，服务端做了按 IP 限流与严格的用户名校验（见下文「安全与限制」）。

---

## 连接配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 数据端口 | `8224` | `0.0.0.0`，注册接口所在端口；`http://<host>:8224` |
| 控制端口 | `8225` | `127.0.0.1` 仅本机可达，**注册申请审批在此进行**，客户端不需要也不应访问 |
| HTTPS 端口 | `8223` | 可选，需证书；注册接口同样可用 |
| 注册开关 | 开启 | 可用 `--no-register` 或 `POUCH_ALLOW_REGISTER=false` 关闭 |

启动：

```bash
cd pouchdb-https-server
node server.js                       # 默认开启注册
node server.js --no-register         # 关闭注册（POST /_register 返回 403）
POUCH_ALLOW_REGISTER=false node server.js
```

> 端口可用 `--port` / `--control-port` 覆盖。局域网内客户端应把 `<host>` 换成本机在局域网中的 IP。

---

## 接口列表

本节只描述**客户端需要调用**的两个注册接口。审批用的控制端口接口属本机管理员操作，不在本文档范围。

### 1. 提交注册申请

```
POST /_register
Content-Type: application/json
```

提交注册申请。免鉴权。服务端校验用户名/密码、按来源 IP 限流后创建一条待审批申请，返回 `token` 供后续轮询。

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名，3–32 位，字母/数字/`_`/`.`/`-`；不能是保留名（`admin`/`root`/`system` 等），不能以 `peer-` 开头，不能与已有账号或待审申请重名 |
| password | string | 是 | 密码，6–128 位 |

**curl 示例：**

```bash
curl -X POST http://192.168.1.100:8224/_register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"wonderland"}'
```

**Python 调用示例：**

```python
import urllib.request
import json

def register(base: str, username: str, password: str) -> dict:
    url = base.rstrip('/') + "/_register"
    body = json.dumps({"username": username, "password": password}).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST',
                                 headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read().decode('utf-8'))

result = register("http://192.168.1.100:8224", "alice", "wonderland")
print(f"申请已提交，等待审批，token={result['token']}")
```

**响应示例（HTTP 200）：**

```json
{
  "token": "2e61b5f8149063d60ea506af323b2547",
  "pending": true
}
```

**响应字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | 申请令牌，后续用它轮询审批结果（`GET /_register/status`） |
| pending | boolean | 固定为 `true`，表示「已受理，待审批」 |

> 注意：这里的 `pending: true` 表示**申请已创建**，不代表账号已生效。此时用该用户名密码访问数据端口会返回 401。

---

### 2. 查询注册审批状态

```
GET /_register/status?token={token}
```

查询某条注册申请的审批状态，免鉴权。客户端可据此轮询，等待管理员审批结果。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| token | string | 是 | `POST /_register` 返回的 token |

**curl 示例：**

```bash
curl "http://192.168.1.100:8224/_register/status?token=2e61b5f8149063d60ea506af323b2547"
```

**Python 调用示例（轮询直到 approved）：**

```python
import urllib.request
import json
import time

def register_status(base: str, token: str) -> dict:
    url = base.rstrip('/') + f"/_register/status?token={token}"
    resp = urllib.request.urlopen(url, timeout=10)
    return json.loads(resp.read().decode('utf-8'))

def wait_approved(base: str, token: str, timeout: int = 300, interval: int = 5) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        st = register_status(base, token)
        if st['state'] == 'approved':
            return True
        if st['state'] == 'denied':
            return False
        time.sleep(interval)
    return False  # 超时，仍在 pending

if wait_approved("http://192.168.1.100:8224", "2e61b5f8149063d60ea506af323b2547"):
    print("账号已生效，可用该用户名密码登录数据端口")
else:
    print("未在时限内通过审批（或被拒绝）")
```

**响应字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| state | string | `pending`（待审批）/ `approved`（已批准，账号生效）/ `denied`（已拒绝） |

**响应示例：**

待审批时：

```json
{ "state": "pending" }
```

已批准时：

```json
{ "state": "approved", "username": "alice" }
```

已拒绝时：

```json
{ "state": "denied" }
```

> `approved` 时返回的 `username` 仅作确认用；密码始终是客户端自己提交的那个，服务端不返回密码。

---

## 错误码

`POST /_register` 失败时的响应（HTTP 状态码与 body 中的 `error` 字段）：

| HTTP | error | 含义 | 处理建议 |
|------|-------|------|----------|
| 200 | — | 申请已受理 | 保存 `token`，进入轮询 |
| 400 | `bad_username` | 用户名不合法（过短/超长/含非法字符/保留名/`peer-` 前缀/已存在/已在待审） | 更换用户名后重试 |
| 400 | `bad_password` | 密码不合法（少于 6 位或超过 128 位） | 调整密码后重试 |
| 403 | `forbidden` | 注册已关闭（`registration disabled`） | 联系管理员开启注册 |
| 429 | `rate_limited` | 同一 IP 提交过于频繁（1 小时内超过 10 次） | 退避后重试 |
| 429 | `too_many` | 服务端待审批申请已满（上限 20 条） | 稍后再试或联系管理员清理 |

`GET /_register/status` 失败时：

| HTTP | error | 含义 |
|------|-------|------|
| 200 | — | 正常，返回 `state` |
| 404 | `not_found` | token 不存在或已过期（待审批记录超 1 小时会被清理） |

错误响应示例：

```json
{ "error": "bad_username", "reason": "username reserved" }
```

```json
{ "error": "bad_username", "reason": "username already pending" }
```

```json
{ "error": "bad_password", "reason": "password must be at least 6 chars" }
```

```json
{ "error": "forbidden", "reason": "registration disabled" }
```

```json
{ "error": "rate_limited", "reason": "too many registration attempts from this ip" }
```

---

## 安全与限制

| 项 | 值 | 说明 |
|----|----|------|
| 用户名长度 | 3–32 | 字符集 `^[A-Za-z0-9_.-]+$` |
| 密码长度 | 6–128 | — |
| 注册限流 | 同一 IP 1 小时内 10 次 | 超限返回 429 `rate_limited` |
| 待审批上限 | 20 条 | 含配对待审；超限返回 429 `too_many` |
| 申请有效期 | 1 小时 | 超时未审批自动清理，轮询会拿到 404 |
| 密码存储 | scrypt 加盐哈希 | 提交时即哈希，服务端（含 `users.json`）**不保存明文** |

保留用户名（不可注册）：`admin`、`root`、`administrator`、`system`、`superuser`。
`peer-` 开头的用户名为配对自动生成的账号保留，注册时不可占用。

> ⚠️ 注册通过后账号角色为 `peer`，可访问/同步**全部数据库**（当前版本尚未提供按库 ACL）。
> 因此请仅在你信任的网络环境中开启注册；不需要时用 `--no-register` 关闭。

---

## 完整调用流程（客户端视角）

```
1. POST /_register {username, password}
      → 200 {token, pending:true}
      → 400/403/429 时按错误码处理（用户名冲突就换一个；限流就退避）

2. GET /_register/status?token=...   （建议每 5s 轮询，超时 5 分钟）
      → pending  : 继续等
      → approved : 进入第 3 步
      → denied   : 注册被拒，流程终止

3. 用该用户名 + 密码，以 Basic Auth 访问数据端口
      → curl -u alice:wonderland http://<host>:8224/_all_dbs
      → 200 即登录成功，可开始 PouchDB 同步
```

第 3 步登录示例：

```bash
curl -u alice:wonderland http://192.168.1.100:8224/_all_dbs
```
