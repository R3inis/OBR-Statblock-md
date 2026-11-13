export function parseStatBlock(markdownText) {
  const lines = markdownText.split("\n");
  
  const statBlock = {
    name: "",
    meta: "",
    initiative: "",
    speed: "", // Added speed
    saves: "",
    abilities: {
      STR: { score: 0, mod: "+0" }, DEX: { score: 0, mod: "+0" },
      CON: { score: 0, mod: "+0" }, INT: { score: 0, mod: "+0" },
      WIS: { score: 0, mod: "+0" }, CHA: { score: 0, mod: "+0" }
    },
    sections: [] 
  };

  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim().replace(/^>\s*/, "");
    if (!line) continue;

    // 1. Name
    if (line.startsWith("## ")) {
      statBlock.name = line.replace("## ", "").trim();
      continue;
    }
    
    // 2. Meta
    if (!currentSection && line.startsWith("*") && line.endsWith("*") && !line.includes("**")) {
      statBlock.meta = line.replace(/\*/g, "").trim();
      continue;
    }

    // 3. Core Stats (Initiative, Speed, Saves)
    if (line.includes("**Initiative**")) {
      statBlock.initiative = formatRollableElements(line.replace(/.*?Initiative\*\*?:?\s*/, "").trim());
      continue;
    }
    if (line.includes("**Speed**")) {
      statBlock.speed = line.replace(/.*?\*\*Speed\*\*?:?\s*/, "").trim();
      continue;
    }
    if (line.includes("**Saving Throws**") || line.includes("**Saves**")) {
      statBlock.saves = formatRollableElements(line.replace(/.*?\*\*(?:Saving Throws|Saves)\*\*?:?\s*/, "").trim());
      continue;
    }

    // 4. Ability Scores table
    if (line.startsWith("|") && line.includes("(") && !line.includes("---")) {
      const parts = line.split("|").filter(p => p.trim() !== "");
      const keys = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
      parts.forEach((part, index) => {
        if (keys[index]) {
          const match = part.trim().match(/^(\d+)\s*\(([^)]+)\)/);
          if (match) {
            statBlock.abilities[keys[index]] = { score: parseInt(match[1]), mod: match[2] };
          }
        }
      });
      continue;
    }

    // 5. Sections
    if (line.startsWith("### ")) {
      if (currentSection) statBlock.sections.push(currentSection);
      currentSection = { title: line.replace("### ", "").trim(), content: [] };
      continue;
    }

    // 6. Section Content
    if (currentSection) {
      if (line === "___" || line === "---" || line.includes("|:---:|")) continue;
      let cleanLine = formatRollableElements(line);
      currentSection.content.push(cleanLine);
    }
  }

  if (currentSection) statBlock.sections.push(currentSection);
  return statBlock;
}

function formatRollableElements(text) {
  let tokens = [];
  let t = 0;

  text = text.replace(/\b(\d+d\d+(?:\s*[\+\-]\s*\d+)?)\b/gi, (match) => {
    let token = `@@DMG${t++}@@`;
    tokens.push({ token, html: `<span class="rollable damage" data-roll="${match.replace(/\s+/g, '')}">${match}</span>` });
    return token;
  });

  text = text.replace(/DC\s+(\d+)/gi, (match, p1) => {
    let token = `@@DC${t++}@@`;
    tokens.push({ token, html: `<span class="rollable dc" data-dc="${p1}">DC ${p1}</span>` });
    return token;
  });

  text = text.replace(/(^|\s|\(|>|\*|\,)([+-]\d+)\b/g, (match, prefix, mod) => {
    let token = `@@MOD${t++}@@`;
    tokens.push({ token, html: `${prefix}<span class="rollable check-save" data-mod="${mod}">${mod}</span>` });
    return token;
  });

  for (let tokenObj of tokens) {
    text = text.replace(tokenObj.token, tokenObj.html);
  }

  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return text;
}