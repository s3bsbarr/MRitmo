package expo.modules.ritmolive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ongoing focus-timer notification, built to qualify as an Android 16 Live Update
 * (status-bar chip + Samsung Now Bar on One UI 8):
 *  - ongoing, with a title, not colorized, no custom views, not a group summary
 *  - ProgressStyle on Android 16+ (the style Google's own Live Update sample uses)
 *  - promotion requested through the API and the extra
 *  - POST_PROMOTED_NOTIFICATIONS declared in the manifest
 * Below Android 16 it is a regular ongoing notification with a system countdown.
 */
class RitmoLiveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private val handler = Handler(Looper.getMainLooper())
  private var current: Live? = null
  private var lastBuilt: Notification? = null

  private data class Live(val title: String, val endsAt: Long?, val remainingMs: Long?, val totalMs: Long)

  /** While a block runs, refresh the progress bar every 30 s (the countdown itself is drawn by the system). */
  private val tick = object : Runnable {
    override fun run() {
      val live = current ?: return
      val endsAt = live.endsAt ?: return
      if (System.currentTimeMillis() >= endsAt) return
      post(live)
      handler.postDelayed(this, 30_000L)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("RitmoLive")

    Function("start") { title: String, endsAt: Double, totalMs: Double ->
      handler.removeCallbacks(tick)
      current = Live(title, endsAt.toLong(), null, totalMs.toLong())
      post(current!!)
      handler.postDelayed(tick, 30_000L)
    }

    Function("pause") { title: String, remainingMs: Double, totalMs: Double ->
      handler.removeCallbacks(tick)
      current = Live(title, null, remainingMs.toLong(), totalMs.toLong())
      post(current!!)
    }

    Function("stop") {
      handler.removeCallbacks(tick)
      current = null
      manager().cancel(NOTIFICATION_ID)
    }

    /** What the system decided about our timer, to show in Settings and debug the Now Bar. */
    Function("diagnose") {
      val sdk = Build.VERSION.SDK_INT
      val canPost: Boolean? = if (sdk >= 36) callBool(manager(), "canPostPromotedNotifications") else null
      val promotable: Boolean? = if (sdk >= 36) lastBuilt?.let { callBool(it, "hasPromotableCharacteristics") } else null
      var active = false
      var promoted: Boolean? = null
      try {
        val sbn = manager().activeNotifications.firstOrNull { it.id == NOTIFICATION_ID }
        if (sbn != null) {
          active = true
          val flag = try { Notification::class.java.getField("FLAG_PROMOTED_ONGOING").getInt(null) } catch (_: Exception) { 0x00040000 }
          promoted = (sbn.notification.flags and flag) != 0
        }
      } catch (_: Exception) {
      }
      mapOf(
        "sdk" to sdk,
        "manufacturer" to Build.MANUFACTURER,
        "canPost" to canPost,
        "promotable" to promotable,
        "active" to active,
        "promoted" to promoted,
      )
    }

    /** Opens the per-app Live Updates switch (Android 16), or the app's notification settings. */
    Function("openPromotionSettings") {
      val pkg = context.packageName
      val candidates = listOf(
        Intent("android.settings.APP_NOTIFICATION_PROMOTION_SETTINGS").putExtra(Settings.EXTRA_APP_PACKAGE, pkg),
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg),
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")),
      )
      val intent = candidates.first { it.resolveActivity(context.packageManager) != null }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun callBool(target: Any, method: String): Boolean? =
    try { target.javaClass.getMethod(method).invoke(target) as Boolean } catch (_: Exception) { null }

  private fun manager() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (manager().getNotificationChannel(CHANNEL_ID) != null) return
    // DEFAULT importance: Live Updates are refused for IMPORTANCE_MIN channels.
    val channel = NotificationChannel(CHANNEL_ID, "Foco en curso", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Temporizador de la tarea en curso, en la barra de estado y la Now Bar."
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager().createNotificationChannel(channel)
  }

  private fun openAppIntent(): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("ritmo://foco")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val launch = if (intent.resolveActivity(context.packageManager) != null) intent
      else context.packageManager.getLaunchIntentForPackage(context.packageName) ?: intent
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Buttons reuse the timer widget's click path, which runs our JS in the background. */
  private fun actionIntent(action: String, requestCode: Int): PendingIntent {
    val pkg = context.packageName
    val intent = Intent("$pkg.WIDGET_CLICK_LIVE_$action").apply {
      setClassName(pkg, "$pkg.widget.RitmoFoco")
      putExtra("widgetId", -1)
      putExtra("clickAction", action)
      putExtra("clickActionData", Bundle())
    }
    return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  @Suppress("DEPRECATION")
  private fun action(label: String, action: String, requestCode: Int): Notification.Action =
    Notification.Action.Builder(0, label, actionIntent(action, requestCode)).build()

  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else android.R.drawable.ic_lock_idle_alarm
  }

  @Suppress("DEPRECATION")
  private fun post(live: Live) {
    ensureChannel()
    val now = System.currentTimeMillis()
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL_ID) else Notification.Builder(context)

    builder
      .setSmallIcon(smallIcon())
      .setContentTitle(live.title)
      .setContentIntent(openAppIntent())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setColorized(false)
      // Accent for the status chip, Now Bar and progress: white instead of the system blue.
      .setColor(Color.WHITE)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    val remaining: Long
    if (live.endsAt != null) {
      remaining = (live.endsAt - now).coerceAtLeast(0L)
      builder
        .setContentText("Foco en curso")
        .setWhen(live.endsAt)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .addAction(action("+5 min", "PLUS5", 41))
        .addAction(action("Pausar", "PAUSE", 42))
        .addAction(action("Terminé", "DONE", 43))
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(true)
      if (remaining > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(remaining + 60_000L)
    } else {
      remaining = live.remainingMs ?: 0L
      val minutes = (remaining + 59_999L) / 60_000L
      builder
        .setContentText("En pausa · quedan $minutes min")
        .setShowWhen(false)
        .addAction(action("Seguir", "START", 44))
        .addAction(action("Terminé", "DONE", 43))
    }

    if (Build.VERSION.SDK_INT >= 36) applyLiveUpdate(builder, live, remaining)
    else builder.extras.putBoolean(EXTRA_REQUEST_PROMOTED, true)

    val notification = builder.build()
    lastBuilt = notification
    manager().notify(NOTIFICATION_ID, notification)
  }

  /** Android 16: ProgressStyle + explicit promotion request + chip text when paused. */
  private fun applyLiveUpdate(builder: Notification.Builder, live: Live, remaining: Long) {
    val total = live.totalMs.coerceAtLeast(1L)
    val done = ((total - remaining).coerceIn(0L, total) * 1000L / total).toInt()
    try {
      val style = Notification.ProgressStyle()
        .setStyledByProgress(true)
        .setProgressSegments(listOf(Notification.ProgressStyle.Segment(1000).setColor(Color.WHITE)))
        .setProgress(done)
      builder.setStyle(style)
    } catch (_: Throwable) {
    }

    // setRequestPromotedOngoing arrived in API 36.1; the extra works on 36.0 too.
    builder.extras.putBoolean(EXTRA_REQUEST_PROMOTED, true)
    try {
      builder.javaClass.getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType).invoke(builder, true)
    } catch (_: Exception) {
    }

    if (live.endsAt == null) {
      // Paused: the chip shows the minutes left instead of a running clock.
      val minutes = (remaining + 59_999L) / 60_000L
      try {
        builder.setShortCriticalText("${minutes}m")
      } catch (_: Throwable) {
      }
    }
  }

  companion object {
    private const val CHANNEL_ID = "ritmo_focus_live_v2"
    private const val NOTIFICATION_ID = 4417
    private const val EXTRA_REQUEST_PROMOTED = "android.requestPromotedOngoing"
  }
}
