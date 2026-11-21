#!/bin/bash
# Walkthrough part A (zone-tap based): fresh boot -> prologue -> hub -> hall
set -e
AB="agent-browser"
shot() { $AB screenshot "/tmp/render/$1.png" >/dev/null && echo "shot $1"; }
tz() { $AB eval "window.__tz('$1','$2')" >/dev/null; sleep 0.9; }
install_helpers() {
  $AB eval "(() => { window.__tz = (sc, id) => { const s = window.__game.game.scene.getScene(sc); const z = s.children.getByName(id); if (!z) return 'NOZONE ' + id; if (s.input) s.input.emit('pointerdown'); z.emit('pointerup'); return 'tapped ' + id; }; return 'helpers'; })()"
}

echo "== reload + wipe =="
$AB eval "(() => { indexedDB.deleteDatabase('ink-and-ashes'); return 'wipe-requested'; })()"
$AB reload
sleep 9
$AB eval "JSON.stringify({phase: window.__game.vm.phase\$.value, mode: window.__game.vm.state.prologueDone ? 'done' : 'fresh-or-page'})"
install_helpers

echo "== start screen =="
# fresh boot shows the start overlay; if resumed, continue instead
$AB eval "(() => { const btns = Array.from(document.querySelectorAll('.start-actions .btn')); const b = btns.find(x => x.textContent === 'Open the case file') || btns.find(x => x.textContent === 'Continue the case'); if (b) { b.click(); return 'clicked ' + b.textContent; } return 'no start overlay: ' + btns.map(x=>x.textContent).join(','); })()"
sleep 1.5
shot 02-prologue-cover

echo "== page to the end of the case file =="
for i in 1 2 3 4 5 6 7; do
  $AB eval "(() => { const n = document.querySelectorAll('.prologue-nav')[1]; if (n && !n.disabled) { n.click(); return 'next'; } return 'last'; })()" >/dev/null
  sleep 0.6
done
$AB eval "(() => document.querySelector('.prologue-count').textContent)"
shot 07-begin-page
$AB eval "(() => { const b = Array.from(document.querySelectorAll('.begin-btn')); if (b[0]) { b[0].click(); return 'took case'; } return 'no begin button'; })()"
sleep 2
shot 05-hollis

echo "== dialogue =="
for i in 1 2 3 4 5; do $AB eval "(() => { const d = document.querySelector('.dialogue-overlay'); if (d && !d.classList.contains('hidden')) { d.click(); return 'adv'; } return 'none'; })()" >/dev/null; sleep 0.45; done
$AB eval "(() => { const c = document.querySelector('.dialogue-choice'); if (c) { c.click(); return 'chose ' + c.textContent; } return 'no choices'; })()"
for i in 1 2 3 4 5 6; do $AB eval "(() => { const d = document.querySelector('.dialogue-overlay'); if (d && !d.classList.contains('hidden')) { d.click(); return 'adv'; } return 'none'; })()" >/dev/null; sleep 0.45; done
shot 06-hub

echo "== hub -> hall =="
tz hub room:hall
sleep 2
shot 07-hall
$AB eval "JSON.stringify({phase: window.__game.vm.phase\$.value, roomId: window.__game.vm.state.roomId})"
echo DONE-A2
