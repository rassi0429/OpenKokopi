import express from 'express';
import {KubeConfig, CoreV1Api, NetworkingV1Api} from '@kubernetes/client-node';
import {createPodSpec, createServiceSpec, createIngressSpec} from './k8s/index.js';


const app = express();


// POSTデータ（URLエンコード）をパース
app.use(express.urlencoded({extended: true}));


// ------------------------------------
// Kubernetes API クライアントの初期化
// ------------------------------------
const kc = new KubeConfig();
// (1) ローカル開発で~/.kube/configを使う場合
kc.loadFromDefault()

const k8sCore = kc.makeApiClient(CoreV1Api);
const k8sNetApi = kc.makeApiClient(NetworkingV1Api);

// /api


app.get('/', (req, res) => {
    // デプロイフォームと、Podの一覧へのリンクを表示
    res.send(`
    <h1>Welcome, User</h1>
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


app.post('/deploy', async (req, res) => {
    const {repoUrl} = req.body;
    const {envVars} = req.body;
    const {host} = req.body;

    const parsedEnv = parseEnvVars(envVars || '');

    try {
        // Pod用マニフェストを作成
        const podManifest = createPodSpec(repoUrl, parsedEnv);
        const serviceManifest = createServiceSpec(podManifest.metadata.name, 3000);
        const ingressManifest = createIngressSpec(podManifest.metadata.name, host)

        const response = await k8sCore.createNamespacedPod({namespace: 'default', body: podManifest});
        const serviceResponse = await k8sCore.createNamespacedService({namespace: 'default', body: serviceManifest});
        const ingressResponse = await k8sNetApi.createNamespacedIngress({namespace: 'default', body: ingressManifest})
        const createdPodName = response.metadata?.name;
        res.send(`
      <p>Pod created successfully: <strong>${createdPodName}</strong></p>
      <p><a href="/pods">Go to Pods list</a></p>
    `);
    } catch (error) {
        console.error('Error creating Pod:', error);
        const errorMessage = (error as Error).message;
        res.status(500).send(`Error fetching logs: ${errorMessage}`);
    }
});

function parseEnvVars(envString: string) {
    const envObj: { [key: string]: string } = {};
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


app.get('/pods', async (req, res) => {
    try {
        const podsResponse = await k8sCore.listNamespacedPod({namespace: 'default'});
        const serviceResponse = await k8sCore.listNamespacedService({namespace: "default"})
        const ingressResponse = await k8sNetApi.listNamespacedIngress({namespace: "default"})
        console.log(JSON.stringify(ingressResponse.items, null, 2))
        const pods = podsResponse.items;

        let html = `
      <h1>Pod List</h1>
      <p><a href="/">Back to Home</a></p>
      <ul>
    `;

        pods.forEach(pod => {
            const name = pod.metadata?.name || 'unknown';
            const phase = pod.status?.phase || 'unknown';
            const host = ingressResponse.items.find(i => i.metadata?.name === name)?.spec?.rules?.[0]?.host;

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
        const errorMessage = (error as Error).message;
        res.status(500).send(`Error fetching logs: ${errorMessage}`);
    }
});


app.get('/pods/:name/logs', async (req, res) => {
    const podName = req.params.name;
    try {
        // initContainerは完了後に終了するので、ログを見たいのはメインコンテナ "node-bot" の想定
        const logsResponse = await k8sCore.readNamespacedPodLog({
            namespace: 'default',
            name: podName,
            container: 'node-bot'
        });
        res.set('Content-Type', 'text/plain');
        res.send(logsResponse);
    } catch (error) {
        console.error('Error fetching logs:', error);
        const errorMessage = (error as Error).message;
        res.status(500).send(`Error fetching logs: ${errorMessage}`);
    }
});

app.get('/pods/:name/delete', async (req, res) => {
    const podName = req.params.name;
    try {
        await k8sCore.deleteNamespacedPod({namespace: 'default', name: podName});
        await k8sCore.deleteNamespacedService({namespace: "default", name: podName})
        await k8sNetApi.deleteNamespacedIngress({namespace: "default", name: podName})
        res.redirect('/pods');
    } catch (error) {
        console.error('Error deleting pod:', error);
        const errorMessage = (error as Error).message;
        res.status(500).send(`Error fetching logs: ${errorMessage}`);
    }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
