(function () {
  "use strict";
  var statusPill = document.getElementById("status-pill");
  var content = document.getElementById("content");
  var zafClient = null;

  function init() {
    if (typeof ZAFClient !== "undefined") {
      zafClient = ZAFClient.init();
      zafClient.invoke("resize", { width: "100%", height: "550px" });
      zafClient.on("ticket.updated", function() { /* refresh */ });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
