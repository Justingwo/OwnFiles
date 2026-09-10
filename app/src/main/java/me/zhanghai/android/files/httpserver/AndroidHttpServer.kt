package me.zhanghai.android.files.httpserver

import android.content.Context
import android.util.Base64
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

class AndroidHttpServer(
    private val context: Context,
    port: Int,
    private val rootDir: File = File("/storage/emulated/0"),
    private val anonymousLogin: Boolean = true,
    private val expectedUser: String = "admin",
    private val expectedPass: String = "",
    private val allowWrite: Boolean = false
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        // 1. 身份验证检查
        if (!anonymousLogin && expectedPass.isNotEmpty()) {
            val authHeader = session.headers["authorization"]
            if (authHeader == null || !checkAuth(authHeader)) {
                val response = newFixedLengthResponse(Response.Status.UNAUTHORIZED, MIME_PLAINTEXT, "Unauthorized")
                response.addHeader("WWW-Authenticate", "Basic realm=\"OwnFiles HTTP Server\"")
                return response
            }
        }

        val method = session.method
        val uri = session.uri.trimStart('/')
        val parms = session.parameters
        val cmd = parms["cmd"]?.firstOrNull()

        // 2. 写入操作权限拦截：如果请求写操作但允许写入关闭，直接返回 403 拒绝
        if (method != Method.GET && method != Method.HEAD) {
            if (!allowWrite) {
                return newFixedLengthResponse(Response.Status.FORBIDDEN, MIME_PLAINTEXT, "Write operations are disabled by configuration.")
            }
        }

        // 3. 处理前端语言包请求
        if (uri.startsWith("loc.json") || cmd == "localize") {
            val json = JSONObject().apply {
                put("OK", true)
            }.toString()
            return newFixedLengthResponse(Response.Status.OK, "application/json", json)
        }

        // 4. 目录列表查询 (cmd=list)
        if (cmd == "list" || (uri.isEmpty() && method == Method.GET)) {
            val targetDir = File(rootDir, uri).let { if (it.exists() && it.isDirectory) it else rootDir }
            val jsonArray = JSONArray()
            
            targetDir.listFiles()?.forEach { file ->
                val obj = JSONObject().apply {
                    put("n", file.name)
                    put("s", if (file.isDirectory) 0 else file.length())
                    put("d", file.lastModified())
                    put("IsDir", file.isDirectory)
                }
                jsonArray.put(obj)
            }

            val json = JSONObject().apply {
                put("list", jsonArray)
            }.toString()
            return newFixedLengthResponse(Response.Status.OK, "application/json", json)
        }

        // 5. 文件上传处理 (POST)
        if (method == Method.POST && cmd == "upload") {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                val tmpFilePath = files["file"]
                val targetName = parms["name"]?.firstOrNull() ?: "uploaded_file"
                
                if (tmpFilePath != null) {
                    val destDir = File(rootDir, uri).let { if (it.exists()) it else rootDir }
                    val destFile = File(destDir, targetName)
                    File(tmpFilePath).copyTo(destFile, overwrite = true)
                    
                    val json = JSONObject().put("OK", true).toString()
                    return newFixedLengthResponse(Response.Status.OK, "application/json", json)
                }
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.message)
            }
        }

        // 6. 优先读取 assets/web 中的静态前端文件
        val assetPath = "web/$uri"
        try {
            val stream = context.assets.open(assetPath)
            val mimeType = getMimeTypeForFile(uri)
            return newChunkedResponse(Response.Status.OK, mimeType, stream)
        } catch (_: Exception) {}

        // 7. 本地文件下载
        val targetFile = File(rootDir, uri)
        if (targetFile.exists() && targetFile.isFile) {
            return try {
                val stream: InputStream = FileInputStream(targetFile)
                newChunkedResponse(Response.Status.OK, getMimeTypeForFile(targetFile.name), stream)
            } catch (e: Exception) {
                newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.message)
            }
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404 Not Found")
    }

    private fun checkAuth(authHeader: String): Boolean {
        return try {
            if (authHeader.startsWith("Basic ")) {
                val base64Credentials = authHeader.substring(6).trim()
                val credentials = String(Base64.decode(base64Credentials, Base64.DEFAULT), Charsets.UTF_8)
                val parts = credentials.split(":", limit = 2)
                if (parts.size == 2) {
                    return parts[0] == expectedUser && parts[1] == expectedPass
                }
            }
            false
        } catch (_: Exception) {
            false
        }
    }
}
