import OBR from "@owlbear-rodeo/sdk";

const STATBLOCK_KEY = "com.quick-statblock/data";
const ROLL_CHANNEL = "com.quick-statblock/public-roll";

OBR.onReady(() => {
  const container = document.getElementById("content");

  const urlParams = new URLSearchParams(window.location.search);
  const initialTokenId = urlParams.get("id");

  if (initialTokenId) {
    updateView([initialTokenId]);
  } else {
    OBR.player.getSelection().then(selection => updateView(selection));
  }

  OBR.player.onChange(async (player) => {
    if (player.selection && player.selection.length > 0) {
      updateView(player.selection);
    }
  });

  function getTokenDisplayName(item, fallbackName) {
    if (item.text && typeof item.text.plainText === "string" && item.text.plainText.trim() !== "") {
      return item.text.plainText.trim();
    }
    if (item.text && Array.isArray(item.text.richText)) {
      const extracted = item.text.richText
        .map(node => (node.children ? node.children.map(c => c.text || "").join("") : ""))
        .join(" ")
        .trim();
      if (extracted !== "") return extracted;
    }
    if (item.name && item.name.trim() !== "") {
      return item.name.trim();
    }
    return fallbackName;
  }

  async function updateView(selection) {
    if (!selection || selection.length === 0) {
      container.innerHTML = "Select a token to view its stat block.";
      return;
    }

    const items = await OBR.scene.items.getItems(selection);
    const item = items[0];

    if (!item || !item.metadata || !item.metadata[STATBLOCK_KEY]) {
      const displayName = item ? getTokenDisplayName(item, "Token") : "Selection";
      container.innerHTML = `<div><strong>${displayName}</strong> has no stat block assigned.</div><div style="font-size:11px; color:#9ca3af; margin-top:4px;">Right-click the token and choose 'Assign Stat Block'.</div>`;
      return;
    }

    const data = item.metadata[STATBLOCK_KEY];
    const rollerName = getTokenDisplayName(item, data.name);
    renderStatBlock(data, rollerName);
  }

  function renderStatBlock(data, rollerName) {
    let html = `
      <h2>${data.name}</h2>
      <div class="meta">${data.meta}</div>
      <div style="font-size: 11px; margin-bottom: 2px;"><strong>Initiative:</strong> ${data.initiative || "N/A"}</div>
    `;

    if (data.speed) {
      html += `<div style="font-size: 11px; margin-bottom: 2px;"><strong>Speed:</strong> ${data.speed}</div>`;
    }

    if (data.saves) {
      html += `<div style="font-size: 11px; margin-bottom: 6px;"><strong>Saving Throws:</strong> ${data.saves}</div>`;
    }

    html += `<hr/>`;

    html += `<table class="abilities-table"><tr>`;
    for (const stat of Object.keys(data.abilities)) {
      html += `<th>${stat}</th>`;
    }
    html += `</tr><tr>`;
    for (const info of Object.values(data.abilities)) {
      html += `<td>${info.score}<br/>(<span class="rollable check-save" data-mod="${info.mod}">${info.mod}</span>)</td>`;
    }
    html += `</tr></table>`;

    if (data.sections) {
      data.sections.forEach(sec => {
        html += `<h4>${sec.title}</h4>`;
        sec.content.forEach(p => {
          html += `<p>${p}</p>`;
        });
      });
    }

    container.innerHTML = html;

    container.querySelectorAll(".rollable").forEach(el => {
      if (el.classList.contains("dc")) return;

      if (el.classList.contains("recharge")) {
        el.title = "Click: Roll 1d6 to Recharge";
      } else if (el.classList.contains("damage")) {
        el.title = "Click: Normal | Shift+Click: Critical Hit";
      } else {
        el.title = "Click: Normal | Shift+Click: Advantage | Ctrl+Click: Disadvantage";
      }

      el.onclick = (e) => {
        e.stopPropagation();
        const rechargeMin = el.getAttribute("data-recharge");
        const diceString = el.getAttribute("data-roll");
        const modString = el.getAttribute("data-mod");

        if (rechargeMin) {
          rollRecharge(parseInt(rechargeMin), rollerName, el.innerText);
        } else if (diceString) {
          rollDiceExpression(diceString, rollerName, e.shiftKey);
        } else if (modString) {
          rollModifier(modString, rollerName, e.shiftKey, e.ctrlKey || e.metaKey);
        }
      };
    });
  }

  function dispatchRollMessage(rawMessage) {
    const isPublic = localStorage.getItem("qs_public_rolls") === "true";
    const formattedMsg = isPublic ? `${rawMessage}` : `[Private DM] ${rawMessage}`;

    try {
      const history = JSON.parse(localStorage.getItem("qs_roll_history") || "[]");
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      history.unshift({ time: timestamp, text: formattedMsg, isPublic });
      if (history.length > 30) history.pop();
      localStorage.setItem("qs_roll_history", JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save roll history:", e);
    }

    if (isPublic) {
      OBR.notification.show(formattedMsg);
      OBR.broadcast.sendMessage(ROLL_CHANNEL, { message: formattedMsg });
    } else {
      OBR.notification.show(formattedMsg);
    }
  }

  // Recharge Roll (Rolls 1d6 and compares against target minimum)
  function rollRecharge(minTarget, creatureName, labelText) {
    const d6 = Math.floor(Math.random() * 6) + 1;
    const success = d6 >= minTarget;
    const status = success ? "Recharged!" : "Not Recharged";

    dispatchRollMessage(`${creatureName} (${labelText}): d6 [${d6}] → ${status}`);
  }

  function rollDiceExpression(expr, creatureName, isCrit) {
    const cleanExpr = expr.replace(/\s+/g, '');
    const match = cleanExpr.match(/^(\d+)d(\d+)([\+\-]\d+)?$/i);
    
    if (!match) {
      dispatchRollMessage(`${creatureName} rolls ${expr}`);
      return;
    }

    const baseCount = parseInt(match[1]);
    const count = isCrit ? baseCount * 2 : baseCount;
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;

    let total = 0;
    let rolls = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      total += r;
    }
    total += bonus;

    const critLabel = isCrit ? "CRIT! " : "";
    const displayExpr = isCrit ? `${count}d${sides}${bonus ? (bonus > 0 ? `+${bonus}` : bonus) : ''}` : expr;
    const bonusText = bonus !== 0 ? ` ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}` : '';

    dispatchRollMessage(`${critLabel}${creatureName} damage (${displayExpr}): [${rolls.join(", ")}]${bonusText} = Total: ${total}`);
  }

  function rollModifier(modStr, creatureName, isAdv, isDis) {
    const mod = parseInt(modStr);
    const bonusText = mod !== 0 ? ` ${mod > 0 ? '+' : '-'} ${Math.abs(mod)}` : '';

    if ((isAdv && isDis) || (!isAdv && !isDis)) {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const total = d20 + mod;
      dispatchRollMessage(`${creatureName} Roll (${modStr}): d20 [${d20}]${bonusText} = Total: ${total}`);
      return;
    }

    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    const chosen = isAdv ? Math.max(r1, r2) : Math.min(r1, r2);
    const total = chosen + mod;
    const tag = isAdv ? "ADV" : "DIS";

    dispatchRollMessage(`[${tag}] ${creatureName} Roll (${modStr}): d20 [${r1}, ${r2}] → ${chosen}${bonusText} = Total: ${total}`);
  }
});