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
import android.telecom.TelecomManager
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
    }

    override fun invalidate() {
        CallManager.removeListener(listener)
        super.invalidate()
    }

    private fun CallSnapshot.toMap(): WritableMap = Arguments.createMap().apply {
        putString("state", state)
        putString("displayName", displayName)
        putBoolean("isPrivate", isPrivate)
        putBoolean("incoming", incoming)
        putDouble("connectTime", connectTimeMillis.toDouble())
        putBoolean("muted", muted)
        putBoolean("speaker", speaker)
        if (photoUri != null) putString("photoUri", photoUri) else putNull("photoUri")
        if (heldCallName != null) putString("heldCallName", heldCallName) else putNull("heldCallName")
        putBoolean("canMerge", canMerge)
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

    private fun place(uri: Uri, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Phone permission required"); return
        }
        try {
            val tm = ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            tm.placeCall(uri, Bundle())
            promise.resolve(true)
        } catch (e: SecurityException) {
            promise.reject("E_PERMISSION", "Phone permission required")
        } catch (e: Exception) {
            promise.reject("E_CALL", "Unable to place call")
        }
    }

    @ReactMethod fun callPrivate(promise: Promise) = place(PrivateIdentity.dialUri(), promise)

    @ReactMethod
    fun dial(digits: String, promise: Promise) {
        if (digits.isBlank()) { promise.reject("E_EMPTY", "Nothing to dial"); return }
        if (PrivateIdentity.isPrivate(digits)) place(PrivateIdentity.dialUri(), promise)
        else place(Uri.fromParts("tel", digits, null), promise)
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
                val out = Arguments.createArray()
                val proj = arrayOf(
                    CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.TYPE,
                    CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.CACHED_NAME
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
                        val priv = PrivateIdentity.isPrivate(number)
                        val map = Arguments.createMap()
                        map.putString("id",   c.getLong(0).toString())
                        map.putString("type", type)
                        map.putBoolean("isPrivate", priv)
                        map.putString("name",
                            if (priv) PrivateIdentity.DISPLAY_NAME
                            else c.getString(5)?.takeIf { it.isNotBlank() } ?: number ?: "Unknown"
                        )
                        map.putString("number", if (priv) "" else number ?: "")
                        map.putDouble("date", c.getLong(3).toDouble())
                        map.putInt("duration", c.getInt(4))
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

    /** Returns all phone contacts, sorted A–Z.
     *  The private contact (RootAccess) is injected at top with an empty number so
     *  the UI shows the name + call button but the number is never exposed anywhere.
     */
    @ReactMethod
    fun getContacts(promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Contacts permission required"); return
        }
        Thread {
            try {
                val out  = Arguments.createArray()

                // ── Inject private contact at the very top (number hidden, id = "private") ──
                val privateEntry = Arguments.createMap()
                privateEntry.putString("id",   "private")
                privateEntry.putString("name", PrivateIdentity.DISPLAY_NAME)
                privateEntry.putString("number", "")   // number NEVER sent to JS
                privateEntry.putNull("photoUri")
                out.pushMap(privateEntry)

                val proj = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI
                )
                val seen = mutableSetOf<String>()
                ctx.contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    proj, null, null,
                    "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
                )?.use { c ->
                    val idIdx    = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameIdx  = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx   = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val photoIdx = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI)
                    while (c.moveToNext()) {
                        val id     = c.getLong(idIdx).toString()
                        val name   = c.getString(nameIdx)?.takeIf { it.isNotBlank() } ?: continue
                        val number = c.getString(numIdx)?.takeIf  { it.isNotBlank() } ?: continue
                        // Skip private contact (never list it again from device contacts)
                        if (PrivateIdentity.isPrivate(number)) continue
                        val key = "$id|${number.replace("\\s".toRegex(), "")}"
                        if (!seen.add(key)) continue
                        val photoUri = c.getString(photoIdx)
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

    /**
     * Creates a new device contact with the given name + number.
     * Returns the new raw-contact ID string on success.
     * Requires WRITE_CONTACTS + READ_CONTACTS permissions.
     */
    @ReactMethod
    fun addContact(contact: ReadableMap, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Write contacts permission required"); return
        }
        val name   = contact.getString("name")?.trim()   ?: ""
        val number = contact.getString("number")?.trim() ?: ""
        if (name.isEmpty() || number.isEmpty()) {
            promise.reject("E_INVALID", "Name and number are required"); return
        }
        Thread {
            try {
                val ops = arrayListOf<ContentProviderOperation>()

                // 1. Insert raw contact (no account → stored locally)
                ops.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                    .build())

                // 2. Display name
                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
                    .build())

                // 3. Phone number (mobile)
                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, number)
                    .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                    .build())

                val results = ctx.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
                val rawId = results[0].uri?.lastPathSegment ?: "0"
                promise.resolve(rawId)
            } catch (e: Exception) {
                promise.reject("E_ADD_CONTACT", "Unable to add contact: ${e.message}")
            }
        }.start()
    }

    /**
     * Deletes the contact and all its associated data by contact ID.
     * Requires WRITE_CONTACTS permission.
     */
    @ReactMethod
    fun deleteContact(contactId: String, promise: Promise) {
        if (ctx.checkSelfPermission(Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_PERMISSION", "Write contacts permission required"); return
        }
        Thread {
            try {
                val contactUri = Uri.withAppendedPath(
                    ContactsContract.Contacts.CONTENT_URI, contactId
                )
                val rows = ctx.contentResolver.delete(contactUri, null, null)
                promise.resolve(rows > 0)
            } catch (e: Exception) {
                promise.reject("E_DELETE_CONTACT", "Unable to delete contact: ${e.message}")
            }
        }.start()
    }

    /** Requests the highest refresh rate the panel supports. */
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
