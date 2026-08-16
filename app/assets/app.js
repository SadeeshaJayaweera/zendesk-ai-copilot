(function () {
  "use strict";

  var statusPill = document.getElementById("status-pill");
  var content = document.getElementById("content");
  var currentContext = null;
  var currentAnalysis = null;
  var generatedReplyText = "";
  var backendBaseUrl = "http://localhost:4000";
  var zafClient = null;

  function setStatus(state, label) {
    statusPill.className = "status-pill status-pill--" + state;
    statusPill.textContent = label;
  }

  function renderError(message) {
    setStatus("error", "Error");
    content.innerHTML =
      '<div class="card">' +
      '<p class="muted"><strong>AI suggestions are temporarily unavailable.</strong></p>' +
      '<p class="muted" style="font-size:11px; margin-top:4px;">' + (message || "") + '</p>' +
      '</div>';
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderUI(context, analysis) {
    setStatus("ready", "Ready");
    var sentiment = (analysis && analysis.customer_sentiment) || "neutral";
    var intent = (analysis && analysis.customer_intent) || "question";
    var urgency = (analysis && analysis.urgency) || "normal";
    var recTone = (analysis && analysis.recommended_tone) || "professional";

    var html =
      '<div class="card">' +
      '  <div class="meta-label">Ticket #' + context.ticketId + '</div>' +
      '  <div style="font-weight:700; margin-top:2px;">' + escapeHtml(context.subject) + '</div>' +
      '  <div class="meta-grid">' +
      '    <div class="meta-item"><span class="meta-label">Sentiment</span><span class="badge badge-sentiment">' + sentiment + '</span></div>' +
      '    <div class="meta-item"><span class="meta-label">Urgency</span><span class="badge badge-urgency">' + urgency + '</span></div>' +
      '    <div class="meta-item"><span class="meta-label">Intent</span><span class="meta-val">' + intent + '</span></div>' +
      '    <div class="meta-item"><span class="meta-label">Tone</span><span class="meta-val">' + recTone + '</span></div>' +
      '  </div>' +
      '</div>' +
      '<div class="card">' +
      '  <div class="action-stack">' +
      '    <button id="btn-generate" class="copilot-btn copilot-btn--primary">✨ Generate Best Reply</button>' +
      '    <button id="btn-improve-tone" class="copilot-btn">🎯 Improve Tone</button>' +
      '    <button id="btn-concise" class="copilot-btn">✂️ Make More Concise</button>' +
      '    <button id="btn-deescalate" class="copilot-btn">🛡️ De-Escalate</button>' +
      '  </div>' +
      '</div>';

    if (generatedReplyText) {
      html +=
        '<div class="card">' +
        '  <div class="meta-label">Suggested AI Reply</div>' +
        '  <div class="suggestion-box">' + escapeHtml(generatedReplyText) + '</div>' +
        '  <div class="action-stack" style="margin-top:6px;">' +
        '    <button id="btn-insert" class="copilot-btn copilot-btn--primary">📥 Insert Reply into Ticket</button>' +
        '    <button id="btn-copy" class="copilot-btn">📋 Copy to Clipboard</button>' +
        '  </div>' +
        '  <div class="feedback-row">' +
        '    <span class="muted" style="font-size:11px;">Was this helpful?</span>' +
        '    <div class="feedback-buttons">' +
        '      <button class="feedback-btn" data-fb="helpful">👍</button>' +
        '      <button class="feedback-btn" data-fb="not_helpful">👎</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    content.innerHTML = html;
    attachListeners(context);

    if (zafClient) {
      zafClient.invoke("resize", { width: "100%", height: document.body.scrollHeight + 40 + "px" });
    }
  }

  function attachListeners(context) {
    var genBtn = document.getElementById("btn-generate");
    if (genBtn) {
      genBtn.onclick = async function () {
        genBtn.disabled = true;
        genBtn.textContent = "Generating...";
        try {
          var res = await fetch(backendBaseUrl + "/api/tickets/" + context.ticketId + "/generate-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticketContext: context })
          });
          var data = await res.json();
          generatedReplyText = data.reply || "";
          renderUI(context, currentAnalysis);
        } catch (e) {
          renderError("Failed to generate reply.");
        }
      };
    }

    var insertBtn = document.getElementById("btn-insert");
    if (insertBtn) {
      insertBtn.onclick = function () {
        if (zafClient && generatedReplyText) {
          zafClient.set("ticket.comment.text", generatedReplyText);
          recordFeedback(context.ticketId, "accepted", "insert");
        }
      };
    }

    var copyBtn = document.getElementById("btn-copy");
    if (copyBtn) {
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(generatedReplyText);
        copyBtn.textContent = "Copied!";
        setTimeout(function () { copyBtn.textContent = "📋 Copy to Clipboard"; }, 1500);
      };
    }

    var rewriteButtons = [
      { id: "btn-improve-tone", action: "improveTone" },
      { id: "btn-concise", action: "makeMoreConcise" },
      { id: "btn-deescalate", action: "deEscalate" }
    ];

    rewriteButtons.forEach(function (b) {
      var elem = document.getElementById(b.id);
      if (elem) {
        elem.onclick = async function () {
          elem.disabled = true;
          try {
            var draftText = generatedReplyText;
            if (zafClient) {
              var editor = await zafClient.get("ticket.comment.text");
              if (editor["ticket.comment.text"]) {
                draftText = editor["ticket.comment.text"];
              }
            }
            var res = await fetch(backendBaseUrl + "/api/tickets/" + context.ticketId + "/rewrite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticketContext: context, agentDraft: draftText || "Hello, I am looking into your request.", action: b.action })
            });
            var data = await res.json();
            generatedReplyText = data.rewrittenText || "";
            renderUI(context, currentAnalysis);
          } catch (e) {
            renderError("Rewrite failed.");
          }
        };
      }
    });

    var fbBtns = document.querySelectorAll(".feedback-btn");
    fbBtns.forEach(function (btn) {
      btn.onclick = function () {
        var fbType = btn.getAttribute("data-fb");
        recordFeedback(context.ticketId, fbType, "reply");
        btn.style.borderColor = "var(--primary)";
      };
    });
  }

  async function recordFeedback(ticketId, eventType, action) {
    try {
      await fetch(backendBaseUrl + "/api/tickets/" + ticketId + "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: eventType, action: action })
      });
    } catch (e) {}
  }

  async function syncTicket(ticketId) {
    try {
      var rawTicket = await zafClient.request({ url: "/api/v2/tickets/" + ticketId + ".json", type: "GET" });
      var rawComments = await zafClient.request({ url: "/api/v2/tickets/" + ticketId + "/comments.json?include=users", type: "GET" });

      var comments = (rawComments && rawComments.comments) || [];
      var ticket = (rawTicket && rawTicket.ticket) || rawTicket || {};

      var normalized = {
        ticketId: ticket.id,
        subject: ticket.subject || "",
        description: ticket.description || "",
        status: ticket.status || "open",
        priority: ticket.priority || null,
        tags: ticket.tags || [],
        customFields: (ticket.custom_fields || []).map(function (cf) { return { id: cf.id, value: cf.value }; }),
        messages: comments.map(function (c) {
          return {
            id: c.id,
            authorRole: c.author_id === ticket.requester_id ? "customer" : (c.author_id <= 0 ? "system" : "agent"),
            body: c.plain_body || c.body || "",
            createdAt: c.created_at || new Date().toISOString(),
            isPublic: c.public !== false
          };
        })
      };

      currentContext = normalized;
      var res = await fetch(backendBaseUrl + "/api/tickets/" + ticketId + "/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized)
      });
      var body = await res.json();
      currentAnalysis = body.analysis || null;
      renderUI(currentContext, currentAnalysis);
    } catch (err) {
      renderError(err.message || "Failed to load ticket.");
    }
  }

  async function init() {
    if (typeof ZAFClient === "undefined") {
      renderError("ZAF SDK unavailable.");
      return;
    }
    zafClient = ZAFClient.init();
    try {
      var metadata = await zafClient.metadata();
      if (metadata.settings && metadata.settings.backend_base_url) {
        backendBaseUrl = metadata.settings.backend_base_url.replace(/\/$/, "");
      }
      var ticketData = await zafClient.get("ticket.id");
      var ticketId = ticketData["ticket.id"];
      await syncTicket(ticketId);

      zafClient.on("ticket.updated", function () {
        syncTicket(ticketId);
      });
    } catch (err) {
      renderError(err.message);
    }
  }

  init();
})();
