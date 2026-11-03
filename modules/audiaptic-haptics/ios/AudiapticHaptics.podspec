require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AudiapticHaptics'
  s.version        = package['version']
  s.summary        = 'Continuous Core Haptics playback for Audiaptic'
  s.description    = 'Plays haptic events with intensity, sharpness, duration and transitions on iOS'
  s.license        = 'MIT'
  s.author         = 'TeamAudiaptic'
  s.homepage       = 'https://github.com/TeamAudiaptic/audiaptic-client'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreHaptics'

  s.source_files = "**/*.{h,m,swift}"
end

