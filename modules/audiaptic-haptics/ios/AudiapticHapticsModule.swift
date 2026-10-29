import CoreHaptics
import ExpoModulesCore

/// Core Haptics caps a single continuous event at 30 seconds.
private let maxContinuousDuration: TimeInterval = 30

/**
 * Plays haptic events with Core Haptics.
 *
 * Each `play` call replaces whatever is vibrating with one continuous
 * vibration at the given intensity and sharpness. Event priority (which event
 * wins) is decided in JS by the event processor; this module only plays.
 *
 * `transitionMs` is used twice, matching the torch output:
 *
 *   intensity
 *     target ┤     ┌───────────────┐
 *            │    ╱                 ╲
 *       from ┤───╱                   ╲
 *            └──┴────┴───────────────┴────┴──► time
 *               0    transition     duration  duration + transition
 *
 * - fade in: from the previous vibration (or silence) up to the target
 * - fade out: from the target down to silence, starting once `durationMs` is over
 *
 * Events with `durationMs` 0 ("until replaced") never fade out on their own.
 */
public class AudiapticHapticsModule: Module {
  /// All haptic work runs here, off the JS thread and one call at a time.
  private let queue = DispatchQueue(label: "com.audiaptic.haptics")

  private var engine: CHHapticEngine?
  private var isEngineRunning = false
  private var player: CHHapticAdvancedPatternPlayer?

  /// The last values played; a transition fades from these.
  private var currentIntensity: Float = 0
  private var currentSharpness: Float = 0
  /// When the current vibration stops on its own (`.distantFuture` while looping).
  private var playingUntil: Date = .distantPast

  public func definition() -> ModuleDefinition {
    Name("AudiapticHaptics")

    /// `false` on devices without a Taptic Engine (e.g. iPads, the simulator).
    Constant("isSupported") {
      CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    /// Starts a vibration that fades in and out over `transitionMs`.
    /// `durationMs` 0 means "until stop() or the next play()".
    Function("play") { (intensity: Double, sharpness: Double, durationMs: Double, transitionMs: Double) in
      self.queue.async {
        self.play(
          intensity: Float(intensity),
          sharpness: Float(sharpness),
          durationMs: durationMs,
          transitionMs: transitionMs
        )
      }
    }

    Function("stop") {
      self.queue.async { self.stop() }
    }

    OnDestroy {
      self.queue.async {
        self.stop()
        self.engine?.stop()
      }
    }
  }

  // MARK: - Playback

  private func play(intensity: Float, sharpness: Float, durationMs: Double, transitionMs: Double) {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }

    let intensity = clamp(intensity)
    let sharpness = clamp(sharpness)

    // A transition starts from the previous vibration, or from silence.
    let wasPlaying = Date() < playingUntil
    let fromIntensity = wasPlaying ? currentIntensity : 0
    let fromSharpness = wasPlaying ? currentSharpness : sharpness

    stop()

    do {
      let engine = try startedEngine()

      let duration = durationMs / 1000
      let transition = transitionMs / 1000
      let fades = transition > 0
      let hasEnd = durationMs > 0
      // The fade-out runs after the duration, so the vibration lasts that much longer.
      let totalDuration = hasEnd ? duration + (fades ? transition : 0) : .infinity
      // Longer than Core Haptics allows (or "until replaced"): loop 30 s chunks.
      let loops = totalDuration > maxContinuousDuration

      // When fading, play at full strength and let the intensity-control curves
      // below scale it (it's a 0...1 multiplier, so it can't go above the base).
      let event = CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: [
          CHHapticEventParameter(parameterID: .hapticIntensity, value: fades ? 1 : intensity),
          CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
          // Hold the strength for the whole duration instead of decaying like a tap.
          CHHapticEventParameter(parameterID: .sustained, value: 1),
        ],
        relativeTime: 0,
        duration: loops ? maxContinuousDuration : totalDuration
      )
      let pattern = try CHHapticPattern(events: [event], parameters: [])
      let player = try engine.makeAdvancedPlayer(with: pattern)
      player.loopEnabled = loops

      // Everything below is timed from this moment, in engine time.
      let startTime = engine.currentTime
      try player.start(atTime: startTime)

      // Curves are scheduled on the player (not baked into the pattern) so a
      // looping vibration fades once instead of on every loop.
      if fades {
        // Fade in from the previous vibration.
        try player.scheduleParameterCurve(
          ramp(.hapticIntensityControl, from: fromIntensity, to: intensity, over: transition),
          atTime: startTime
        )
        // Sharpness control is an offset added to the event's sharpness.
        try player.scheduleParameterCurve(
          ramp(.hapticSharpnessControl, from: fromSharpness - sharpness, to: 0, over: transition),
          atTime: startTime
        )
      }

      if hasEnd {
        if fades {
          // Fade out once the duration is over. If the duration is shorter than
          // the fade-in, start from wherever the fade-in had reached.
          let fadeInProgress = Float(min(1, duration / transition))
          let levelAtEnd = fromIntensity + (intensity - fromIntensity) * fadeInProgress
          try player.scheduleParameterCurve(
            ramp(.hapticIntensityControl, from: levelAtEnd, to: 0, over: transition),
            atTime: startTime + duration
          )
        }
        // Ends a looping vibration; a single event would also end on its own.
        try player.stop(atTime: startTime + totalDuration)
      }

      self.player = player
      currentIntensity = intensity
      currentSharpness = sharpness
      playingUntil = hasEnd ? Date().addingTimeInterval(totalDuration) : .distantFuture
    } catch {
      // A missed vibration shouldn't crash the session; the next event retries.
      print("[AudiapticHaptics] play failed: \(error)")
    }
  }

  private func stop() {
    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil
    playingUntil = .distantPast
  }

  // MARK: - Engine

  /// Creates the engine on first use and (re)starts it if iOS stopped it.
  private func startedEngine() throws -> CHHapticEngine {
    let engine = try self.engine ?? makeEngine()
    if !isEngineRunning {
      try engine.start()
      isEngineRunning = true
    }
    return engine
  }

  private func makeEngine() throws -> CHHapticEngine {
    let engine = try CHHapticEngine()
    engine.playsHapticsOnly = true

    // iOS stops the engine, e.g. when the app goes to the background.
    engine.stoppedHandler = { [weak self] _ in
      self?.queue.async { self?.handleEngineInterrupted() }
    }
    // The haptic server restarted: existing players are no longer valid.
    engine.resetHandler = { [weak self] in
      self?.queue.async { self?.handleEngineInterrupted() }
    }

    self.engine = engine
    return engine
  }

  /// The next play() call restarts the engine and builds a fresh player.
  private func handleEngineInterrupted() {
    isEngineRunning = false
    player = nil
    playingUntil = .distantPast
  }
}

private func clamp(_ value: Float) -> Float {
  max(0, min(1, value))
}

/// A straight-line change of a dynamic parameter from `from` to `to`.
private func ramp(
  _ parameter: CHHapticDynamicParameter.ID,
  from: Float,
  to: Float,
  over seconds: TimeInterval
) -> CHHapticParameterCurve {
  CHHapticParameterCurve(
    parameterID: parameter,
    controlPoints: [
      .init(relativeTime: 0, value: from),
      .init(relativeTime: seconds, value: to),
    ],
    relativeTime: 0
  )
}

