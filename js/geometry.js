 window.Geometry = (function () {
  function polygonArea(pts){
    let s=0;
    for (let i=0;i<pts.length;i++){
      const [x1,y1]=pts[i], [x2,y2]=pts[(i+1)%pts.length];
      s += x1*y2 - x2*y1;
    }
    return s/2;
  }
  function bboxOf(pts){
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for (const [x,y] of pts){ if(x<x0)x0=x; if(y<y0)y0=y; if(x>x1)x1=x; if(y>y1)y1=y; }
    return [x0,y0,x1,y1];
  }
  function dist(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]); }

  function segDist(p,a,b){
    const vx=b[0]-a[0], vy=b[1]-a[1], wx=p[0]-a[0], wy=p[1]-a[1];
    const vv=vx*vx+vy*vy;
    if (vv===0) return Math.hypot(wx,wy);
    let t=(wx*vx+wy*vy)/vv; t=Math.max(0,Math.min(1,t));
    return Math.hypot(p[0]-(a[0]+t*vx), p[1]-(a[1]+t*vy));
  }
  function pointInPoly(p, poly){
    let inside=false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
      if (((yi>p[1])!==(yj>p[1])) && (p[0] < (xj-xi)*(p[1]-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  }
  function inwardNormal(a,b,ccw){
    const tx=b[0]-a[0], ty=b[1]-a[1];
    const len=Math.hypot(tx,ty)||1;
    const nx = -ty/len, ny = tx/len;
    return ccw ? [nx,ny] : [-nx,-ny];
  }
  function lineIntersect(a,b,c,d){
    const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]];
    const den=r[0]*s[1]-r[1]*s[0];
    if (Math.abs(den)<1e-9) return null;
    const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den;
    return [a[0]+r[0]*t, a[1]+r[1]*t];
  }

  function inwardOffsetPolygon(poly, off, ccw) {
    const n = poly.length;
    if (n < 3) return [];
    const inner = [];
    for (let i=0;i<n;i++){
      const a=poly[i], b=poly[(i+1)%n];
      const [nx,ny]=inwardNormal(a,b,ccw);
      inner.push({ a:[a[0]+nx*off, a[1]+ny*off], b:[b[0]+nx*off, b[1]+ny*off], nx, ny });
    }
    const shifted = [];
    for (let i=0;i<n;i++){
      const l1=inner[(i-1+n)%n], l2=inner[i];
      const p=lineIntersect(l1.a,l1.b,l2.a,l2.b);
      if (p) shifted.push(p);
      else shifted.push([poly[i][0]+l2.nx*off, poly[i][1]+l2.ny*off]);
    }
    return shifted;
  }

  function rectInside(cx,cy,halfW,halfL,ang,poly){
    const ca=Math.cos(ang), sa=Math.sin(ang);
    const corners=[
      [-halfL,-halfW],[halfL,-halfW],[halfL,halfW],[-halfL,halfW]
    ].map(([x,y]) => [cx + x*ca - y*sa, cy + x*sa + y*ca]);
    for (const c of corners) if (!pointInPoly(c, poly)) return false;
    return true;
  }

  function placeRow(poly, off, stepAlong, halfW, halfL, ccw) {
    const placed = [];
    const shifted = inwardOffsetPolygon(poly, off, ccw);
    if (shifted.length < 3) return placed;
    let acc = 0;
    for (let i=0;i<shifted.length;i++){
      const a=shifted[i], b=shifted[(i+1)%shifted.length];
      const segLen=dist(a,b);
      if (segLen===0) continue;
      const ang = Math.atan2(b[1]-a[1], b[0]-a[0]);
      let t = (stepAlong - (acc % stepAlong)) % stepAlong;
      while (t <= segLen) {
        const cx = a[0] + (b[0]-a[0]) * (t/segLen);
        const cy = a[1] + (b[1]-a[1]) * (t/segLen);
        if (rectInside(cx,cy,halfW,halfL,ang,poly)) placed.push({ cx, cy, angle: ang });
        t += stepAlong;
      }
      acc += segLen;
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
      const ccw = polygonArea(poly) > 0;
      const bb = bboxOf(poly);
      const minSide = Math.min(bb[2]-bb[0], bb[3]-bb[1]);

      let placed = [];
      let skipped = false;
      let reason = "";

      if (minSide < (module.w + 2*safetyMM) * unitsPerMM) {
        skipped = true;
        reason = `stroke too narrow for module ${module.name} (${module.w} mm)`;
        if (force) placed = placeRow(poly, firstOff, stepAlong, halfW, halfL, ccw);
      } else {
        let off = firstOff;
        let rows = 0, guard = 50;
        while (guard-- > 0) {
          const row = placeRow(poly, off, stepAlong, halfW, halfL, ccw);
          if (!row.length) break;
          placed.push(...row);
          rows++;
          off += rowOffset;
          if (off > Math.max(bb[3]-bb[1], bb[2]-bb[0])) break;
        }
        if (rows === 0) {
          skipped = true;
          reason = `no room for a full row of module ${module.name}`;
          if (force) placed = placeRow(poly, firstOff, stepAlong, halfW, halfL, ccw);
        }
      }

      total += placed.length;
      perGlyph.push({ index: perGlyph.length+1, count: placed.length, skipped, reason, placed, poly, bbox: bb });
    }

    return { perGlyph, total };
  }

  return { place };
})();
