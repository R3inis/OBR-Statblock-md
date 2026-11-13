import OBR from "@owlbear-rodeo/sdk";

OBR.onReady(() => {
  // 1. Assign Stat Block Context Menu
  OBR.contextMenu.create({
    id: "com.quick-statblock/menu-assign",
    icons: [{ icon: "/icon.svg", label: "Assign Stat Block", filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }] } }],
    onClick: (context) => {
      const tokenId = context.items[0].id;
      OBR.popover.open({
        id: "com.quick-statblock/ui-assign",
        url: `/token-ui.html?id=${tokenId}`,
        height: 150, width: 280,
        anchorElementId: tokenId
      });
    }
  });

  // 2. View Stat Block Context Menu
  OBR.contextMenu.create({
    id: "com.quick-statblock/menu-view",
    icons: [{ icon: "/icon.svg", label: "View Stat Block", filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }] } }],
    onClick: (context) => {
      const tokenId = context.items[0].id;
      // Using a Modal instead of a Popover keeps it detached and centered on screen
      OBR.modal.open({
        id: "com.quick-statblock/ui-view",
        url: `/stat-view.html?id=${tokenId}`,
        height: 550, width: 380
      });
    }
  });
});