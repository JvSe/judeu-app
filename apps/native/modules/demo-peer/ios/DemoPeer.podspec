Pod::Spec.new do |s|
  s.name           = 'DemoPeer'
  s.version        = '1.0.0'
  s.summary        = 'Multipeer Connectivity para o Modo Apresentação do Judeu'
  s.description    = 'Liga dois aparelhos iOS direto (Wi-Fi ponto a ponto), sem internet nem servidor.'
  s.author         = ''
  s.homepage       = 'https://judeu.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MultipeerConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
