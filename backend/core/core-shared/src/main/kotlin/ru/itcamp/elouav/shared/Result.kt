package ru.itcamp.elouav.shared

sealed class AppResult<out T> {
    data class Ok<T>(val value: T) : AppResult<T>()
    data class Err(val message: String, val cause: Throwable? = null) : AppResult<Nothing>()

    inline fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }

    inline fun <R> flatMap(transform: (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Ok -> transform(value)
        is Err -> this
    }

    inline fun onError(transform: (Err) -> Unit): AppResult<T> {
        if (this is Err) transform(this)
        return this
    }

    fun getOrNull(): T? = (this as? Ok)?.value
    fun errorOrNull(): String? = (this as? Err)?.message
}

inline fun <T> result(block: () -> T): AppResult<T> = try {
    AppResult.Ok(block())
} catch (e: Throwable) {
    AppResult.Err(e.message ?: "Unknown error", e)
}
