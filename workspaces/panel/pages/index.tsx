import React from 'react';
import {Button, Layout, Menu, Typography} from 'antd';

const {Header, Content, Footer} = Layout;


const Index = () => {


  return (
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
            <Button type="primary" size={"large"}>Deploy</Button>
          </div>
        </Header>
      </Layout>
    </div>
  );
}

export default Index;
