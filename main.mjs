import express from 'express';
import session from 'express-session';
import { KubeConfig, CoreV1Api, NetworkingV1Api, V1SecretList, V1ContainerPort } from '@kubernetes/client-node';

/**
 * Podを作成するためのマニフェストを生成する関数
 * (initContainer で git clone → メインコンテナで npm install & npm run start)
 */
function createPodSpec(repoUrl, envVars = {}) {
    const repositoryName = repoUrl.split('/').pop().split('.').shift();
    const podName = `${repositoryName}-${Date.now()}`;

    // 受け取った envVars オブジェクトを k8s 用の配列形式に変換
    const envArray = Object.entries(envVars).map(([key, value]) => ({
        name: key,
        value: value
    }));

    return {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
            name: podName,
            labels: {
                app: podName
            }
        },
        spec: {
            restartPolicy: 'Never',
            volumes: [
                {
                    name: 'app-volume',
                    emptyDir: {}
                }
            ],
            initContainers: [
                {
                    name: 'git-clone',
                    image: 'alpine/git:latest',
                    command: ['sh', '-c'],
                    args: [
                        `git clone ${repoUrl} /app`
                    ],
                    volumeMounts: [
                        {
                            name: 'app-volume',
                            mountPath: '/app'
                        }
                    ]
                }
            ],
            containers: [
                {
                    name: 'node-bot',
                    image: 'node:18-alpine',
                    workingDir: '/app',
                    command: ['sh', '-c'],
                    args: [
                        'npm install && npm run build && npm run start'
                    ],
                    volumeMounts: [
                        {
                            name: 'app-volume',
                            mountPath: '/app'
                        }
                    ],
                    env: envArray,
                    ports: [
                        { containerPort: 3000 }
                    ]
                }
            ]
        }
    };
}

function createServiceSpec(podName, port) {
    return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: podName,
            labels: {
                app: podName
            }
        },
        spec: {
            type: 'ClusterIP',
            selector: {
                app: podName
            },
            ports: [
                { port: 80, targetPort: port }
            ]
        }
    };
}

function createIngressSpec(podName, host) {

    return {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
            name: podName,
            annotations: {
                "kubernetes.io/ingress.class": "nginx"
            }
        },
        spec: {
            rules: [
                {
                    host: host,
                    "http": {
                        "paths": [
                            {
                                "path": "/",
                                "pathType": "Prefix",
                                "backend": {
                                    "service": {
                                        "name": podName,
                                        "port": {
                                            "number": 80
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            ]
        }
    };
}

// ------------------------------------
// Expressアプリケーションの設定
// ------------------------------------
const app = express();

// セッション設定
app.use(session({
    secret: 'someSecretKey',
    resave: false,
    saveUninitialized: false
}));

// POSTデータ（URLエンコード）をパース
app.use(express.urlencoded({ extended: true }));

// ------------------------------------
// ログイン機能 (超シンプルな例)
// ------------------------------------
const USERNAME = 'admin';
const PASSWORD = 'pass';

// ログインページ
app.get('/login', (req, res) => {
    res.send(`
    <h1>Login</h1>
    <form method="POST" action="/login">
      <div>
        <label>Username: <input type="text" name="username" /></label>
      </div>
      <div>
        <label>Password: <input type="password" name="password" /></label>
      </div>
      <button type="submit">Login</button>
    </form>
  `);
});

// ログイン処理
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === USERNAME && password === PASSWORD) {
        req.session.user = { username };
        return res.redirect('/');
    }
    res.redirect('/login');
});

// ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// 認証チェック用ミドルウェア
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

// ------------------------------------
// Kubernetes API クライアントの初期化
// ------------------------------------
const kc = new KubeConfig();
// (1) ローカル開発で~/.kube/configを使う場合
kc.loadFromDefault();

// (2) Kubernetes内で動かす場合 (ServiceAccount)
// kc.loadFromCluster();

const k8sCore = kc.makeApiClient(CoreV1Api);
const k8sNetApi = kc.makeApiClient(NetworkingV1Api);

// ------------------------------------
// メインページ (ログイン必須)
// ------------------------------------
app.get('/', requireAuth, (req, res) => {
    // デプロイフォームと、Podの一覧へのリンクを表示
    res.send(`
    <h1>Welcome, ${req.session.user.username}</h1>
    <p>Deploy a new MirageX app:</p>
    <form method="POST" action="/deploy">
    <div>
        <input type="text" name="repoUrl" placeholder="GitHubリポジトリURL" required />
    </div>
    <div>
        <label>Env Vars (KEY=VALUE形式、改行区切り):</label><br/>
        <textarea name="envVars" rows="5" cols="30" placeholder="EXAMPLE_API_KEY=12345&#10;ANOTHER_VAR=HelloWorld"></textarea>
    </div>
    <div>
        <textarea name="host" placeholder="hoge.miragex.local"></textarea>
    </div>
    <button type="submit">Deploy</button>
    </form>
    <hr/>
    <p><a href="/pods">View All Pods</a></p>
    <p><a href="/logout">Logout</a></p>
  `);
});

// ------------------------------------
// Podを生成する (POST /deploy)
// ------------------------------------
app.post('/deploy', requireAuth, async (req, res) => {
    const { repoUrl } = req.body;
    const { envVars } = req.body;
    const { host } = req.body;

    const parsedEnv = parseEnvVars(envVars || '');

    try {
        // Pod用マニフェストを作成
        const podManifest = createPodSpec(repoUrl, parsedEnv);
        const serviceManifest = createServiceSpec(podManifest.metadata.name, 3000);
        const ingressManifest = createIngressSpec(podManifest.metadata.name, host)

        const response = await k8sCore.createNamespacedPod({ namespace: 'default', body: podManifest });
        const serviceResponse = await k8sCore.createNamespacedService({ namespace: 'default', body: serviceManifest });
        const ingressResponse = await k8sNetApi.createNamespacedIngress({ namespace: 'default', body: ingressManifest })
        const createdPodName = response.metadata.name;
        res.send(`
      <p>Pod created successfully: <strong>${createdPodName}</strong></p>
      <p>port is ${serviceResponse.spec.ports[0].nodePort}<p>
      <p><a href="/pods">Go to Pods list</a></p>
    `);
    } catch (error) {
        console.error('Error creating Pod:', error);
        res.status(500).send(`Error creating Pod: ${error.message}`);
    }
});

function parseEnvVars(envString) {
    const envObj = {};
    // 1行ごとに分割し、"=" 区切りでキーと値を取り出す
    envString.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return; // 空行スキップ

        // KEY=VALUE の想定だが、VALUE 部分に = が含まれる場合を考慮して分割
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('='); // "=" が複数あっても後ろ全部をつなげる
        if (key) {
            envObj[key] = value;
        }
    });
    return envObj;
}

// ------------------------------------
// Pod 一覧を表示 (GET /pods)
// ------------------------------------
app.get('/pods', requireAuth, async (req, res) => {
    try {
        const podsResponse = await k8sCore.listNamespacedPod({ namespace: 'default' });
        const serviceResponse = await k8sCore.listNamespacedService({ namespace: "default" })
        const ingressResponse = await k8sNetApi.listNamespacedIngress({ namespace: "default" })
        const pods = podsResponse.items;

        let html = `
      <h1>Pod List</h1>
      <p><a href="/">Back to Home</a></p>
      <ul>
    `;

        pods.forEach(pod => {
            const name = pod.metadata.name;
            const phase = pod.status.phase;
            const host = ingressResponse.items.find(i => i.metadata.name === name)?.spec.rules[0].host

            html += `
        <li>
          <strong>${name}  HOST: ${host}</strong> 
          (status: ${phase}) 
          [<a href="/pods/${name}/logs">Logs</a>]
          [<a href="/pods/${name}/delete">Delete</a>]
        </li>
      `;
        });

        html += '</ul>';
        res.send(html);
    } catch (error) {
        console.error('Error listing pods:', error);
        res.status(500).send(`Error listing pods: ${error.message}`);
    }
});

// ------------------------------------
// Pod のログを表示 (GET /pods/:name/logs)
// ------------------------------------
app.get('/pods/:name/logs', requireAuth, async (req, res) => {
    const podName = req.params.name;
    try {
        // initContainerは完了後に終了するので、ログを見たいのはメインコンテナ "node-bot" の想定
        const logsResponse = await k8sCore.readNamespacedPodLog({ namespace: 'default', name: podName, container: 'node-bot' });
        res.set('Content-Type', 'text/plain');
        res.send(logsResponse);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).send(`Error fetching logs: ${error.message}`);
    }
});

// ------------------------------------
// Pod を削除する例 (GET /pods/:name/delete)
// ------------------------------------
app.get('/pods/:name/delete', requireAuth, async (req, res) => {
    const podName = req.params.name;
    try {
        await k8sCore.deleteNamespacedPod({ namespace: 'default', name: podName });
        await k8sCore.deleteNamespacedService({ namespace: "default", name: podName })
        await k8sNetApi.deleteNamespacedIngress({ namespace: "default", name: podName })
        res.redirect('/pods');
    } catch (error) {
        console.error('Error deleting pod:', error);
        res.status(500).send(`Error deleting pod: ${error.message}`);
    }
});

// ------------------------------------
// サーバー起動
// ------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
