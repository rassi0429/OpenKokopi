export const parseEnvVars = (envString: string) => {
    const envObj: { [key: string]: string } = {};
    // 1行ごとに分割し、"=" 区切りでキーと値を取り出す
    envString.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return; // 空行スキップ

        // KEY=VALUE の想定だが、VALUE 部分に = が含まれる場合を考慮して分割
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('='); // "=" が複数あっても後ろ全部をつなげる
        if (key) {
            envObj[key] = value;
        }
    });
    return envObj;
}
