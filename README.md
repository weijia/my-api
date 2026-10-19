# My API

股票行情服务器 API 文档仓库。

## 目录结构

```
stock-server/
  API_USAGE.md              # 接口使用文档（curl 示例、请求参数、响应格式）
  docs/
    stock_price_api_prd.html   # 产品需求文档（PRD）
    node_config_sync_flow.md   # 节点配置自动同步流程设计
    MQTT-Commands-API.md       # MQTT 命令接口文档（远程控制）
    MQTT-Price-API.md          # MQTT 行情接口文档（取行情 / 订阅实时价）
pouchdb-server/
  docs/
    PouchDB-Register-API.md    # PouchDB 同步服务账号注册接口（注册申请 / 审批状态查询）
mqtt-secure-client/
  mqtt-client.js             # 加密 MQTT 客户端封装
  example.html
  README.md
```

## 接口概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 服务器全局配置 |
| `/api/node/config` | GET/POST/DELETE | 节点个性化配置 |
| `/api/realtime/{code}` | GET | 实时行情 |
| `/api/kline/{code}` | GET | K线数据 |
| `/api/intraday/{code}` | GET | 分时数据 |

详见 [stock-server/API_USAGE.md](stock-server/API_USAGE.md)

## MQTT 远程控制

通过 MQTT 协议实现远程控制，支持方正证券和平安证券两家券商。

| 文档 | 说明 |
|------|------|
| [MQTT 命令接口](stock-server/docs/MQTT-Commands-API.md) | MQTT 命令协议、命令列表、参数说明 |
| [MQTT Secure Client](mqtt-secure-client/README.md) | 加密 MQTT 客户端封装 |

## MQTT 行情（Price Server）

取行情与订阅实时价，走独立 topic（`secure/stock-price-mqtt`），与上面的下单通道互不相干。

| 文档 | 说明 |
|------|------|
| [MQTT 行情接口](stock-server/docs/MQTT-Price-API.md) | 信封/加密约定、命令列表、`subscribe` / `quote_push` 字段、接入示例 |

### 支持的命令

**方正证券**：`get_holdings`、`list`、`stop`、`buy`、`sell`、`create`、`add`、`cancel`、`generate_decrease`、`refresh_grid`、`list_grid`、`remove_grid`、`create_grid`

**平安证券**：`get_holdings`、`add`、`create`、`buy`、`sell`、`query`、`cancel`、`remove`、`list`

## PouchDB 同步服务

PouchDB/CouchDB 兼容的同步服务（`pouchdb-https-server`，Node.js），用于多设备间同步本地数据库。新设备通过注册接口申请账号，本机管理员审批后即可登录同步。

| 文档 | 说明 |
|------|------|
| [PouchDB 注册接口](pouchdb-server/docs/PouchDB-Register-API.md) | 注册申请提交、审批状态轮询、错误码、Python 调用示例 |

注册为**审批制**：客户端 `POST /_register` 提交申请拿到 `token`，轮询 `GET /_register/status` 直到 `approved`，本机管理员在管理页（`http://127.0.0.1:8224/_admin/`）点批准，账号才生效。
