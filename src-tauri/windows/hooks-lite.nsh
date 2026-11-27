; Legato Lite's installer hooks (tauri.lite.conf.json › bundle.windows.nsis.installerHooks). None of the full app's
; hooks.nsh: no rename catch-up here.

; The legato:// link type (src-tauri/src/protocol.rs): Lite registers it when it is alone, the full app takes it over.
; Gone with Lite only while it still names this install's exe: a full app's is never touched.
!macro NSIS_HOOK_POSTUNINSTALL
  Push $0
  ReadRegStr $0 HKCU "Software\Classes\legato\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\legato"
  ${EndIf}
  Pop $0
!macroend
