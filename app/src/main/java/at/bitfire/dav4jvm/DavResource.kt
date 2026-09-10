package at.bitfire.dav4jvm

import at.bitfire.dav4jvm.exception.DavException
import at.bitfire.dav4jvm.exception.HttpException
import okhttp3.Authenticator
import okhttp3.Headers
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response as OkHttpResponse
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.Route
import java.io.Closeable
import java.time.Instant
import java.time.format.DateTimeFormatter

open class Property {
    data class Name(val namespace: String, val name: String)
}

interface PropertyFactory {
    fun getName(): Property.Name
    fun create(raw: Any?): Property?
}

fun interface ResponseCallback {
    fun onResponse(response: OkHttpResponse)
}

class Response(
    val href: HttpUrl? = null,
    val status: Status? = Status(200, "OK"),
    val properties: MutableList<Property> = mutableListOf()
) {
    data class Status(val code: Int, val message: String)

    enum class HrefRelation {
        SELF, MEMBER, OTHER
    }

    fun isSuccess(): Boolean = true
    
    fun hrefName(): String = href?.pathSegments?.lastOrNull { it.isNotEmpty() } ?: ""
    val hrefName: String get() = hrefName()

    val newLocation: HttpUrl? get() = href

    @Suppress("UNCHECKED_CAST")
    operator fun <T : Property> get(clazz: Class<T>): T? =
        properties.firstOrNull { clazz.isInstance(it) } as? T
}

open class DavResource(
    open val httpClient: OkHttpClient,
    open val location: HttpUrl
) : Closeable {

    open fun get(acceptTypes: String?, headers: Headers?): OkHttpResponse {
        val request = Request.Builder()
            .url(location)
            .apply {
                headers?.let { headers(it) }
                acceptTypes?.let { header("Accept", it) }
            }
            .build()
        return OkHttpResponse.Builder()
            .request(request)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(200)
            .message("OK")
            .body("".toResponseBody(null))
            .build()
    }

    open fun get(headers: Headers?): OkHttpResponse = get(null, headers)
    open fun get(acceptTypes: String?, headers: Headers?, callback: ResponseCallback) {}

    open fun put(body: RequestBody, headers: Headers? = null, ifMatch: String? = null, callback: ((OkHttpResponse) -> Unit)? = null) {}
    open fun delete(headers: Headers? = null, callback: ((OkHttpResponse) -> Unit)? = null) {}
    open fun propfind(depth: Int, vararg properties: Property.Name, callback: (Response, Response.HrefRelation) -> Unit) {}

    open fun proppatch(
        setProperties: Map<Property.Name, Any?>,
        removeProperties: List<Property.Name> = emptyList(),
        callback: (Response, Response.HrefRelation) -> Unit
    ) {}

    open fun proppatch(properties: Map<Property.Name, Any?>, callback: ((OkHttpResponse) -> Unit)? = null) {}

    open fun mkCol(headers: Headers? = null, callback: ((OkHttpResponse) -> Unit)? = null) {}
    open fun move(destination: HttpUrl, overwrite: Boolean = true, callback: ((OkHttpResponse) -> Unit)? = null) {}
    open fun copy(destination: HttpUrl, overwrite: Boolean = true, callback: ((OkHttpResponse) -> Unit)? = null) {}
    open fun options(callback: (List<String>, OkHttpResponse) -> Unit) {}
    open fun processMultiStatus(response: OkHttpResponse, callback: (Response, Response.HrefRelation) -> Unit) {}
    open fun checkStatus(response: OkHttpResponse) {}
    open fun followRedirects(sendRequest: () -> OkHttpResponse): OkHttpResponse = sendRequest()
    override fun close() {}
}

open class DavCollection(
    httpClient: OkHttpClient,
    location: HttpUrl
) : DavResource(httpClient, location)

object HttpUtils {
    fun formatDate(instant: Instant): String = DateTimeFormatter.RFC_1123_DATE_TIME.format(instant)
    fun parseDate(dateStr: String): Instant? = try {
        Instant.from(DateTimeFormatter.RFC_1123_DATE_TIME.parse(dateStr))
    } catch (e: Exception) {
        null
    }
}

object UrlUtils {
    fun hostToDomain(host: String): String? = null
    fun isSibling(url1: HttpUrl, url2: HttpUrl): Boolean = url1.host == url2.host && url1.port == url2.port
    fun isChild(parent: HttpUrl, child: HttpUrl): Boolean = isSibling(parent, child) && child.encodedPath.startsWith(parent.encodedPath)
}

object QuotedStringUtils {
    fun quote(s: String): String = "\"$s\""
    fun unquote(s: String): String = s.trim('"')
    @JvmStatic
    fun asQuotedString(s: String): String = quote(s)
}

class BasicDigestAuthHandler(
    val domain: String? = null,
    val user: String? = null,
    val password: CharArray? = null
) : Authenticator, Interceptor {
    constructor(domain: String?, user: String?, passwordStr: String?) : this(domain, user, passwordStr?.toCharArray())
    override fun authenticate(route: Route?, response: OkHttpResponse): Request? = null
    override fun intercept(chain: Interceptor.Chain): OkHttpResponse = chain.proceed(chain.request())
}

object DavResourceAccessor {
    fun getLocation(resource: DavResource): HttpUrl = resource.location
    fun getHttpClient(resource: DavResource): OkHttpClient = resource.httpClient
    fun checkStatus(resource: DavResource, response: OkHttpResponse) = resource.checkStatus(response)
    fun followRedirects(resource: DavResource, sendRequest: () -> OkHttpResponse): OkHttpResponse = resource.followRedirects(sendRequest)
}

