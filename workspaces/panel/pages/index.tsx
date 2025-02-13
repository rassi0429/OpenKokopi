import React from 'react';
import {Button, Layout, Menu} from 'antd';

const {Header, Content, Footer} = Layout;


const Index = () => {
    return (
        <div className="App">
            <Layout>
                <Header style={{display: 'flex', alignItems: 'center'}}>
                    <div className="demo-logo"/>
                    <Button type="primary">Button</Button>
                </Header>
            </Layout>
        </div>
    );
}

export default Index;
