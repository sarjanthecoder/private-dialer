package com.rootaccess.dialer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import androidx.core.app.NotificationCompat

class DialerInCallService : InCallService() {
    companion object {
        private const val CHANNEL_ID = "incoming_calls"
        private const val NOTIF_ID = 1001
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        CallManager.onCallAdded(call, this)
        if (call.state == Call.STATE_RINGING) {
            call.registerCallback(object : Call.Callback() {
                override fun onStateChanged(c: Call, state: Int) {
                    if (state != Call.STATE_RINGING) cancelNotification()
                }
            })
            showIncoming()
        } else {
            openUi()
        }
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        CallManager.onCallRemoved(call)
        cancelNotification()
    }

    @Deprecated("Deprecated in Java")
    override fun onCallAudioStateChanged(audioState: CallAudioState?) {
        super.onCallAudioStateChanged(audioState)
        CallManager.publish()
    }

    private fun launchIntent(): Intent? =
        packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

    private fun openUi() {
        try { launchIntent()?.let { startActivity(it) } } catch (e: Exception) { }
    }

    private fun cancelNotification() {
        getSystemService(NotificationManager::class.java).cancel(NOTIF_ID)
    }

    private fun showIncoming() {
        val intent = launchIntent() ?: return
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
            ch.setSound(null, null)
            nm.createNotificationChannel(ch)
        }
        val pi = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(CallManager.snapshot().displayName) // name only, never the number for private contact
            .setContentText("Incoming call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()
        try { nm.notify(NOTIF_ID, n) } catch (e: SecurityException) { }
    }
}
