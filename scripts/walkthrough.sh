#!/bin/bash
# Golden-path walkthrough of Ink & Ashes via agent-browser.
set -e
AB="agent-browser"
shot() { $AB screenshot "/tmp/render/$1.png" >/dev/null && echo "shot $1"; }
tap()  { $AB eval "window.__tap($1,$2)" >/dev/null; sleep 0.6; }

# wait for boot
$AB reload
sleep 9
$AB eval "window.__game ? 'boot phase=' + window.__game.vm.phase$.value : 'NOBOOT'"

# 1. start screen -> open case file
$AB find text "Open the case file" click
sleep 1.5
shot 02-prologue-cover

# 2. page to suspects (5 nexts from cover: letter, victim, plan, story, suspects)
for i in 1 2 3 4 5; do $AB find text "Next →" click >/dev/null; sleep 0.7; done
shot 04-suspects

# 3. to last page -> take up the case
$AB find text "Next →" click >/dev/null; sleep 0.7
$AB find text "Next →" click >/dev/null; sleep 0.7
$AB eval "document.querySelector('.prologue-count').textContent"
$AB find text "Walk up to the door of 7 Hollow Lane" click
sleep 1.5
shot 05-hollis

# 4. dialogue: advance 3 lines, choose "Where do I begin?", advance, close
for i in 1 2 3; do $AB eval "window.__game.vm.bus" >/dev/null; $AB eval "document.querySelector('.dialogue-overlay').click()" >/dev/null; sleep 0.4; done
$AB eval "document.querySelector('.dialogue-overlay').click()" >/dev/null; sleep 0.5
$AB find text "Where do I begin?" click >/dev/null; sleep 0.5
for i in 1 2 3; do $AB eval "document.querySelector('.dialogue-overlay').click()" >/dev/null; sleep 0.4; done
sleep 0.5
shot 06-hub

# 5. install canvas tap helper and enter the hall
$AB eval "window.__cam = (sc) => window.__game.game.scene.getScene(sc).cameras.main; window.__tapAt = (sc, wx, wy) => { const cam = window.__cam(sc); const canvas = document.querySelector('canvas'); const r = canvas.getBoundingClientRect(); const x = r.left + (wx - cam.scrollX) * cam.zoom * (r.width / 1280); const y = r.top + (wy - cam.scrollY) * cam.zoom * (r.height / 720); const o = { bubbles: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true, button: 0 }; canvas.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => canvas.dispatchEvent(new PointerEvent('pointerup', o)), 50); return [Math.round(x), Math.round(y)]; }; 'helpers ok'"
$AB eval "window.__tapAt('hub', 950, 540)" >/dev/null; sleep 1.6
shot 07-hall

# 6. hall clues: clock, ledger, umbrella, mat (pan left first), coats, letter, button
tap_hub() { $AB eval "window.__tapAt('hall', $1, $2)" >/dev/null; sleep 0.8; }
closeup_shot() { shot "$1"; $AB find text "Close" click >/dev/null; sleep 0.5; }

# pan camera left to see the whole hall
$AB eval "(() => { window.__cam('room').setScroll(0, 0); return 'panned'; })()" >/dev/null; sleep 0.5
tap_hub 1390 445; closeup_shot 08-clock
tap_hub 1025 515; closeup_shot 09-ledger
tap_hub 605 680;  closeup_shot 10-umbrella
tap_hub 230 807;  closeup_shot 11-doormat
tap_hub 460 325;  closeup_shot 12-coats
tap_hub 1187 530; closeup_shot 13-letter
tap_hub 1680 710; closeup_shot 14-button
$AB eval "window.__game.vm.clueCount$.value"

# 7. parlour door -> gate 1
tap_hub 790 500
sleep 1
shot 15-gate1

echo DONE-A
