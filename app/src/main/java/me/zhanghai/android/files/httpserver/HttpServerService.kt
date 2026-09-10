package me.zhanghai.android.files.httpserver

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.preference.PreferenceManager
import me.zhanghai.android.files.R
import java.io.File

class HttpServerService : Service() {
    private var server: AndroidHttpServer? = null

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
                    context = this,
                    port = port,
                    rootDir = File("/storage/emulated/0"),
                    anonymousLogin = anonymous,
                    expectedUser = username,
                    expectedPass = password,
                    allowWrite = allowWrite
                )
                server?.start()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        server?.stop()
        server = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
