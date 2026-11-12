package com.rootaccess.dialer

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CallRecorder {

    private var recorder: MediaRecorder? = null
    private var currentFile: File? = null
    @Volatile var isRecording: Boolean = false
        private set

    fun start(context: Context, contactName: String) {
        if (isRecording) return
        try {
            val dir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                "RootAccessDialer"
            )
            if (!dir.exists()) dir.mkdirs()

            val ts = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault()).format(Date())
            val safeName = contactName.replace(Regex("[^a-zA-Z0-9_\\-]"), "_").take(30)
            val file = File(dir, "${ts}_${safeName}.m4a")
            currentFile = file

            val mr = if (Build.VERSION.SDK_INT >= 31) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            // Try VOICE_CALL first (captures both sides on supported devices/ROMs)
            // On restricted devices it falls back to MIC
            var audioSource = MediaRecorder.AudioSource.VOICE_CALL
            try {
                mr.setAudioSource(audioSource)
            } catch (e: Exception) {
                audioSource = MediaRecorder.AudioSource.MIC
                mr.reset()
                mr.setAudioSource(audioSource)
            }

            mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mr.setAudioEncodingBitRate(128_000)
            mr.setAudioSamplingRate(44_100)
            mr.setOutputFile(file.absolutePath)
            mr.prepare()
            mr.start()

            recorder = mr
            isRecording = true
        } catch (e: Exception) {
            isRecording = false
            currentFile = null
            recorder = null
        }
    }

    fun stop(): String? {
        if (!isRecording) return null
        return try {
            recorder?.apply {
                stop()
                release()
            }
            recorder = null
            isRecording = false
            currentFile?.absolutePath
        } catch (e: Exception) {
            recorder?.release()
            recorder = null
            isRecording = false
            currentFile?.absolutePath
        } finally {
            currentFile = null
        }
    }

    fun cancel() {
        try {
            recorder?.apply { stop(); release() }
        } catch (e: Exception) {}
        recorder = null
        isRecording = false
        currentFile?.delete()
        currentFile = null
    }
}

