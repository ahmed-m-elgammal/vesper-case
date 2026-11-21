#!/bin/bash
# Walkthrough part B (zone-tap based): hall clues -> gate 1 -> parlour clues -> gate 2 -> endcard
set -e
AB="agent-browser"
shot() { $AB screenshot "/tmp/render/$1.png" >/dev/null && echo "shot $1"; }
tz() { $AB eval "window.__tz('$1','$2')" >/dev/null; sleep 0.9; }
closesnap() { shot "$1"; $AB eval "(() => { const b = Array.from(document.querySelectorAll('.closeup-foot .btn')).find(x => x.textContent === 'Close'); if (b) b.click(); return 'closed'; })()" >/dev/null; sleep 0.5; }
drain_dialogue() { for i in 1 2 3 4 5 6 7 8; do $AB eval "(() => { const d = document.querySelector('.dialogue-overlay'); if (d && !d.classList.contains('hidden')) { d.click(); return 'adv'; } return 'none'; })()" >/dev/null; sleep 0.45; done; }

$AB eval "(() => { window.__tz = (sc, id) => { const s = window.__game.game.scene.getScene(sc); const z = s.children.getByName(id); if (!z) return 'NOZONE ' + id; if (s.input) s.input.emit('pointerdown'); z.emit('pointerup'); return 'tapped ' + id; }; return 'helpers'; })()" >/dev/null

drain_dialogue
echo "---- HALL CLUES ----"
tz room hall_clock;      closesnap 08-clock
tz room visitor_ledger;  closesnap 09-ledger
tz room umbrella_stand;  closesnap 10-umbrella
tz room doormat_prints;  closesnap 11-doormat
tz room coat_peg_coats;  closesnap 12-coats
tz room mail_letter;     closesnap 13-letter
tz room stair_button;    closesnap 14-button
$AB eval "JSON.stringify({clues: Object.keys(window.__game.vm.state.clues).length})"

echo "---- GATE 1 ----"
tz room door:parlour
sleep 1.2
shot 15-gate1-open
# wrong attempt first
for i in 1 2 3; do $AB eval "(() => { const chips = Array.from(document.querySelectorAll('.gate-pool .chip')); if (chips[0]) chips[0].click(); return 'chip'; })()" >/dev/null; sleep 0.35; done
$AB find text "Check the deduction" click >/dev/null; sleep 0.8
shot 16-gate1-wrong
# clear the wrong slots, then solve correctly
$AB eval "(() => { document.querySelectorAll('.gate-slot.filled').forEach(s => s.click()); return 'cleared'; })()" >/dev/null; sleep 0.5
for answer in "Julian Ashcombe" "a quarter past ten" "10:47"; do
  $AB eval "(() => { const chip = Array.from(document.querySelectorAll('.gate-pool .chip')).find(c => c.textContent === '$answer'); if (chip) chip.click(); return '$answer'; })()" >/dev/null; sleep 0.4
done
$AB find text "Check the deduction" click >/dev/null; sleep 1.2
shot 17-gate1-solved
$AB find text "Continue" click >/dev/null; sleep 1.8
drain_dialogue

echo "---- ENTER PARLOUR ----"
tz room door:parlour
sleep 2
shot 18-parlour

echo "---- PARLOUR CLUES ----"
tz room memoir_desk; shot 19-memoir
$AB eval "(() => { const r = Array.from(document.querySelectorAll('.closeup-reveal')); if (r[0]) r[0].click(); return 'reveal'; })()" >/dev/null; sleep 1
shot 20-slip; closesnap 21-after-slip
tz room body_chair; closesnap 22-body
$AB eval "(() => { const r = Array.from(document.querySelectorAll('.closeup-reveal')); if (r[0]) r[0].click(); return 'reveal-pills'; })()" >/dev/null; sleep 1
shot 23-pills; closesnap 24-after-pills
tz room whiskey_glass; closesnap 25-glass
tz room decanter; shot 26-decanter; closesnap 27-after-decanter
tz room hearth_ash; closesnap 28-ash
tz room mantel_clock; closesnap 29-mantel
tz room hearth_rug_print; closesnap 30-print
tz room scissors_sideboard; closesnap 31-scissors
tz room garden_door_bolt; closesnap 32-bolt
$AB eval "JSON.stringify({clues: Object.keys(window.__game.vm.state.clues).length})"

echo "---- GATE 2 ----"
tz room door:hall
sleep 1.2
shot 33-gate2-open
for answer in "foxglove" "the whiskey decanter" "parlour hearth" "kitchen garden door"; do
  $AB eval "(() => { const chip = Array.from(document.querySelectorAll('.gate-pool .chip')).find(c => c.textContent === '$answer'); if (chip) chip.click(); return '$answer'; })()" >/dev/null; sleep 0.4
done
$AB find text "Check the deduction" click >/dev/null; sleep 1.2
shot 34-gate2-solved
$AB find text "Continue" click >/dev/null; sleep 2
shot 35-endcard
$AB find text "Step back into the hall" click >/dev/null; sleep 1.5

echo "---- NOTEBOOK ----"
$AB find text "Notebook" click >/dev/null; sleep 1
shot 36-notebook-clues
$AB eval "(() => { const t = Array.from(document.querySelectorAll('.notebook-tab')).find(b => b.textContent === 'Timeline'); if (t) t.click(); return 'tab'; })()" >/dev/null; sleep 0.6
shot 37-notebook-timeline
$AB eval "(() => { const t = Array.from(document.querySelectorAll('.notebook-tab')).find(b => b.textContent === 'Threads'); if (t) t.click(); return 'tab'; })()" >/dev/null; sleep 0.6
shot 38-notebook-threads
$AB eval "(() => { const t = Array.from(document.querySelectorAll('.notebook-tab')).find(b => b.textContent === 'People'); if (t) t.click(); return 'tab'; })()" >/dev/null; sleep 0.6
shot 39-notebook-people
$AB eval "(() => { const b = Array.from(document.querySelectorAll('.notebook-foot .btn')).find(x => x.textContent === 'Close the book'); if (b) b.click(); return 'closed'; })()" >/dev/null; sleep 0.5
$AB eval "JSON.stringify({phase: window.__game.vm.phase\$.value, clues: Object.keys(window.__game.vm.state.clues).length, gates: Object.keys(window.__game.vm.state.gates)})"
echo DONE-B2
