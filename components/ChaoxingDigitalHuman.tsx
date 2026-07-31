"use client";

import Script from "next/script";

const sdkUrl = "https://robot.chaoxing.com/sdk/CxRobotSdkJs.js";
const robotUrl =
  "https://robot.chaoxing.com/embedChat?unitId=1275&robotId=53b6aaebaaf5447f9c040aa5aab640e5&groupId=0&openType=auto&openPage=coze";
const robotKey = "926687868f71c0a4050fb5ff711fde7b";

declare global {
  interface Window {
    CxRobotSdkJs?: {
      init: (url: string, key: string) => void;
    };
    __chaoxingDigitalHumanReady?: boolean;
  }
}

export default function ChaoxingDigitalHuman() {
  function initDigitalHuman() {
    if (window.__chaoxingDigitalHumanReady || !window.CxRobotSdkJs) return;
    window.CxRobotSdkJs.init(robotUrl, robotKey);
    window.__chaoxingDigitalHumanReady = true;
  }

  return (
    <Script
      id="chaoxing-digital-human-sdk"
      src={sdkUrl}
      strategy="afterInteractive"
      onLoad={initDigitalHuman}
      onReady={initDigitalHuman}
    />
  );
}
