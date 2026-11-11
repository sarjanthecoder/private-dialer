package com.rootaccess.dialer

import android.net.Uri

/**
 * The ONLY place the private number lives. It never crosses the JS bridge,
 * is never logged, and is never put in notifications or UI.
 */
internal object PrivateIdentity {
    private const val PRIVATE_NUMBER = "7904238801"
    const val DISPLAY_NAME = "💫 𝑹𝒐𝒐𝒕𝑨𝒄𝒄𝒆𝒔𝒔. 𝒆𝒙𝒆✨"

    private fun normalize(raw: String?): String =
        raw.orEmpty().filter { it.isDigit() }.takeLast(10)

    fun isPrivate(raw: String?): Boolean {
        val n = normalize(raw)
        return n.length == 10 && n == PRIVATE_NUMBER
    }

    fun resolve(raw: String?): String? = if (isPrivate(raw)) DISPLAY_NAME else null

    fun dialUri(): Uri = Uri.fromParts("tel", PRIVATE_NUMBER, null)
}
