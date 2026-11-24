package com.emotionball.desk;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Rect;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.util.Log;
import android.view.DisplayCutout;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * yuanbing for Android —— 全屏 WebView 桌搭外壳。
 * 只做四件事:全屏常亮、加载本地表情页面、把点击交给网页、留一个隐藏出口。
 * 不改系统分区,不 root,安装/卸载都只是普通应用。
 */
public class MainActivity extends Activity implements SensorEventListener {

    private WebView web;
    private KeyguardManager.KeyguardLock keyguardLock;
    private ConfigServer server;
    private SensorManager sensors;
    private Sensor accelerometer;
    private final float[] accel = new float[] {0f, 0f, 0f};
    private long accelAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        /* 桌搭要像一块表:息屏再亮、重启之后都直接显示,不要停在滑动锁屏 */
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
        }
        /* 非安全锁屏允许直接关掉,开机后不用先滑一下;安全锁屏会失败,失败也不影响使用 */
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km != null) {
            try {
                keyguardLock = km.newKeyguardLock("emotionball-desk");
                keyguardLock.disableKeyguard();
            } catch (Exception ignored) {
            }
        }
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        /* 屏幕亮度压到 45%,夜里不刺眼,也能减缓 OLED 老化 */
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = 0.45f;
        if (Build.VERSION.SDK_INT >= 28) {
            /* 6T 有刘海:默认会为了避开刘海把窗口内缩,导致触点和画面错位 */
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        getWindow().setAttributes(lp);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHorizontalScrollBarEnabled(false);
        web.setVerticalScrollBarEnabled(false);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("EBWEB", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= 19) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        web.addJavascriptInterface(new Bridge(), "Native");

        setContentView(web);
        hideSystemUi();
        installNativeExitGesture();
        startConfigServer();

        sensors = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensors != null) {
            accelerometer = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (accelerometer != null) {
                sensors.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
            }
        }

        web.loadUrl("file:///android_asset/index.html");
    }

    private long lastCornerTap = 0;
    private int cornerTapCount = 0;

    /**
     * 原生兜底出口:即使网页脚本整个挂掉,左上角 6 连击也能回到系统桌面/设置。
     * 监听器返回 false,点击照常传给 WebView,不影响戳表情。
     */
    private void installNativeExitGesture() {
        final float corner = 120f * getResources().getDisplayMetrics().density;
        web.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    if (e.getX() < corner && e.getY() < corner) {
                        long now = System.currentTimeMillis();
                        if (now - lastCornerTap > 3000) cornerTapCount = 0;
                        lastCornerTap = now;
                        cornerTapCount++;
                        if (cornerTapCount >= 6) {
                            cornerTapCount = 0;
                            showDeskMenu();
                        }
                    } else {
                        cornerTapCount = 0;
                    }
                }
                return false;
            }
        });
    }

    private void hideSystemUi() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (keyguardLock != null) {
            try {
                keyguardLock.disableKeyguard();
            } catch (Exception ignored) {
            }
        }
        if (Build.VERSION.SDK_INT >= 26) {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                km.requestDismissKeyguard(this, null);
            }
        }
        if (web != null && server != null) {
            String cfg = server.getConfig();
            if (cfg != null && cfg.length() > 2) {
                web.evaluateJavascript("window.DeskConfig&&DeskConfig.apply(" + cfg + ")", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        /* 桌面模式里 Back 不退出;要退出用左上角连点 6 次 */
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor != null && event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            synchronized (accel) {
                accel[0] = event.values[0];
                accel[1] = event.values[1];
                accel[2] = event.values[2];
            }
            accelAt = System.currentTimeMillis();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    @Override
    protected void onDestroy() {
        if (sensors != null) {
            try {
                sensors.unregisterListener(this);
            } catch (Exception ignored) {
            }
            sensors = null;
        }
        if (keyguardLock != null) {
            try {
                keyguardLock.reenableKeyguard();
            } catch (Exception ignored) {
            }
            keyguardLock = null;
        }
        if (web != null) {
            web.removeJavascriptInterface("Native");
            web.destroy();
            web = null;
        }
        if (server != null) {
            server.stop();
            server = null;
        }
        super.onDestroy();
    }

    /** 网页里唯一需要的原生能力:退出到系统桌面 */
    private class Bridge {
        @JavascriptInterface
        public void exitKiosk() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    launchSystemHome();
                }
            });
        }

        @JavascriptInterface
        public void setBrightness(float v) {
            final float value = Math.max(0.05f, Math.min(1f, v));
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    WindowManager.LayoutParams lp = getWindow().getAttributes();
                    lp.screenBrightness = value;
                    getWindow().setAttributes(lp);
                }
            });
        }

        @JavascriptInterface
        public String info() {
            return "emotionball-desk/1.0";
        }

        /* 电量: "百分比,是否充电(1/0)" */
        @JavascriptInterface
        public String battery() {
            try {
                Intent b = registerReceiver(null,
                        new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if (b != null) {
                    int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                    int status = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    int pct = scale > 0 ? Math.round(level * 100f / scale) : level;
                    boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                            || status == BatteryManager.BATTERY_STATUS_FULL;
                    return pct + "," + (charging ? 1 : 0);
                }
            } catch (Exception ignored) {
            }
            return "0,0";
        }

        /* 加速度计: "x,y,z"，取不到时返回 0,0,0 */
        @JavascriptInterface
        public String motion() {
            if (System.currentTimeMillis() - accelAt > 2000) return "0,0,0";
            synchronized (accel) {
                return Math.round(accel[0] * 100) / 100.0 + ","
                        + Math.round(accel[1] * 100) / 100.0 + ","
                        + Math.round(accel[2] * 100) / 100.0;
            }
        }

        /* 明信片: 截当前 WebView 一帧，存到 filesDir，返回 /media/ 地址 */
        @JavascriptInterface
        public String snapshot() {
            return captureSnapshot();
        }

        /**
         * 刘海安全区，单位是设备像素：left,top,right,bottom,density。
         * 网页按 density 换算成 CSS 像素，球就不会跑到刘海下面。
         */
        @JavascriptInterface
        public String cutout() {
            float density = getResources().getDisplayMetrics().density;
            try {
                if (Build.VERSION.SDK_INT >= 28) {
                    WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                    if (insets != null) {
                        DisplayCutout dc = insets.getDisplayCutout();
                        if (dc != null) {
                            int l = dc.getSafeInsetLeft();
                            int t = dc.getSafeInsetTop();
                            int r = dc.getSafeInsetRight();
                            int b = dc.getSafeInsetBottom();
                            int dw = getResources().getDisplayMetrics().widthPixels;
                            int dh = getResources().getDisplayMetrics().heightPixels;
                            List<Rect> rects = dc.getBoundingRects();
                            for (int i = 0; i < rects.size(); i++) {
                                Rect rect = rects.get(i);
                                if (rect.left <= 0) l = Math.max(l, rect.right);
                                if (rect.top <= 0) t = Math.max(t, rect.bottom);
                                if (rect.right >= dw) r = Math.max(r, dw - rect.left);
                                if (rect.bottom >= dh) b = Math.max(b, dh - rect.top);
                            }
                            return l + "," + t + "," + r + "," + b + "," + density;
                        }
                    }
                }
            } catch (Exception ignored) {
            }
            return "0,0,0,0," + density;
        }

        @JavascriptInterface
        public void log(String text) {
            Log.i("EBWEB", text);
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(Math.max(1, Math.min(60, ms)));
                }
            } catch (Exception ignored) {
            }
        }

        /* 网页启动时读取已保存的配置；没有就用默认值 */
        @JavascriptInterface
        public String getConfig() {
            return server != null ? server.getConfig() : "{}";
        }

        /* 背景图/自定义眼睛的地址：手机本机回环地址，避免 Wi-Fi IP 变化 */
        @JavascriptInterface
        public String serverUrl() {
            return server != null ? server.getLocalUrl() : "";
        }
    }

    private String captureSnapshot() {
        final String[] result = new String[] {""};
        final CountDownLatch latch = new CountDownLatch(1);
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (web != null) {
                        int w = web.getWidth();
                        int h = web.getHeight();
                        if (w > 0 && h > 0) {
                            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                            Canvas canvas = new Canvas(bmp);
                            web.draw(canvas);
                            String name = "snapshot-" + System.currentTimeMillis() + ".png";
                            File out = new File(getFilesDir(), name);
                            FileOutputStream fos = new FileOutputStream(out);
                            bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                            fos.close();
                            bmp.recycle();
                            result[0] = "/media/" + name;
                        }
                    }
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            }
        });
        try {
            latch.await(2500, TimeUnit.MILLISECONDS);
        } catch (Exception ignored) {
        }
        return result[0];
    }

    private void startConfigServer() {
        server = new ConfigServer(this, new ConfigServer.Listener() {
            @Override
            public void onConfig(final String json) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (web != null) {
                            web.evaluateJavascript(
                                    "window.DeskConfig&&DeskConfig.apply(" + json + ")", null);
                        }
                    }
                });
            }

            @Override
            public String onSnapshot() {
                return captureSnapshot();
            }
        });
        server.start();
        String url = server.getLanUrl();
        if (url.length() > 0) {
            Log.i("EBWEB", "CONFIG " + url);
        }
    }

    private void showDeskMenu() {
        final String lanUrl = ConfigServer.getLastLanUrl();
        float density = getResources().getDisplayMetrics().density;
        int pad = Math.round(20 * density);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, Math.round(4 * density), pad, 0);

        TextView msg = new TextView(this);
        msg.setText("同一 Wi-Fi 打开：\n" + lanUrl);
        msg.setTextSize(15);
        msg.setTextColor(0xFFEDEDED);
        msg.setTextIsSelectable(true);
        box.addView(msg, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        Button copy = new Button(this);
        copy.setText("复制网址");
        copy.setAllCaps(false);
        copy.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) {
                cm.setPrimaryClip(ClipData.newPlainText("yuanbing for Android 控制台", lanUrl));
                Toast.makeText(this, "网址已复制", Toast.LENGTH_SHORT).show();
            }
        });
        LinearLayout.LayoutParams copyLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        copyLp.topMargin = Math.round(8 * density);
        box.addView(copy, copyLp);

        AlertDialog d = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("yuanbing for Android")
                .setView(box)
                .setPositiveButton("打开控制台（本机）", (dialog, which) -> {
                    try {
                        startActivity(new Intent(this, ConfigActivity.class));
                    } catch (Exception e) {
                        Toast.makeText(this, "控制台打开失败", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNeutralButton("退出到桌面", (dialog, which) -> launchSystemHome())
                .setNegativeButton("取消", null)
                .create();
        d.setOnShowListener(dialog -> {
            Window w = d.getWindow();
            if (w != null) {
                w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);
                w.getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
        });
        d.setOnDismissListener(dialog -> hideSystemUi());
        d.show();
    }

    private void launchSystemHome() {
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        List<ResolveInfo> homes = getPackageManager().queryIntentActivities(homeIntent, 0);
        for (int i = 0; i < homes.size(); i++) {
            ResolveInfo ri = homes.get(i);
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(getPackageName())) continue;
            Intent i2 = new Intent(Intent.ACTION_MAIN);
            i2.addCategory(Intent.CATEGORY_HOME);
            i2.setComponent(new ComponentName(pkg, ri.activityInfo.name));
            i2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(i2);
                return;
            } catch (Exception ignored) {
            }
        }
        /* 找不到别的桌面就打开设置,至少不会把人困住 */
        try {
            startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
        } catch (Exception ignored) {
        }
    }
}
