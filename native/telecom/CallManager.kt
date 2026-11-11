package com.rootaccess.dialer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import java.util.concurrent.CopyOnWriteArrayList

data class CallSnapshot(
    val state: String,
    val displayName: String,
    val isPrivate: Boolean,
    val incoming: Boolean,
    val connectTimeMillis: Long,
    val muted: Boolean,
    val speaker: Boolean,
    val photoUri: String?,
    val heldCallName: String?,
    val canMerge: Boolean
)

internal object CallManager {
    private var service: InCallService? = null
    private val calls = mutableListOf<Call>()
    private val incomingCalls = mutableSetOf<Call>()
    private val listeners = CopyOnWriteArrayList<(CallSnapshot) -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    private val callback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) = publish()
        override fun onDetailsChanged(call: Call, details: Call.Details) = publish()
    }

    fun addListener(l: (CallSnapshot) -> Unit) { listeners.add(l) }
    fun removeListener(l: (CallSnapshot) -> Unit) { listeners.remove(l) }

    fun onCallAdded(call: Call, svc: InCallService) {
        service = svc
        if (call.state == Call.STATE_RINGING) incomingCalls.add(call)
        calls.add(call)
        call.registerCallback(callback)
        publish()
    }

    fun onCallRemoved(call: Call) {
        call.unregisterCallback(callback)
        calls.remove(call)
        incomingCalls.remove(call)
        publish()
    }

    private fun primary(): Call? =
        calls.firstOrNull { it.state == Call.STATE_RINGING } ?: calls.lastOrNull()

    private fun held(): Call? =
        calls.firstOrNull { it.state == Call.STATE_HOLDING }

    private fun lookupName(number: String?): String? {
        if (number.isNullOrBlank()) return null
        if (PrivateIdentity.isPrivate(number)) return PrivateIdentity.DISPLAY_NAME
        val svc = service ?: return null
        return try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_URI, Uri.encode(number))
            val proj = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)
            svc.contentResolver.query(uri, proj, null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0)?.takeIf { it.isNotBlank() } else null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun lookupPhoto(number: String?): String? {
        if (number.isNullOrBlank() || PrivateIdentity.isPrivate(number)) return null
        val svc = service ?: return null
        return try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_URI, Uri.encode(number))
            val proj = arrayOf(ContactsContract.PhoneLookup.PHOTO_THUMBNAIL_URI)
            svc.contentResolver.query(uri, proj, null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        } catch (_: Exception) {
            null
        }
    }

    fun snapshot(): CallSnapshot {
        val call = primary() ?: return CallSnapshot(
            "idle", "", false, false, 0L, false, false, null, null, false
        )
        val number = call.details?.handle?.schemeSpecificPart
        val priv = PrivateIdentity.isPrivate(number)
        val name = if (priv) PrivateIdentity.DISPLAY_NAME
            else call.details?.callerDisplayName?.takeIf { it.isNotBlank() }
                ?: lookupName(number)
                ?: number
                ?: "Unknown"
        val state = when (call.state) {
            Call.STATE_RINGING -> "ringing"
            Call.STATE_ACTIVE -> "active"
            Call.STATE_HOLDING -> "holding"
            Call.STATE_DISCONNECTING, Call.STATE_DISCONNECTED -> "disconnected"
            else -> "dialing"
        }
        @Suppress("DEPRECATION")
        val audio = service?.callAudioState

        // Determine held call info for conference awareness
        val heldCall = held()
        val heldName: String? = if (heldCall != null && heldCall != call) {
            val heldNumber = heldCall.details?.handle?.schemeSpecificPart
            if (PrivateIdentity.isPrivate(heldNumber)) PrivateIdentity.DISPLAY_NAME
            else heldCall.details?.callerDisplayName?.takeIf { it.isNotBlank() }
                ?: lookupName(heldNumber)
                ?: heldNumber
        } else null
        val canMerge = heldCall != null && heldCall != call &&
            call.state == Call.STATE_ACTIVE && heldCall.state == Call.STATE_HOLDING

        val photo = if (priv) null else lookupPhoto(number)

        return CallSnapshot(
            state = state,
            displayName = name,
            isPrivate = priv,
            incoming = incomingCalls.contains(call),
            connectTimeMillis = call.details?.connectTimeMillis ?: 0L,
            muted = audio?.isMuted ?: false,
            speaker = audio?.route == CallAudioState.ROUTE_SPEAKER,
            photoUri = photo,
            heldCallName = heldName,
            canMerge = canMerge
        )
    }

    fun publish() {
        val s = snapshot()
        listeners.forEach { it(s) }
    }

    fun answer() { primary()?.answer(VideoProfile.STATE_AUDIO_ONLY) }
    fun reject() { primary()?.reject(false, null) }
    fun hangup() { primary()?.disconnect() }
    fun setMuted(m: Boolean) { service?.setMuted(m) }
    fun setSpeaker(on: Boolean) {
        service?.setAudioRoute(if (on) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_WIRED_OR_EARPIECE)
    }
    fun hold() { primary()?.hold() }
    fun unhold() {
        val heldCall = held()
        heldCall?.unhold()
    }
    fun merge() {
        val active = calls.firstOrNull { it.state == Call.STATE_ACTIVE } ?: return
        val heldCall = held() ?: return
        heldCall.conference(active)
    }

    fun dtmf(c: Char) {
        val call = primary() ?: return
        call.playDtmfTone(c)
        main.postDelayed({ call.stopDtmfTone() }, 120)
    }
}
