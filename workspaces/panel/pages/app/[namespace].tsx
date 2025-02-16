import {useRouter} from "next/router";
import {Breadcrumb, Button, Layout, Modal, Typography} from "antd";
import React, {useEffect, useState} from "react";
import {Ingress, Pod} from "@/lib/type";
import {HomeOutlined} from '@ant-design/icons';

const {Header} = Layout;

const NamespacePage = () => {
  const {query} = useRouter();
  const {namespace} = query;

  const [pods, setPods] = useState<Pod[]>([]);
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [services, setServices] = useState<Ingress[]>([]);

  const [logText, setLogText] = useState("");
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

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
  }, [namespace]);


  return (
    <div className="App">
      <Modal title="Basic Modal" open={isLogModalOpen} onCancel={() => {
        setIsLogModalOpen(false)
      }}
             footer={(<></>)}
      >
        <pre style={{maxHeight: 300}}>{logText}</pre>
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
                      // TODO 本当はバックエンドが削除を待つ必要がある
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    })
                }
              }}>Delete</Button>
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
