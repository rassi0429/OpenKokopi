import express from "express";
import {parseEnvVars} from "../lib/utils.js";
import {KubeConfig, CoreV1Api, NetworkingV1Api, AppsV1Api} from '@kubernetes/client-node';
import {
  createServiceSpec,
  createIngressSpec,
  createNamespaceSpec,
  createDeploymentSpec,
  type PortConfig,
  type HostConfig
} from '../lib/k8s/index.js';


const router = express.Router();


// Kubernetes API クライアントの初期化
const kc = new KubeConfig();
// (1) ローカル開発で~/.kube/configを使う場合
kc.loadFromDefault()

const k8sApps = kc.makeApiClient(AppsV1Api);
const k8sCore = kc.makeApiClient(CoreV1Api);
const k8sNetApi = kc.makeApiClient(NetworkingV1Api);

// "/api"

router.get("/", (req, res) => {
  res.send("Hello from API");
});

router.post("/deploy", async (req, res) => {
  const {namespace, repoUrl, envVars} = req.body;
  const ports: PortConfig[] = req.body.ports;
  const hosts: HostConfig[] = req.body.hosts;
  const legacyHost: string = req.body.host; // For backward compatibility

  const parsedEnv = parseEnvVars(envVars || '');
  
  // Default ports if not provided (backward compatibility)
  const portConfigs: PortConfig[] = ports || [{ containerPort: 3000, name: 'http' }];
  const hostConfigs: HostConfig[] = hosts || (legacyHost ? [{ hostname: legacyHost, port: 80, targetPort: 3000 }] : []);

  try {
    // Check if any hostname is already in use across all namespaces BEFORE creating anything
    const allIngresses = await k8sNetApi.listIngressForAllNamespaces();
    const hostsInUse = hostConfigs.filter(hostConfig =>
      allIngresses.items.some(ingress => 
        ingress.spec?.rules?.some(rule => rule.host === hostConfig.hostname)
      )
    );
    
    if (hostsInUse.length > 0) {
      return res.status(400).json({
        error: `Following hostnames are already in use: ${hostsInUse.map(h => h.hostname).join(', ')}`
      });
    }

    const k8sNamespace = createNamespaceSpec(namespace, {
      repositoryUrl: repoUrl.replace(/https?:\/\//, '').replace(/\//g, '_'),
      deployEnvVars: "not_implemented",
      deployUser: "admin"
    })
    await k8sCore.createNamespace({body: k8sNamespace})

    // Pod用マニフェストを作成
    const deployManifest = createDeploymentSpec(repoUrl, parsedEnv, portConfigs, 1, namespace);
    const serviceManifest = createServiceSpec(deployManifest.metadata.name, portConfigs, namespace);
    const ingressManifest = createIngressSpec(deployManifest.metadata.name, hostConfigs, namespace)
    
    const deployment = await k8sApps.createNamespacedDeployment({namespace: namespace, body: deployManifest});
    const serviceResponse = await k8sCore.createNamespacedService({namespace: namespace, body: serviceManifest});
    const ingressResponse = await k8sNetApi.createNamespacedIngress({namespace: namespace, body: ingressManifest})
    const createdPodName = deployment.metadata?.name;
    res.json({
      message: `Deployment ${createdPodName} created successfully`,
      podName: createdPodName,
    })
  } catch (error) {
    console.error('Error creating Pod:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get('/namespaces', async (req, res) => {
  try {
    const namespacesResponse = await k8sCore.listNamespace({labelSelector: 'openKokopiManaged=true'});
    res.json(namespacesResponse.items)
  } catch (error) {
    console.error('Error listing pods:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
});

router.get("/namespace/:namespace/pods", async (req, res) => {
  const namespace = req.params.namespace;
  try {
    const podsResponse = await k8sCore.listNamespacedPod({namespace: namespace});
    res.json(podsResponse.items);
  } catch (error) {
    console.error('Error listing pods:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/pod/:podname" , async (req, res) => {
  const namespace = req.params.namespace;
  const podName = req.params.podname;
  try {
    const podResponse = await k8sCore.readNamespacedPod({namespace: namespace, name: podName});
    res.json(podResponse);
  } catch (error) {
    console.error('Error fetching pod:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/pod/:podname/log", async (req, res) => {
  const namespace = req.params.namespace;
  const podName = req.params.podname;
  try {
    const logsResponse = await k8sCore.readNamespacedPodLog({namespace: namespace, name: podName});
    res.json({log: logsResponse});
  } catch (error) {
    console.error('Error fetching logs:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/services", async (req, res) => {
  const namespace = req.params.namespace;
  try {
    const servicesResponse = await k8sCore.listNamespacedService({namespace: namespace});
    res.json(servicesResponse.items);
  } catch (error) {
    console.error('Error listing services:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/ingresses", async (req, res) => {
  const namespace = req.params.namespace;
  try {
    const ingressesResponse = await k8sNetApi.listNamespacedIngress({namespace: namespace});
    res.json(ingressesResponse.items);
  } catch (error) {
    console.error('Error listing ingresses:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.post("/namespace/:namespace/delete", async (req, res) => {
  const namespace = req.params.namespace;
  try {
    // Check if namespace exists first
    try {
      await k8sCore.readNamespace({name: namespace});
    } catch (readError: any) {
      if (readError.statusCode === 404) {
        return res.status(404).json({error: `Namespace ${namespace} not found`});
      }
      throw readError;
    }
    
    // Delete the namespace
    await k8sCore.deleteNamespace({name: namespace});
    
    // Wait for namespace to start terminating (up to 5 seconds)
    let isTerminating = false;
    for (let i = 0; i < 10; i++) {
      try {
        const ns = await k8sCore.readNamespace({name: namespace});
        if (ns.status?.phase === 'Terminating') {
          isTerminating = true;
          break;
        }
      } catch (error: any) {
        if (error.statusCode === 404) {
          // Namespace already deleted
          isTerminating = true;
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    res.json({
      message: `Namespace ${namespace} deletion initiated`,
      status: isTerminating ? 'terminating' : 'pending'
    });
  } catch (error) {
    console.error('Error deleting namespace:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/deployments", async (req, res) => {
  const namespace = req.params.namespace;
  try {
    const deploymentsResponse = await k8sApps.listNamespacedDeployment({namespace: namespace});
    res.json(deploymentsResponse.items);
  } catch (error) {
    console.error('Error listing deployments:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.get("/namespace/:namespace/deployment/:deploymentName", async (req, res) => {
  const namespace = req.params.namespace;
  const deploymentName = req.params.deploymentName;
  try {
    const deployment = await k8sApps.readNamespacedDeployment({
      namespace: namespace,
      name: deploymentName
    });
    
    // Extract environment variables from deployment spec
    const container = deployment.spec?.template?.spec?.containers?.[0];
    const envVars = container?.env || [];
    
    // Get namespace metadata for repository URL
    const namespaceData = await k8sCore.readNamespace({name: namespace});
    const repositoryUrl = namespaceData.metadata?.labels?.repositoryUrl?.replace(/_/g, '/');
    
    res.json({
      deployment: deployment,
      envVars: envVars,
      repositoryUrl: repositoryUrl ? `https://${repositoryUrl}` : null
    });
  } catch (error) {
    console.error('Error fetching deployment:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.patch("/namespace/:namespace/deployment/:deploymentName/env", async (req, res) => {
  const namespace = req.params.namespace;
  const deploymentName = req.params.deploymentName;
  const {envVars} = req.body;
  
  try {
    const parsedEnv = parseEnvVars(envVars || '');
    const envArray = Object.entries(parsedEnv).map(([key, value]) => ({
      name: key,
      value: String(value)
    }));
    
    // Get current deployment
    const deployment = await k8sApps.readNamespacedDeployment({
      namespace: namespace,
      name: deploymentName
    });
    
    // Update environment variables
    if (deployment.spec?.template?.spec?.containers?.[0]) {
      deployment.spec.template.spec.containers[0].env = envArray;
    }
    
    // Apply the update
    const updatedDeployment = await k8sApps.replaceNamespacedDeployment({
      namespace: namespace,
      name: deploymentName,
      body: deployment
    });
    
    res.json({
      message: `Environment variables updated for deployment ${deploymentName}`,
      deployment: updatedDeployment
    });
  } catch (error) {
    console.error('Error updating deployment environment:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.post("/namespace/:namespace/deployment/:deploymentName/restart", async (req, res) => {
  const namespace = req.params.namespace;
  const deploymentName = req.params.deploymentName;
  
  try {
    // Get current deployment
    const deployment = await k8sApps.readNamespacedDeployment({
      namespace: namespace,
      name: deploymentName
    });
    
    // Update deployment with restart annotation
    if (!deployment.spec?.template?.metadata?.annotations) {
      deployment.spec!.template!.metadata = deployment.spec!.template!.metadata || {};
      deployment.spec!.template!.metadata.annotations = {};
    }
    deployment.spec!.template!.metadata!.annotations!['kubectl.kubernetes.io/restartedAt'] = new Date().toISOString();
    
    // Apply the update
    const updatedDeployment = await k8sApps.replaceNamespacedDeployment({
      namespace: namespace,
      name: deploymentName,
      body: deployment
    });
    
    res.json({
      message: `Deployment ${deploymentName} restarted successfully`,
      deployment: updatedDeployment
    });
  } catch (error) {
    console.error('Error restarting deployment:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

router.post("/namespace/:namespace/deployment/:deploymentName/redeploy", async (req, res) => {
  const namespace = req.params.namespace;
  const deploymentName = req.params.deploymentName;
  const {repoUrl} = req.body;
  
  try {
    // Get current deployment
    const deployment = await k8sApps.readNamespacedDeployment({
      namespace: namespace,
      name: deploymentName
    });
    
    // Update git repository URL in init container
    const initContainers = deployment.spec?.template?.spec?.initContainers;
    if (initContainers && initContainers.length > 0) {
      const gitCloneContainer = initContainers.find(c => c.name === 'git-clone');
      if (gitCloneContainer) {
        gitCloneContainer.args = [`git clone ${repoUrl} /app`];
      }
    }
    
    // Force restart by updating annotation
    if (!deployment.spec?.template?.metadata?.annotations) {
      deployment.spec!.template!.metadata = deployment.spec!.template!.metadata || {};
      deployment.spec!.template!.metadata.annotations = {};
    }
    deployment.spec!.template!.metadata!.annotations!['kubectl.kubernetes.io/restartedAt'] = new Date().toISOString();
    
    // Update namespace label with new repository URL
    const namespaceData = await k8sCore.readNamespace({name: namespace});
    if (namespaceData.metadata?.labels) {
      namespaceData.metadata.labels.repositoryUrl = repoUrl.replace(/https?:\/\//, '').replace(/\//g, '_');
      await k8sCore.replaceNamespace({name: namespace, body: namespaceData});
    }
    
    // Apply the deployment update
    const updatedDeployment = await k8sApps.replaceNamespacedDeployment({
      namespace: namespace,
      name: deploymentName,
      body: deployment
    });
    
    res.json({
      message: `Deployment ${deploymentName} redeployed with new repository`,
      deployment: updatedDeployment
    });
  } catch (error) {
    console.error('Error redeploying:', error);
    const errorMessage = (error as Error).message;
    res.status(500).json({error: errorMessage});
  }
})

export default router;
