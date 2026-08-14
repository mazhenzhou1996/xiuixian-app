// 广告解锁 Provider
// 观看激励广告后解锁网盘链接/资源链接。
//
// 接入真实广告（可盈利）的方式：
//  1. 移动 App（推荐，收益最好）：
//     - 穿山甲（字节）激励视频：https://www.csjplatform.com  需企业主体，App 上架
//     - 腾讯优量汇（广点通）激励视频：https://e.qq.com
//     - 快手联盟、百度联盟 同类
//  2. 纯网页 H5：
//     - Google AdSense（海外流量）：https://adsense.google.com  需网站 + 内容审核
//     - 国内 H5 激励广告位一般要求 App 联运或媒体平台白名单，个人网站较难接入激励视频
//  3. 合规要求：网站需 ICP 备案 + 广告内容合规；网盘内资源必须拥有版权或授权，
//     否则即使有广告也会被联盟下架、封号，且涉嫌侵权。
//
// 接入步骤：
//  - 注册广告联盟 → 创建激励视频广告位 → 拿到 appId / adUnitId
//  - 在下方 AD_CONFIG 填入 → 在 AdProvider.play() 里调用对应 SDK
//  - 当前默认 mock 模式：模拟 5 秒广告后解锁，用于联调流程

export type AdMode = 'mock' | 'pangle' | 'gdt' | 'adsense';

export const AD_CONFIG = {
  mode: 'mock' as AdMode,       // 切换真实广告：改为 'pangle' / 'gdt' / 'adsense'
  appId: '',                    // 联盟 App ID
  adUnitId: '',                 // 激励视频广告位 ID
  mockSeconds: 5,               // mock 模式广告时长（秒）
};

/**
 * 播放激励广告。
 * @returns Promise<boolean> 用户完整观看广告返回 true；中途关闭返回 false。
 */
export function playRewardedAd(): Promise<boolean> {
  const { mode, appId, adUnitId, mockSeconds } = AD_CONFIG;
  return new Promise((resolve) => {
    if (mode === 'mock' || !appId || !adUnitId) {
      // ===== Mock 模式：模拟广告播放 =====
      let remain = mockSeconds;
      const fakeAd = () => {
        console.log(`[广告] 模拟激励视频播放中... ${remain}s 后解锁（配置真实广告位后替换）`);
        remain -= 1;
        if (remain <= 0) {
          console.log('[广告] 观看完成，解锁');
          resolve(true);
        } else {
          setTimeout(fakeAd, 1000);
        }
      };
      fakeAd();
      return;
    }
    if (mode === 'adsense') {
      // ===== Google AdSense：网页激励广告 =====
      // 需要引入 AdSense 脚本并在后台配置激励广告位，此处为接入点占位
      // @ts-ignore
      const googletag = (window as any).googletag;
      if (googletag && googletag.defineSlot) {
        // 真实接入时在此调用 googletag 激励广告 API（AdSense 激励广告目前仅部分区域开放）
        console.warn('[广告] AdSense 激励广告位未配置完整，回退 mock');
        setTimeout(() => resolve(true), mockSeconds * 1000);
      } else {
        setTimeout(() => resolve(true), mockSeconds * 1000);
      }
      return;
    }
    // ===== 穿山甲 / 优量汇（App 内 WebView 或小程序场景）=====
    // @ts-ignore
    const sdk = (window as any).PangleRewardedAd || (window as any).RewardedVideoAd;
    if (sdk && typeof sdk.show === 'function') {
      sdk.show({
        appId,
        adUnitId,
        onClose: (completed: boolean) => resolve(!!completed),
        onError: () => resolve(false),
      });
    } else {
      console.warn('[广告] 未检测到 SDK，回退 mock 模式');
      setTimeout(() => resolve(true), mockSeconds * 1000);
    }
  });
}

/** 判断链接是否为网盘类链接（需要广告解锁提示） */
export function isNetdiskUrl(url: string): boolean {
  if (!url) return false;
  return /pan\.(baidu|quark|aliyun|uc)\.|cloud\.189|115\.com|lanzou|蓝奏|夸克|百度网盘|阿里云盘|迅雷/.test(url);
}
