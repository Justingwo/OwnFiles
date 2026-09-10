package at.bitfire.dav4jvm.property.webdav

import at.bitfire.dav4jvm.Property
import at.bitfire.dav4jvm.PropertyFactory

open class CreationDate(val creationDate: String? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "creationdate")
    }
    class Factory : PropertyFactory {
        override fun getName() = NAME
        override fun create(raw: Any?) = CreationDate()
    }
}

open class DisplayName(val displayName: String? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "displayname")
    }
}

open class GetContentLength(val contentLength: Long? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "getcontentlength")
    }
}

open class GetContentType(val type: String? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "getcontenttype")
    }
}

open class GetETag(val eTag: String? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "getetag")
    }
}

open class GetLastModified(val lastModified: java.time.Instant? = null) : Property() {
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "getlastmodified")
    }
}

open class ResourceType : Property() {
    val types = mutableSetOf<Property.Name>()
    companion object {
        @JvmField
        val NAME = Property.Name("DAV:", "resourcetype")
        val COLLECTION = Property.Name("DAV:", "collection")
    }
}
