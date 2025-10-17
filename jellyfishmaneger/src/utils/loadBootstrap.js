export function loadBootstrapCSS(isRTL = true) {
  // امسح أي لينك قديم
  const oldLink = document.getElementById("bootstrap-css");
  if (oldLink) oldLink.remove();

  // أنشئ لينك جديد
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.id = "bootstrap-css";
  link.href = isRTL
    ? new URL(
        "/node_modules/bootstrap/dist/css/bootstrap.rtl.min.css",
        import.meta.url
      ).href
    : new URL(
        "/node_modules/bootstrap/dist/css/bootstrap.min.css",
        import.meta.url
      ).href;

  document.head.appendChild(link);
}
