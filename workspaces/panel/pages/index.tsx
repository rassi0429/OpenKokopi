import React, {useEffect, useState} from 'react';
import {Button, Card, Flex, Input, Layout, Modal, Tag, Typography} from 'antd';
import TextArea from "antd/es/input/TextArea";

const {Header} = Layout;

const API_LIST_URL = "/api/pods"

type Pod = {
  name: string;
  status: string;
  service: string;
  ingress: unknown;
}

const Index = () => {

  const [pods, setPods] = useState<Pod[]>([]);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployRepoUrl, setDeployRepoUrl] = useState("");
  const [deployEnvVars, setDeployEnvVars] = useState("");
  const [deployHost, setDeployHost] = useState("");

  useEffect(() => {
    fetch(API_LIST_URL)
      .then(res => res.json())
      .then(data => {
        setPods(data.pods);
      })
  }, []);


  return (
    <>
      <Modal title="Basic Modal" open={isLogModalOpen} onCancel={() => {
        setIsLogModalOpen(false)
      }}
             footer={(<></>)}
      >
        <pre style={{maxHeight: 300}}>{logText}</pre>
      </Modal>
      <Modal title="Deploy" open={isDeployModalOpen} onCancel={() => {
        setIsDeployModalOpen(false)
      }} footer={(<></>)}>
        <Flex vertical gap={10}>
          <Input type="text" placeholder="Repository URL" value={deployRepoUrl} onChange={(e) => setDeployRepoUrl(e.target.value)}/>
          <TextArea placeholder="Environment Variables" value={deployEnvVars} onChange={(e) => setDeployEnvVars(e.target.value)}/>
          <Input type="text" placeholder="Host" value={deployHost} onChange={(e) => setDeployHost(e.target.value)}/>
          <Button onClick={() => {
            fetch("/api/deploy", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                repoUrl: deployRepoUrl,
                envVars: deployEnvVars,
                host: deployHost
              })
            }).then(res => res.json())
              .then(data => {
                console.log(data);
                setTimeout(() => {
                  window.location.reload();
                }, 1000)
          })}}>Deploy</Button>
        </Flex>
      </Modal>
      <div className="App">
        <Layout>
          <Header>
            <div style={{
              height: "100%",
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Typography.Title level={3} style={{color: 'white', margin: 0}}>OpenKokopi Panel</Typography.Title>
              <Button type="primary" size={"large"} onClick={() => setIsDeployModalOpen(true)}>Deploy</Button>
            </div>
          </Header>
          <Layout.Content>
            <div style={{padding: 24}}>
              <Typography.Title level={2}>Apps</Typography.Title>
              <div>
                {pods.map(pod => (
                  <Card key={pod.name}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      gap: 10
                    }}>
                      <div>
                        <Typography.Text>{pod.name}</Typography.Text>
                      </div>
                      {
                        // @ts-expect-error wip
                        pod.ingress?.spec?.rules?.[0]?.host ? (
                          <Tag color="green">
                            {/* @ts-expect-error wip */}
                            {pod.ingress?.spec?.rules?.[0]?.host}
                          </Tag>
                        ) : (<></>)
                      }
                      <div style={{marginLeft: "auto"}}>
                        <Typography.Text>{pod.status}</Typography.Text>
                      </div>
                      <Button variant={"solid"} color={"primary"} onClick={() => {
                        setIsLogModalOpen(true);
                        fetch(`/api/pods/${pod.name}/logs`)
                          .then(res => res.json())
                          .then(data => {
                            setLogText(data.log);
                          })
                      }}>Log</Button>
                      <Button variant={"solid"} color={"danger"} onClick={() => {
                        if (window.confirm(`Are you sure to delete ${pod.name}?`)) {
                          fetch(`/api/pods/${pod.name}/delete`)
                            .then(res => res.json())
                            .then(data => {
                              console.log(data);
                              // TODO 本当はバックエンドが削除を待つ必要がある
                              setTimeout(() => {
                                window.location.reload();
                              }, 1000);
                            })
                        }
                      }}>Delete</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Layout.Content>
        </Layout>
      </div>
    </>
  );
}

export default Index;
