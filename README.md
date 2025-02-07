# OpenKokopi
HelokuライクなPaaS OSS

自鯖のDiscordBotを作るのにCIでイメージなんて作りたくない！
kubernetesを基盤として、Webコントロールパネルで簡単にアプリケーションをデプロイできます。

## 構築
Kubernetes環境をご用意ください。

nginx-ingressが必要です。
```
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/static/provider/cloud/deploy.yaml
```


```
kubectl apply -f k8s.yml
```