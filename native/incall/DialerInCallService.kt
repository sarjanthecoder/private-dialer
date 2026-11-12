package com.rootaccess.dialer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService

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
            openUi()
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

        // Action 1: Green Answer button in notification
        val answerIntent = Intent(this, CallActionReceiver::class.java).apply {
            action = CallActionReceiver.ACTION_ANSWER
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            this, 101, answerIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Action 2: Red Decline button in notification
        val rejectIntent = Intent(this, CallActionReceiver::class.java).apply {
            action = CallActionReceiver.ACTION_REJECT
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            this, 102, rejectIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        val n = builder
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(CallManager.snapshot().displayName)
            .setContentText("Incoming call")
            .setOngoing(true)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .addAction(
                Notification.Action.Builder(
                    android.R.drawable.sym_action_call, "Answer", answerPendingIntent
                ).build()
            )
            .addAction(
                Notification.Action.Builder(
                    android.R.drawable.ic_menu_close_clear_cancel, "Decline", rejectPendingIntent
                ).build()
            )
            .setCategory(Notification.CATEGORY_CALL)
            .build()
        try { nm.notify(NOTIF_ID, n) } catch (e: SecurityException) { }
    }
}
