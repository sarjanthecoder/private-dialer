package com.rootaccess.dialer

import android.Manifest
import android.app.role.RoleManager
import android.content.ContentProviderOperation
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CallLog
import android.provider.ContactsContract
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class DialerModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "Dialer"

    private val listener: (CallSnapshot) -> Unit = { emit(it) }

    override fun initialize() {
        super.initialize()
        CallManager.addListener(listener)
        // Prime SIM slot cache on startup
        primeSimCache()
    }

    override fun invalidate() {
        CallManager.removeListener(listener)
        super.invalidate()
    }

    private fun primeSimCache() {
        try {
            val tm = ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val accounts = tm.callCapablePhoneAccounts ?: return
            if (Build.VERSION.SDK_INT >= 22) {
                val sm = ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                val subs = if (ctx.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED)
                    sm?.activeSubscriptionInfoList else null
                accounts.forEachIndexed { idx, handle ->
                    val pa = tm.getPhoneAccount(handle) ?: return@forEachIndexed
                    val label = pa.label?.toString() ?: "SIM ${idx + 1}"
                    // Try to match via subscription id in handle id
                    val subId = handle.id.toLongOrNull()?.toInt()
                    val sub = subs?.firstOrNull { it.subscriptionId == subId }
                    val slot = (sub?.simSlotIndex ?: idx) + 1 // 1-based for UI
                    CallManager.updateSimCache(handle.id, slot, label)
                }
            }
        } catch (e: Exception) {}
    }

    private fun CallSnapshot.toMap(): WritableMap = Arguments.createMap().apply {
        putString("state",       state)
        putString("displayName", displayName)
        putBoolean("isPrivate",  isPrivate)
        putBoolean("incoming",   incoming)
        putDouble("connectTime", connectTimeMillis.toDouble())
        putBoolean("muted",      muted)
        putBoolean("speaker",    speaker)
        if (photoUri    != null) putString("photoUri",    photoUri)    else putNull("photoUri")
        if (heldCallName != null) putString("heldCallName", heldCallName) else putNull("heldCallName")
        putBoolean("canMerge", canMerge)
        if (simSlot  != null) putInt("simSlot",   simSlot)   else putNull("simSlot")
        if (simLabel != null) putString("simLabel", simLabel) else putNull("simLabel")
    }

    private fun emit(s: CallSnapshot) {
        if (!ctx.hasActiveReactInstance()) return
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onCallState", s.toMap())
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    @ReactMethod
    fun getCurrentCall(promise: Promise) = promise.resolve(CallManager.snapshot().toMap())

    private fun place(uri: Uri, simId: String?, promise: Promise) {
        val tm = ctx.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager

        // 1. Try TelecomManager.placeCall (succeeds when app is default dialer)
        if (tm != null) {
            try {
                val extras = Bundle()
                if (!simId.isNullOrBlank()) {
                    val accounts = tm.callCapablePhoneAccounts
                    val handle = accounts?.firstOrNull { it.id == simId }
                    if (handle != null) {
                        extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
                    }
                }
                tm.placeCall(uri, extras)
                promise.resolve(true)
                return
            } catch (e: Exception) {
                // Not default dialer or TelecomManager failed, fallback to direct intent
            }
        }

        // 2. Direct call via Intent.ACTION_CALL (requires CALL_PHONE permission, works without default dialer)
        if (ctx.checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
            try {
                val callIntent = Intent(Intent.ACTION_CALL, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    if (!simId.isNullOrBlank()) {
                        putExtra("com.android.phone.extra.slot", simId.toIntOrNull() ?: 0)
                        putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE", simId)
                    }
                }
                ctx.startActivity(callIntent)
                promise.resolve(true)
                return
            } catch (e: Exception) {
                // Fall through to ACTION_DIAL
            }
        }

        // 3. Fallback to Intent.ACTION_DIAL (always succeeds, opens system dialer if permission not yet granted)
        try {
            val dialIntent = Intent(Intent.ACTION_DIAL, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(dialIntent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_CALL", "Unable to place call: ${e.message}")
        }
    }

    @ReactMethod fun callPrivate(promise: Promise) = place(PrivateIdentity.dialUri(), null, promise)

    @ReactMethod
    fun dial(digits: String, simId: String?, promise: Promise) {
        if (digits.isBlank()) { promise.reject("E_EMPTY", "Nothing to dial"); return }
        if (PrivateIdentity.isPrivate(digits)) place(PrivateIdentity.dialUri(), null, promise)
        else place(Uri.fromParts("tel", digits, null), simId, promise)
    }

    @ReactMethod
    fun resolveInput(digits: String, promise: Promise) = promise.resolve(PrivateIdentity.resolve(digits))

    @ReactMethod fun answer()                = CallManager.answer()
    @ReactMethod fun reject()                = CallManager.reject()
    @ReactMethod fun hangup()                = CallManager.hangup()
    @ReactMethod fun setMuted(m: Boolean)    = CallManager.setMuted(m)
    @ReactMethod fun setSpeaker(on: Boolean) = CallManager.setSpeaker(on)
    @ReactMethod fun sendDtmf(d: String)     { if (d.isNotEmpty()) CallManager.dtmf(d[0]) }
    @ReactMethod fun hold()                  = CallManager.hold()
    @ReactMethod fun unhold()                = CallManager.unhold()
    @ReactMethod fun merge()                 = CallManager.merge()

    /** Returns active SIM cards as [{id, label, slot, displaySlot}]. */
    @ReactMethod
    fun getSims(promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            promise.resolve(Arguments.createArray()); return
        }
        try {
            val tm = ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val accounts = tm.callCapablePhoneAccounts ?: run { promise.resolve(Arguments.createArray()); return }
            val sm = if (Build.VERSION.SDK_INT >= 22)
                ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            else null
            val subs = sm?.activeSubscriptionInfoList

            val out = Arguments.createArray()
            accounts.forEachIndexed { idx, handle ->
                val pa = tm.getPhoneAccount(handle) ?: return@forEachIndexed
                val label = pa.label?.toString() ?: "SIM ${idx + 1}"
                val subId = handle.id.toLongOrNull()?.toInt()
                val sub   = subs?.firstOrNull { it.subscriptionId == subId }
                val slot0 = sub?.simSlotIndex ?: idx
                val slot1 = slot0 + 1
                // Update cache
                CallManager.updateSimCache(handle.id, slot1, label)
                val map = Arguments.createMap()
                map.putString("id",           handle.id)
                map.putString("label",        label)
                map.putInt("slot",            slot0)
                map.putInt("displaySlot",     slot1)
                out.pushMap(map)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    @ReactMethod
    fun isDefaultDialer(promise: Promise) {
        val tm = ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        promise.resolve(tm.defaultDialerPackage == ctx.packageName)
    }

    @ReactMethod
    fun requestDefaultDialer(promise: Promise) {
        val act = currentActivity ?: run { promise.reject("E_ACTIVITY", "No activity"); return }
        try {
            val intent: Intent = if (Build.VERSION.SDK_INT >= 29) {
                val rm = ctx.getSystemService(Context.ROLE_SERVICE) as RoleManager
                rm.createRequestRoleIntent(RoleManager.ROLE_DIALER)
            } else {
                Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
                    .putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, ctx.packageName)
            }
            act.startActivityForResult(intent, 4242)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_ROLE", "Unable to request default dialer role")
        }
    }

    @ReactMethod
    fun getCallLog(limit: Int, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Call log permission required"); return
        }
        Thread {
            try {
                val out  = Arguments.createArray()
                val proj = arrayOf(
                    CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.TYPE,
                    CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.PHONE_ACCOUNT_ID
                )
                ctx.contentResolver.query(
                    CallLog.Calls.CONTENT_URI, proj, null, null, "${CallLog.Calls.DATE} DESC"
                )?.use { c ->
                    var n = 0
                    while (c.moveToNext() && n < limit) {
                        val type = when (c.getInt(2)) {
                            CallLog.Calls.INCOMING_TYPE -> "incoming"
                            CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                            CallLog.Calls.MISSED_TYPE   -> "missed"
                            CallLog.Calls.REJECTED_TYPE, CallLog.Calls.BLOCKED_TYPE -> "rejected"
                            else -> continue
                        }
                        val number = c.getString(1)
                        val priv   = PrivateIdentity.isPrivate(number)
                        val accountId = c.getString(6)
                        val simInfo = accountId?.let { CallManager.simSlotCache[it] }
                        val map = Arguments.createMap()
                        map.putString("id",   c.getLong(0).toString())
                        map.putString("type", type)
                        map.putBoolean("isPrivate", priv)
                        map.putString("name",
                            if (priv) PrivateIdentity.DISPLAY_NAME
                            else c.getString(5)?.takeIf { it.isNotBlank() } ?: number ?: "Unknown"
                        )
                        map.putString("number", if (priv) "" else number ?: "")
                        map.putDouble("date",   c.getLong(3).toDouble())
                        map.putInt("duration",  c.getInt(4))
                        if (simInfo != null) {
                            map.putInt("simSlot", simInfo.first)
                            map.putString("simLabel", simInfo.second)
                        } else {
                            map.putNull("simSlot")
                            map.putNull("simLabel")
                        }
                        out.pushMap(map)
                        n++
                    }
                }
                promise.resolve(out)
            } catch (e: Exception) {
                promise.reject("E_LOG", "Unable to read call log")
            }
        }.start()
    }

    @ReactMethod
    fun getContacts(promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Contacts permission required"); return
        }
        
        Thread {
            try {
                val out  = Arguments.createArray()
                val proj = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI
                )
                val seen = mutableSetOf<String>()
                ctx.contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI, proj, null, null,
                    "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
                )?.use { c ->
                    val idIdx    = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameIdx  = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx   = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val photoIdx = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI)
                    while (c.moveToNext()) {
                        val id     = if (idIdx >= 0) c.getLong(idIdx).toString() else ""
                        val name   = (if (nameIdx >= 0) c.getString(nameIdx) else null)?.takeIf { it.isNotBlank() } ?: continue
                        val number = (if (numIdx >= 0) c.getString(numIdx) else null)?.takeIf { it.isNotBlank() } ?: continue
                        if (PrivateIdentity.isPrivate(number)) continue
                        if (!seen.add("$id|${number.replace("\\s".toRegex(), "")}")) continue
                        val photoUri = if (photoIdx >= 0) c.getString(photoIdx) else null
                        val map = Arguments.createMap()
                        map.putString("id",   id)
                        map.putString("name", name)
                        map.putString("number", number)
                        if (photoUri != null) map.putString("photoUri", photoUri) else map.putNull("photoUri")
                        out.pushMap(map)
                    }
                }
                promise.resolve(out)
            } catch (e: Exception) {
                promise.reject("E_CONTACTS", "Unable to read contacts: ${e.message}")
            }
        }.start()
    }

    @ReactMethod
    fun addContact(contact: ReadableMap, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Write contacts permission required"); return
        }
        val name   = contact.getString("name")?.trim()   ?: ""
        val number = contact.getString("number")?.trim() ?: ""
        if (name.isEmpty() || number.isEmpty()) {
            promise.reject("E_INVALID", "Name and number required"); return
        }
        Thread {
            try {
                val ops = arrayListOf<ContentProviderOperation>()
                ops.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null).build())
                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name).build())
                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, number)
                    .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE).build())
                val results = ctx.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
                promise.resolve(results[0].uri?.lastPathSegment ?: "0")
            } catch (e: Exception) {
                promise.reject("E_ADD", "Unable to add contact: ${e.message}")
            }
        }.start()
    }

    @ReactMethod
    fun deleteContact(contactId: String, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Write contacts permission required"); return
        }
        Thread {
            try {
                val uri  = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, contactId)
                val rows = ctx.contentResolver.delete(uri, null, null)
                promise.resolve(rows > 0)
            } catch (e: Exception) {
                promise.reject("E_DELETE", "Unable to delete contact: ${e.message}")
            }
        }.start()
    }

    @ReactMethod
    fun setHighRefreshRate(promise: Promise) {
        val act = currentActivity ?: run { promise.resolve(0.0); return }
        act.runOnUiThread {
            try {
                @Suppress("DEPRECATION")
                val display = act.windowManager.defaultDisplay
                val cur  = display.mode
                val best = display.supportedModes
                    .filter { it.physicalWidth == cur.physicalWidth && it.physicalHeight == cur.physicalHeight }
                    .maxByOrNull { it.refreshRate } ?: cur
                val lp = act.window.attributes
                lp.preferredDisplayModeId = best.modeId
                act.window.attributes = lp
                promise.resolve(best.refreshRate.toDouble())
            } catch (e: Exception) {
                promise.resolve(0.0)
            }
        }
    }
}
