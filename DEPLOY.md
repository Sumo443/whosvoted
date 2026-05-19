# DEPLOY.md - WHO VOTED Cloudflare Pages デプロイ手順

## 対象
Cloudflare Pages（無料プラン・商用利用OK）

---

## 事前準備

### 輝さん側でやっておくこと
- [ ] Cloudflareアカウント作成（https://dash.cloudflare.com/sign-up）
- [ ] whosvoted.com のドメイン設定（Cloudflare DNSに変更 or Cloudflare Pagesでドメイン追加）

---

## Step 1：GitHubリポジトリ準備

```bash
# ローカルのMacで
cd /Users/openclaw/.openclaw/workspace/whosvoted

# .gitignoreを作成
cat > .gitignore << 'EOF'
node_modules/
.next/
out/
data/
src/data/*.json
src/data/index.ts
.next/
EOF

# GitHubでリポジトリを作成してプッシュ
git init
git add .
git commit -m "Initial commit: WHO VOTED static site"
git remote add origin https://github.com/【あなたのユーザー名】/whosvoted.git
git push -u origin main
```

## Step 2：Cloudflare Pagesにデプロイ

1. Cloudflareダッシュボードにログイン
2. 「Workers & Pages」→「Pages」→「Connect to Git」
3. GitHubを連携（初回のみ認証）
4. リポジトリ `whosvoted` を選択
5. ビルド設定：

| 項目 | 値 |
|---|---|
| フレームワーク | Next.js |
| ビルドコマンド | `npm run build` |
| 出力ディレクトリ | `out` |
| 環境変数 | なし（静的サイトなので不要） |

6. 「Save and Deploy」→ ビルドが走る（約5分）

## Step 3：独自ドメイン設定

1. Cloudflare Pagesのプロジェクト設定 → 「Custom domains」
2. `whosvoted.com` を追加
3. DNS設定（Cloudflare DNSに委任している場合は自動）

## Step 4：動作確認

```
https://whosvoted.com
```

- [ ] トップページ表示
- [ ] 検索が効く
- [ ] 議員詳細ページが開く
- [ ] 法案詳細ページが開く
- [ ] 推し議員メーカーが動く
- [ ] Xシェアボタンが開く
- [ ] スマホ表示OK

---

## データ更新手順

DBを更新するたびに再ビルド＋再デプロイが必要。

```bash
# 1. ローカルで voting_watcher の auto_update を実行
cd ../voting_watcher
python3 auto_update.py

# 2. DBをコピー
cd ../whosvoted
bash setup-data.sh

# 3. ビルド（prebuildでデータが再生成される）
npm run build

# 4. Gitにプッシュ（Cloudflare Pagesが自動で再デプロイ）
git add .
git commit -m "データ更新 $(date +%Y-%m-%d)"
git push origin main
```

またはGitを使わず直接アップロード：
```bash
# wrangler CLIでデプロイ（Cloudflare CLI）
npx wrangler pages deploy out/ --project-name=whosvoted
```

---

## 注意事項

- Cloudflare Pagesの無料枠：**帯域無制限**、ビルド時間500分/月
- 全データ約235MB（608法案 + 465議員）
- データ更新は週1回想定（国会会期中）
- AdSenseはCloudflare Pagesでも通常通り設置可能
- 静的サイトなのでDBサーバー不要、永続的に維持費無料
