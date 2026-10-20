package expo.modules.audiaptictorch

import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.roundToInt

class AudiapticTorchModule : Module() {
  private val cameraManager: CameraManager
    get() = appContext.reactContext?.getSystemService(CameraManager::class.java)
      ?: throw Exceptions.ReactContextLost()

  /** The back camera with a flash, or null if the device has no torch. Looked up once. */
  private val cameraId: String? by lazy {
    cameraManager.cameraIdList.firstOrNull { id ->
      val c = cameraManager.getCameraCharacteristics(id)
      c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true &&
        c.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
    }
  }

  /**
   * Number of brightness steps. Only Android 13+ devices with supporting
   * hardware report more than 1; the rest can only switch the torch on or off.
   */
  private val maxStrength: Int by lazy {
    val id = cameraId
    if (id == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      1
    } else {
      cameraManager.getCameraCharacteristics(id)
        .get(CameraCharacteristics.FLASH_INFO_STRENGTH_MAXIMUM_LEVEL) ?: 1
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudiapticTorch")

    Function("setTorchLevel") { level: Float ->
      val id = cameraId ?: return@Function

      try {
        val clamped = level.coerceIn(0f, 1f)
        if (clamped <= 0.01f) {
          cameraManager.setTorchMode(id, false)
        } else if (maxStrength > 1 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          // Same perceptual curve as iOS so fades look alike on both platforms.
          // Android takes whole steps from 1 to maxStrength instead of 0..1.
          val perceptualLevel = clamped * clamped
          val strength = (perceptualLevel * maxStrength).roundToInt().coerceIn(1, maxStrength)
          cameraManager.turnOnTorchWithStrengthLevel(id, strength)
        } else {
          cameraManager.setTorchMode(id, true)
        }
      } catch (e: CameraAccessException) {
        // Torch busy (e.g. another app has the camera); ignore like iOS does
      } catch (e: IllegalArgumentException) {
        // Strength rejected by the device; ignore during rapid updates
      }
    }
  }
}
