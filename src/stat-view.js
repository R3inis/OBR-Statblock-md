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

  async function updateView(selection) {
    if (!selection || selection.length === 0) {
      container.innerHTML = "Select a token to view its stat block.";
      return;
    }

    const items = await OBR.scene.items.getItems(selection);
    const item = items[0];

    if (!item || !item.metadata || !item.metadata[STATBLOCK_KEY]) {
      container.innerHTML = `<div><strong>${item ? item.name || "Token" : "Selection"}</strong> has no stat block assigned.</div><div style="font-size:11px; color:#9ca3af; margin-top:4px;">Right-click the token and choose 'Assign Stat Block'.</div>`;
      return;
    }

    const data = item.metadata[STATBLOCK_KEY];
    renderStatBlock(data);
  }

  function renderStatBlock(data) {
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

    // Attach click listeners with Shift/Ctrl modifier detection
    container.querySelectorAll(".rollable").forEach(el => {
      if (el.classList.contains("dc")) return;

      // Add helpful hover tooltips
      if (el.classList.contains("damage")) {
        el.title = "Click: Normal | Shift+Click: Critical Hit";
      } else {
        el.title = "Click: Normal | Shift+Click: Advantage | Ctrl+Click: Disadvantage";
      }

      el.onclick = (e) => {
        e.stopPropagation();
        const diceString = el.getAttribute("data-roll");
        const modString = el.getAttribute("data-mod");

        if (diceString) {
          rollDiceExpression(diceString, data.name, e.shiftKey);
        } else if (modString) {
          rollModifier(modString, data.name, e.shiftKey, e.ctrlKey || e.metaKey);
        }
      };
    });
  }

  // Handles broadcasting public rolls vs showing private DM notifications
  function dispatchRollMessage(rawMessage) {
    const isPublic = localStorage.getItem("qs_public_rolls") === "true";

    if (isPublic) {
      const publicMsg = `🎲 ${rawMessage}`;
      OBR.notification.show(publicMsg);
      OBR.broadcast.sendMessage(ROLL_CHANNEL, { message: publicMsg });
    } else {
      OBR.notification.show(`[Private DM] ${rawMessage}`);
    }
  }

  // Damage Rolls (Supports Shift+Click for Critical Hits)
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

    const critLabel = isCrit ? "Critical hit! " : "";
    const displayExpr = isCrit ? `${count}d${sides}${bonus ? (bonus > 0 ? `+${bonus}` : bonus) : ''}` : expr;
    const bonusText = bonus !== 0 ? ` ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}` : '';

    dispatchRollMessage(`${critLabel}${creatureName} damage (${displayExpr}): [${rolls.join(", ")}]${bonusText} = Total: ${total}`);
  }

  // Attack / Check / Save Rolls (Supports Shift+Click Advantage & Ctrl+Click Disadvantage)
  function rollModifier(modStr, creatureName, isAdv, isDis) {
    const mod = parseInt(modStr);
    const bonusText = mod !== 0 ? ` ${mod > 0 ? '+' : '-'} ${Math.abs(mod)}` : '';

    // If both are held, they cancel out to a normal roll per 5e rules
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