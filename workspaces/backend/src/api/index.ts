import express from "express";
import {parseEnvVars} from "../lib/utils.js";
import {KubeConfig, CoreV1Api, NetworkingV1Api} from '@kubernetes/client-node';
import {createPodSpec, createServiceSpec, createIngressSpec} from '../lib/k8s/index.js';


const router = express.Router();


// Kubernetes API クライアントの初期化
const kc = new KubeConfig();
// (1) ローカル開発で~/.kube/configを使う場合
kc.loadFromDefault()

const k8sCore = kc.makeApiClient(CoreV1Api);
const k8sNetApi = kc.makeApiClient(NetworkingV1Api);

// "/api"

router.get("/", (req, res) => {
    res.send("Hello from API");
});

router.post("/deploy", async (req, res) => {
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
        res.json({
            message: `Pod ${createdPodName} created successfully`,
            podName: createdPodName,
        })
    } catch (error) {
        console.error('Error creating Pod:', error);
        const errorMessage = (error as Error).message;
        res.status(500).json({error: errorMessage});
    }
})


router.get('/pods', async (req, res) => {
    try {
        const podsResponse = await k8sCore.listNamespacedPod({namespace: 'default'});
        const serviceResponse = await k8sCore.listNamespacedService({namespace: "default"})
        const ingressResponse = await k8sNetApi.listNamespacedIngress({namespace: "default"})

        const pods = podsResponse.items;

        res.json({
            pods: pods.map(pod => ({
                name: pod.metadata?.name,
                status: pod.status?.phase,
                service: serviceResponse.items.find(service => service.metadata?.name === pod.metadata?.name),
                ingress: ingressResponse.items.find(ingress => ingress.metadata?.name === pod.metadata?.name)
            }))
        })
    } catch (error) {
        console.error('Error listing pods:', error);
        const errorMessage = (error as Error).message;
        res.status(500).json({error: errorMessage});
    }
});

router.get('/pods/:name/logs', async (req, res) => {
    const podName = req.params.name;
    try {
        // initContainerは完了後に終了するので、ログを見たいのはメインコンテナ "node-bot" の想定
        const logsResponse = await k8sCore.readNamespacedPodLog({
            namespace: 'default',
            name: podName,
            container: 'node-bot'
        });
        res.json({log:logsResponse});
    } catch (error) {
        console.error('Error fetching logs:', error);
        const errorMessage = (error as Error).message;
        res.status(500).json({error: errorMessage});
    }
});

router.get('/pods/:name/delete', async (req, res) => {
    const podName = req.params.name;
    try {
        await k8sCore.deleteNamespacedPod({namespace: 'default', name: podName});
        await k8sCore.deleteNamespacedService({namespace: "default", name: podName})
        await k8sNetApi.deleteNamespacedIngress({namespace: "default", name: podName})
        res.json({message: `Pod ${podName} deleted successfully`});
    } catch (error) {
        console.error('Error deleting pod:', error);
        const errorMessage = (error as Error).message;
        res.status(500).json({error: errorMessage});
    }
});

export default router;
