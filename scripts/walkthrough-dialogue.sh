#!/bin/bash
# Walkthrough: the conversation system (build two) -- interrogations, evidence
# presentation, a caught lie, bearing shifts, notebook People tab.
set -e
AB="agent-browser"
shot() { $AB screenshot "/tmp/render/$1.png" >/dev/null && echo "shot $1"; }
tz() { $AB eval "window.__tz('$1','$2')" >/dev/null; sleep 1; }

install_helpers() {
  $AB eval "(() => { window.__tz = (sc, id) => { const s = window.__game.game.scene.getScene(sc); const z = s.children.getByName(id); if (!z) return 'NOZONE ' + id; z.emit('pointerup'); return 'tapped ' + id; }; return 'helpers'; })()"
}

# Click the dialogue sheet until choices are visible (or the sheet closes).
to_choices() {
  for i in $(seq 1 14); do
    if $AB eval "document.querySelector('.dialogue-choice') ? 'yes' : 'no'" 2>/dev/null | rg -q yes; then return 0; fi
    $AB eval "(() => { const d = document.querySelector('.dialogue-overlay'); if (d && !d.classList.contains('hidden')) { d.click(); return 'adv'; } return 'closed'; })()" >/dev/null
    sleep 0.45
  done
  echo "WARN: choices never appeared"
  return 1
}

# Click the dialogue sheet until it closes (terminal node).
to_close() {
  for i in $(seq 1 16); do
    if $AB eval "document.querySelector('.dialogue-overlay.hidden') ? 'yes' : 'no'" 2>/dev/null | rg -q yes; then return 0; fi
    $AB eval "(() => { const d = document.querySelector('.dialogue-overlay'); if (d && !d.classList.contains('hidden')) { d.click(); return 'adv'; } return 'closed'; })()" >/dev/null
    sleep 0.4
  done
  return 0
}

# Click the choice whose text matches the regex; echo what matched.
pick() {
  $AB eval "(() => { const c = Array.from(document.querySelectorAll('.dialogue-choice')).find(x => $1.test(x.textContent)); if (c) { c.click(); return 'PICKED ' + c.textContent; } return 'NO MATCH'; })()"
  sleep 0.6
}

echo "== fresh boot =="
$AB open http://localhost:3000 >/dev/null
sleep 12
$AB eval "window.__game ? 'boot phase=' + window.__game.vm.phase\$.value : 'NOBOOT'"
$AB eval "(() => { try { window.__game.vm.save.clear(); return 'save cleared'; } catch (e) { return 'noclear: ' + e.message; } })()"
$AB open http://localhost:3000 >/dev/null
sleep 12
$AB eval "window.__game ? 'boot phase=' + window.__game.vm.phase\$.value : 'NOBOOT'"
install_helpers

echo "== start -> case file -> begin =="
$AB eval "(() => { const btns = Array.from(document.querySelectorAll('.start-actions .btn')); const b = btns.find(x => x.textContent === 'Open the case file') || btns.find(x => x.textContent === 'Continue the case'); if (b) { b.click(); return 'clicked'; } return 'none'; })()" >/dev/null
sleep 1.5
for i in 1 2 3 4 5 6 7; do
  $AB eval "(() => { const n = document.querySelectorAll('.prologue-nav')[1]; if (n && !n.disabled) { n.click(); return 'next'; } return 'last'; })()" >/dev/null
  sleep 0.5
done
$AB eval "(() => { const b = Array.from(document.querySelectorAll('.begin-btn')); if (b[0]) { b[0].click(); return 'took case'; } return 'no begin button'; })()"
sleep 2

echo "== hollis briefing -> hub -> hall =="
to_choices
pick "/Where do I begin/"
to_close
sleep 0.6
tz hub room:hall
sleep 2
$AB eval "JSON.stringify({phase: window.__game.vm.phase\$.value, roomId: window.__game.vm.state.roomId})"
shot 20-hall-people

echo "== collect one clue (for the present-evidence test) =="
tz room hall_clock
sleep 0.8
$AB eval "(() => { const o = document.querySelector('.closeup-overlay'); const b = o && !o.classList.contains('hidden') ? Array.from(o.querySelectorAll('button')).find(x => x.textContent.trim() === 'Close') : null; if (b) { b.click(); return 'closed closeup'; } return 'no closeup open'; })()" >/dev/null
sleep 0.5
$AB eval "'hall_clock held: ' + Boolean(window.__game.vm.state.clues.hall_clock)"

echo "== talk to Colette =="
tz room person:colette
sleep 1
$AB eval "document.querySelector('.dialogue-name') ? 'SPEAKER=' + document.querySelector('.dialogue-name').textContent : 'NO SHEET'"
$AB eval "document.querySelector('.dialogue-bearing') ? 'BEARING=' + document.querySelector('.dialogue-bearing').textContent : 'NO BEARING'"
shot 21-colette-sheet
to_choices
pick "/kitchen/"
to_choices
$AB eval "'evening flag: ' + Boolean(window.__game.vm.hasFlag('talked:colette:evening'))"

echo "== present evidence to Colette =="
pick "/evidence/"
sleep 0.6
shot 22-evidence-picker
$AB eval "(() => { const it = document.querySelector('.dialogue-present-item'); if (it) { const n = it.querySelector('.dialogue-present-name'); const label = n ? n.textContent : '?'; it.click(); return 'presented ' + label; } return 'empty picker'; })()"
sleep 0.8
$AB eval "document.querySelector('.dialogue-line') ? 'REACTION=' + document.querySelector('.dialogue-line').textContent.slice(0, 60) : 'no line'"
to_choices
$AB eval "'reaction once-flag: ' + window.__game.vm.hasFlag('asked:colette:pr-clock')"
pick "/all for now/"
sleep 0.5

echo "== talk to Tobias (testimony clue + bearing) =="
tz room person:tobias
sleep 1
to_choices
pick "/hear/"
to_choices
$AB eval "JSON.stringify({clatterClue: Boolean(window.__game.vm.state.clues.tobias_clatter), trustTobias: window.__game.vm.getVar('trust:tobias')})"
$AB eval "document.querySelector('.dialogue-bearing') ? 'BEARING=' + document.querySelector('.dialogue-bearing').textContent : 'NO BEARING'"
shot 23-tobias-warming
pick "/all/"
sleep 0.5

echo "== unlock the parlour (VM intents, same path as the gate UI) =="
$AB eval "(() => { const vm = window.__game.vm; vm.collectClue('umbrella_stand'); vm.collectClue('doormat_prints'); vm.collectClue('visitor_ledger'); vm.solveGate('gate-parlour'); return 'gate solved: ' + Boolean(vm.state.gates['gate-parlour']); })()"
sleep 1
tz room door:parlour
sleep 2
$AB eval "JSON.stringify({roomId: window.__game.vm.state.roomId})"
shot 24-parlour

echo "== talk to Peggy and catch her lie with the clock =="
tz room person:peggy
sleep 1
to_choices
pick "/own words/"
to_choices
$AB eval "'lie planted flag: ' + window.__game.vm.hasFlag('talked:peggy:evening')"
pick "/evidence/"
sleep 0.6
$AB eval "(() => { const items = Array.from(document.querySelectorAll('.dialogue-present-item')); const it = items.find(x => /Stopped Clock/i.test(x.textContent)); if (it) { it.click(); return 'showed the clock'; } return 'clock not found: ' + items.length + ' items'; })()"
sleep 0.8
shot 25-lie-caught
to_choices
$AB eval "JSON.stringify({lieCaught: window.__game.vm.hasFlag('peggy_lie_caught'), trustPeggy: window.__game.vm.getVar('trust:peggy')})"
$AB eval "document.querySelector('.dialogue-bearing') ? 'BEARING=' + document.querySelector('.dialogue-bearing').textContent : 'NO BEARING'"
pick "/all for now/"
sleep 0.5

echo "== notebook People tab shows bearing =="
$AB eval "(() => { window.__game.vm.bus.emit('notebook:open', { tab: 'people' }); return 'opened'; })()"
sleep 1
shot 26-notebook-people
$AB eval "(() => { const chips = Array.from(document.querySelectorAll('.person-spoken')).map(x => x.textContent); return JSON.stringify(chips); })()"
$AB eval "(() => { const n = document.querySelector('.notebook-book'); if (n) n.classList.add('hidden'); return 'closed book'; })()" >/dev/null

echo "== summary =="
$AB eval "JSON.stringify({clues: Object.keys(window.__game.vm.state.clues).sort(), trust: window.__game.vm.state.vars, flags: Object.keys(window.__game.vm.state.flags).filter(f => /talked|asked|caught/.test(f)).sort()})"
echo DONE-DIALOGUE
