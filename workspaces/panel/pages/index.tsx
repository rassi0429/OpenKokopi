import React, {useEffect, useState} from 'react';
import {Breadcrumb, Button, Flex, Input, Layout, Modal, Typography, Space, Card, Tag} from 'antd';
import NamespaceCard from "@/Components/namespaceCard";
import {Namespace} from "@/lib/type";
import {HomeOutlined, PlusOutlined, DeleteOutlined} from "@ant-design/icons";
const { TextArea } = Input;

const {Header} = Layout;

const API_LIST_URL = "/api/namespaces"


type PortConfig = {
  containerPort: number;
  name?: string;
  protocol?: 'TCP' | 'UDP';
}

type HostConfig = {
  hostname: string;
  port: number;
  targetPort: number;
  path?: string;
}

const Index = () => {

  const [namespaces, setNameSpaces] = useState<Namespace[]>([]);

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [namespace, setNamespace] = useState("");
  const [deployRepoUrl, setDeployRepoUrl] = useState("");
  const [deployEnvVars, setDeployEnvVars] = useState("");
  const [deployHost, setDeployHost] = useState("");
  
  // New states for multi-port/multi-host
  const [useAdvancedConfig, setUseAdvancedConfig] = useState(false);
  const [ports, setPorts] = useState<PortConfig[]>([{ containerPort: 3000, name: 'http' }]);
  const [hosts, setHosts] = useState<HostConfig[]>([{ hostname: '', port: 80, targetPort: 3000 }]);

  useEffect(() => {
    fetch(API_LIST_URL)
      .then(res => res.json())
      .then(data => {
        setNameSpaces(data);
      })
  }, []);

  const addPort = () => {
    setPorts([...ports, { containerPort: 3000 }]);
  };

  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const updatePort = (index: number, field: keyof PortConfig, value: any) => {
    const newPorts = [...ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setPorts(newPorts);
  };

  const addHost = () => {
    setHosts([...hosts, { hostname: '', port: 80, targetPort: ports[0]?.containerPort || 3000 }]);
  };

  const removeHost = (index: number) => {
    setHosts(hosts.filter((_, i) => i !== index));
  };

  const updateHost = (index: number, field: keyof HostConfig, value: any) => {
    const newHosts = [...hosts];
    newHosts[index] = { ...newHosts[index], [field]: value };
    setHosts(newHosts);
  };


  return (
    <>
      <Modal 
        title="Deploy" 
        open={isDeployModalOpen} 
        onCancel={() => {
          setIsDeployModalOpen(false);
          setUseAdvancedConfig(false);
          setPorts([{ containerPort: 3000, name: 'http' }]);
          setHosts([{ hostname: '', port: 80, targetPort: 3000 }]);
        }} 
        footer={(<></>)}
        width={800}
      >
        <Flex vertical gap={10}>
          <Input type="text" placeholder="namespace" value={namespace} onChange={(e) => setNamespace(e.target.value)}/>
          <Input type="text" placeholder="Repository URL" value={deployRepoUrl} onChange={(e) => setDeployRepoUrl(e.target.value)}/>
          <TextArea placeholder="Environment Variables" value={deployEnvVars} onChange={(e) => setDeployEnvVars(e.target.value)}/>
          
          <Button 
            type="link" 
            onClick={() => setUseAdvancedConfig(!useAdvancedConfig)}
          >
            {useAdvancedConfig ? 'Use Simple Configuration' : 'Use Advanced Configuration (Multiple Ports/Hosts)'}
          </Button>

          {!useAdvancedConfig ? (
            <Input type="text" placeholder="Host" value={deployHost} onChange={(e) => setDeployHost(e.target.value)}/>
          ) : (
            <>
              <Card title="Ports Configuration" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {ports.map((port, index) => (
                    <Space key={index} style={{ width: '100%' }}>
                      <Input
                        type="number"
                        placeholder="Container Port"
                        value={port.containerPort}
                        onChange={(e) => updatePort(index, 'containerPort', parseInt(e.target.value) || 0)}
                        style={{ width: 150 }}
                      />
                      <Input
                        placeholder="Name (optional)"
                        value={port.name || ''}
                        onChange={(e) => updatePort(index, 'name', e.target.value)}
                        style={{ width: 150 }}
                      />
                      <select
                        value={port.protocol || 'TCP'}
                        onChange={(e) => updatePort(index, 'protocol', e.target.value as 'TCP' | 'UDP')}
                        style={{ 
                          width: 80,
                          padding: '4px 8px',
                          border: '1px solid #d9d9d9',
                          borderRadius: '6px',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                      </select>
                      <Button
                        icon={<DeleteOutlined />}
                        onClick={() => removePort(index)}
                        disabled={ports.length === 1}
                        danger
                      />
                    </Space>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={addPort}>Add Port</Button>
                </Space>
              </Card>

              <Card title="Hosts Configuration" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {hosts.map((host, index) => (
                    <Space key={index} style={{ width: '100%' }}>
                      <Input
                        placeholder="Hostname"
                        value={host.hostname}
                        onChange={(e) => updateHost(index, 'hostname', e.target.value)}
                        style={{ width: 200 }}
                      />
                      <Input
                        placeholder="Path (optional)"
                        value={host.path || '/'}
                        onChange={(e) => updateHost(index, 'path', e.target.value)}
                        style={{ width: 100 }}
                      />
                      <select
                        value={host.targetPort}
                        onChange={(e) => updateHost(index, 'targetPort', parseInt(e.target.value))}
                        style={{ 
                          width: 150,
                          padding: '4px 8px',
                          border: '1px solid #d9d9d9',
                          borderRadius: '6px',
                          backgroundColor: 'white'
                        }}
                      >
                        {ports.map((port, pIndex) => (
                          <option key={pIndex} value={port.containerPort}>
                            Port {port.containerPort} {port.name ? `(${port.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <Button
                        icon={<DeleteOutlined />}
                        onClick={() => removeHost(index)}
                        disabled={hosts.length === 1}
                        danger
                      />
                    </Space>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={addHost}>Add Host</Button>
                </Space>
              </Card>
            </>
          )}

          <Button type="primary" onClick={() => {
            const body: any = {
              namespace,
              repoUrl: deployRepoUrl,
              envVars: deployEnvVars,
            };

            if (useAdvancedConfig) {
              body.ports = ports;
              body.hosts = hosts.filter(h => h.hostname); // Only send hosts with hostname
            } else {
              body.host = deployHost;
            }

            fetch("/api/deploy", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            }).then(res => res.json())
              .then(data => {
                console.log(data);
                if (data.error) {
                  alert(`Error: ${data.error}`);
                } else if (data.message) {
                  alert(`Success: ${data.message}`);
                  setIsDeployModalOpen(false);
                  // Reset form
                  setNamespace("");
                  setDeployRepoUrl("");
                  setDeployEnvVars("");
                  setDeployHost("");
                  setUseAdvancedConfig(false);
                  setPorts([{ containerPort: 3000, name: 'http' }]);
                  setHosts([{ hostname: '', port: 80, targetPort: 3000 }]);
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                }
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
                  }
                ]}
              />
              <Typography.Title level={2}>Apps</Typography.Title>
              <div>
                {namespaces.map(ns => (
                  <NamespaceCard namespace={ns.metadata.name} key={ns.metadata.name}/>
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
