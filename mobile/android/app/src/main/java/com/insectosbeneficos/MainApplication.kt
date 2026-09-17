package com.insectosbeneficos

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createNotificationChannels()
  }

  /**
   * Crea canales de notificacion para Android 8+ (API 26+).
   * Los canales son requeridos para que las push se muestren
   * como notificaciones del sistema (estilo WhatsApp).
   */
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)

      // Canal general de notificaciones del sistema
      val generalChannel = NotificationChannel(
        "insectos_beneficos_general",
        "Notificaciones del sistema",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notificaciones de programaciones, requerimientos y cambios de estado"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 300, 200, 300)
      }

      // Canal de alertas de exito (cuando el usuario envia algo)
      val successChannel = NotificationChannel(
        "insectos_beneficos_success",
        "Confirmaciones de envio",
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "Confirmaciones de que tu accion se envio correctamente"
      }

      manager.createNotificationChannel(generalChannel)
      manager.createNotificationChannel(successChannel)
    }
  }
}
