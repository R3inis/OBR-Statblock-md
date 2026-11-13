import OBR from "@owlbear-rodeo/sdk";

const STATBLOCK_KEY = "com.quick-statblock/data";

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

    // Render Speed if it exists
    if (data.speed) {
      html += `<div style="font-size: 11px; margin-bottom: 2px;"><strong>Speed:</strong> ${data.speed}</div>`;
    }

    // Render Saving Throws if they exist
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

      el.onclick = (e) => {
        e.stopPropagation();
        const diceString = el.getAttribute("data-roll");
        const modString = el.getAttribute("data-mod");

        if (diceString) {
          rollDiceExpression(diceString, data.name);
        } else if (modString) {
          rollModifier(modString, data.name);
        }
      };
    });
  }

  function rollDiceExpression(expr, creatureName) {
    const cleanExpr = expr.replace(/\s+/g, '');
    const match = cleanExpr.match(/^(\d+)d(\d+)([\+\-]\d+)?$/i);
    
    if (!match) {
      OBR.notification.show(`🤫 [Private DM] ${creatureName} rolls ${expr}`);
      return;
    }

    const count = parseInt(match[1]);
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

    OBR.notification.show(` ${creatureName} rolls ${expr}: [${rolls.join(", ")}] ${bonus >= 0 ? '+' : ''} ${Math.abs(bonus)} = Total: ${total}`);
  }

  function rollModifier(modStr, creatureName) {
    const mod = parseInt(modStr);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;

    OBR.notification.show(`${creatureName} Rolls (${modStr}): d20 [${d20}] ${mod >= 0 ? '+' : ''} ${Math.abs(mod)} = Total: ${total}`);
  }
});