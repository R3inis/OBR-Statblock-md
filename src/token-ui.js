import OBR from "@owlbear-rodeo/sdk";
import { parseStatBlock } from "./parser.js";

const STATBLOCK_KEY = "com.quick-statblock/data";

OBR.onReady(() => {
  const fileInput = document.getElementById("mdFile");
  const statusDiv = document.getElementById("status");
  
  // Grab the exact token ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const tokenId = urlParams.get("id");

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!tokenId) {
      statusDiv.innerText = "Error: No token ID found!";
      return;
    }

    statusDiv.innerText = "Reading file...";

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const markdownText = e.target.result;
        const parsedData = parseStatBlock(markdownText);

        // Save directly to the targeted token
        await OBR.scene.items.updateItems([tokenId], (items) => {
          for (let item of items) {
            if (!item.metadata) item.metadata = {};
            item.metadata[STATBLOCK_KEY] = parsedData;
          }
        });

        statusDiv.innerText = `Successfully linked!`;
        OBR.notification.show(`Assigned stat block to token!`);
        setTimeout(() => OBR.popover.close("com.quick-statblock/ui-assign"), 1500);

      } catch (err) {
        console.error(err);
        statusDiv.innerText = "Error parsing file.";
      }
    };

    reader.readAsText(file);
  });
});