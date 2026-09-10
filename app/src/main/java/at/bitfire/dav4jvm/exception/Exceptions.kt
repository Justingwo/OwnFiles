package at.bitfire.dav4jvm.exception

import okhttp3.Response
import java.io.IOException

open class DavException(message: String? = null, cause: Throwable? = null) : Exception(message, cause)

open class HttpException(val code: Int, message: String? = null, cause: Throwable? = null) : DavException(message, cause) {
    constructor(response: Response) : this(response.code, response.message)
}

class UnauthorizedException(message: String? = null, cause: Throwable? = null) : HttpException(401, message, cause) {
    constructor(response: Response) : this(response.message)
}

class ForbiddenException(message: String? = null, cause: Throwable? = null) : HttpException(403, message, cause) {
    constructor(response: Response) : this(response.message)
}

class NotFoundException(message: String? = null, cause: Throwable? = null) : HttpException(404, message, cause) {
    constructor(response: Response) : this(response.message)
}

class ConflictException(message: String? = null, cause: Throwable? = null) : HttpException(409, message, cause) {
    constructor(response: Response) : this(response.message)
}

class PreconditionFailedException(message: String? = null, cause: Throwable? = null) : HttpException(412, message, cause) {
    constructor(response: Response) : this(response.message)
}

class ServiceUnavailableException(message: String? = null, cause: Throwable? = null) : HttpException(503, message, cause) {
    constructor(response: Response) : this(response.message)
}
