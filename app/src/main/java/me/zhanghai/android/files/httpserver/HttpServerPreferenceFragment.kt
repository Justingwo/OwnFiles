package me.zhanghai.android.files.httpserver

import android.content.Intent
import android.os.Bundle
import androidx.core.content.ContextCompat
import androidx.preference.Preference
import androidx.preference.PreferenceManager
import androidx.preference.SwitchPreferenceCompat
import me.zhanghai.android.files.R
import me.zhanghai.android.files.ui.PreferenceFragmentCompat

class HttpServerPreferenceFragment : PreferenceFragmentCompat() {
    override fun onCreatePreferencesFix(savedInstanceState: Bundle?, rootKey: String?) {
        addPreferencesFromResource(R.xml.http_server)

        val context = requireContext()
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        val urlPref = findPreference<Preference>("http_server_url")
        val statePref = findPreference<SwitchPreferenceCompat>(getString(R.string.pref_key_http_server_state))

        fun updateUrlSummary() {
            val port = try {
                prefs.getInt(getString(R.string.pref_key_http_server_port), 8080)
            } catch (_: ClassCastException) {
                prefs.getString(getString(R.string.pref_key_http_server_port), "8080")?.toIntOrNull() ?: 8080
            }
            urlPref?.summary = HttpServerUrl.get(context, port)
        }

        updateUrlSummary()

        // 绑定状态开关事件：当用户开启时启动服务，关闭时停止服务
        statePref?.setOnPreferenceChangeListener { _, newValue ->
            val isEnabled = newValue as Boolean
            val intent = Intent(context, HttpServerService::class.java)
            if (isEnabled) {
                ContextCompat.startForegroundService(context, intent)
            } else {
                context.stopService(intent)
            }
            true
        }

        prefs.registerOnSharedPreferenceChangeListener { _, key ->
            if (key == getString(R.string.pref_key_http_server_port)) {
                updateUrlSummary()
            }
        }
    }
}
