window.Geometry = (function () {
  
  function dist(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]); }

  function placeContour(poly, off, stepAlong, halfW, halfL) {
    const placed = [];
    if (!window.ClipperLib) return placed;

    const scale = 10000; 
    const path = new ClipperLib.Path();
    poly.forEach(p => path.push(new ClipperLib.IntPoint(p[0] * scale, p[1] * scale)));

    const co = new ClipperLib.ClipperOffset(2, 0.25);
    co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    const solution = new ClipperLib.Paths();
    co.Execute(solution, -off * scale);

    if (solution.length === 0) return placed;

    for (const shifted of solution) {
      if (shifted.length < 3) continue;
      let acc = 0;
      for (let i = 0; i < shifted.length; i++) {
        const a = [shifted[i].X / scale, shifted[i].Y / scale];
        const b = [shifted[(i + 1) % shifted.length].X / scale, shifted[(i + 1) % shifted.length].Y / scale];
        const segLen = dist(a, b);
        if (segLen === 0) continue;
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        let t = (stepAlong - (acc % stepAlong)) % stepAlong;

        while (t <= segLen) {
          const cx = a[0] + (b[0] - a[0]) * (t / segLen);
          const cy = a[1] + (b[1] - a[1]) * (t / segLen);
          
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const corners = [
            [-halfL, -halfW], [halfL, -halfW], [halfL, halfW], [-halfL, halfW]
          ].map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);

          let inside = true;
          for (const c of corners) {
            const pt = new ClipperLib.IntPoint(c[0] * scale, c[1] * scale);
            if (ClipperLib.Clipper.PointInPolygon(pt, path) === 0) { inside = false; break; }
          }
          
          if (inside) placed.push({ cx, cy, angle: ang });
          t += stepAlong;
        }
        acc += segLen;
      }
    }
    return placed;
  }

  function place(glyphs, module, gapAlongMM, gapRowsMM, safetyMM, unitsPerMM, force) {
    const stepAlong = (module.l + gapAlongMM) * unitsPerMM;
    const rowOffset = (module.w + gapRowsMM) * unitsPerMM;
    const firstOff  = (module.w / 2 + safetyMM) * unitsPerMM;
    const halfL     = (module.l / 2) * unitsPerMM;
    const halfW     = (module.w / 2) * unitsPerMM;

    const perGlyph = [];
    let total = 0;

    for (const g of glyphs) {
      const poly = g.pts;
      let placed = [];
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      poly.forEach(p => { minX=Math.min(minX,p[0]); minY=Math.min(minY,p[1]); maxX=Math.max(maxX,p[0]); maxY=Math.max(maxY,p[1]); });
      const minSide = Math.min(maxX-minX, maxY-minY);

      if (minSide < (module.w + 2*safetyMM) * unitsPerMM && force) {
        let x = minX + (module.l/2) * unitsPerMM;
        const cy = (minY + maxY) / 2;
        while (x <= maxX) {
           placed.push({ cx: x, cy: cy, angle: 0 });
           x += stepAlong;
        }
      } else if (minSide >= (module.w + 2*safetyMM) * unitsPerMM) {
        let off = firstOff;
        let rows = 0;
        while (rows < 100) {
          const row = placeContour(poly, off, stepAlong, halfW, halfL);
          if (!row.length) break;
          placed.push(...row);
          rows++;
          off += rowOffset;
          if (off > Math.max(maxY-minY, maxX-minX)) break; 
        }
      }

      total += placed.length;
      perGlyph.push({ index: perGlyph.length+1, count: placed.length, skipped: placed.length === 0, reason: placed.length === 0 ? "No room" : "", placed, poly, bbox: [minX,minY,maxX,maxY] });
    }

    return { perGlyph, total };
  }

  return { place };
})();
