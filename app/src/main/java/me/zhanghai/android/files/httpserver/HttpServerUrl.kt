package me.zhanghai.android.files.httpserver

import android.content.Context
import android.net.wifi.WifiManager
import java.net.NetworkInterface
import java.util.Locale

object HttpServerUrl {
    fun get(context: Context, port: Int): String {
        val ip = getLocalIpAddress(context) ?: "127.0.0.1"
        return String.format(Locale.US, "http://%s:%d/", ip, port)
    }

    private fun getLocalIpAddress(context: Context): String? {
        try {
            // 优先通过 NetworkInterface 获取处于活动状态的局域网 IP
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val intf = interfaces.nextElement()
                val addrs = intf.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (!addr.isLoopbackAddress && addr.hostAddress?.indexOf(':') == -1) {
                        return addr.hostAddress
                    }
                }
            }
        } catch (_: Exception) {}
        
        try {
            @Suppress("DEPRECATION")
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            @Suppress("DEPRECATION")
            val wifiInfo = wifiManager?.connectionInfo
            val ipInt = wifiInfo?.ipAddress ?: 0
            if (ipInt != 0) {
                return String.format(
                    Locale.US,
                    "%d.%d.%d.%d",
                    ipInt and 0xff,
                    ipInt shr 8 and 0xff,
                    ipInt shr 16 and 0xff,
                    ipInt shr 24 and 0xff
                )
            }
        } catch (_: Exception) {}

        return null
    }
}
