Pod::Spec.new do |s|
  s.name           = 'BloomOnDeviceAI'
  s.version        = '1.0.0'
  s.summary        = "Apple's on-device language model for Bloom Assistant"
  s.author         = 'Bloom'
  s.homepage       = 'https://github.com/Sarbah12/Bloom'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  # Weak: the framework only exists on iOS 26 and later; the app supports 16.4.
  s.weak_frameworks = 'FoundationModels'
  s.source_files   = '**/*.swift'
end
