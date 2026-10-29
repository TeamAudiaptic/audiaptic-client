import AVFoundation
import ExpoModulesCore

public class AudiapticTorchModule: Module {
  /// Looked up once so rapid fade and strobe ticks don't re-query AVFoundation.
  private lazy var device: AVCaptureDevice? = {
    guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else {
      return nil
    }
    return device
  }()

  public func definition() -> ModuleDefinition {
    Name("AudiapticTorch")

    Function("setTorchLevel") { (level: Float) in
      guard let device = self.device else {
        return
      }

      do {
        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }

        let clamped = max(0.0, min(1.0, level))
        if clamped <= 0.01 {
          if device.torchMode != .off {
            device.torchMode = .off
          }
        } else {
          // Human vision is logarithmic; squaring the linear 0..1 level makes
          // brightness transitions look smooth and distinct across the whole fade.
          let perceptualLevel = max(0.01, min(1.0, clamped * clamped))
          try device.setTorchModeOn(level: perceptualLevel)
        }
      } catch {
        // Ignore configuration lock errors during rapid updates
      }
    }
  }
}

