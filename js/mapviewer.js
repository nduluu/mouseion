// Full-screen world-map viewer with zoom (buttons + wheel) and drag-to-pan.
// Opening it pauses the small map's drift (via body.map-expanded); closing resumes.
(function () {
  const expandBtn = document.getElementById("map-expand");
  const viewer = document.getElementById("map-viewer");
  const stage = document.getElementById("map-stage");
  const img = document.getElementById("map-full");
  const zoomInBtn = document.getElementById("map-zoom-in");
  const zoomOutBtn = document.getElementById("map-zoom-out");
  const collapseBtn = document.getElementById("map-collapse");
  if (!expandBtn || !viewer || !stage || !img) return;

  const MIN = 1, MAX = 8;
  let scale = 1, tx = 0, ty = 0;

  function apply() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function open() {
    scale = 1; tx = 0; ty = 0; apply();
    viewer.hidden = false;
    document.body.classList.add("map-expanded");
  }

  function close() {
    viewer.hidden = true;
    document.body.classList.remove("map-expanded");
  }

  // Zoom by a factor, optionally keeping the point (cx, cy) in screen space fixed.
  function zoomBy(factor, cx, cy) {
    const prev = scale;
    scale = Math.min(MAX, Math.max(MIN, scale * factor));
    if (scale === prev) return;
    if (cx != null) {
      const rect = stage.getBoundingClientRect();
      const ox = cx - (rect.left + rect.width / 2);
      const oy = cy - (rect.top + rect.height / 2);
      const r = scale / prev;
      tx = ox - (ox - tx) * r;
      ty = oy - (oy - ty) * r;
    }
    if (scale === MIN) { tx = 0; ty = 0; }
    apply();
  }

  expandBtn.addEventListener("click", open);
  collapseBtn.addEventListener("click", close);
  zoomInBtn.addEventListener("click", () => zoomBy(1.3));
  zoomOutBtn.addEventListener("click", () => zoomBy(1 / 1.3));

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  }, { passive: false });

  // Drag to pan.
  let dragging = false, lastX = 0, lastY = 0;
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.classList.add("grabbing");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    apply();
  });
  function endDrag() {
    dragging = false;
    stage.classList.remove("grabbing");
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", (e) => {
    if (viewer.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "+" || e.key === "=") zoomBy(1.3);
    else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.3);
  });
})();
