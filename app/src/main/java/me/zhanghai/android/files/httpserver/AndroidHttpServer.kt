package me.zhanghai.android.files.httpserver

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Environment
import android.util.Base64
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

class AndroidHttpServer(
    private val context: Context,
    port: Int,
    private val rootDir: File = Environment.getExternalStorageDirectory(),
    private val anonymousLogin: Boolean = true,
    private val expectedUser: String = "admin",
    private val expectedPass: String = "",
    private val allowWrite: Boolean = false
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val queryString = session.queryParameterString ?: ""

        // 1. 安全提取 cmd 指令，杜绝提前解析 POST Body
        var cmd: String? = null
        if (queryString.isNotEmpty()) {
            val pairs = queryString.split("&")
            for (pair in pairs) {
                val idx = pair.indexOf("=")
                if (idx != -1) {
                    val key = Uri.decode(pair.substring(0, idx))
                    if (key == "cmd") {
                        cmd = Uri.decode(pair.substring(idx + 1))
                        break
                    }
                }
            }
        }

        // 2. 静态页面首屏加载放行（仅在无 cmd 指令时派发静态网页，避免抢占 Ajax 接口）
        if (cmd == null) {
            val assetPath = if (uri == "/" || uri.isEmpty()) "web/index.html" else "web$uri"
            try {
                val inputStream: InputStream = context.assets.open(assetPath)
                val mimeType = getCustomMimeType(assetPath)
                return newChunkedResponse(Response.Status.OK, mimeType, inputStream)
            } catch (_: Exception) {}
        }

        // 3. API 鉴权校验（匿名模式跳过）
        if (!anonymousLogin) {
            val authHeader = session.headers["authorization"]
            if (authHeader == null || !checkAuth(authHeader)) {
                val errJson = JSONObject().apply {
                    put("ok", false)
                    put("auth", false)
                    put("err", "Unauthorized")
                }
                return newFixedLengthResponse(Response.Status.UNAUTHORIZED, "application/json; charset=utf-8", errJson.toString())
            }
        }

        // 4. 只读权限拦截
        if (!allowWrite) {
            if (session.method == Method.POST || cmd == "delete") {
                return newFixedLengthResponse(Response.Status.FORBIDDEN, "application/json; charset=utf-8", "{\"ok\":false,\"err\":\"Server is in READ_ONLY mode.\"}")
            }
        }

        // 5. 上传处理
        val isUpload = session.method == Method.POST && (queryString.contains("cmd=file") || uri.contains("cmd=file") || cmd == "upload")
        if (isUpload) {
            return handleUpload(session)
        }

        // 6. 获取文件列表 (JSON 格式严格对齐原版前端)
        if (cmd == "list_root" || cmd == "list") {
            return handleListDirectory(session, cmd, !allowWrite)
        }

        // 7. 删除操作
        if (cmd == "delete") {
            return handleDeleteAction(session)
        }

        // 8. 提取 APK 图标
        if (cmd == "ext_icon") {
            return handleApkIcon(session.uri)
        }

        // 9. 视频缩略图或物理文件下载
        if (cmd == "file" || cmd == "image" || cmd == "thumbnail") {
            return handleFileDelivery(uri, cmd)
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404 Not Found: $uri")
    }

    private fun checkAuth(authHeader: String): Boolean {
        return try {
            if (!authHeader.startsWith("Basic ")) return false
            val base64 = authHeader.substring("Basic ".length).trim()
            val credentials = String(Base64.decode(base64, Base64.DEFAULT), Charsets.UTF_8)
            val parts = credentials.split(":", limit = 2)
            parts.size == 2 && parts[0] == expectedUser && parts[1] == expectedPass
        } catch (_: Exception) {
            false
        }
    }

    private fun handleListDirectory(session: IHTTPSession, cmd: String, isReadOnly: Boolean): Response {
        return try {
            val responseObj = JSONObject()
            val filesArray = JSONArray()

            val targetFile = if (cmd == "list_root") {
                rootDir
            } else {
                val reqPath = Uri.decode(session.uri)
                if (reqPath == "/" || reqPath.isEmpty()) rootDir else File(reqPath)
            }

            responseObj.put("path", targetFile.absolutePath)
            responseObj.put("read_only", isReadOnly)

            if (targetFile.exists() && targetFile.isDirectory) {
                targetFile.listFiles()?.forEach { file ->
                    val fileJson = JSONObject().apply {
                        put("n", file.name)
                        put("t", if (file.isDirectory) 1 else 2)
                        put("size", file.length())
                        put("time", file.lastModified())
                        put("hidden", file.name.startsWith("."))
                        if (!file.isDirectory) {
                            val lower = file.name.lowercase()
                            put("mime", when {
                                lower.endsWith(".mp4") -> "video/mp4"
                                lower.endsWith(".mp3") -> "audio/mpeg"
                                lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
                                lower.endsWith(".png") -> "image/png"
                                lower.endsWith(".txt") -> "text/plain"
                                else -> "application/octet-stream"
                            })
                        }
                    }
                    filesArray.put(fileJson)
                }
            }

            responseObj.put("files", filesArray)
            newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", responseObj.toString())
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json; charset=utf-8", "{\"err\":\"${e.message}\"}")
        }
    }

    private fun handleApkIcon(uriPath: String): Response {
        return try {
            val file = File(Uri.decode(uriPath))
            if (file.exists() && file.isFile && file.name.lowercase().endsWith(".apk")) {
                val pm = context.packageManager
                val packageInfo = pm.getPackageArchiveInfo(file.absolutePath, 0)
                packageInfo?.applicationInfo?.let { appInfo ->
                    appInfo.sourceDir = file.absolutePath
                    appInfo.publicSourceDir = file.absolutePath
                    val iconDrawable = appInfo.loadIcon(pm)
                    if (iconDrawable is BitmapDrawable) {
                        val baos = ByteArrayOutputStream()
                        iconDrawable.bitmap.compress(Bitmap.CompressFormat.PNG, 90, baos)
                        val bytes = baos.toByteArray()
                        return newFixedLengthResponse(Response.Status.OK, "image/png", ByteArrayInputStream(bytes), bytes.size.toLong())
                    }
                }
            }
            newChunkedResponse(Response.Status.OK, "image/png", context.assets.open("web/img/le_unknown.png"))
        } catch (_: Exception) {
            try {
                newChunkedResponse(Response.Status.OK, "image/png", context.assets.open("web/img/le_unknown.png"))
            } catch (e: Exception) {
                newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Icon Not Found")
            }
        }
    }

    private fun handleFileDelivery(uriPath: String, cmd: String): Response {
        return try {
            val file = File(Uri.decode(uriPath))
            if (file.exists() && file.isFile) {
                if (cmd == "thumbnail" && (file.name.lowercase().endsWith(".mp4") || file.name.lowercase().endsWith(".mkv"))) {
                    val retriever = MediaMetadataRetriever()
                    return try {
                        retriever.setDataSource(file.absolutePath)
                        val bitmap = retriever.getFrameAtTime(1000000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                        if (bitmap != null) {
                            val baos = ByteArrayOutputStream()
                            bitmap.compress(Bitmap.CompressFormat.PNG, 80, baos)
                            val bytes = baos.toByteArray()
                            newFixedLengthResponse(Response.Status.OK, "image/png", ByteArrayInputStream(bytes), bytes.size.toLong())
                        } else {
                            newChunkedResponse(Response.Status.OK, "image/png", context.assets.open("web/img/le_unknown.png"))
                        }
                    } catch (_: Exception) {
                        newChunkedResponse(Response.Status.OK, "image/png", context.assets.open("web/img/le_unknown.png"))
                    } finally {
                        retriever.release()
                    }
                }

                val mimeType = getCustomMimeType(file.name)
                val response = newChunkedResponse(Response.Status.OK, mimeType, FileInputStream(file))
                if (cmd == "file") {
                    response.addHeader("Content-Disposition", "attachment; filename=\"${Uri.encode(file.name)}\"")
                }
                response
            } else {
                newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "File Not Found")
            }
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.message)
        }
    }

    private fun handleDeleteAction(session: IHTTPSession): Response {
        return try {
            var targetPath: String? = null
            val queryString = session.queryParameterString ?: ""
            if (queryString.isNotEmpty()) {
                val pairs = queryString.split("&")
                for (pair in pairs) {
                    val idx = pair.indexOf("=")
                    if (idx != -1) {
                        val key = Uri.decode(pair.substring(0, idx))
                        if (key == "path") {
                            targetPath = Uri.decode(pair.substring(idx + 1))
                            break
                        }
                    }
                }
            }
            if (targetPath == null) {
                targetPath = Uri.decode(session.uri)
            }

            val file = File(targetPath)
            if (file.exists()) {
                val success = if (file.isDirectory) file.deleteRecursively() else file.delete()
                if (success) {
                    scanMediaFile(file)
                    newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", "{\"ok\":true}")
                } else {
                    newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json; charset=utf-8", "{\"ok\":false,\"err\":\"Delete failed\"}")
                }
            } else {
                newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json; charset=utf-8", "{\"ok\":false,\"err\":\"File not found\"}")
            }
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json; charset=utf-8", "{\"ok\":false,\"err\":\"${e.message}\"}")
        }
    }

    private fun handleUpload(session: IHTTPSession): Response {
        return try {
            val uriPath = Uri.decode(session.uri)
            val queryString = session.queryParameterString ?: ""

            var filename: String? = null
            if (queryString.isNotEmpty()) {
                val pairs = queryString.split("&")
                for (pair in pairs) {
                    val idx = pair.indexOf("=")
                    if (idx != -1) {
                        val key = Uri.decode(pair.substring(0, idx))
                        if (key == "name" || key == "filename") {
                            filename = Uri.decode(pair.substring(idx + 1))
                            break
                        }
                    }
                }
            }
            if (filename == null) {
                filename = uriPath.substring(uriPath.lastIndexOf('/') + 1)
            }

            var destFile = File(uriPath)
            if (destFile.isDirectory || !uriPath.contains(".")) {
                destFile = File(destFile, filename)
            }
            destFile.parentFile?.mkdirs()

            val contentLength = session.headers["content-length"]?.toLongOrNull() ?: 0L
            if (contentLength > 0) {
                val input = session.inputStream
                FileOutputStream(destFile).use { output ->
                    val buffer = ByteArray(1024 * 64)
                    var totalRead = 0L
                    while (totalRead < contentLength) {
                        val remaining = contentLength - totalRead
                        val toRead = if (buffer.size.toLong() > remaining) remaining.toInt() else buffer.size
                        val read = input.read(buffer, 0, toRead)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        totalRead += read
                    }
                    output.flush()
                }
            }

            scanMediaFile(destFile)

            val res = JSONObject().apply {
                put("ok", true)
                put("length", destFile.length())
            }
            val response = newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", res.toString())
            response.addHeader("Connection", "keep-alive")
            response.addHeader("Access-Control-Allow-Origin", "*")
            return response
        } catch (e: Exception) {
            val errRes = JSONObject().apply {
                put("ok", false)
                put("err", e.message ?: "Upload failed")
            }
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json; charset=utf-8", errRes.toString())
        }
    }

    private fun scanMediaFile(file: File) {
        try {
            val intent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE)
            intent.data = Uri.fromFile(file)
            context.sendBroadcast(intent)
        } catch (_: Exception) {}
    }

    private fun getCustomMimeType(uri: String): String {
        val lower = uri.lowercase()
        return when {
            lower.endsWith(".html") || lower.endsWith(".htm") -> "text/html; charset=utf-8"
            lower.endsWith(".css") -> "text/css; charset=utf-8"
            lower.endsWith(".js") -> "application/javascript; charset=utf-8"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".mp4") -> "video/mp4"
            lower.endsWith(".mp3") -> "audio/mpeg"
            lower.endsWith(".txt") -> "text/plain; charset=utf-8"
            lower.endsWith(".json") -> "application/json; charset=utf-8"
            else -> "application/octet-stream"
        }
    }
}
