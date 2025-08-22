# 個別支援計画書作成ツール（簡易版）

障害者支援施設向けの個別支援計画書作成支援ツールです。
面談内容からAIが自動的に支援計画を生成します。

## 特徴

- 🏢 **3つの事業所タイプに対応**
  - 就労継続支援A型事業所（3項目）
  - 就労継続支援B型事業所（3項目）
  - 生活介護事業所（3項目）
  - 総合判断による追加項目（1項目）

- ✨ **シンプルな操作**
  - 面談内容を入力するだけ
  - 10項目の支援内容を自動生成
  - 各項目を個別にコピー可能

- 📋 **Excel連携**
  - タブ区切り形式でコピー
  - Excelに直接貼り付け可能

## セットアップ

### 1. 環境変数の設定

`.env.local`ファイルを作成し、OpenAI APIキーを設定：

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo  # オプション（デフォルト: gpt-3.5-turbo）
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## デプロイ（Vercel）

### 1. Vercelにプロジェクトをインポート

1. [Vercel](https://vercel.com)にログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択（またはローカルプロジェクトをアップロード）

### 2. 環境変数の設定

Vercelのプロジェクト設定で以下の環境変数を追加：

- `OPENAI_API_KEY`: OpenAI APIキー
- `OPENAI_MODEL`: 使用するモデル（オプション）

### 3. デプロイ

自動的にビルド・デプロイが実行されます。

## 使い方

1. **面談内容の入力**
   - テキストエリアに面談の文字起こしデータを貼り付け
   - **デモ用サンプル**: [demo-samples.md](./demo-samples.md) にサンプル面談記録があります

2. **支援内容の生成**
   - 「支援内容を生成する」ボタンをクリック
   - AIが10項目の支援内容を自動生成

3. **項目のコピー**
   - 各項目の「コピー」アイコンで個別にコピー
   - 「Excel用に全てコピー」ボタンで一括コピー
   - Excelに貼り付けて使用

## 技術スタック

- **フレームワーク**: Next.js 14（App Router）
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **AI**: OpenAI API（GPT-3.5/GPT-4）
- **デプロイ**: Vercel

## GitHub Pages デプロイ

このアプリケーションはGitHub Pagesにデプロイ可能です：

1. リポジトリのSettings → Pages
2. Source: GitHub Actions
3. Next.js用のGitHub Actionsワークフローを設定
4. 自動ビルド・デプロイが実行されます

## リポジトリ情報

- **GitHub**: https://github.com/kotashimizu/care-plan-simple
- **作成日**: 2025-08-22
- **開発者**: kota5656

## ライセンス

MIT
