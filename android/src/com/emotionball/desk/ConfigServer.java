package com.emotionball.desk;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 手机上的迷你配置服务：给同一 Wi-Fi 下的电脑提供配置页和 JSON API。
 * 只依赖 JDK/Android 自带的 ServerSocket，不引第三方库。
 */
public class ConfigServer {

    public interface Listener {
        void onConfig(String json);
        String onSnapshot();
    }

    private static final String TAG = "EBWEB";
    private static final String PREFS = "emotionball";
    private static final String KEY = "config";
    private static final int MAX_CONFIG = 64 * 1024;
    private static final int MAX_UPLOAD = 8 * 1024 * 1024;
    private static final int MAX_BODY = 16 * 1024 * 1024;

    private final Context ctx;
    private final Listener listener;
    private ServerSocket server;
    private ExecutorService pool;
    private Thread acceptThread;
    private int port = 0;
    private static volatile int lastPort = 8765;
    private static volatile String lastToken = "";
    private static volatile String lastUrl = "";
    private final String token;
    private volatile boolean running = false;
    private String cachedIp = null;

    public static int getLastPort() {
        return lastPort;
    }

    public static String getLastToken() {
        return lastToken;
    }

    public static String getLastLanUrl() {
        return lastUrl;
    }

    public ConfigServer(Context context, Listener listener) {
        this.ctx = context.getApplicationContext();
        this.listener = listener;
        this.token = newToken();
    }

    private static String newToken() {
        byte[] b = new byte[8];
        new SecureRandom().nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x & 0xff));
        return sb.toString();
    }

    public String getToken() {
        return token;
    }

    private String prefix() {
        return "/t/" + token + "/";
    }

    /* ---------------- 启停 ---------------- */

    public synchronized void start() {
        if (running) return;
        pool = Executors.newFixedThreadPool(4);
        for (int p = 8765; p <= 8795; p++) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress("0.0.0.0", p), 8);
                server = s;
                port = p;
                lastPort = p;
                lastToken = token;
                break;
            } catch (Exception ignored) {
            }
        }
        if (server == null) {
            Log.w(TAG, "config server: no free port");
            pool.shutdownNow();
            pool = null;
            return;
        }
        running = true;
        acceptThread = new Thread(new Runnable() {
            @Override
            public void run() {
                acceptLoop();
            }
        }, "eb-config-accept");
        acceptThread.setDaemon(true);
        acceptThread.start();
        Log.i(TAG, "config server started at " + getLanUrl());
        lastUrl = getLanUrl();
    }

    public synchronized void stop() {
        running = false;
        if (server != null) {
            try { server.close(); } catch (Exception ignored) {}
            server = null;
        }
        if (pool != null) {
            pool.shutdownNow();
            pool = null;
        }
        acceptThread = null;
    }

    public int getPort() {
        return port;
    }

    public String getLocalUrl() {
        return port > 0 ? "http://127.0.0.1:" + port + prefix() : "";
    }

    public String getLanUrl() {
        if (port <= 0) return "";
        if (cachedIp == null) cachedIp = findLanIp();
        return "http://" + cachedIp + ":" + port + prefix();
    }

    /* ---------------- 配置持久化 ---------------- */

    public String getConfig() {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return sp.getString(KEY, "{}");
    }

    private boolean saveConfig(String json) {
        JSONObject o;
        try {
            o = new JSONObject(json);
        } catch (Exception e) {
            return false;
        }
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            o.put("_savedAt", System.currentTimeMillis());
            json = o.toString();
        } catch (Exception ignored) {
        }
        boolean ok = sp.edit().putString(KEY, json).commit();
        if (ok) {
            /* 配置里如果清空了图片，就把对应的上传文件也删掉，避免占空间 */
            try {
                JSONObject ce = o.optJSONObject("customEyes");
                if (ce == null || ce.optString("image", "").length() == 0) {
                    deleteUploads("eyes-");
                }
                JSONObject bg = o.optJSONObject("bg");
                if (bg == null || bg.optString("image", "").length() == 0) {
                    deleteUploads("bg-");
                }
                JSONObject ca = o.optJSONObject("customAcc");
                if (ca == null || ca.optString("image", "").length() == 0) {
                    deleteUploads("acc-");
                }
                JSONObject sounds = o.optJSONObject("sounds");
                String[] skeys = {"poke", "pop", "wall", "yawn", "dizzy", "giggle"};
                for (String sk : skeys) {
                    if (sounds == null || sounds.optString(sk, "").length() == 0) {
                        deleteUploads("snd-" + sk + "-");
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return ok;
    }

    private void deleteUploads(String prefix) {
        File[] files = ctx.getFilesDir().listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.getName().startsWith(prefix)) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    /* ---------------- 网络 ---------------- */

    private void acceptLoop() {
        while (running) {
            Socket socket = null;
            try {
                socket = server.accept();
                socket.setSoTimeout(10000);
                final Socket s = socket;
                pool.execute(new Runnable() {
                    @Override
                    public void run() {
                        handle(s);
                    }
                });
            } catch (Exception e) {
                if (running) Log.w(TAG, "accept failed: " + e.getMessage());
                try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            }
        }
    }

    private void handle(Socket socket) {
        try {
            InputStream in = socket.getInputStream();
            byte[] headerBytes = readHeader(in);
            if (headerBytes == null) return;

            String header = new String(headerBytes, "UTF-8");
            String[] lines = header.split("\r\n");
            if (lines.length == 0) return;
            String[] first = lines[0].split(" ");
            if (first.length < 2) return;

            String method = first[0];
            String target = first[1];
            int q = target.indexOf('?');
            String rawPath = q >= 0 ? target.substring(0, q) : target;
            String path = URLDecoder.decode(rawPath, "UTF-8");

            Map<String, String> headers = new HashMap<String, String>();
            for (int i = 1; i < lines.length; i++) {
                int c = lines[i].indexOf(':');
                if (c > 0) {
                    headers.put(lines[i].substring(0, c).trim().toLowerCase(Locale.US),
                            lines[i].substring(c + 1).trim());
                }
            }

            int length = 0;
            try {
                length = Integer.parseInt(headers.containsKey("content-length")
                        ? headers.get("content-length") : "0");
            } catch (Exception ignored) {}
            if (length < 0 || length > MAX_BODY) {
                sendJson(socket, 413, "{\"error\":\"too large\"}");
                return;
            }
            byte[] body = readFully(in, length);

            route(socket, method, path, headers, body);
        } catch (Exception e) {
            Log.w(TAG, "request failed: " + e.getMessage());
            try { sendJson(socket, 500, "{\"error\":\"server error\"}"); } catch (Exception ignored) {}
        } finally {
            try { socket.close(); } catch (Exception ignored) {}
        }
    }

    private void route(Socket socket, String method, String path,
                       Map<String, String> headers, byte[] body) throws IOException {
        /* 控制台和 API 必须带随机 token；媒体文件按不可猜文件名公开，供桌面页直接加载。 */
        String pre = prefix();
        if (path.startsWith(pre)) {
            path = path.substring(pre.length());
            if (path.length() == 0) path = "/";
            else if (!path.startsWith("/")) path = "/" + path;
        } else if (path.startsWith("/media/") || "/favicon.ico".equals(path)) {
            /* public */
        } else {
            sendForbidden(socket);
            return;
        }

        if ("/api/config".equals(path)) {
            if ("GET".equals(method)) {
                sendJson(socket, 200, getConfig());
            } else if ("POST".equals(method)) {
                String json = new String(body, "UTF-8");
                if (json.length() > MAX_CONFIG || !saveConfig(json)) {
                    sendJson(socket, 400, "{\"error\":\"invalid config\"}");
                    return;
                }
                if (listener != null) listener.onConfig(getConfig());
                sendJson(socket, 200, getConfig());
            } else {
                sendJson(socket, 405, "{\"error\":\"method not allowed\"}");
            }
            return;
        }

        if ("/api/export".equals(path) && "GET".equals(method)) {
            sendJson(socket, 200, exportBundle());
            return;
        }

        if ("/api/import".equals(path) && "POST".equals(method)) {
            try {
                importBundle(new String(body, "UTF-8"));
                if (listener != null) listener.onConfig(getConfig());
                sendJson(socket, 200, getConfig());
            } catch (Exception e) {
                sendJson(socket, 400, "{\"error\":\"invalid bundle\"}");
            }
            return;
        }

        if ("/api/upload".equals(path) && "POST".equals(method)) {
            handleUpload(socket, body);
            return;
        }

        if ("/api/snapshot".equals(path) && "POST".equals(method)) {
            String p = "";
            try {
                if (listener != null) p = listener.onSnapshot();
            } catch (Exception ignored) {
            }
            JSONObject o = new JSONObject();
            try { o.put("path", p == null ? "" : p); } catch (Exception ignored) {}
            sendJson(socket, 200, o.toString());
            return;
        }

        if ("/api/info".equals(path)) {
            JSONObject o = new JSONObject();
            try {
                o.put("name", "yuanbing for Android");
                o.put("version", "4.7");
                o.put("port", port);
                o.put("lan", getLanUrl());
                android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
                android.view.WindowManager wm = (android.view.WindowManager)
                        ctx.getSystemService(Context.WINDOW_SERVICE);
                if (wm != null) wm.getDefaultDisplay().getRealMetrics(dm);
                o.put("w", dm.widthPixels);
                o.put("h", dm.heightPixels);
                o.put("density", dm.density);
            } catch (Exception ignored) {}
            sendJson(socket, 200, o.toString());
            return;
        }

        if (path.startsWith("/media/")) {
            serveMedia(socket, path.substring("/media/".length()));
            return;
        }

        if ("/favicon.ico".equals(path)) {
            send(socket, 204, "text/plain", new byte[0], null);
            return;
        }

        serveAsset(socket, path);
    }

    /* ---------------- 上传 ---------------- */

    private String exportBundle() {
        JSONObject out = new JSONObject();
        try {
            JSONObject cfg = new JSONObject(getConfig());
            out.put("app", "yuanbing-for-android");
            out.put("version", 1);
            out.put("config", cfg);
            Set<String> paths = new HashSet<>();
            collectMedia(cfg, paths);
            JSONObject media = new JSONObject();
            for (String p : paths) {
                String name = p.substring("/media/".length());
                File f = new File(ctx.getFilesDir(), name);
                if (!f.isFile() || f.length() > MAX_UPLOAD) continue;
                byte[] bytes = readFile(f);
                media.put(p, "data:" + mimeFor(name) + ";base64,"
                        + Base64.encodeToString(bytes, Base64.NO_WRAP));
            }
            out.put("media", media);
        } catch (Exception e) {
            try { out.put("error", "export failed"); } catch (Exception ignored) {}
        }
        return out.toString();
    }

    private void importBundle(String json) throws Exception {
        JSONObject root = new JSONObject(json);
        JSONObject cfg = root.optJSONObject("config");
        if (cfg == null) throw new Exception("no config");
        JSONObject media = root.optJSONObject("media");
        if (media != null) {
            java.util.Iterator<String> it = media.keys();
            while (it.hasNext()) {
                String key = it.next();
                if (!key.startsWith("/media/")) continue;
                String name = key.substring("/media/".length());
                if (!name.matches("[A-Za-z0-9._-]+")) continue;
                String data = media.optString(key, "");
                int comma = data.indexOf(',');
                if (comma < 0 || !data.substring(0, comma).contains("base64")) continue;
                byte[] bytes = Base64.decode(data.substring(comma + 1), Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_UPLOAD) continue;
                FileOutputStream fos = new FileOutputStream(new File(ctx.getFilesDir(), name));
                fos.write(bytes);
                fos.close();
            }
        }
        if (!saveConfig(cfg.toString())) throw new Exception("bad config");
    }

    private static void collectMedia(Object node, Set<String> out) {
        if (node instanceof JSONObject) {
            JSONObject o = (JSONObject) node;
            java.util.Iterator<String> it = o.keys();
            while (it.hasNext()) {
                Object v = o.opt(it.next());
                if (v instanceof String && ((String) v).startsWith("/media/")) {
                    out.add((String) v);
                } else if (v != null) {
                    collectMedia(v, out);
                }
            }
        } else if (node instanceof JSONArray) {
            JSONArray a = (JSONArray) node;
            for (int i = 0; i < a.length(); i++) collectMedia(a.opt(i), out);
        }
    }

    private static String mimeFor(String name) {
        String n = name.toLowerCase(Locale.US);
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ogg")) return "audio/ogg";
        if (n.endsWith(".m4a")) return "audio/mp4";
        return "application/octet-stream";
    }

    private static byte[] readFile(File f) throws IOException {
        FileInputStream in = new FileInputStream(f);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    private void handleUpload(Socket socket, byte[] body) throws IOException {
        try {
            JSONObject o = new JSONObject(new String(body, "UTF-8"));
            String kind = o.optString("kind", "bg");
            String key = o.optString("key", "");
            boolean sound = "sound".equals(kind);
            if (!"bg".equals(kind) && !"eyes".equals(kind) && !"acc".equals(kind) && !sound) {
                sendJson(socket, 400, "{\"error\":\"bad kind\"}");
                return;
            }
            if (sound && !isSoundKey(key)) {
                sendJson(socket, 400, "{\"error\":\"bad sound key\"}");
                return;
            }
            String data = o.optString("data", "");
            int comma = data.indexOf(',');
            if (comma < 0 || !data.substring(0, comma).contains("base64")) {
                sendJson(socket, 400, "{\"error\":\"bad data\"}");
                return;
            }
            String meta = data.substring(0, comma).toLowerCase(Locale.US);
            String b64 = data.substring(comma + 1);
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > MAX_UPLOAD) {
                sendJson(socket, 413, "{\"error\":\"file too large\"}");
                return;
            }

            String ext;
            String mime;
            if (sound) {
                if (isMp3(bytes)) { ext = "mp3"; mime = "audio/mpeg"; }
                else if (isWav(bytes)) { ext = "wav"; mime = "audio/wav"; }
                else if (isOgg(bytes)) { ext = "ogg"; mime = "audio/ogg"; }
                else if (isM4a(bytes)) { ext = "m4a"; mime = "audio/mp4"; }
                else {
                    sendJson(socket, 415, "{\"error\":\"unsupported audio\"}");
                    return;
                }
            } else if (isPng(bytes)) { ext = "png"; mime = "image/png"; }
            else if (isJpeg(bytes)) { ext = "jpg"; mime = "image/jpeg"; }
            else if (isWebp(bytes)) { ext = "webp"; mime = "image/webp"; }
            else {
                sendJson(socket, 415, "{\"error\":\"unsupported image\"}");
                return;
            }

            File dir = ctx.getFilesDir();
            File[] old = dir.listFiles();
            if (old != null) {
                for (File f : old) {
                    String prefix = sound ? ("snd-" + key + "-") : (kind + "-");
                    if (f.getName().startsWith(prefix)) {
                        //noinspection ResultOfMethodCallIgnored
                        f.delete();
                    }
                }
            }
            String name = (sound ? ("snd-" + key) : kind) + "-" + System.currentTimeMillis() + "." + ext;
            File out = new File(dir, name);
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(bytes);
            fos.close();

            JSONObject res = new JSONObject();
            res.put("path", "/media/" + name);
            res.put("mime", mime);
            res.put("bytes", bytes.length);
            sendJson(socket, 200, res.toString());
        } catch (Exception e) {
            sendJson(socket, 400, "{\"error\":\"bad upload\"}");
        }
    }

    private static boolean isSoundKey(String k) {
        return "poke".equals(k) || "pop".equals(k) || "wall".equals(k)
                || "yawn".equals(k) || "dizzy".equals(k) || "giggle".equals(k);
    }

    private static boolean isMp3(byte[] b) {
        if (b.length > 3 && b[0] == 'I' && b[1] == 'D' && b[2] == '3') return true;
        return b.length > 2 && (b[0] & 0xff) == 0xff && ((b[1] & 0xe0) == 0xe0);
    }

    private static boolean isWav(byte[] b) {
        return b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E';
    }

    private static boolean isOgg(byte[] b) {
        return b.length > 4 && b[0] == 'O' && b[1] == 'g' && b[2] == 'g' && b[3] == 'S';
    }

    private static boolean isM4a(byte[] b) {
        return b.length > 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p';
    }

    private static boolean isPng(byte[] b) {
        return b.length > 8 && (b[0] & 0xff) == 0x89 && b[1] == 0x50 && b[2] == 0x4e && b[3] == 0x47;
    }

    private static boolean isJpeg(byte[] b) {
        return b.length > 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8;
    }

    private static boolean isWebp(byte[] b) {
        return b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    /* ---------------- 静态资源 ---------------- */

    private void serveAsset(Socket socket, String path) throws IOException {
        String rel = path.equals("/") ? "config.html" : path.replaceFirst("^/+", "");
        if (rel.length() == 0) rel = "config.html";
        if (rel.contains("..")) {
            sendJson(socket, 404, "{\"error\":\"not found\"}");
            return;
        }
        try {
            AssetManager am = ctx.getAssets();
            InputStream in = am.open(rel);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
            byte[] data = out.toByteArray();
            send(socket, 200, mimeOf(rel), data,
                    "Cache-Control: no-store\r\n");
        } catch (Exception e) {
            sendJson(socket, 404, "{\"error\":\"not found\"}");
        }
    }

    private void serveMedia(Socket socket, String name) throws IOException {
        if (name.contains("/") || name.contains("..")) {
            sendJson(socket, 404, "{\"error\":\"not found\"}");
            return;
        }
        File f = new File(ctx.getFilesDir(), name);
        if (!f.isFile()) {
            sendJson(socket, 404, "{\"error\":\"not found\"}");
            return;
        }
        byte[] data = readFile(f);
        send(socket, 200, mimeOf(name), data,
                "Cache-Control: max-age=31536000\r\n");
    }

    private static String mimeOf(String name) {
        String n = name.toLowerCase(Locale.US);
        if (n.endsWith(".html")) return "text/html; charset=utf-8";
        if (n.endsWith(".css")) return "text/css; charset=utf-8";
        if (n.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (n.endsWith(".json")) return "application/json; charset=utf-8";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ogg")) return "audio/ogg";
        if (n.endsWith(".m4a")) return "audio/mp4";
        if (n.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    /* ---------------- HTTP 小工具 ---------------- */

    private static byte[] readHeader(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int state = 0;
        int b;
        while ((b = in.read()) != -1) {
            out.write(b);
            if (out.size() > 64 * 1024) break;
            if (state == 0 && b == '\r') state = 1;
            else if (state == 1 && b == '\n') state = 2;
            else if (state == 2 && b == '\r') state = 3;
            else if (state == 3 && b == '\n') break;
            else state = 0;
        }
        return out.size() == 0 ? null : out.toByteArray();
    }

    private static byte[] readFully(InputStream in, int length) throws IOException {
        byte[] data = new byte[length];
        int off = 0;
        while (off < length) {
            int n = in.read(data, off, length - off);
            if (n <= 0) break;
            off += n;
        }
        return data;
    }

    private static void sendJson(Socket socket, int code, String json) throws IOException {
        send(socket, code, "application/json; charset=utf-8", json.getBytes("UTF-8"),
                "Access-Control-Allow-Origin: *\r\n");
    }

    private static void sendForbidden(Socket socket) throws IOException {
        String html = "<!doctype html><meta charset=utf-8><title>yuanbing for Android</title>"
                + "<body style='background:#000;color:#ddd;font:16px sans-serif;padding:40px'>"
                + "<h2>需要控制台地址</h2>"
                + "<p>请在这台手机上左上角连点 6 下，选择“打开控制台（本机）”，"
                + "再复制页面顶部显示的完整地址；或在同一 Wi-Fi 设备上使用该完整地址。</p>"
                + "<p style='color:#888'>为了安全，根地址不再直接开放控制台。</p></body>";
        send(socket, 403, "text/html; charset=utf-8", html.getBytes("UTF-8"), null);
    }

    private static void send(Socket socket, int code, String mime, byte[] body,
                             String extraHeaders) throws IOException {
        OutputStream out = socket.getOutputStream();
        String reason = code == 200 ? "OK" : code == 204 ? "No Content"
                : code == 400 ? "Bad Request" : code == 403 ? "Forbidden"
                : code == 404 ? "Not Found"
                : code == 405 ? "Method Not Allowed" : code == 413 ? "Payload Too Large"
                : code == 415 ? "Unsupported Media Type" : "Error";
        StringBuilder head = new StringBuilder();
        head.append("HTTP/1.1 ").append(code).append(' ').append(reason).append("\r\n");
        head.append("Content-Type: ").append(mime).append("\r\n");
        head.append("Content-Length: ").append(body.length).append("\r\n");
        head.append("Connection: close\r\n");
        if (extraHeaders != null) head.append(extraHeaders);
        head.append("\r\n");
        out.write(head.toString().getBytes("UTF-8"));
        if (body.length > 0) out.write(body);
        out.flush();
    }

    /* ---------------- 局域网 IP ---------------- */

    private static String findLanIp() {
        try {
            List<NetworkInterface> list = new ArrayList<NetworkInterface>();
            Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces();
            while (en.hasMoreElements()) list.add(en.nextElement());
            Collections.sort(list, new java.util.Comparator<NetworkInterface>() {
                @Override
                public int compare(NetworkInterface a, NetworkInterface b) {
                    return rank(a) - rank(b);
                }
            });
            for (NetworkInterface ni : list) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && addr.isSiteLocalAddress()) {
                        String ip = addr.getHostAddress();
                        if (ip != null && !ip.startsWith("127.")) return ip;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "127.0.0.1";
    }

    private static int rank(NetworkInterface ni) {
        String n = ni.getName() == null ? "" : ni.getName().toLowerCase(Locale.US);
        if (n.startsWith("wlan")) return 0;
        if (n.startsWith("eth")) return 1;
        return 2;
    }
}
