# OpenKokopi 仕様書

## 概要
OpenKokopiは、Kubernetes上で動作するHeroku風のPaaS（Platform-as-a-Service）です。Node.jsアプリケーションを簡単にデプロイできるWebコントロールパネルを提供します。

## アーキテクチャ

### システム構成
- **バックエンド**: Express.js APIサーバー (ポート3000)
- **フロントエンド**: Next.js Webアプリケーション (ポート3001)
- **コンテナオーケストレーション**: Kubernetes
- **Ingressコントローラー**: nginx-ingress

### ワークスペース構成
```
workspaces/
├── backend/    # Express.js APIサーバー
└── panel/      # Next.js コントロールパネル
```

## 主要機能

### 1. アプリケーションデプロイ
- GitリポジトリURLを指定してNode.jsアプリケーションをデプロイ
- 環境変数の設定
- カスタムホスト名の指定
- 自動的なnpm install、build、startの実行

### 2. 名前空間管理
- Kubernetesの名前空間を自動作成
- `openKokopiManaged=true`ラベルで管理対象を識別
- リポジトリURL、デプロイユーザー情報をラベルとして保存

### 3. デプロイメント管理
- Deploymentリソースの作成・管理
- 環境変数の更新
- アプリケーションの再起動
- リポジトリの再デプロイ

### 4. ネットワーキング
- ClusterIP Serviceの自動作成
- Nginx Ingressによる外部公開
- ホスト名の重複チェック

## API仕様

### 認証
- Basic認証 (デフォルト: admin:pass)
- すべてのAPIエンドポイントで必須

### エンドポイント

#### POST /api/deploy
新しいアプリケーションをデプロイ

**リクエストボディ**:
```json
{
  "namespace": "app-name",
  "repoUrl": "https://github.com/user/repo.git",
  "envVars": "KEY1=value1\nKEY2=value2",
  "ports": [
    {
      "containerPort": 3000,
      "name": "http",
      "protocol": "TCP"
    },
    {
      "containerPort": 8080,
      "name": "admin"
    }
  ],
  "hosts": [
    {
      "hostname": "app.example.com",
      "port": 80,
      "targetPort": 3000,
      "path": "/"
    },
    {
      "hostname": "admin.example.com",
      "port": 80,
      "targetPort": 8080
    }
  ]
}
```

**旧形式（後方互換性あり）**:
```json
{
  "namespace": "app-name",
  "repoUrl": "https://github.com/user/repo.git",
  "envVars": "KEY1=value1\nKEY2=value2",
  "host": "app.example.com"
}
```

**レスポンス**:
```json
{
  "message": "Deployment {name} created successfully",
  "podName": "deployment-name"
}
```

**エラーケース**:
- 400: ホスト名が既に使用中
- 500: Kubernetesエラー

#### GET /api/namespaces
管理対象の名前空間一覧を取得

#### GET /api/namespace/:namespace/pods
指定名前空間のPod一覧を取得

#### GET /api/namespace/:namespace/pod/:podname
Pod詳細情報を取得

#### GET /api/namespace/:namespace/pod/:podname/log
Podのログを取得

#### GET /api/namespace/:namespace/services
Service一覧を取得

#### GET /api/namespace/:namespace/ingresses
Ingress一覧を取得

#### GET /api/namespace/:namespace/deployments
Deployment一覧を取得

#### GET /api/namespace/:namespace/deployment/:deploymentName
Deployment詳細と環境変数を取得

#### PATCH /api/namespace/:namespace/deployment/:deploymentName/env
環境変数を更新

**リクエストボディ**:
```json
{
  "envVars": "KEY1=newvalue1\nKEY2=newvalue2"
}
```

#### POST /api/namespace/:namespace/deployment/:deploymentName/restart
Deploymentを再起動

#### POST /api/namespace/:namespace/deployment/:deploymentName/redeploy
新しいリポジトリURLで再デプロイ

**リクエストボディ**:
```json
{
  "repoUrl": "https://github.com/user/new-repo.git"
}
```

#### POST /api/namespace/:namespace/delete
名前空間を削除

## Kubernetesリソース仕様

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: {namespace}
  labels:
    name: {namespace}
    openKokopiManaged: 'true'
    repositoryUrl: {encoded-repo-url}
    deployEnvVars: "not_implemented"
    deployUser: "admin"
```

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {repo-name}-{timestamp}
  namespace: {namespace}
spec:
  replicas: 1
  template:
    spec:
      initContainers:
      - name: git-clone
        image: alpine/git:2.45.2
        command: ['sh', '-c']
        args: ['git clone {repoUrl} /app']
      containers:
      - name: node-bot
        image: node:18-bookworm-slim
        workingDir: /app
        command: ['sh', '-c']
        args: ['npm install && npm run build && npm run start']
        ports:
        - containerPort: 3000
        env: {environment-variables}
```

### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {deployment-name}
  namespace: {namespace}
spec:
  type: ClusterIP
  selector:
    app: {deployment-name}
  ports:
  - port: 80
    targetPort: 3000
```

### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {deployment-name}
  namespace: {namespace}
spec:
  ingressClassName: nginx
  rules:
  - host: {hostname}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {deployment-name}
            port:
              number: 80
```

## 新機能：マルチポート・マルチホスト対応

### ポート設定
アプリケーションは複数のポートを公開できます：
- 各ポートに名前を付けることが可能
- TCP/UDPプロトコルの指定が可能（デフォルトはTCP）

### ホスト設定
各ポートに対して異なるホスト名を割り当てることができます：
- 1つのアプリケーションで複数のドメインを使用可能
- 各ホストは特定のコンテナポートにルーティング
- パスベースのルーティングも設定可能

### 使用例
```json
{
  "ports": [
    { "containerPort": 3000, "name": "web" },
    { "containerPort": 8080, "name": "api" },
    { "containerPort": 9090, "name": "metrics" }
  ],
  "hosts": [
    { "hostname": "myapp.example.com", "port": 80, "targetPort": 3000 },
    { "hostname": "api.myapp.example.com", "port": 80, "targetPort": 8080 },
    { "hostname": "metrics.myapp.example.com", "port": 80, "targetPort": 9090 }
  ]
}
```

## 制限事項

1. **永続化**: 現在、永続ボリュームはサポートされていない（emptyDirのみ）
2. **言語**: Node.jsアプリケーションのみサポート
3. **ビルド**: `npm install && npm run build && npm run start`コマンドが実行可能である必要がある
4. **環境変数**: 名前空間のアノテーションでの保存は未実装
5. **ポート番号**: サービスポートは80から順番に割り当てられる

## セキュリティ考慮事項

1. Basic認証のクレデンシャルは環境変数で設定すべき
2. Gitリポジトリは公開リポジトリのみサポート（認証なし）
3. すべてのアプリケーションは分離された名前空間で実行される

## 必要な前提条件

1. Kubernetes クラスター
2. nginx-ingress コントローラーのインストール
3. クラスターへのアクセス権限（~/.kube/config）

## 開発環境

- Node.js 22.13.1 (Volta使用)
- TypeScript (strict mode)
- npm workspaces