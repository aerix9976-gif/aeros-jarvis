# Aero's JARVIS — Design System

## Direction
An original precision-instrument HUD, not a clone of Brahma Echo. Dark aerospace console, editorial typography, small technical labels, a faceted crimson reactor, molten-amber secondary signal, and brushed-gunmetal panels. The UI should feel like a real instrument panel rather than a game menu.

## Tokens
- Background: `#070608`; elevated panel: `#141116`; secondary panel: `#0F0B10`.
- Primary signal: ember red `#FF4A4F`; secondary signal `#FF633F`; warning/active accent: molten amber `#FFAD57`.
- Main text: `#F3EDF0`; muted text: `#A29AA6`; separators: `#35242B`.
- UI type: system sans stack; telemetry/commands: system monospace. Keep panel contrast and visible keyboard focus; never use glow as the only state signal.

## Layout
- Narrow-phone-first, 320px minimum CSS viewport, max content width 740px.
- Top status bar, compact telemetry, headline, centered reactor, three quick action cards, command console, session stream, persistent bottom navigation.
- Touch controls at least 34px where compact; main actions 44px where room allows.
- Keep text legible and do not rely on color alone to communicate assistant state.

## Motion
- Reactor outer orbit rotates slowly; core glow breathes only while active.
- Listening animates the waveform; executing changes the core status color.
- Honor `prefers-reduced-motion`; motion is decorative and never indicates wake-word detection by itself.

## Privacy and status
- Clearly label the current assistant state and local intent engine.
- State honestly when a native feature is unavailable in browser preview.
- Do not imply always-listening or phone-wide control until native permissioned features are implemented and tested.
