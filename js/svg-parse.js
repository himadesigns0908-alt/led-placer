window.SVGParser = (function () {
  function parse(text) {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") throw new Error("Not an SVG file.");

    const wAttr = svg.getAttribute("width") || "";
    const hAttr = svg.getAttribute("height") || "";
    const vbAttr = svg.getAttribute("viewBox") || "";

    let viewBox = null;
    if (vbAttr) {
      const p = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (p.length === 4 && p.every(n => isFinite(n))) viewBox = p;
    }
    if (!viewBox) {
      const w = parseFloat(wAttr), h = parseFloat(hAttr);
      if (!isFinite(w) || !isFinite(h)) throw new Error("SVG has no usable viewBox or width/height.");
      viewBox = [0, 0, w, h];
    }

    const wMM = parseLengthToMM(wAttr);
    const hMM = parseLengthToMM(hAttr);
    let unitsPerMM = null;
    if (wMM && viewBox[2]) unitsPerMM = viewBox[2] / wMM;
    else if (hMM && viewBox[3]) unitsPerMM = viewBox[3] / hMM;

    const glyphs = [];
    const shapes = svg.querySelectorAll("path, polygon, polyline, rect, circle, ellipse");
    shapes.forEach(el => {
      shapeToPolylines(el).forEach(pts => {
        if (pts.length >= 3) glyphs.push({ pts });
      });
    });
    if (!glyphs.length) throw new Error("No closed shapes found. Convert text to curves and export as SVG paths.");
    return { viewBox, unitsPerMM, glyphs };
  }

  function parseLengthToMM(str) {
    if (!str) return null;
    const m = String(str).trim().match(/^([\d.]+)\s*([a-z%]*)$/i);
    if (!m) return null;
    const v = parseFloat(m[1]); if (!isFinite(v)) return null;
    const u = (m[2] || "").toLowerCase();
    switch (u) {
      case "mm": return v;
      case "cm": return v * 10;
      case "in": return v * 25.4;
      case "pt": return v * 25.4 / 72;
      case "pc": return v * 25.4 / 6;
      default: return null;
    }
  }

  function shapeToPolylines(el) {
    const tag = el.nodeName.toLowerCase();
    const out = [];
    try {
      if (tag === "rect") {
        const x = +el.getAttribute("x") || 0, y = +el.getAttribute("y") || 0;
        const w = +el.getAttribute("width") || 0, h = +el.getAttribute("height") || 0;
        if (w > 0 && h > 0) out.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
      } else if (tag === "circle") {
        const cx = +el.getAttribute("cx") || 0, cy = +el.getAttribute("cy") || 0, r = +el.getAttribute("r") || 0;
        if (r > 0) out.push(circlePts(cx, cy, r, 64));
      } else if (tag === "ellipse") {
        const cx = +el.getAttribute("cx") || 0, cy = +el.getAttribute("cy") || 0;
        const rx = +el.getAttribute("rx") || 0, ry = +el.getAttribute("ry") || 0;
        if (rx > 0 && ry > 0) {
          const pts = [];
          for (let i=0;i<64;i++){ const t=i/64*Math.PI*2; pts.push([cx+rx*Math.cos(t), cy+ry*Math.sin(t)]); }
          out.push(pts);
        }
      } else if (tag === "polygon" || tag === "polyline") {
        const nums = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number).filter(n=>isFinite(n));
        const pts = [];
        for (let i=0;i+1<nums.length;i+=2) pts.push([nums[i], nums[i+1]]);
        if (pts.length >= 3) out.push(pts);
      } else if (tag === "path") {
        flattenPath(el.getAttribute("d") || "").forEach(p => { if (p.length >= 3) out.push(p); });
      }
    } catch(e){ }
    return out;
  }

  function circlePts(cx, cy, r, n) {
    const pts = [];
    for (let i=0;i<n;i++){ const t=i/n*Math.PI*2; pts.push([cx+r*Math.cos(t), cy+r*Math.sin(t)]); }
    return pts;
  }

  function flattenPath(d) {
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    let i = 0;
    const polys = [];
    let cur = null;
    let cx = 0, cy = 0, startX = 0, startY = 0;
    let cmd = null, prevCtrl = null;

    const num = () => parseFloat(tokens[i++]);
    const isNum = t => t !== undefined && !isNaN(parseFloat(t)) && !/^[a-zA-Z]$/.test(t);

    while (i < tokens.length) {
      const t = tokens[i];
      if (/^[a-zA-Z]$/.test(t)) {
        cmd = t; i++;
        if (cmd.toUpperCase() === "Z") {
          if (cur && cur.length) polys.push(cur);
          cur = null; cx = startX; cy = startY; prevCtrl = null;
          continue;
        }
      } else if (cmd === null) { i++; continue; }

      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (!isNum(tokens[i]) && C !== "Z") { if (/^[a-zA-Z]$/.test(tokens[i]||"")) { continue; } else { break; } }

      if (C === "M" || C === "L") {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        if (C === "M") {
          if (cur && cur.length) polys.push(cur);
          cur = [[x,y]]; startX = x; startY = y;
          cmd = rel ? "l" : "L";
        } else {
          if (!cur) cur = [[cx,cy]];
          cur.push([x,y]);
        }
        cx = x; cy = y; prevCtrl = null;
      } else if (C === "H") {
        let x = num(); if (rel) x += cx;
        if (!cur) cur = [[cx,cy]];
        cur.push([x,cy]); cx = x; prevCtrl = null;
      } else if (C === "V") {
        let y = num(); if (rel) y += cy;
        if (!cur) cur = [[cx,cy]];
        cur.push([cx,y]); cy = y; prevCtrl = null;
      } else if (C === "C") {
        let x1=num(), y1=num(), x2=num(), y2=num(), x=num(), y=num();
        if (rel) { x1+=cx; y1+=cy; x2+=cx; y2+=cy; x+=cx; y+=cy; }
        if (!cur) cur = [[cx,cy]];
        for (let s=1;s<=16;s++) cur.push(bez([cx,cy],[x1,y1],[x2,y2],[x,y], s/16));
        cx=x; cy=y; prevCtrl=[x2,y2];
      } else if (C === "Q") {
        let x1=num(), y1=num(), x=num(), y=num();
        if (rel) { x1+=cx; y1+=cy; x+=cx; y+=cy; }
        if (!cur) cur = [[cx,cy]];
        for (let s=1;s<=16;s++) cur.push(quad([cx,cy],[x1,y1],[x,y], s/16));
        cx=x; cy=y; prevCtrl=[x1,y1];
      } else if (C === "S") {
        let x2=num(), y2=num(), x=num(), y=num();
        if (rel) { x2+=cx; y2+=cy; x+=cx; y+=cy; }
        const x1 = prevCtrl ? 2*cx - prevCtrl[0] : cx;
        const y1 = prevCtrl ? 2*cy - prevCtrl[1] : cy;
        if (!cur) cur = [[cx,cy]];
        for (let s=1;s<=16;s++) cur.push(bez([cx,cy],[x1,y1],[x2,y2],[x,y], s/16));
        cx=x; cy=y; prevCtrl=[x2,y2];
      } else if (C === "T") {
        let x=num(), y=num(); if (rel) { x+=cx; y+=cy; }
        const x1 = prevCtrl ? 2*cx - prevCtrl[0] : cx;
        const y1 = prevCtrl ? 2*cy - prevCtrl[1] : cy;
        if (!cur) cur = [[cx,cy]];
        for (let s=1;s<=16;s++) cur.push(quad([cx,cy],[x1,y1],[x,y], s/16));
        cx=x; cy=y; prevCtrl=[x1,y1];
      } else {
        break;
      }
    }
    if (cur && cur.length >= 3) polys.push(cur);
    return polys;
  }

  function bez(p0,p1,p2,p3,t){ const mt=1-t; return [
    mt*mt*mt*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t*t*t*p3[0],
    mt*mt*mt*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t*t*t*p3[1]
  ]; }
  function quad(p0,p1,p2,t){ const mt=1-t; return [
    mt*mt*p0[0]+2*mt*t*p1[0]+t*t*p2[0],
    mt*mt*p0[1]+2*mt*t*p1[1]+t*t*p2[1]
  ]; }

  return { parse };
})();
