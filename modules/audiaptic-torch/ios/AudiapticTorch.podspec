require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AudiapticTorch'
  s.version        = package['version']
  s.summary        = 'Native torch brightness level control for Audiaptic'
  s.description    = 'Controls hardware flashlight intensity levels on iOS'
  s.license        = 'MIT'
  s.author         = 'TeamAudiaptic'
  s.homepage       = 'https://github.com/TeamAudiaptic/audiaptic-client'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end

