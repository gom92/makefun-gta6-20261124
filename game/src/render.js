import {
  CAMERA,
  COLORS,
  FONT,
  MONO,
  PICKUPS,
  PLACES,
  ROADS,
  SPECIAL,
  VEHICLES,
  WANTED,
  WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const TAU = Math.PI * 2;

function roundPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function alphaColor(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1;
  let viewW = 1280;
  let viewH = 720;
  const cam = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1, ready: false };
  let lastDraw = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = Math.max(480, Math.round(rect.width || window.innerWidth));
    viewH = Math.max(320, Math.round(rect.height || window.innerHeight));
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
  }

  window.addEventListener('resize', resize);
  resize();

  function viewRect() {
    const halfW = viewW / 2 / cam.zoom;
    const halfH = viewH / 2 / cam.zoom;
    return { x: cam.x - halfW - 100, y: cam.y - halfH - 100, w: halfW * 2 + 200, h: halfH * 2 + 200 };
  }

  function inView(x, y, pad = 0) {
    return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
  }

  let view = { x: 0, y: 0, w: 0, h: 0 };

  function drawGround() {
    ctx.fillStyle = COLORS.bay;
    ctx.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    ctx.fillStyle = COLORS.grassA;
    ctx.fillRect(0, 0, WORLD.width, WORLD.beachY);
    ctx.fillStyle = COLORS.grassB;
    for (let y = 0; y < WORLD.beachY; y += 140) {
      if (y + 70 < view.y || y > view.y + view.h) continue;
      ctx.fillRect(0, y, WORLD.width, 70);
    }
    const park = SPECIAL.park;
    ctx.fillStyle = COLORS.park;
    roundPath(ctx, park.x, park.y, park.w, park.h, 18);
    ctx.fill();
    ctx.strokeStyle = alphaColor(COLORS.parkPath, 0.8);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(park.x + park.w / 2, park.y + 12);
    ctx.lineTo(park.x + park.w / 2, park.y + park.h - 12);
    ctx.moveTo(park.x + 14, park.y + park.h / 2);
    ctx.lineTo(park.x + park.w - 14, park.y + park.h / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20, 40, 24, 0.35)';
    ctx.lineWidth = 3;
    roundPath(ctx, park.x + 3, park.y + 3, park.w - 6, park.h - 6, 16);
    ctx.stroke();

    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, WORLD.beachY, WORLD.width, WORLD.waterY - WORLD.beachY);
    ctx.fillStyle = COLORS.sandDark;
    for (let y = WORLD.beachY + 18; y < WORLD.waterY; y += 38) {
      ctx.fillRect(0, y, WORLD.width, 3);
    }
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
    ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(0, WORLD.waterY + 46, WORLD.width, WORLD.height - WORLD.waterY - 46);
    ctx.strokeStyle = alphaColor(COLORS.foam, 0.5);
    ctx.lineWidth = 3;
    for (let y = WORLD.waterY + 16; y < WORLD.height; y += 34) {
      ctx.beginPath();
      for (let x = 0; x <= WORLD.width; x += 60) {
        const wave = Math.sin(x * 0.018 + y * 0.02) * 5;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
  }

  function drawRoads() {
    const half = WORLD.roadWidth / 2;
    const walk = WORLD.sidewalk;
    ctx.fillStyle = COLORS.sidewalk;
    for (const x of ROADS.vertical) {
      ctx.fillRect(x - half - walk, 0, walk, WORLD.beachY);
      ctx.fillRect(x + half, 0, walk, WORLD.beachY);
    }
    for (const y of ROADS.horizontal) {
      ctx.fillRect(0, y - half - walk, WORLD.width, walk);
      ctx.fillRect(0, y + half, WORLD.width, walk);
    }
    ctx.fillStyle = COLORS.sidewalkLine;
    for (const x of ROADS.vertical) {
      ctx.fillRect(x - half - walk, 0, 2, WORLD.beachY);
      ctx.fillRect(x + half + walk - 2, 0, 2, WORLD.beachY);
    }
    for (const y of ROADS.horizontal) {
      ctx.fillRect(0, y - half - walk, WORLD.width, 2);
      ctx.fillRect(0, y + half + walk - 2, WORLD.width, 2);
    }

    ctx.fillStyle = COLORS.road;
    for (const x of ROADS.vertical) {
      const top = Math.max(0, view.y);
      const bottom = Math.min(WORLD.beachY, view.y + view.h);
      if (bottom > top) ctx.fillRect(x - half, top, WORLD.roadWidth, bottom - top);
    }
    for (const y of ROADS.horizontal) {
      const left = Math.max(0, view.x);
      const right = Math.min(WORLD.width, view.x + view.w);
      if (right > left) ctx.fillRect(left, y - half, right - left, WORLD.roadWidth);
    }

    ctx.strokeStyle = COLORS.roadEdge;
    ctx.lineWidth = 2;
    for (const x of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(x - half + 1, 0);
      ctx.lineTo(x - half + 1, WORLD.beachY);
      ctx.moveTo(x + half - 1, 0);
      ctx.lineTo(x + half - 1, WORLD.beachY);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(0, y - half + 1);
      ctx.lineTo(WORLD.width, y - half + 1);
      ctx.moveTo(0, y + half - 1);
      ctx.lineTo(WORLD.width, y + half - 1);
      ctx.stroke();
    }

    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 26]);
    for (const x of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.beachY);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const x of ROADS.vertical) {
      const name = ROADS.namesV[x];
      if (!name) continue;
      for (let y = 160; y < WORLD.beachY; y += 640) {
        if (!inView(x, y, 200)) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(236, 226, 196, 0.28)';
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 0, 0);
        ctx.restore();
      }
    }
    for (const y of ROADS.horizontal) {
      const name = ROADS.namesH[y];
      if (!name) continue;
      for (let x = 180; x < WORLD.width; x += 640) {
        if (!inView(x, y, 200)) continue;
        ctx.fillStyle = 'rgba(236, 226, 196, 0.28)';
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, x, y);
      }
    }

    ctx.fillStyle = 'rgba(238, 233, 219, 0.55)';
    for (const x of ROADS.vertical) {
      for (const y of ROADS.horizontal) {
        if (!inView(x, y, 120)) continue;
        for (let k = 0; k < 5; k += 1) {
          const o = -38 + k * 19;
          ctx.fillRect(x + o, y - half - 17, 11, 14);
          ctx.fillRect(x + o, y + half + 3, 11, 14);
          ctx.fillRect(x - half - 17, y + o, 14, 11);
          ctx.fillRect(x + half + 3, y + o, 14, 11);
        }
      }
    }
  }

  function drawBuildings() {
    const list = stateCache.buildings.filter((b) => inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h)));
    for (const b of list) {
      ctx.fillStyle = COLORS.shadow;
      roundPath(ctx, b.x + 10, b.y + 13, b.w, b.h, 5);
      ctx.fill();
      ctx.fillStyle = b.roof;
      roundPath(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(38, 24, 22, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 234, 200, 0.18)';
      ctx.lineWidth = 1.5;
      roundPath(ctx, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 3);
      ctx.stroke();

      if (b.special === 'hospital') {
        ctx.fillStyle = '#f2f5f7';
        ctx.fillRect(b.x + b.w / 2 - 36, b.y + b.h / 2 - 10, 72, 20);
        ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 36, 20, 72);
        ctx.fillStyle = '#d64545';
        ctx.fillRect(b.x + b.w / 2 - 28, b.y + b.h / 2 - 7, 56, 14);
        ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h / 2 - 28, 14, 56);
      } else if (b.special === 'chop') {
        ctx.fillStyle = 'rgba(12, 20, 20, 0.75)';
        ctx.fillRect(b.x + 16, b.y + b.h / 2 - 16, b.w - 32, 32);
        ctx.fillStyle = COLORS.gold;
        ctx.font = `700 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHOP SHOP', b.x + b.w / 2, b.y + b.h / 2);
      } else if (b.special === 'garage') {
        ctx.fillStyle = 'rgba(12, 18, 24, 0.7)';
        ctx.fillRect(b.x + 18, b.y + b.h / 2 - 14, b.w - 36, 28);
        ctx.fillStyle = COLORS.neon;
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BAYFRONT GARAGE', b.x + b.w / 2, b.y + b.h / 2);
      } else {
        for (const w of b.windows) {
          ctx.fillStyle = w.lit ? COLORS.windowsLit : COLORS.windowsDark;
          if (w.lit) {
            ctx.fillStyle = 'rgba(255, 210, 122, 0.28)';
            ctx.fillRect(w.x - 3, w.y - 3, 12, 13);
            ctx.fillStyle = COLORS.windowsLit;
          }
          ctx.fillRect(w.x - 2.5, w.y - 3, 5, 7);
        }
        ctx.fillStyle = 'rgba(80, 84, 92, 0.9)';
        ctx.fillRect(b.ac.x, b.ac.y, b.ac.w, b.ac.h);
        ctx.strokeStyle = 'rgba(30, 32, 36, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.ac.x, b.ac.y, b.ac.w, b.ac.h);
      }
      if (b.special === 'hospital') {
        ctx.fillStyle = 'rgba(40, 44, 52, 0.65)';
        ctx.font = `700 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ST. MARY', b.x + b.w / 2, b.y + b.h - 24);
      }
    }
  }

  function drawTrees() {
    for (const t of stateCache.trees) {
      if (!inView(t.x, t.y, 60)) continue;
      ctx.fillStyle = 'rgba(20, 30, 20, 0.25)';
      ctx.beginPath();
      ctx.ellipse(t.x + 7, t.y + 8, t.r * 0.95, t.r * 0.6, 0, 0, TAU);
      ctx.fill();
      if (t.kind === 'palm') {
        ctx.strokeStyle = COLORS.trunk;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y + 8);
        ctx.lineTo(t.x + Math.sin(t.phase) * 2, t.y - t.r * 0.7);
        ctx.stroke();
        ctx.strokeStyle = COLORS.tree;
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU + Math.sin(stateCache.time + t.phase) * 0.06;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - t.r * 0.7);
          ctx.quadraticCurveTo(
            t.x + Math.cos(a) * t.r * 0.8,
            t.y - t.r * 0.7 + Math.sin(a) * t.r * 0.8,
            t.x + Math.cos(a) * t.r * 1.25,
            t.y - t.r * 0.7 + Math.sin(a) * t.r * 1.25,
          );
          ctx.stroke();
        }
        ctx.fillStyle = COLORS.treeLight;
        ctx.beginPath();
        ctx.arc(t.x, t.y - t.r * 0.7, 3.5, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.trunk;
        ctx.fillRect(t.x - 2.5, t.y + t.r * 0.35, 5, t.r * 0.7);
        ctx.fillStyle = COLORS.tree;
        ctx.beginPath();
        ctx.arc(t.x - t.r * 0.3, t.y, t.r * 0.72, 0, TAU);
        ctx.arc(t.x + t.r * 0.35, t.y + t.r * 0.16, t.r * 0.62, 0, TAU);
        ctx.arc(t.x, t.y - t.r * 0.4, t.r * 0.66, 0, TAU);
        ctx.fill();
        ctx.fillStyle = COLORS.treeLight;
        ctx.beginPath();
        ctx.arc(t.x - t.r * 0.22, t.y - t.r * 0.3, t.r * 0.3, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawMarker(x, y, label, kind = 'start', time = 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + x * 0.01);
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'start') {
      ctx.fillStyle = 'rgba(255, 215, 94, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, 30 + pulse * 8, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.marker;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = alphaColor(COLORS.marker, 0.75);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255, 215, 94, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.marker;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = COLORS.marker;
      ctx.fillRect(-4, -9, 8, 18);
      ctx.fillRect(-9, -4, 18, 8);
    }
    if (label) {
      const text = label;
      ctx.font = `700 13px ${FONT}`;
      const width = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
      roundPath(ctx, -width / 2 - 8, -48, width + 16, 22, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, -37);
    }
    ctx.restore();
  }

  function drawPickups() {
    for (const item of stateCache.pickups) {
      if (!item.active || !inView(item.x, item.y, 40)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(stateCache.time * 2.4 + item.phase);
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = 'rgba(80, 220, 120, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 20 + pulse * 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.money;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 50, 26, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0f3b20';
      ctx.font = `700 14px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
    }
  }

  function drawPed(ped) {
    if (!inView(ped.x, ped.y, 40)) return;
    const wobble = Math.sin(ped.phase) * 1.6;
    ctx.fillStyle = 'rgba(10, 15, 20, 0.22)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 3, ped.y + 5, 8, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ped.fleeTimer > 0 ? '#f1d9a9' : '#2b2f36';
    ctx.fillRect(ped.x - 4, ped.y + 2, 3, 6);
    ctx.fillRect(ped.x + 1, ped.y + 2, 3, 6);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 1, 6.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(ped.x + wobble * 0.2, ped.y - 8, 4.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ped.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ped.x - 5, ped.y - 1);
    ctx.lineTo(ped.x - 7, ped.y + 4 + wobble);
    ctx.moveTo(ped.x + 5, ped.y - 1);
    ctx.lineTo(ped.x + 7, ped.y + 4 - wobble);
    ctx.stroke();
    if (ped.fleeTimer > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = `700 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 18);
    }
  }

  function drawPlayerOnFoot(player) {
    const punch = player.punch > 0 ? Math.sin((1 - player.punch / 0.28) * Math.PI) : 0;
    const bob = player.moving ? Math.sin(player.phase) * 2 : 0;
    ctx.fillStyle = 'rgba(10, 15, 20, 0.28)';
    ctx.beginPath();
    ctx.ellipse(player.x + 4, player.y + 6, 11, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#242a33';
    ctx.fillRect(player.x - 5, player.y + 3 + bob * 0.3, 4, 8);
    ctx.fillRect(player.x + 2, player.y + 3 - bob * 0.3, 4, 8);
    ctx.fillStyle = COLORS.player;
    roundPath(ctx, player.x - 8, player.y - 7, 16, 15, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.playerDark;
    ctx.fillRect(player.x - 8, player.y + 2, 16, 3);
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(player.x + bob * 0.2, player.y - 10, 5.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c2129';
    ctx.beginPath();
    ctx.arc(player.x + bob * 0.2 - 1, player.y - 12, 5.2, Math.PI, TAU);
    ctx.fill();
    const armAngle = player.angle;
    ctx.strokeStyle = COLORS.skin;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 1);
    if (punch > 0) {
      ctx.lineTo(player.x + Math.cos(armAngle) * (13 + punch * 12), player.y + Math.sin(armAngle) * (13 + punch * 12));
    } else {
      ctx.lineTo(player.x - 8, player.y + 2 - bob);
    }
    ctx.stroke();
    if (stateCache.wanted > 0) {
      ctx.strokeStyle = alphaColor(COLORS.danger, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 16, 0, TAU);
      ctx.stroke();
    }
  }

  function drawCar(car) {
    if (!inView(car.x, car.y, 110)) return;
    const spec = VEHICLES[car.type];
    const l = spec.length;
    const w = spec.width;
    ctx.save();
    ctx.translate(car.x + 5, car.y + 7);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(6, 9, 14, 0.30)';
    roundPath(ctx, -l / 2, -w / 2, l, w, 7);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const bodyColor = car.wrecked ? '#3a3c40' : spec.color;
    ctx.fillStyle = bodyColor;
    roundPath(ctx, -l / 2, -w / 2, l, w, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 18, 24, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(16, 20, 26, 0.9)';
    ctx.fillRect(-l * 0.32, -w / 2 - 1, 9, 4);
    ctx.fillRect(l * 0.22, -w / 2 - 1, 9, 4);
    ctx.fillRect(-l * 0.32, w / 2 - 3, 9, 4);
    ctx.fillRect(l * 0.22, w / 2 - 3, 9, 4);

    if (car.type === 'truck') {
      ctx.fillStyle = car.wrecked ? '#2e3034' : spec.roof;
      roundPath(ctx, -l / 2 + 4, -w / 2 + 3, l * 0.62, w - 6, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 18, 22, 0.55)';
      ctx.lineWidth = 1.5;
      for (let x = -l / 2 + 12; x < -l * 0.12; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, -w / 2 + 5);
        ctx.lineTo(x, w / 2 - 5);
        ctx.stroke();
      }
      ctx.fillStyle = spec.color;
      roundPath(ctx, l * 0.18, -w / 2 + 3, l * 0.3, w - 6, 4);
      ctx.fill();
    } else {
      ctx.fillStyle = car.wrecked ? '#24262a' : spec.roof;
      roundPath(ctx, -l * 0.18, -w * 0.32, l * 0.4, w * 0.64, 5);
      ctx.fill();
      ctx.fillStyle = car.wrecked ? '#1a1d21' : '#2d3743';
      roundPath(ctx, l * 0.13, -w * 0.28, l * 0.09, w * 0.56, 3);
      ctx.fill();
      roundPath(ctx, -l * 0.3, -w * 0.26, l * 0.07, w * 0.52, 3);
      ctx.fill();
      if (car.type === 'sports') {
        ctx.fillStyle = 'rgba(255, 250, 235, 0.85)';
        ctx.fillRect(-l * 0.38, -2, l * 0.76, 4);
      }
      if (car.type === 'taxi') {
        ctx.fillStyle = '#fff3c9';
        roundPath(ctx, -7, -5, 14, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#1c1d22';
        ctx.font = `700 7px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAXI', 0, 0);
      }
    }

    if (car.type === 'police') {
      ctx.fillStyle = 'rgba(240, 244, 250, 0.9)';
      ctx.fillRect(-l * 0.12, -w / 2 + 2, l * 0.2, w - 4);
      ctx.fillStyle = COLORS.policeBlue;
      ctx.fillRect(-l * 0.12, -w / 2 + 2, l * 0.2, 4);
      const flash = Math.sin(stateCache.time * 12 + car.phase) > 0;
      ctx.fillStyle = flash ? COLORS.policeRed : '#5a1f24';
      ctx.fillRect(-9, -w / 2 + 3, 8, 5);
      ctx.fillStyle = flash ? '#1d3c70' : COLORS.policeBlue;
      ctx.fillRect(1, -w / 2 + 3, 8, 5);
      ctx.fillStyle = flash ? 'rgba(232, 80, 92, 0.22)' : 'rgba(75, 143, 224, 0.22)';
      ctx.beginPath();
      ctx.arc(-5, -w / 2 + 5, 15, 0, TAU);
      ctx.fill();
    }

    if (!car.wrecked) {
      ctx.fillStyle = '#ffe7a1';
      ctx.fillRect(l / 2 - 3, -w / 2 + 4, 3, 5);
      ctx.fillRect(l / 2 - 3, w / 2 - 9, 3, 5);
      ctx.fillStyle = '#d94b45';
      ctx.fillRect(-l / 2, -w / 2 + 4, 2.5, 4);
      ctx.fillRect(-l / 2, w / 2 - 8, 2.5, 4);
    }
    ctx.restore();

    if (car.health < car.maxHealth && !car.wrecked) {
      const ratio = car.health / car.maxHealth;
      const bw = 38;
      const bx = car.x - bw / 2;
      const by = car.y - w / 2 - 22;
      ctx.fillStyle = 'rgba(8, 12, 18, 0.78)';
      roundPath(ctx, bx - 1, by - 1, bw + 2, 6, 3);
      ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? '#6ed36e' : ratio > 0.25 ? '#e8b84a' : '#e8504a';
      roundPath(ctx, bx, by, bw * ratio, 4, 2);
      ctx.fill();
    }

    if (car.health < 45 || car.wrecked) {
      const puffs = car.wrecked ? 4 : 2;
      for (let i = 0; i < puffs; i += 1) {
        const t = stateCache.time * (car.wrecked ? 1.6 : 2.2) + car.phase + i * 1.7;
        const rise = (t % 1.6) / 1.6;
        const alpha = (car.wrecked ? 0.5 : 0.28) * (1 - rise);
        ctx.fillStyle = `rgba(52, 54, 58, ${alpha})`;
        ctx.beginPath();
        ctx.arc(
          car.x - Math.cos(car.angle) * l * 0.3 + Math.sin(car.phase + i * 2) * 6,
          car.y - Math.sin(car.angle) * l * 0.3 - rise * 26,
          6 + rise * 10,
          0,
          TAU,
        );
        ctx.fill();
      }
    }
  }

  function drawCars() {
    const cars = stateCache.cars
      .filter((car) => inView(car.x, car.y, 120))
      .slice()
      .sort((a, b) => a.y - b.y);
    for (const car of cars) drawCar(car);
  }

  function drawMarkers() {
    const time = stateCache.time;
    if (!stateCache.mission) {
      for (const marker of stateCache.startMarkers) {
        if (!inView(marker.x, marker.y, 80)) continue;
        drawMarker(marker.x, marker.y, `${marker.title}  $${marker.reward}`, 'start', time);
      }
    } else {
      for (const objective of stateCache.mission.objectives) {
        if (!inView(objective.x, objective.y, 80)) continue;
        drawMarker(objective.x, objective.y, objective.label, 'target', time);
      }
    }
  }

  function drawHud(state, ui) {
    const panel = { x: 16, y: 16, w: 248, h: 140 };
    ctx.fillStyle = COLORS.hudBg;
    roundPath(ctx, panel.x, panel.y, panel.w, panel.h, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = COLORS.neon;
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('NEON BAY', panel.x + 16, panel.y + 24);

    const stars = state.wanted;
    for (let i = 0; i < WANTED.max; i += 1) {
      const cx = panel.x + panel.w - 20 - i * 20;
      starPath(ctx, cx, panel.y + 20, 8, 3.6);
      if (i < stars) {
        ctx.fillStyle = COLORS.gold;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(245, 197, 66, 0.32)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText('CASH', panel.x + 16, panel.y + 48);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `800 26px ${MONO}`;
    ctx.fillText(money(state.cash), panel.x + 16, panel.y + 76);

    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText('HEALTH', panel.x + 16, panel.y + 96);
    const healthRatio = state.player.health / 100;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    roundPath(ctx, panel.x + 16, panel.y + 103, 180, 10, 5);
    ctx.fill();
    ctx.fillStyle = healthRatio > 0.5 ? '#62d47a' : healthRatio > 0.25 ? '#e8b84a' : '#e8504a';
    roundPath(ctx, panel.x + 16, panel.y + 103, Math.max(2, 180 * healthRatio), 10, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`BEST ${money(state.bestEarnings)}`, panel.x + panel.w - 16, panel.y + 128);
  }

  function drawMissionPanel(state) {
    if (!state.mission) {
      if (state.wanted > 0) {
        const w = 300;
        const x = viewW / 2 - w / 2;
        ctx.fillStyle = COLORS.hudBg;
        roundPath(ctx, x, 16, w, 50, 12);
        ctx.fill();
        ctx.strokeStyle = alphaColor(COLORS.danger, 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = COLORS.danger;
        ctx.font = `800 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EVADE THE POLICE', viewW / 2, 34);
        ctx.fillStyle = COLORS.muted;
        ctx.font = `600 11px ${FONT}`;
        ctx.fillText(`${state.wanted} star${state.wanted === 1 ? '' : 's'} · lose the heat`, viewW / 2, 52);
      }
      return;
    }
    const mission = state.mission;
    const w = 380;
    const x = viewW / 2 - w / 2;
    const y = 16;
    ctx.fillStyle = COLORS.hudBg;
    roundPath(ctx, x, y, w, 74, 12);
    ctx.fill();
    ctx.strokeStyle = alphaColor(COLORS.gold, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${mission.title.toUpperCase()}  ·  ${money(mission.reward)}`, x + 16, y + 20);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(mission.stageText, x + 16, y + 43);
    ctx.fillStyle = mission.timeLeft < 15 ? COLORS.danger : COLORS.text;
    ctx.font = `800 17px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(mission.timeLeft), x + w - 16, y + 22);
    const ratio = Math.max(0, Math.min(1, mission.timeLeft / 1));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 16, y + 60, w - 32, 4);
    ctx.fillStyle = mission.timeLeft < 15 ? COLORS.danger : COLORS.gold;
    ctx.fillRect(x + 16, y + 60, (w - 32) * Math.max(0, Math.min(1, mission.timeLeft / 120)), 4);
  }

  function drawMinimap(state) {
    const w = 210;
    const h = 152;
    const x = viewW - w - 16;
    const y = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 22, 0.82)';
    roundPath(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.save();
    roundPath(ctx, x, y, w, h, 12);
    ctx.clip();
    const scale = Math.min((w - 16) / WORLD.width, (h - 16) / WORLD.height);
    const ox = x + (w - WORLD.width * scale) / 2;
    const oy = y + (h - WORLD.height * scale) / 2;
    const mx = (v) => ox + v * scale;
    const my = (v) => oy + v * scale;
    ctx.fillStyle = '#1c3327';
    ctx.fillRect(mx(0), my(0), WORLD.width * scale, WORLD.beachY * scale);
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(mx(SPECIAL.park.x), my(SPECIAL.park.y), SPECIAL.park.w * scale, SPECIAL.park.h * scale);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(mx(0), my(WORLD.beachY), WORLD.width * scale, (WORLD.waterY - WORLD.beachY) * scale);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(mx(0), my(WORLD.waterY), WORLD.width * scale, (WORLD.height - WORLD.waterY) * scale);
    ctx.strokeStyle = '#5b6570';
    ctx.lineWidth = 1.4;
    for (const roadX of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(mx(roadX), my(0));
      ctx.lineTo(mx(roadX), my(WORLD.beachY));
      ctx.stroke();
    }
    for (const roadY of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(mx(0), my(roadY));
      ctx.lineTo(mx(WORLD.width), my(roadY));
      ctx.stroke();
    }
    ctx.fillStyle = '#e8e2d2';
    for (const b of state.buildings) {
      if (b.special) continue;
      ctx.fillRect(mx(b.x), my(b.y), Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    ctx.fillStyle = '#f2f5f7';
    ctx.fillRect(mx(SPECIAL.hospital.x), my(SPECIAL.hospital.y), SPECIAL.hospital.w * scale, SPECIAL.hospital.h * scale);

    for (const car of state.cars) {
      if (car.role === 'traffic') {
        ctx.fillStyle = 'rgba(240, 240, 235, 0.8)';
        ctx.fillRect(mx(car.x) - 1, my(car.y) - 1, 2, 2);
      } else if (car.role === 'police') {
        ctx.fillStyle = COLORS.policeBlue;
        ctx.beginPath();
        ctx.arc(mx(car.x), my(car.y), 2.8, 0, TAU);
        ctx.fill();
      }
    }

    if (state.mission) {
      for (const o of state.mission.objectives) {
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx(o.x), my(o.y), 4, 0, TAU);
        ctx.stroke();
      }
    } else {
      for (const marker of state.startMarkers) {
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.arc(mx(marker.x), my(marker.y), 2.4, 0, TAU);
        ctx.fill();
      }
    }

    const px = state.player.inCar ? state.player.inCar.x : state.player.x;
    const py = state.player.inCar ? state.player.inCar.y : state.player.y;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(mx(px), my(py), 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.45)';
    ctx.lineWidth = 1.5;
    roundPath(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawControls(state) {
    const text = 'WASD Move / Drive   ·   Shift Run   ·   Space Punch / Handbrake   ·   E Enter   ·   P Pause   ·   M Mute';
    ctx.font = `600 12px ${FONT}`;
    const width = ctx.measureText(text).width + 28;
    const x = 16;
    const y = viewH - 44;
    ctx.fillStyle = 'rgba(8, 14, 24, 0.66)';
    roundPath(ctx, x, y, width, 28, 9);
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 14, y + 15);

    if (state.actionHint) {
      ctx.font = `700 14px ${FONT}`;
      const w = ctx.measureText(state.actionHint).width + 30;
      ctx.fillStyle = 'rgba(8, 14, 24, 0.8)';
      roundPath(ctx, viewW / 2 - w / 2, viewH - 86, w, 32, 10);
      ctx.fill();
      ctx.strokeStyle = alphaColor(COLORS.gold, 0.6);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = COLORS.gold;
      ctx.textAlign = 'center';
      ctx.fillText(state.actionHint, viewW / 2, viewH - 70);
    }

    if (state.player.inCar) {
      const car = state.player.inCar;
      const kmh = Math.round(Math.abs(car.speed) * 0.2);
      const w = 132;
      const px = viewW - w - 16;
      const py = viewH - 78;
      ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
      roundPath(ctx, px, py, w, 52, 10);
      ctx.fill();
      ctx.fillStyle = car.wrecked ? COLORS.danger : COLORS.neon;
      ctx.font = `800 28px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(kmh), px + w - 42, py + 26);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `700 10px ${FONT}`;
      ctx.fillText('KM/H', px + w - 14, py + 30);
    }
  }

  function drawToast(state) {
    if (!state.toast) return;
    const t = state.toast;
    const alpha = Math.min(1, t.time / 0.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 16px ${FONT}`;
    const w = ctx.measureText(t.text).width + 36;
    const y = 108;
    ctx.fillStyle = 'rgba(8, 14, 24, 0.86)';
    roundPath(ctx, viewW / 2 - w / 2, y, w, 38, 12);
    ctx.fill();
    ctx.strokeStyle = alphaColor(COLORS.gold, 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, viewW / 2, y + 20);
    ctx.restore();
  }

  function drawHudAll(state, ui) {
    drawHud(state, ui);
    drawMissionPanel(state);
    drawMinimap(state);
    drawControls(state);
    drawToast(state);
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = 'rgba(4, 8, 16, 0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    const cx = viewW / 2;
    const gradient = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0);
    gradient.addColorStop(0, COLORS.neon);
    gradient.addColorStop(0.5, '#ffe7a1');
    gradient.addColorStop(1, COLORS.neonPink);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 104px ${FONT}`;
    ctx.save();
    ctx.shadowColor = 'rgba(88, 224, 208, 0.55)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = gradient;
    ctx.fillText('NEON BAY', cx, 188);
    ctx.restore();

    ctx.fillStyle = COLORS.gold;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('RICO VANCE IS BROKE. THE CITY IS NOT.', cx, 226);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('A sunset crime sandbox — steal, drive, deliver, survive the heat.', cx, 252);

    const panelW = 640;
    const panelH = 176;
    const px = cx - panelW / 2;
    const py = 292;
    ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
    roundPath(ctx, px, py, panelW, panelH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const lines = [
      ['WASD / Arrows', 'walk and drive'],
      ['Shift', 'sprint'],
      ['Space', 'punch · handbrake · confirm'],
      ['E', 'enter cars and start missions'],
      ['P / Esc', 'pause'],
      ['M', 'mute'],
    ];
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i += 1) {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const lx = px + 36 + col * 300;
      const ly = py + 42 + row * 40;
      ctx.fillStyle = COLORS.gold;
      ctx.font = `800 13px ${MONO}`;
      ctx.fillText(lines[i][0], lx, ly);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 13px ${FONT}`;
      ctx.fillText(lines[i][1], lx + 112, ly);
    }

    const blink = 0.55 + 0.45 * Math.sin(state.time * 4.2);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PRESS SPACE TO START', cx, 520);
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`Best earnings ${money(state.bestEarnings)}   ·   Missions complete ${state.completed.length}/3`, cx, 556);
    ctx.fillStyle = 'rgba(88, 224, 208, 0.8)';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('St. Mary Hospital · Neon Park · Ocean Ave · The Docks', cx, 584);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText(ui && ui.muted ? 'Sound: muted' : 'Sound: on', cx, 606);
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(4, 8, 16, 0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    const cx = viewW / 2;
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', cx, viewH / 2 - 50);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText('Space / P — resume', cx, viewH / 2 + 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('M — mute sound      ·      P / Esc — pause', cx, viewH / 2 + 50);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(`Cash ${money(state.cash)}  ·  Wanted ${state.wanted}  ·  Best ${money(state.bestEarnings)}`, cx, viewH / 2 + 88);
  }

  function drawEnd(state, screen) {
    const busted = screen === SCREEN_BUSTED;
    ctx.fillStyle = busted ? 'rgba(48, 8, 14, 0.62)' : 'rgba(30, 8, 18, 0.68)';
    ctx.fillRect(0, 0, viewW, viewH);
    const cx = viewW / 2;
    ctx.fillStyle = busted ? '#ff8a7a' : '#ff5f7a';
    ctx.font = `900 86px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.fillText(busted ? 'BUSTED' : 'WASTED', cx, viewH / 2 - 54);
    ctx.restore();
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('You woke up outside St. Mary Hospital.', cx, viewH / 2 + 14);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(`Hospital bill: -${money(state.lastLoss)}`, cx, viewH / 2 + 46);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('Cash and your record carry on.', cx, viewH / 2 + 76);
    const blink = 0.55 + 0.45 * Math.sin(state.time * 4.2);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText('PRESS SPACE TO CONTINUE', cx, viewH / 2 + 128);
    ctx.globalAlpha = 1;
  }

  let stateCache = null;

  function draw(state, screen, ui = {}) {
    stateCache = state;
    const now = performance.now();
    const dt = lastDraw === 0 ? 1 / 60 : Math.min(0.1, (now - lastDraw) / 1000);
    lastDraw = now;

    let targetX;
    let targetY;
    let targetZoom;
    if (screen === SCREEN_TITLE) {
      targetX = WORLD.width / 2 + Math.sin(state.time * 0.09) * CAMERA.titlePanX;
      targetY = WORLD.height * 0.5 + Math.cos(state.time * 0.07) * CAMERA.titlePanY;
      targetZoom = CAMERA.titleZoom;
    } else {
      const car = state.player.inCar;
      targetX = car ? car.x : state.player.x;
      targetY = car ? car.y : state.player.y;
      targetZoom = car ? CAMERA.carZoom : CAMERA.walkZoom;
    }
    if (!cam.ready) {
      cam.x = targetX;
      cam.y = targetY;
      cam.zoom = targetZoom;
      cam.ready = true;
    } else {
      const follow = 1 - Math.exp(-CAMERA.follow * dt);
      cam.x += (targetX - cam.x) * follow;
      cam.y += (targetY - cam.y) * follow;
      cam.zoom += (targetZoom - cam.zoom) * follow;
    }

    view = viewRect();
    const shake = state.shake || 0;
    const shakeX = Math.sin(state.time * 61) * shake * 0.45;
    const shakeY = Math.cos(state.time * 73) * shake * 0.35;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bay;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(viewW / 2 + shakeX, viewH / 2 + shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGround();
    drawRoads();
    drawMarkers();
    drawPickups();
    drawBuildings();
    drawTrees();
    for (const ped of state.peds) drawPed(ped);
    drawCars();
    if (!state.player.inCar) drawPlayerOnFoot(state.player);

    ctx.restore();
    ctx.fillStyle = COLORS.sunset;
    ctx.fillRect(0, 0, viewW, viewH);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
    } else {
      drawHudAll(state, ui);
      if (screen === SCREEN_PAUSED) drawPaused(state);
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) drawEnd(state, screen);
    }
  }

  return {
    draw,
    resize,
    get camera() {
      return cam;
    },
  };
}
