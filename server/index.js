"use strict";

const { createApp } = require("./app");

const PORT = Number(process.env.PORT || 3001);

function start() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start };
