import type {AppProps} from "next/app";
import {ConfigProvider} from 'antd';

import 'antd/dist/reset.css';
import theme from '@/theme/themeConfig';

const App = ({Component, pageProps}: AppProps) => {
    return (
        <ConfigProvider theme={theme}>
            <Component {...pageProps} />
        </ConfigProvider>
    );
}

export default App;
