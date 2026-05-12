# 叉哥持仓跟踪

Bright Valley Capital Ltd 的 13F 持仓跟踪网页。

## 使用

直接打开 `index.html`，或在本目录启动一个静态服务器：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 数据口径

- 持仓数据来自 Bright Valley Capital Ltd 的 SEC 13F 报告，并通过 13f.info 的结构化接口整理。
- 13F 的 `Value` 是季度末披露市值，单位为 USD 千元，不等同于基金完整 AUM。
- “占公司股本”使用当前 Nasdaq 摘要中的市值 / 前收盘价推算 ADS 或普通股等价基数。
- 期权仓位单独展示，占股本比例只代表名义敞口，不代表真实普通股所有权。
- 当前可用历史从 2023 Q4 到 2025 Q4；如果 13f.info 或 SEC 后续出现更早/更新 filing，可以补进脚本。

## 更新

运行：

```bash
./scripts/update-data.sh
```

脚本会先刷新 Bright Valley Capital 的 13f.info manager 页面，自动发现最近五年窗口内的 filing，再下载对应 13F JSON，并重新生成 `assets/portfolio-data.js`。

截至 2026-05-12，数据源中最新 filing 仍为 2025 Q4；2026 Q1 filing 尚未出现在 13f.info/SEC 数据集中。页面会把这个状态展示为“待披露”。
