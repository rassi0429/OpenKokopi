import {useRouter} from "next/router";
import {Breadcrumb, Button, Layout, Modal, Typography, Card, Space, Input, Form, message, Spin} from "antd";
import React, {useEffect, useState} from "react";
import {Ingress, Pod} from "@/lib/type";
import {HomeOutlined, ReloadOutlined, SettingOutlined, CloudUploadOutlined} from '@ant-design/icons';

const {Header} = Layout;

const NamespacePage = () => {
  const {query} = useRouter();
  const {namespace} = query;

  const [pods, setPods] = useState<Pod[]>([]);
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [services, setServices] = useState<Ingress[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [logText, setLogText] = useState("");
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isRedeployModalOpen, setIsRedeployModalOpen] = useState(false);
  
  const [envForm] = Form.useForm();
  const [redeployForm] = Form.useForm();

  useEffect(() => {
    fetch(`/api/namespace/${namespace}/pods`)
      .then(res => res.json())
      .then(data => {
        setPods(data);
      })

    fetch(`/api/namespace/${namespace}/ingresses`)
      .then(res => res.json())
      .then(data => {
        setIngresses(data);
      })

    fetch(`/api/namespace/${namespace}/services`)
      .then(res => res.json())
      .then(data => {
        setServices(data);
      })

    fetch(`/api/namespace/${namespace}/deployments`)
      .then(res => res.json())
      .then(data => {
        setDeployments(data);
      })
  }, [namespace]);

  const fetchDeploymentDetails = async (deploymentName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/namespace/${namespace}/deployment/${deploymentName}`);
      const data = await res.json();
      setSelectedDeployment(data);
      
      // Set environment variables in form
      const envVarsString = data.envVars
        .map((env: any) => `${env.name}=${env.value}`)
        .join('\n');
      envForm.setFieldsValue({ envVars: envVarsString });
      
      // Set repository URL in form
      redeployForm.setFieldsValue({ repoUrl: data.repositoryUrl || '' });
    } catch (error) {
      message.error('Failed to fetch deployment details');
    } finally {
      setLoading(false);
    }
  };

  const handleEnvUpdate = async (values: any) => {
    if (!selectedDeployment) return;
    
    setLoading(true);
    try {
      const deploymentName = selectedDeployment.deployment.metadata.name;
      const res = await fetch(`/api/namespace/${namespace}/deployment/${deploymentName}/env`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envVars: values.envVars })
      });
      
      if (res.ok) {
        message.success('Environment variables updated successfully');
        setIsEnvModalOpen(false);
        fetchDeploymentDetails(deploymentName);
      } else {
        throw new Error('Failed to update environment variables');
      }
    } catch (error) {
      message.error('Failed to update environment variables');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (deploymentName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/namespace/${namespace}/deployment/${deploymentName}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        message.success('Deployment restarted successfully');
      } else {
        throw new Error('Failed to restart deployment');
      }
    } catch (error) {
      message.error('Failed to restart deployment');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeploy = async (values: any) => {
    if (!selectedDeployment) return;
    
    setLoading(true);
    try {
      const deploymentName = selectedDeployment.deployment.metadata.name;
      const res = await fetch(`/api/namespace/${namespace}/deployment/${deploymentName}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: values.repoUrl })
      });
      
      if (res.ok) {
        message.success('Deployment redeployed successfully');
        setIsRedeployModalOpen(false);
        fetchDeploymentDetails(deploymentName);
      } else {
        throw new Error('Failed to redeploy');
      }
    } catch (error) {
      message.error('Failed to redeploy');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="App">
      <Modal title="Logs" open={isLogModalOpen} onCancel={() => {
        setIsLogModalOpen(false)
      }}
             footer={(<></>)}
      >
        <pre style={{maxHeight: 300, overflow: 'auto'}}>{logText}</pre>
      </Modal>
      
      <Modal 
        title="Update Environment Variables" 
        open={isEnvModalOpen} 
        onCancel={() => setIsEnvModalOpen(false)}
        footer={null}
      >
        <Form form={envForm} onFinish={handleEnvUpdate} layout="vertical">
          <Form.Item name="envVars" label="Environment Variables (KEY=VALUE format, one per line)">
            <Input.TextArea rows={10} placeholder="NODE_ENV=production&#10;API_KEY=your-key" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update
              </Button>
              <Button onClick={() => setIsEnvModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal 
        title="Redeploy Application" 
        open={isRedeployModalOpen} 
        onCancel={() => setIsRedeployModalOpen(false)}
        footer={null}
      >
        <Form form={redeployForm} onFinish={handleRedeploy} layout="vertical">
          <Form.Item name="repoUrl" label="Repository URL" rules={[{ required: true }]}>
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Redeploy
              </Button>
              <Button onClick={() => setIsRedeployModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
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
          </div>
        </Header>
        <Layout.Content>
          <div style={{padding: 48}}>

            <Breadcrumb
              items={[
                {
                  href: '/',
                  title: <HomeOutlined/>,
                },
                {
                  title: (
                    <>
                      <span>Apps</span>
                    </>
                  ),
                },
                {
                  title: namespace,
                },
              ]}
            />

            <Typography.Title level={2}>Apps</Typography.Title>

            <div style={{marginTop: 24}}>
              {namespace}
              <Button variant={"solid"} color={"danger"} onClick={() => {
                if (window.confirm(`Are you sure to delete ${namespace}?`)) {
                  fetch(`/api/namespace/${namespace}/delete`,{
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  })
                    .then(res => res.json())
                    .then(data => {
                      console.log(data);
                      if (data.message) {
                        alert(data.message);
                        router.push('/');
                      } else if (data.error) {
                        alert(`Error: ${data.error}`);
                      }
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    })
                }
              }}>Delete</Button>
              
              <Typography.Title level={3}>Deployments</Typography.Title>
              <Spin spinning={loading}>
                <div style={{ marginBottom: 24 }}>
                  {deployments.map((deployment) => (
                    <Card 
                      key={deployment.metadata.name} 
                      style={{ marginBottom: 16 }}
                      actions={[
                        <Button 
                          icon={<ReloadOutlined />} 
                          onClick={() => handleRestart(deployment.metadata.name)}
                          loading={loading}
                        >
                          Restart
                        </Button>,
                        <Button 
                          icon={<SettingOutlined />}
                          onClick={() => {
                            fetchDeploymentDetails(deployment.metadata.name);
                            setIsEnvModalOpen(true);
                          }}
                        >
                          Environment
                        </Button>,
                        <Button 
                          icon={<CloudUploadOutlined />}
                          onClick={() => {
                            fetchDeploymentDetails(deployment.metadata.name);
                            setIsRedeployModalOpen(true);
                          }}
                        >
                          Redeploy
                        </Button>
                      ]}
                    >
                      <Card.Meta 
                        title={deployment.metadata.name}
                        description={
                          <Space direction="vertical">
                            <span>Replicas: {deployment.status.replicas || 0} / {deployment.spec.replicas}</span>
                            <span>Available: {deployment.status.availableReplicas || 0}</span>
                          </Space>
                        }
                      />
                    </Card>
                  ))}
                </div>
              </Spin>
              
              <Typography.Title level={3}>Pods</Typography.Title>
              <div>
                {pods.map((pod) => (
                  <div key={pod.metadata.name}>
                    {pod.metadata.name}

                    <Button variant={"solid"} color={"primary"} onClick={() => {
                      setIsLogModalOpen(true);
                      fetch(`/api/namespace/${namespace}/pod/${pod.metadata.name}/log`)
                        .then(res => res.json())
                        .then(data => {
                          setLogText(data.log);
                        })
                    }}>Log</Button>

                  </div>
                ))}
              </div>

              <Typography.Title level={3}>Ingresses</Typography.Title>
              <div>
                {ingresses.map((ingress) => (
                  <div key={ingress.metadata.name}>
                    {ingress.spec.rules[0].host}
                  </div>
                ))}
              </div>

              <Typography.Title level={3}>Services</Typography.Title>
              <div>
                {services.map((service) => (
                  <div key={service.metadata.name}>
                    {service.metadata.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  )
}

export default NamespacePage;
