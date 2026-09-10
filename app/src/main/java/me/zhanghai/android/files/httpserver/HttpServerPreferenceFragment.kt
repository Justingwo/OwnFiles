package me.zhanghai.android.files.httpserver

import android.os.Bundle
import androidx.preference.Preference
import androidx.preference.PreferenceManager
import me.zhanghai.android.files.R
import me.zhanghai.android.files.ui.PreferenceFragmentCompat

class HttpServerPreferenceFragment : PreferenceFragmentCompat() {
    override fun onCreatePreferencesFix(savedInstanceState: Bundle?, rootKey: String?) {
        addPreferencesFromResource(R.xml.http_server)

        val prefs = PreferenceManager.getDefaultSharedPreferences(requireContext())
        val urlPref = findPreference<Preference>("http_server_url")

        fun updateUrlSummary() {
            // 兼容读取 Integer 或 String 类型，防止类型转换崩溃
            val port = try {
                prefs.getInt(getString(R.string.pref_key_http_server_port), 8080)
            } catch (_: ClassCastException) {
                prefs.getString(getString(R.string.pref_key_http_server_port), "8080")?.toIntOrNull() ?: 8080
            }
            urlPref?.summary = HttpServerUrl.get(requireContext(), port)
        }

        updateUrlSummary()

        prefs.registerOnSharedPreferenceChangeListener { _, key ->
            if (key == getString(R.string.pref_key_http_server_port)) {
                updateUrlSummary()
            }
        }
    }
}
