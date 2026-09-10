package at.bitfire.dav4jvm.property

import at.bitfire.dav4jvm.Property
import java.util.Date

class CreationDate(val creationDate: Date? = null) : Property()
class DisplayName(val displayName: String? = null) : Property()
class GetContentLength(val contentLength: Long? = null) : Property()
class GetContentType(val type: String? = null) : Property()
class GetETag(val eTag: String? = null) : Property()
class GetLastModified(val lastModified: Date? = null) : Property()

class ResourceType : Property() {
    val types = mutableSetOf<String>()
    companion object {
        const val COLLECTION = "collection"
    }
}
