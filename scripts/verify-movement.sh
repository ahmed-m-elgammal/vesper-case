#!/bin/bash
# Movement milestone verification, round 3: deterministic full precinct walk.
set -e
AB="agent-browser"
SHOTDIR=/tmp/render
mkdir -p "$SHOTDIR"
shot() { $AB screenshot "$SHOTDIR/$1.png" >/dev/null && echo "shot $1"; }
q() { $AB eval "$1"; }
wait_scene() { # wait_scene <key> <tries>
  for i in $(seq 1 "${2:-8}"); do
    R=$($AB eval "(() => { const s = window.__game && window.__game.station; return s ? s.scene.key : 'loading'; })()" | tr -d '"')
    [[ "$R" == "$1" ]] && { echo "  scene $1 after ${i}s"; return 0; }
    sleep 1
  done
  echo "  TIMEOUT waiting for $1 (last: $R)"; return 1
}
dismiss_cards() { # click through narration/intro overlay until gone
  q "(() => { let n = 0; const step = () => { const c = document.querySelector('.narration-overlay, .intro-overlay:not(.start-overlay)'); if (!c || n > 9) return; c.click(); n++; setTimeout(step, 250); }; step(); return 'dismissing'; })()" >/dev/null
  sleep 3
  q "(() => { const c = document.querySelector('.narration-overlay, .intro-overlay:not(.start-overlay)'); return 'cards remaining: ' + (c ? 'yes' : 'none'); })()"
}

echo "== fresh boot =="
q "(() => new Promise(res => { const req = indexedDB.deleteDatabase('ink-and-ashes'); req.onsuccess = () => res('cleared'); req.onerror = () => res('err'); req.onblocked = () => res('blocked-later-ok'); }))()"
q "location.href = 'http://localhost:3000/?nav=1'" >/dev/null
sleep 9
q "window.__game ? 'boot phase=' + window.__game.vm.phase$.value : 'NOBOOT'"
wait_scene station-ext 10
q "(() => { const b = Array.from(document.querySelectorAll('.start-actions .btn, .overlay .btn')).find(x => /Begin the night shift/i.test(x.textContent || '')); if (b) { b.click(); return 'start clicked'; } return 'no start button'; })()"
sleep 2
dismiss_cards
q "(() => { const s = window.__game.station; return 'exterior player at ' + Math.round(s.player.x) + ',' + Math.round(s.player.y); })()"
shot 01-exterior-nav

echo "== keyboard: W (north) and A+W (diagonal) =="
q "(() => { const s = window.__game.station; s.wasdKeys.W.isDown = true; return 'W'; })()"
sleep 0.9
q "(() => { const s = window.__game.station; s.wasdKeys.W.isDown = false; const p = s.player; return 'after W: ' + Math.round(p.x) + ',' + Math.round(p.y) + ' (kerb clamps at y=975)'; })()"
q "(() => { const s = window.__game.station; s.wasdKeys.A.isDown = true; s.wasdKeys.W.isDown = true; return 'A+W'; })()"
sleep 0.8
q "(() => { const s = window.__game.station; s.wasdKeys.A.isDown = false; s.wasdKeys.W.isDown = false; return 'after A+W: ' + Math.round(s.player.x) + ',' + Math.round(s.player.y) + ' ' + s.player.sprite.texture.key; })()"

echo "== tap-to-move across the street (Phaser binds mousedown/mouseup) =="
q "(() => { const canvas = document.querySelector('canvas'); const r = canvas.getBoundingClientRect(); const scene = window.__game.station; const wv = scene.cameras.cameras[0].worldView; const x = r.left + ((1650 - wv.x) / wv.width) * r.width; const y = r.top + ((1010 - wv.y) / wv.height) * r.height; const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }; canvas.dispatchEvent(new MouseEvent('mousedown', o)); canvas.dispatchEvent(new MouseEvent('mouseup', o)); const t = scene.player.target; return 'tap accepted, target=' + JSON.stringify(t ? t.pts.map(p => [Math.round(p.x), Math.round(p.y)]) : null); })()"
sleep 2.5
q "(() => { const p = window.__game.station.player; return 'after tap: ' + Math.round(p.x) + ',' + Math.round(p.y); })()"
shot 02-exterior-right

echo "== door -> interior (stand point walk + transition) =="
q "(() => { const s = window.__game.station; const h = s.sceneData().hotspots.find(h => h.id === 'door'); s.tryActivate(h); return 'door: dist=' + Math.round(s.player.distToRect(h.spot)); })()"
wait_scene station-int 10
sleep 2
dismiss_cards
q "(() => { const s = window.__game.station; return 'interior spawn: ' + Math.round(s.player.x) + ',' + Math.round(s.player.y); })()"
shot 03-interior-entry

echo "== captain's office through the doorway =="
q "(() => { const s = window.__game.station; s.player.walkTo(480, 660); return 'office walk'; })()"
sleep 3
q "(() => { const p = window.__game.station.player; return 'office pos: ' + Math.round(p.x) + ',' + Math.round(p.y) + ' (office zone x 402-506, y 620-716)'; })()"
shot 05-office

echo "== depth: behind the cooler =="
q "(() => { const s = window.__game.station; s.player.walkTo(1630, 715); return 'to cooler rear'; })()"
sleep 4.5
q "(() => { const p = window.__game.station.player; return 'behind cooler: y=' + Math.round(p.y) + ' depth=' + Math.round(p.sprite.depth) + ' < cooler base 806 -> cooler occludes'; })()"
shot 06-behind-cooler

echo "== depth: behind Dewi =="
q "(() => { const s = window.__game.station; s.player.walkTo(1450, 810); return 'behind dewi'; })()"
sleep 3.5
q "(() => { const p = window.__game.station.player; return 'behind dewi: y=' + Math.round(p.y) + ' depth=' + Math.round(p.sprite.depth) + ' < dewi base 990'; })()"
shot 07-behind-dewi

echo "== desk -> case files -> freeze -> close =="
q "(() => { const s = window.__game.station; const p = s.player; window.__trace = []; window.__iv = setInterval(() => { window.__trace.push([Date.now(), Math.round(p.x), Math.round(p.y), p.frozen, p.target ? Math.round(p.target.pts[p.target.pts.length - 1].x) + ',' + Math.round(p.target.pts[p.target.pts.length - 1].y) : null]); }, 250); const h = s.sceneData().hotspots.find(h => h.id === 'desk'); s.tryActivate(h); return 'to desk'; })()"
sleep 4.5
q "(() => { const s = window.__game.station; const open = !!document.querySelector('.casefiles-overlay:not(.hidden)'); return 'casefiles open=' + open + ' walker frozen=' + (s.player ? s.player.frozen : 'n/a') + ' pos=' + Math.round(s.player.x) + ',' + Math.round(s.player.y); })()"
shot 04-casefiles
q "(() => { const o = document.querySelector('.casefiles-overlay:not(.hidden)'); const btn = o && Array.from(o.querySelectorAll('button, .btn')).find(b => /close|back|return/i.test(b.textContent || '')); if (btn) { btn.click(); return 'closed: ' + btn.textContent.trim(); } return 'no close button found'; })()"
sleep 1.5
q "(() => { const s = window.__game.station; clearInterval(window.__iv); const tr = window.__trace; const moves = tr.filter((e, i) => i === 0 || e[1] !== tr[i - 1][1] || e[2] !== tr[i - 1][2] || e[3] !== tr[i - 1][3] || e[4] !== tr[i - 1][4]); return 'after close: frozen=' + (s.player ? s.player.frozen : 'n/a') + ' pos=' + Math.round(s.player.x) + ',' + Math.round(s.player.y) + ' TRACE=' + JSON.stringify(moves); })()"

echo "== desk-detour regression: walk around YOUR desk to the far side =="
q "(() => { const s = window.__game.station; s.player.walkTo(1340, 1000); return 'crossing behind the desk line'; })()"
sleep 3.5
q "(() => { const p = window.__game.station.player; return 'around desk: ' + Math.round(p.x) + ',' + Math.round(p.y); })()"

echo "== stairs -> upper floor =="
q "(() => { const s = window.__game.station; const h = s.sceneData().hotspots.find(h => h.id === 'stairs'); s.tryActivate(h); return 'to stairs: dist=' + Math.round(s.player.distToRect(h.spot)); })()"
wait_scene station-up 14
sleep 2
dismiss_cards
q "(() => { const s = window.__game.station; return 'upper spawn: ' + Math.round(s.player.x) + ',' + Math.round(s.player.y); })()"
shot 08-upper

echo "== back down to the bullpen (arrival point near stairs) =="
q "(() => { const s = window.__game.station; const h = s.sceneData().hotspots.find(h => h.id === 'stairs'); s.tryActivate(h); return 'down we go'; })()"
wait_scene station-int 10
sleep 2
dismiss_cards
q "(() => { const s = window.__game.station; return 'bullpen arrival: ' + Math.round(s.player.x) + ',' + Math.round(s.player.y) + ' (spawnNear upper = 1690,880 or saved pos)'; })()"
shot 09-bullpen-return

echo "== saved positions =="
q "JSON.stringify(window.__game.vm.state.station.pos ?? {})"
echo "== DONE =="
