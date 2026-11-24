# yuanbing for Android 4.7 安装与使用

## 安装

1. 把 `yuanbing-for-Android-v4.7.apk` 传到手机，或执行：
   `adb install -r yuanbing-for-Android-v4.7.apk`
2. （推荐）设为默认桌面：
   `adb shell cmd package set-home-activity com.emotionball.desk/.MainActivity`
   也可以在系统设置里把默认桌面改成 yuanbing for Android。
3. 打开 App，横屏放在支架上即可。App 不联网、不依赖电脑也能运行。

## 打开控制台

- 本机：左上角 120dp 内 3 秒连点 6 下 → 菜单 → 打开控制台（本机）。
- 同一 Wi-Fi 的电脑/手机：在菜单里看完整地址，形如
  `http://192.168.x.x:8765/t/<随机 token>/`
  根地址不带 token 会返回 403。

## 换手机 / 备份

控制台底部「导出配置」会下载一个 JSON（内含已上传的图片和音效）；
新手机安装后，「导入配置」选择这个 JSON 即可恢复。

## 注意

- 部分 ROM 重启后可能显示滑动锁屏，向上滑一次即可。
- 控制台只适合可信局域网，不要把 8765 映射到公网。
- 本项目为非商业衍生作品，许可见 LICENSE / NOTICE.md。
