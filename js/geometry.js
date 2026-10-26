window.Geometry = (function () {
  
  function dist(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]); }
  
  function placeRow(poly, off, stepAlong, halfW, halfL, ccw) {
    const placed = [];
    if (!window.ClipperLib) return placed; // Safety check

    // Convert our polygon to the Clipper format (integers)
    const scale = 1000;
    const path = new ClipperLib.Path();
    poly.forEach(p => path.push(new ClipperLib.IntPoint(p[0] * scale, p[1] * scale)));

    // Calculate inward offset using Clipper
    const co = new ClipperLib.ClipperOffset(2, 0.25);
    co.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const solution = new ClipperLib.Paths();
    co.Execute(solution, -off * scale); // Negative offset for inward

    if (solution.length === 0) return placed;

    // Walk the offset path and place modules
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
          
          // Check if the rectangle fits inside the original letter
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
      
      // Determine if poly is clockwise or counter-clockwise
      let area = 0;
      for (let i=0; i<poly.length; i++) {
         let j = (i+1)%poly.length;
         area += poly[i][0]*poly[j][1] - poly[j][0]*poly[i][1];
      }
      const isCCW = area > 0;
      
      // Bounding box for skipping
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      poly.forEach(p => { minX=Math.min(minX,p[0]); minY=Math.min(minY,p[1]); maxX=Math.max(maxX,p[0]); maxY=Math.max(maxY,p[1]); });
      const minSide = Math.min(maxX-minX, maxY-minY);

      if (minSide < (module.w + 2*safetyMM) * unitsPerMM && !force) {
        perGlyph.push({ index: perGlyph.length+1, count: 0, skipped: true, reason: "Too narrow", placed: [], poly, bbox: [minX,minY,maxX,maxY] });
        continue;
      }

      // Place rows
      let off = firstOff;
      let rows = 0;
      while (rows < 50) {
        const row = placeRow(poly, off, stepAlong, halfW, halfL, isCCW);
        if (!row.length) break;
        placed.push(...row);
        rows++;
        off += rowOffset;
        if (off > Math.max(maxY-minY, maxX-minX)) break; // Prevent infinite loop
      }

      total += placed.length;
      perGlyph.push({ index: perGlyph.length+1, count: placed.length, skipped: placed.length === 0, reason: placed.length === 0 ? "No room" : "", placed, poly, bbox: [minX,minY,maxX,maxY] });
    }

    return { perGlyph, total };
  }

  return { place };
})();
