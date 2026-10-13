package expo.modules.ritmolive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ongoing focus-timer notification.
 *
 * On Android 16+ it asks to be promoted to a Live Update, which is what One UI 8
 * shows in the Now Bar and the status-bar chip. On older versions it stays a
 * regular ongoing notification with a system-drawn countdown, so it keeps
 * ticking even when the app is closed.
 */
class RitmoLiveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("RitmoLive")

    Function("start") { title: String, endsAt: Double ->
      post(title, endsAt.toLong(), null)
    }

    Function("pause") { title: String, remainingMs: Double ->
      post(title, null, remainingMs.toLong())
    }

    Function("stop") {
      manager().cancel(NOTIFICATION_ID)
    }

    /** True when the system will show our timer as a Live Update (Android 16+). */
    Function("canPromote") {
      if (Build.VERSION.SDK_INT < 36) return@Function false
      try {
        manager().javaClass.getMethod("canPostPromotedNotifications").invoke(manager()) as Boolean
      } catch (e: Exception) {
        false
      }
    }
  }

  private fun manager() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (manager().getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Foco en curso", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Muestra el temporizador de la tarea en curso."
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
    return PendingIntent.getActivity(
      context, 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /**
   * Buttons on the live notification. They reuse the timer widget's click path,
   * which runs our JS in the background, so they work with the app closed.
   */
  private fun actionIntent(action: String, requestCode: Int): PendingIntent {
    val pkg = context.packageName
    val intent = Intent("$pkg.WIDGET_CLICK_LIVE_$action").apply {
      setClassName(pkg, "$pkg.widget.RitmoFoco")
      putExtra("widgetId", -1)
      putExtra("clickAction", action)
      putExtra("clickActionData", Bundle())
    }
    return PendingIntent.getBroadcast(
      context, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  @Suppress("DEPRECATION")
  private fun action(label: String, action: String, requestCode: Int): Notification.Action =
    Notification.Action.Builder(0, label, actionIntent(action, requestCode)).build()

  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else android.R.drawable.ic_lock_idle_alarm
  }

  @Suppress("DEPRECATION")
  private fun post(title: String, endsAt: Long?, remainingMs: Long?) {
    ensureChannel()
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      Notification.Builder(context, CHANNEL_ID)
    else
      Notification.Builder(context)

    builder
      .setSmallIcon(smallIcon())
      .setContentTitle(title)
      .setContentIntent(openAppIntent())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    val status: String
    if (endsAt != null) {
      status = "Foco en curso"
      builder
        .addAction(action("+5 min", "PLUS5", 41))
        .addAction(action("Pausar", "PAUSE", 42))
        .addAction(action("Terminé", "DONE", 43))
      builder
        .setContentText("Foco en curso")
        .setWhen(endsAt)
        .setShowWhen(true)
        .setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(true)
      val left = endsAt - System.currentTimeMillis()
      if (left > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(left)
    } else {
      val minutes = ((remainingMs ?: 0L) + 59_999L) / 60_000L
      status = "En pausa · quedan $minutes min"
      builder
        .setContentText(status)
        .setShowWhen(false)
        .addAction(action("Seguir", "START", 44))
        .addAction(action("Terminé", "DONE", 43))
    }

    // Samsung Live Notifications / Now Bar fields (used when One UI allows this app).
    builder.extras.apply {
      putInt("android.ongoingActivityNoti.style", 1)
      putString("android.ongoingActivityNoti.primaryInfo", title)
      putString("android.ongoingActivityNoti.secondaryInfo", status)
      putString("android.ongoingActivityNoti.nowbarPrimaryInfo", title)
      putString("android.ongoingActivityNoti.nowbarSecondaryInfo", status)
      putString("android.ongoingActivityNoti.chipExpandedText", title)
      putInt("android.ongoingActivityNoti.actionType", 1)
      putInt("android.ongoingActivityNoti.actionPrimarySet", 0)
    }

    // Ask Android 16+ to promote this to a Live Update (Now Bar / status chip).
    builder.extras.putBoolean("android.requestPromotedOngoing", true)
    if (Build.VERSION.SDK_INT >= 36 && remainingMs != null) {
      try {
        val minutes = (remainingMs + 59_999L) / 60_000L
        builder.javaClass.getMethod("setShortCriticalText", String::class.java).invoke(builder, "${minutes}m")
      } catch (_: Exception) {
      }
    }

    manager().notify(NOTIFICATION_ID, builder.build())
  }

  companion object {
    private const val CHANNEL_ID = "ritmo_focus_live"
    private const val NOTIFICATION_ID = 4417
  }
}
