package me.zhanghai.android.files.httpserver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.preference.PreferenceManager
import fi.iki.elonen.NanoHTTPD
import me.zhanghai.android.files.R
import java.io.IOException

class HttpServerService : Service() {

    private var server: AndroidHttpServer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onCreate() {
        super.onCreate()
        // 必须在 onCreate 第一行直接拉起前台通知，避免超时
        startForegroundServiceInternal()
        acquireHardwareLocks()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = PreferenceManager.getDefaultSharedPreferences(this)
        val port = try {
            prefs.getInt(getString(R.string.pref_key_http_server_port), 8080)
        } catch (_: ClassCastException) {
            prefs.getString(getString(R.string.pref_key_http_server_port), "8080")?.toIntOrNull() ?: 8080
        }

        val anonymous = prefs.getBoolean(getString(R.string.pref_key_http_server_anonymous_login), true)
        val username = prefs.getString(getString(R.string.pref_key_http_server_username), "admin") ?: "admin"
        val password = prefs.getString(getString(R.string.pref_key_http_server_password), "") ?: ""
        val allowWrite = prefs.getBoolean(getString(R.string.pref_key_http_server_writable), false)

        if (server == null) {
            try {
                server = AndroidHttpServer(
                    context = applicationContext,
                    port = port,
                    anonymousLogin = anonymous,
                    expectedUser = username,
                    expectedPass = password,
                    allowWrite = allowWrite
                )
                server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
        return START_STICKY
    }

    private fun acquireHardwareLocks() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OwnFiles::HttpWakeLock")?.apply {
                setReferenceCounted(false)
                acquire(10 * 60 * 1000L)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            wifiLock = wm?.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "OwnFiles::HttpWifiLock")?.apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun releaseHardwareLocks() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {} finally {
            wakeLock = null
        }

        try {
            wifiLock?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {} finally {
            wifiLock = null
        }
    }

    private fun startForegroundServiceInternal() {
        val channelId = "http_server_service_channel"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "HTTP 文件传输服务",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("HTTP 文件服务运行中")
            .setContentText("服务已就绪，正在监听局域网连接")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(10086, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(10086, notification)
        }
    }

    override fun onDestroy() {
        releaseHardwareLocks()
        server?.stop()
        server = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
