package com.rootaccess.dialer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles incoming call notification action buttons (Answer & Decline).
 */
class CallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ANSWER = "com.rootaccess.dialer.ACTION_ANSWER"
        const val ACTION_REJECT = "com.rootaccess.dialer.ACTION_REJECT"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ACTION_ANSWER -> {
                CallManager.answer()
                // Bring in-call UI to front
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                }
                if (launchIntent != null) {
                    context.startActivity(launchIntent)
                }
            }
            ACTION_REJECT -> {
                CallManager.reject()
            }
        }
    }
}

