package com.rootaccess.dialer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.PhoneAccountHandle
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
    val canMerge: Boolean,
    val simSlot: Int?,    // 1-based slot number, null if single/unknown
    val simLabel: String? // e.g. "SIM 1 – Jio"
)

internal object CallManager {
    private var service: InCallService? = null
    private val calls = mutableListOf<Call>()
    private val incomingCalls = mutableSetOf<Call>()
    private val listeners = CopyOnWriteArrayList<(CallSnapshot) -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    // Cache SIM slot info keyed by PhoneAccountHandle id — readable from DialerModule
    internal val simSlotCache = mutableMapOf<String, Pair<Int, String>>() // id → (slot1based, label)

    fun updateSimCache(id: String, slot: Int, label: String) {
        simSlotCache[id] = Pair(slot, label)
    }

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

    private fun resolveContactName(number: String?): String? {
        if (number.isNullOrBlank()) return null
        if (PrivateIdentity.isPrivate(number)) return PrivateIdentity.DISPLAY_NAME
        return try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_URI, Uri.encode(number))
            service?.contentResolver?.query(
                uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null
            )?.use { c -> if (c.moveToFirst()) c.getString(0)?.takeIf { it.isNotBlank() } else null }
        } catch (_: Exception) { null }
    }

    private fun resolveContactPhoto(number: String?): String? {
        if (number.isNullOrBlank() || PrivateIdentity.isPrivate(number)) return null
        return try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_URI, Uri.encode(number))
            service?.contentResolver?.query(
                uri, arrayOf(ContactsContract.PhoneLookup.PHOTO_THUMBNAIL_URI), null, null, null
            )?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        } catch (_: Exception) { null }
    }

    private fun simInfo(accountHandle: PhoneAccountHandle?): Pair<Int?, String?> {
        val id = accountHandle?.id ?: return Pair(null, null)
        val cached = simSlotCache[id] ?: return Pair(null, null)
        return Pair(cached.first, cached.second)
    }

    fun snapshot(): CallSnapshot {
        val call = primary() ?: return CallSnapshot(
            "idle", "", false, false, 0L, false, false,
            null, null, false, null, null
        )
        val number = call.details?.handle?.schemeSpecificPart
        val priv   = PrivateIdentity.isPrivate(number)
        val name   = if (priv) PrivateIdentity.DISPLAY_NAME
                     else call.details?.callerDisplayName?.takeIf { it.isNotBlank() }
                          ?: resolveContactName(number)
                          ?: number
                          ?: "Unknown"
        val state  = when (call.state) {
            Call.STATE_RINGING                              -> "ringing"
            Call.STATE_ACTIVE                               -> "active"
            Call.STATE_HOLDING                              -> "holding"
            Call.STATE_DISCONNECTING, Call.STATE_DISCONNECTED -> "disconnected"
            else                                            -> "dialing"
        }
        @Suppress("DEPRECATION")
        val audio  = service?.callAudioState

        val heldCall  = held()
        val heldName: String? = if (heldCall != null && heldCall != call) {
            val hn = heldCall.details?.handle?.schemeSpecificPart
            if (PrivateIdentity.isPrivate(hn)) PrivateIdentity.DISPLAY_NAME
            else heldCall.details?.callerDisplayName?.takeIf { it.isNotBlank() }
                 ?: resolveContactName(hn) ?: hn
        } else null

        val canMerge = heldCall != null && heldCall != call &&
                call.state == Call.STATE_ACTIVE && heldCall.state == Call.STATE_HOLDING

        val photo    = if (priv) null else resolveContactPhoto(number)
        val (simSlot, simLabel) = simInfo(call.details?.accountHandle)

        return CallSnapshot(
            state, name, priv, incomingCalls.contains(call),
            call.details?.connectTimeMillis ?: 0L,
            audio?.isMuted ?: false,
            audio?.route == CallAudioState.ROUTE_SPEAKER,
            photo, heldName, canMerge, simSlot, simLabel
        )
    }

    fun publish() { val s = snapshot(); listeners.forEach { it(s) } }

    fun answer() { primary()?.answer(VideoProfile.STATE_AUDIO_ONLY) }
    fun reject() { primary()?.reject(false, null) }
    fun hangup() { primary()?.disconnect() }
    fun setMuted(m: Boolean) { service?.setMuted(m) }
    fun setSpeaker(on: Boolean) {
        service?.setAudioRoute(if (on) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_WIRED_OR_EARPIECE)
    }
    fun hold()   { primary()?.hold() }
    fun unhold() { held()?.unhold() }
    fun merge()  {
        val active   = calls.firstOrNull { it.state == Call.STATE_ACTIVE } ?: return
        val heldCall = held() ?: return
        heldCall.conference(active)
    }
    fun dtmf(c: Char) {
        val call = primary() ?: return
        call.playDtmfTone(c)
        main.postDelayed({ call.stopDtmfTone() }, 120)
    }
}
