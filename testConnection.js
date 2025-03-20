const axios = require("axios");

axios
  .get("http://127.0.0.1:11434/api/tags")
  .then((res) => console.log("Success:", res.data))
  .catch((err) => console.error("Error:", err.message));
