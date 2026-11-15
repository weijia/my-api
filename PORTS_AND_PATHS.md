# 常用端口及路径规划

本仓库各服务（行情、PouchDB/CouchDB 同步、MQTT）使用的端口与 URL 路径集中规划，便于排错、避免端口冲突与路径撞车。

> 约定说明：
> - **标准端口**：对应组件官方默认端口，仅作规划参考。
> - **项目端口**：本仓库实际部署时使用的端口（可能与标准不同，需以此为准）。
> - CouchDB/PouchDB 约定：**所有以 `_` 开头的路径为系统保留路径**（`/_utils`、`/_admin`、`/_register`、`/_session` 等），自定义业务接口应避免使用 `_` 前缀以免冲突。

---

## 一、端口规划

| 服务 / 组件 | 协议 | 标准端口 | 项目端口 | 说明 |
|-------------|------|---------|---------|------|
| CouchDB | HTTP | `5984` | `8224` | 官方默认 `5984`（HTTPS 为 `6984`）；本仓库 pouchdb-server 实际监听 `8224` |
| Stock Server（行情） | HTTP | `8080` | `8080` | 股票行情 REST API 服务 |
| MQTT Broker | MQTT（明文） | `1883` | `1883` | 行情/下单通道明文连接 |
| MQTT Broker | MQTT（TLS） | `8883` | `8883` | 加密通道（本项目使用加密客户端） |
| MQTT Broker | WebSocket | `8083` | — | 规划/可选：浏览器端 WebSocket 接入 |
| MQTT Broker 管理控制台 | HTTP | `18083` | — | 规划/可选：如 EMQX Dashboard |
| Parkour Game（跑酷游戏测试） | HTTP | — | `5180` | 跑酷游戏测试后端，访问示例 `http://127.0.0.1:5180/play.html?theme=synthwave` |

> 新增服务时优先从 `9000~9999` 段选取空闲端口，并在本表登记，避免与本仓库既有端口（`8080` / `8224` / `1883` / `8883` / `5180`）冲突。

---

## 二、路径规划

### 2.1 CouchDB / PouchDB 同步服务

| 路径 | 类型 | 说明 |
|------|------|------|
| `/_utils/` | 系统 | CouchDB 原生管理界面（Fauxton），标准数据库路径 |
| `/_admin/` | 自定义 | 本项目自定义管理界面（账号审批、注册管理），访问示例 `http://127.0.0.1:8224/_admin/` |
| `/_register` | 自定义 | 同步账号注册申请提交（POST），返回 `token` |
| `/_register/status` | 自定义 | 注册审批状态轮询（GET），直到 `approved` |
| `/<db>/` | 系统 | 数据库/文档访问路径，由 PouchDB 同步自动使用 |

详见 [PouchDB 注册接口](pouchdb-server/docs/PouchDB-Register-API.md)。

### 2.2 Stock Server（行情 API）

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 服务器全局配置 |
| `/api/node/config` | GET/POST/DELETE | 节点个性化配置 |
| `/api/realtime/{code}` | GET | 实时行情 |
| `/api/realtime/batch` | GET | 批量实时行情 |
| `/api/kline/{code}` | GET | K 线数据 |
| `/api/trend/{code}` | GET | 走势数据 |
| `/api/intraday/{code}` | GET | 分时数据 |
| `/api/providers` | GET | 券商 provider 列表 |
| `/api/provider` | GET | 单个 provider 信息 |

详见 [stock-server/API_USAGE.md](stock-server/API_USAGE.md)。

### 2.3 MQTT 远程控制 / 行情

| Topic / 通道 | 说明 |
|--------------|------|
| `secure/stock-mqtt` | 远程控制（下单）通道 |
| `secure/stock-price-mqtt` | 行情（取行情 / 订阅实时价）通道，与下单通道隔离 |

详见 [MQTT 命令接口](stock-server/docs/MQTT-Commands-API.md) 与 [MQTT 行情接口](stock-server/docs/MQTT-Price-API.md)。

### 2.4 Parkour Game（跑酷游戏测试）

| 路径 | 类型 | 说明 |
|------|------|------|
| `/play.html` | 页面 | 跑酷游戏测试入口页面 |
| `/play.html?theme=synthwave` | 页面 | 带 `synthwave` 主题的测试入口，访问示例 `http://127.0.0.1:5180/play.html?theme=synthwave` |

> 该后端用于跑酷游戏的本地测试，端口 `5180` 为项目实际端口（无对应组件标准端口）。

---

## 三、命名与冲突规避

- **端口**：本仓库服务集中在 `8080` / `8224` / `1883` / `8883` / `5180`，新服务从高位空闲段分配并登记。
- **路径**：业务接口以 `/api/` 或普通单词开头；`_` 前缀路径专留给 CouchDB/PouchDB 系统（含本项目自定义的 `/_admin`、`/_register` 等），不得挪作他用。
- **跨服务一致性**：同一逻辑概念（如实时行情）在各文档中的路径、端口必须指向本表登记值，变更须同步更新本文件。
