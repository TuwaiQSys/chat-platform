export interface ClientSignals {
  screenRes: string
  timezone: string
  language: string
  platform: string
  webglRenderer: string
}

export function collectSignals(): ClientSignals {
  let webglRenderer = ''
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl && gl instanceof WebGLRenderingContext) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) webglRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''
    }
  } catch {}

  return {
    screenRes: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    webglRenderer,
  }
}
