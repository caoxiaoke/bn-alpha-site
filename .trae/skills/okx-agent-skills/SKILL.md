---
name: "okx-agent-skills"
description: "Uses OKX public data (funding, OI, tickers) to validate and rank 'degen' candidates. Invoke when user asks to combine OKX data or improve token hunting signals."
---

# OKX Agent Skills（用于“妖币”寻找的 OKX 数据增强）

## 何时使用

在以下场景调用本技能：

- 需要用 OKX 的公开数据（费率、持仓量、成交额等）来增强/校验“妖币”筛选结果
- 当前上游（例如 Binance futures）在部署环境受限或数据不稳定，需要增加替代数据源
- 需要对单个标的做“费率 / OI / 交易热度”一致性核验，避免页面展示错误

## 目标

为现有“妖币寻找/妖币得分”链路增加 OKX 维度：

- 费率：Funding Rate（负费率/极端费率作为挤压信号）
- 持仓：Open Interest（当前值 + 历史趋势）
- 热度：24h 成交额/成交量、涨跌幅、交易对可交易状态

## OKX 公共接口建议（无需鉴权）

说明：OKX 的公开接口会返回 `code`/`msg`/`data`，`data` 多为数组；注意将数值字段按字符串解析为 number。

### 1) 永续合约列表（校验“是否有合约”）

- `GET https://www.okx.com/api/v5/public/instruments?instType=SWAP`
- 过滤 `settleCcy=USDT` 或 `quoteCcy=USDT`（以 OKX 实际字段为准）
- 用 `instId`（如 `BTC-USDT-SWAP`）建立可交易集合

### 2) 资金费率（当前/最近）

- `GET https://www.okx.com/api/v5/public/funding-rate?instId=<instId>`
- 或：`GET https://www.okx.com/api/v5/public/funding-rate-history?instId=<instId>&limit=<n>`

解析：

- `fundingRate`：字符串，转 number
- 若需要展示百分比：`fundingRate * 100`

### 3) OI（当前）

- `GET https://www.okx.com/api/v5/public/open-interest?instId=<instId>&instType=SWAP`

注意：

- OKX 可能返回的是合约张数/币本位数量，必要时结合标的乘数/价格换算成统一口径

### 4) 行情（成交额、涨跌、价格）

- `GET https://www.okx.com/api/v5/market/ticker?instId=<instId>`
- 批量：`GET https://www.okx.com/api/v5/market/tickers?instType=SWAP`

常用字段（以实际返回为准）：

- `last`、`vol24h`、`volCcy24h`、`sodUtc0`/`open24h` 等

## 接入到当前项目的推荐方式

### A. 数据层（src/lib/api.ts）增加 OKX 聚合器

- 新增 `fetchOkxSwapUniverse()`：获取可用 SWAP 合约集合（instId 映射）
- 新增 `fetchOkxFunding(instIds[])`：批量拉 funding（并做限流/缓存）
- 新增 `fetchOkxOpenInterest(instIds[])`：批量拉 OI（并做限流/缓存）
- 新增 `fetchOkxTickers()`：批量拉 tickers 用于成交额/热度指标

输出建议统一成内部结构：

- `hasPerp`（OKX 维度）
- `fundingRateOkx`
- `openInterestOkx`
- `volume24hOkx`

### B. 评分层（calculateDegenScore）引入 OKX 作为“校验或替代”

当 Binance 费率/持仓受限时：

- funding 使用 OKX 的 `fundingRateOkx`
- OI 趋势使用 OKX 的 OI 历史（若实现）

当 Binance 可用时：

- 用 OKX 做交叉校验：如果两边方向差异很大，可降低该信号权重或标记“数据不一致”

### C. API 代理层（src/app/api/proxy/route.ts）建议

- 为 OKX 新增 proxy target（例如 `okxInstruments/okxFunding/okxOI/okxTickers`）
- 对数组响应统一包装 `{ code:'000000', data:[...], _sourceUrl }`，避免前端解析错
- 对 429/超时做短 TTL cache（例如 5–30 秒），避免频繁刷新导致抖动

## 最小可行的“妖币”筛选信号（OKX 版）

当需要仅依赖 OKX 数据完成筛选，可使用：

- `marketCap`（来自现有 Alpha/链上数据）仍作为主筛条件
- `volume24h / marketCap`（volume 可用 OKX 的 `volCcy24h` 或 Binance alpha `volume24h`）
- `fundingRate < 0`（OKX funding）
- `openInterest` 趋势：最近 N 个点上升，或者当前 OI 高于均值一定比例

## 验证清单（避免“展示错误”）

- 数组响应是否被错误展开成对象（必须保留数组）
- 费率是否按“标的粒度”存在才展示（缺失应显示 `-` 而不是 `0`）
- OI 口径（张数/币/美元）是否在 UI 标注一致，避免误解

