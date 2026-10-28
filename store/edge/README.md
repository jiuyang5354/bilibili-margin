# 自动发布到 Edge 加载项

1. 第一次需要在 Partner Center 手动创建产品并提交：上传 Release 里的 margin.zip，填写 listing.md 里的资料。
2. 审核通过后，在 Partner Center →「发布 API」创建 API 凭据，得到 Client ID 和 API key；产品页 URL 中有 Product ID。
3. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：
   - EDGE_PRODUCT_ID
   - EDGE_CLIENT_ID
   - EDGE_API_KEY
4. 之后每次推送 v* tag，build.yml 会把 margin.zip 上传为新草稿并提交审核；用户的 Edge 会在审核通过后自动更新。
