import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xiuixian.app',
  appName: '修仙问答',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    // 本地联调时放开；生产构建使用打包后的静态资源，无需远程地址
    // url: 'https://xiuixian-app-wk2fm3y5.edgeone.cool',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
