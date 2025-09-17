# 覆蓋包使用說明（一次性）

## 怎麼用
1. 下載並解壓本壓縮檔，**整包覆蓋** 到你 repo 的根目錄。
   - 會覆蓋：`scripts/update_products.mjs`、`data/sources.csv`
2. Commit 到 main 分支。
3. 到 GitHub **Actions → Auto Update Products → Run workflow**。
4. 完成後，重新整理網站：`https://yuhan0117.github.io/SHOP-AUTO/?_=1758075931`

## 換成你的商品
- 編輯 `data/sources.csv`：
  - `url` = 商品頁網址
  - `affiliate_url` = 你的分潤連結
  - 其餘欄位可留白讓系統自動抓標題/圖片
- Commit 後跑 workflow，自動同步更新。

—— 完 ——
