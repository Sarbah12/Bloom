Pod::Spec.new do |s|
  s.name           = 'BloomShortcuts'
  s.version        = '1.0.0'
  s.summary        = 'Home screen quick actions and Siri hand-off for Bloom'
  s.author         = 'Bloom'
  s.homepage       = 'https://github.com/Sarbah12/Bloom'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.swift'
end
