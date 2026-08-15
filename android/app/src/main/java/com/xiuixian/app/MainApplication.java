package com.xiuixian.app;

import com.getcapacitor.BridgeApplication;

/**
 * Capacitor 应用入口（必需）。
 * 继承 BridgeApplication 以正确初始化插件生命周期回调（推送/存储/深链等插件依赖 Application 上下文）。
 * 缺失此类时 Gradle 虽能用默认 Application 编出 APK，但部分插件运行期会异常。
 */
public class MainApplication extends BridgeApplication {}
